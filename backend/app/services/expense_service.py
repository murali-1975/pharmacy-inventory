import datetime
import io
import pandas as pd
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from fastapi import HTTPException, status

from app import models, schemas, utils
from app.core.logging_config import logger
from app.utils import ValidationError, FinanceModuleError

class ExpenseService:
    @staticmethod
    def record_expense(
        db: Session, 
        exp_in: schemas.ExpenseCreate, 
        user_id: int,
        recalculate: bool = True
    ) -> models.Expense:
        """
        Atomically records an operational expense with optional split payments.
        Ensures mathematical consistency between total and payments.
        """
        # 1. Validation
        payment_sum = sum(p.amount for p in exp_in.payments) if exp_in.payments else 0.0
        if abs(payment_sum - exp_in.total_amount) > 0.01:
            raise ValidationError(
                f"Reconciliation Error: Total amount (₹{exp_in.total_amount}) "
                f"does not match sum of payments (₹{payment_sum})"
            )

        # 2. Persist Header
        db_expense = models.Expense(
            **exp_in.model_dump(exclude={"payments"}),
            created_by=user_id,
            modified_by=user_id
        )
        db.add(db_expense)
        db.flush()

        # 3. Persist Child Records
        for p_in in exp_in.payments:
            db_pm = models.ExpensePayment(
                **p_in.model_dump(),
                expense_id=db_expense.id
            )
            db.add(db_pm)
        
        db.flush()
        if recalculate:
            from app.services.finance_service import FinanceService
            FinanceService.recalculate_daily_summary(db, exp_in.expense_date)

        return db_expense

    @staticmethod
    def process_bulk_upload(db: Session, df: pd.DataFrame, user_id: int) -> Dict[str, Any]:
        """
        Processes a dataframe of expense records.
        Supports wide format: Category and Mode names as columns.
        """
        # 1. Normalize Headers
        df.columns = [c.strip() for c in df.columns]
        norm_cols = [c.lower() for c in df.columns]

        # 2. Pre-fetch Masters
        masters = ExpenseService._load_masters(db)
        
        required = ["date", "category", "details", "base amount", "total amount"]
        for r in required:
            if r not in norm_cols:
                raise ValidationError(f"Missing required bulk column: {r.title()}")

        success_count = 0
        errors = []

        for idx, row in df.iterrows():
            try:
                # Map row to ExpenseCreate schema
                exp_in = ExpenseService._map_row_to_schema(row, norm_cols, masters)
                
                # Atomically record
                ExpenseService.record_expense(db, exp_in, user_id)
                success_count += 1
                
            except Exception as e:
                logger.error(f"Bulk expense row {idx+2} failed: {str(e)}")
                errors.append({
                    "row": idx + 2,
                    "details": str(row.get("Details", "Unknown")),
                    "error_reason": str(e)
                })
        
        # Final Recalculations
        if success_count > 0:
            from app.services.finance_service import FinanceService
            # Extract unique dates and ensure they are date objects
            processed_dates = set()
            for d in df["Date"]:
                if pd.notna(d):
                    if isinstance(d, str):
                        try:
                            d_obj = pd.to_datetime(d, dayfirst=True).date()
                            processed_dates.add(d_obj)
                        except:
                            continue
                    else:
                        processed_dates.add(pd.to_datetime(d).date())
            
            for d in processed_dates:
                FinanceService.recalculate_daily_summary(db, d)

        return {"success_count": success_count, "errors": errors}

    @staticmethod
    def generate_template(db: Session) -> io.StringIO:
        """
        Generates a CSV template for bulk expense upload.
        Includes dynamic columns for all active payment modes.
        """
        modes = db.query(models.PaymentModeMaster).filter(models.PaymentModeMaster.is_active == True).all()
        categories = db.query(models.ExpenseType).filter(models.ExpenseType.is_active == True).all()
        
        headers = [
            "Date", "Category", "Details", "Reference", 
            "Base Amount", "GST Amount", "Total Amount", "Notes"
        ]
        # Add payment mode columns
        for m in modes:
            headers.append(m.mode)

        # Create sample row
        sample_category = categories[0].name if categories else "Utility"
        sample_mode = modes[0].mode if modes else "Cash"
        
        sample_row = {
            "Date": datetime.date.today().strftime("%Y-%m-%d"),
            "Category": sample_category,
            "Details": "Sample Electricity Bill",
            "Reference": "INV/2024/001",
            "Base Amount": 1000.0,
            "GST Amount": 180.0,
            "Total Amount": 1180.0,
            "Notes": "Paid for April 2024"
        }
        for m in modes:
            sample_row[m.mode] = 1180.0 if m.mode == sample_mode else 0.0

        df = pd.DataFrame([sample_row], columns=headers)
        stream = io.StringIO()
        df.to_csv(stream, index=False)
        return stream

    @staticmethod
    def record_expense_from_invoice_payment(
        db: Session,
        invoice: models.Invoice,
        payment: models.InvoicePayment,
        user_id: int,
        recalculate: bool = True
    ) -> Optional[models.Expense]:
        """
        Automatically records an operational expense from a purchase invoice payment.
        This is triggered when a payment is recorded against an invoice in the inventory module.
        """
        logger.info(f"Auto-Expense: Processing payment of {payment.paid_amount} for Invoice {invoice.reference_number}")

        # 1. Resolve Expense Type (Category)
        # Try to match SupplierType name to an ExpenseType
        expense_type_name = "Pharmacy Procurement"
        if invoice.supplier and invoice.supplier.type:
            expense_type_name = invoice.supplier.type.name

        db_type = db.query(models.ExpenseType).filter(models.ExpenseType.name == expense_type_name).first()
        if not db_type:
            logger.info(f"Auto-Expense: Creating missing expense type '{expense_type_name}'")
            db_type = models.ExpenseType(name=expense_type_name)
            db.add(db_type)
            db.flush()

        # 2. Resolve Payment Mode
        # Map enum value (e.g. 'Bank Transfer') to master ID
        mode_name = payment.payment_mode.value # Get string from enum
        db_mode = db.query(models.PaymentModeMaster).filter(models.PaymentModeMaster.mode == mode_name).first()
        if not db_mode:
            logger.info(f"Auto-Expense: Creating missing payment mode '{mode_name}'")
            db_mode = models.PaymentModeMaster(mode=mode_name)
            db.add(db_mode)
            db.flush()

        # 3. Check for existing Expense header for this invoice
        # We group all payments for one invoice under one Expense record
        db_expense = db.query(models.Expense).filter(
            models.Expense.reference_number == invoice.reference_number,
            models.Expense.is_deleted == False
        ).first()

        if not db_expense:
            logger.info(f"Auto-Expense: Creating new expense header for Invoice {invoice.reference_number}")
            db_expense = models.Expense(
                expense_date=payment.payment_date,
                expense_type_id=db_type.id,
                details=f"Procurement: {invoice.supplier.supplier_name}",
                reference_number=invoice.reference_number,
                amount=invoice.total_value, # Base Cost is now the Total Amount
                gst_amount=invoice.gst or 0, # GST is part of it
                total_amount=invoice.total_value,
                notes=f"Auto-generated from Invoice {invoice.reference_number}",
                created_by=user_id,
                modified_by=user_id
            )
            db.add(db_expense)
            db.flush()
        else:
            logger.info(f"Auto-Expense: Linking to existing expense ID {db_expense.id}")

        # 4. Create the Expense Payment entry
        # We record this specific payment event
        db_exp_pay = models.ExpensePayment(
            expense_id=db_expense.id,
            payment_mode_id=db_mode.id,
            amount=payment.paid_amount,
            notes=payment.payment_reference or f"Auto-link from {invoice.reference_number}"
        )
        db.add(db_exp_pay)
        db.flush()
        
        if recalculate:
            from app.services.finance_service import FinanceService
            FinanceService.recalculate_daily_summary(db, payment.payment_date)
            
        return db_expense

    @staticmethod
    def soft_delete_expense(db: Session, expense_id: int, user_id: int) -> bool:
        """
        Performs a soft delete and refreshes the daily summary.
        """
        logger.info(f"Expense: Admin {user_id} soft-deleting expense {expense_id}")
        db_obj = db.query(models.Expense).filter(
            models.Expense.id == expense_id,
            models.Expense.is_deleted == False
        ).first()
        
        if not db_obj:
            return False

        exp_date = db_obj.expense_date
        db_obj.is_deleted = True
        db_obj.deleted_by = user_id
        db_obj.deleted_at = datetime.datetime.now(datetime.timezone.utc)
        
        db.flush()
        from app.services.finance_service import FinanceService
        FinanceService.recalculate_daily_summary(db, exp_date)
        return True

    @staticmethod
    def update_expense(
        db: Session, 
        expense_id: int, 
        exp_in: schemas.ExpenseCreate, 
        user_id: int
    ) -> models.Expense:
        """
        Updates an expense and its payments, then refreshes summaries for both old and new dates.
        """
        # 1. Reconciliation Check
        payment_sum = sum(p.amount for p in exp_in.payments) if exp_in.payments else 0.0
        if abs(payment_sum - exp_in.total_amount) > 0.01:
            raise ValidationError(
                f"Reconciliation Error: Total amount (₹{exp_in.total_amount}) "
                f"does not match sum of payments (₹{payment_sum})"
            )

        db_expense = db.query(models.Expense).filter(
            models.Expense.id == expense_id,
            models.Expense.is_deleted == False
        ).first()
        
        if not db_expense:
            raise ValidationError("Expense record not found.")

        old_date = db_expense.expense_date
        new_date = exp_in.expense_date
        old_total = float(db_expense.total_amount)
        new_total = float(exp_in.total_amount)

        # Update fields
        for key, value in exp_in.model_dump(exclude={"payments"}).items():
            setattr(db_expense, key, value)
        
        db_expense.modified_by = user_id
        db_expense.modified_date = datetime.datetime.now(datetime.timezone.utc)

        # Replace payments
        db.query(models.ExpensePayment).filter(models.ExpensePayment.expense_id == expense_id).delete()
        for p_in in exp_in.payments:
            db.add(models.ExpensePayment(**p_in.model_dump(), expense_id=expense_id))

        db.flush()
        
        db.flush()
        
        # 3. Always recalculate summaries for both old and new dates 
        # (even if total didn't change, the breakdown or category might have)
        from app.services.finance_service import FinanceService
        FinanceService.recalculate_daily_summary(db, old_date)
        if new_date != old_date:
            FinanceService.recalculate_daily_summary(db, new_date)

        logger.info(f"Expense: Successfully updated expense ID {expense_id} for date {new_date}")
        return db_expense

    @staticmethod
    def _load_masters(db: Session) -> Dict[str, Any]:
        categories = db.query(models.ExpenseType).filter(models.ExpenseType.is_active == True).all()
        modes = db.query(models.PaymentModeMaster).filter(models.PaymentModeMaster.is_active == True).all()
        
        return {
            "categories": {c.name.lower().strip(): c.id for c in categories},
            "modes": {m.mode.lower().strip(): m.id for m in modes}
        }

    @staticmethod
    def _map_row_to_schema(row: pd.Series, norm_cols: List[str], masters: Dict[str, Any]) -> schemas.ExpenseCreate:
        # 1. Basic Fields
        cat_name = str(row.get("Category", "")).lower().strip()
        if cat_name not in masters["categories"]:
            raise ValidationError(f"Unknown expense category: '{row.get('Category')}'")
        
        # 2. Payments
        payments = []
        for mode_name, mode_id in masters["modes"].items():
            if mode_name in norm_cols:
                val = row.iloc[norm_cols.index(mode_name)]
                amt = float(val) if pd.notna(val) else 0.0
                if amt > 0:
                    payments.append(schemas.ExpensePaymentCreate(
                        payment_mode_id=mode_id,
                        amount=amt,
                        notes=f"Bulk imported via {mode_name}"
                    ))

        return schemas.ExpenseCreate(
            expense_date=pd.to_datetime(row.get("Date"), dayfirst=True).date(),
            expense_type_id=masters["categories"][cat_name],
            details=str(row.get("Details", "Bulk Import")),
            reference_number=str(row.get("Reference", "")) if pd.notna(row.get("Reference")) else None,
            amount=float(row.get("Base Amount", 0.0)),
            gst_amount=float(row.get("GST Amount", 0.0)) if pd.notna(row.get("GST Amount")) else 0.0,
            total_amount=float(row.get("Total Amount", 0.0)),
            notes=str(row.get("Notes", "")) if pd.notna(row.get("Notes")) else None,
            payments=payments
        )
