import datetime
from datetime import date
import io
import pandas as pd
from sqlalchemy import func
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any, Set
from app import models, schemas
from app.core.logging_config import logger
from app.utils import FinanceModuleError, ValidationError, ResourceNotFoundError

class FinanceService:
    @staticmethod
    def record_payment(
        db: Session,
        payment_in: schemas.PatientPaymentCreate,
        user_id: int,
        recalculate: bool = True
    ) -> models.PatientPayment:
        """
        Atomically records a patient payment with nested identifiers and services.
        """
        # Security: Prevent negative amounts
        if payment_in.total_amount < 0:
            raise ValidationError("Total amount cannot be negative")
        
        for srv in payment_in.services:
            if srv.amount < 0:
                raise ValidationError(f"Service amount for ID {srv.service_id} cannot be negative")

        logger.info(f"Finance: Recording payment for {payment_in.patient_name} by user {user_id}")

        # 1. Create header
        db_payment = models.PatientPayment(
            patient_name=payment_in.patient_name.strip(),
            payment_date=payment_in.payment_date,
            total_amount=payment_in.total_amount,
            gst_amount=payment_in.gst_amount,
            notes=payment_in.notes.strip() if payment_in.notes else None,
            free_flag=payment_in.free_flag,
            token_no=payment_in.token_no,
            created_by=user_id,
            modified_by=user_id,
        )
        db.add(db_payment)
        db.flush()

        # 2. Identifiers
        for ident_in in payment_in.identifiers:
            db_ident = models.PatientPaymentIdentifier(
                patient_payment_id=db_payment.id,
                identifier_id=ident_in.identifier_id,
                id_value=ident_in.id_value.strip(),
            )
            db.add(db_ident)

        # 3. Services
        for srv_in in payment_in.services:
            db_srv = models.PatientPaymentService(
                patient_payment_id=db_payment.id,
                service_id=srv_in.service_id,
                amount=srv_in.amount
            )
            db.add(db_srv)

        # 4. Payments
        for pay_val_in in payment_in.payments:
            db_val = models.PatientPaymentValue(
                patient_payment_id=db_payment.id,
                payment_mode_id=pay_val_in.payment_mode_id,
                value=pay_val_in.value,
                notes=pay_val_in.notes.strip() if pay_val_in.notes else None,
                modified_by=user_id,
            )
            db.add(db_val)
        
        # 4.5. Calculate Status
        total_paid = sum(p.value for p in payment_in.payments)
        db_payment.payment_status = FinanceService._determine_payment_status(payment_in.total_amount, total_paid, payment_in.free_flag)

        # 5. Trigger Summary Recalculation
        if recalculate:
            db.flush()
            FinanceService.recalculate_daily_summary(db, payment_in.payment_date)

        return db_payment

    @staticmethod
    def update_payment(
        db: Session,
        payment_id: int,
        payment_in: schemas.PatientPaymentUpdate,
        user_id: int
    ) -> models.PatientPayment:
        """
        Updates an existing patient payment and its nested relationships.
        Recalculates status and daily summaries.
        """
        logger.info(f"Finance: Updating payment record {payment_id}")
        db_obj = db.query(models.PatientPayment).filter(
            models.PatientPayment.id == payment_id,
            models.PatientPayment.is_deleted == False
        ).first()
        if not db_obj:
             raise ResourceNotFoundError("Payment record", payment_id)

        # 1. Update basic fields manually to avoid overwriting relationships or audit fields unintentionally
        db_obj.patient_name = payment_in.patient_name.strip()
        db_obj.payment_date = payment_in.payment_date
        db_obj.total_amount = payment_in.total_amount
        db_obj.gst_amount = payment_in.gst_amount
        db_obj.notes = payment_in.notes.strip() if payment_in.notes else None
        db_obj.free_flag = payment_in.free_flag
        db_obj.token_no = payment_in.token_no
        db_obj.modified_by = user_id
        db_obj.modified_date = datetime.datetime.now(datetime.timezone.utc)

        # 2. Force-rebuild nested relationships
        # We clear the lists and flush to ensure old records are deleted by 'delete-orphan'
        db_obj.identifiers = []
        db_obj.services = []
        db_obj.payments = []
        db.flush()

        # Re-add Identifiers
        for ident_in in payment_in.identifiers:
            db_obj.identifiers.append(models.PatientPaymentIdentifier(
                identifier_id=ident_in.identifier_id,
                id_value=ident_in.id_value.strip(),
            ))

        # Re-add Services
        for srv_in in payment_in.services:
            db_obj.services.append(models.PatientPaymentService(
                service_id=srv_in.service_id,
                amount=srv_in.amount
            ))

        # Re-add Payments
        total_paid_calc = 0.0
        for pay_val_in in payment_in.payments:
            total_paid_calc += pay_val_in.value
            db_obj.payments.append(models.PatientPaymentValue(
                payment_mode_id=pay_val_in.payment_mode_id,
                value=pay_val_in.value,
                notes=pay_val_in.notes.strip() if pay_val_in.notes else None,
                modified_by=user_id,
            ))

        # 3. Recalculate Status based on ACTUAL data being saved
        db_obj.payment_status = FinanceService._determine_payment_status(
            db_obj.total_amount, 
            total_paid_calc, 
            db_obj.free_flag
        )

        db.flush()
        FinanceService.recalculate_daily_summary(db, db_obj.payment_date)
        
        return db_obj

    @staticmethod
    def _determine_payment_status(total_bill: float, total_paid: float, is_free: bool) -> str:
        if is_free:
            return "PAID"
        if total_paid >= total_bill:
            return "PAID"
        if total_paid > 0:
            return "PARTIAL"
        return "DUE"

    @staticmethod
    def process_bulk_upload(db: Session, df: Any, user_id: int) -> Dict[str, Any]:
        """
        Processes a columnar dataframe of payment records.
        """
        # 1. Pre-fetch master data and normalize headers
        masters = FinanceService._load_bulk_masters(db)
        df.columns = [c.strip() for c in df.columns]
        norm_cols = [c.lower() for c in df.columns]

        # Security check: Ensure basic required columns exist
        required_cols = ["date", "patient name"]
        for rc in required_cols:
            if rc not in norm_cols:
                logger.warning(f"Bulk Upload: Missing required column {rc}")
                raise ValidationError(f"Missing required bulk column: {rc.title()}")

        success_count = 0
        errors = []
        processed_dates: Set[date] = set()

        for idx, row in df.iterrows():
            try:
                payment_in = FinanceService._map_row_to_schema(row, norm_cols, masters)
                
                # Validation: Services vs Payments (OWASP A04: Insecure Design)
                total_paid = sum(p.value for p in payment_in.payments)
                if abs(total_paid - payment_in.total_amount) > 0.01 and total_paid > 0:
                    raise ValidationError(f"Balance mismatch: Bill (₹{payment_in.total_amount}) vs Paid (₹{total_paid})")

                FinanceService.record_payment(db, payment_in, user_id, recalculate=False)
                processed_dates.add(payment_in.payment_date)
                success_count += 1

            except Exception as e:
                import traceback
                logger.error(f"Bulk row {idx+2} failed: {str(e)}\n{traceback.format_exc()}")
                errors.append({
                    "row": idx + 2,
                    "patient_name": str(row.get("Patient Name", "Unknown")),
                    "error_reason": str(e)
                })
        
        # Final Recalculations
        for d in processed_dates:
            FinanceService.recalculate_daily_summary(db, d)

        return {"success_count": success_count, "errors": errors}

    @staticmethod
    def _load_bulk_masters(db: Session) -> Dict[str, Dict[str, int]]:
        active_idents = db.query(models.PatientIdentifier).all()
        active_services = db.query(models.PatientService).all()
        active_modes = db.query(models.PaymentModeMaster).all()
        
        return {
            "idents": {i.id_name.lower().strip(): i.id for i in active_idents},
            "services": {s.service_name.lower().strip(): s.id for s in active_services},
            "modes": {m.mode.lower().strip(): m.id for m in active_modes}
        }

    @staticmethod
    def _map_row_to_schema(row: Any, norm_cols: List[str], masters: Dict[str, Any]) -> schemas.PatientPaymentCreate:
        p_name = row.get("Patient Name")
        p_date = row.get("Date")
        if not p_name or pd.isna(p_name):
            raise ValidationError("Patient Name is missing")
        if not p_date or pd.isna(p_date):
            raise ValidationError("Date is missing")

        # 1. Identifiers
        patient_idents = []
        ident_type = str(row.get("Identifier Type", "")).lower().strip()
        ident_val = str(row.get("ID Value", "")).strip()
        if ident_type in masters["idents"] and ident_val:
            patient_idents.append({"identifier_id": masters["idents"][ident_type], "id_value": ident_val})

        # 2. Services
        patient_services = []
        for col_name, s_id in masters["services"].items():
            if col_name in norm_cols:
                val = row.iloc[norm_cols.index(col_name)]
                amt = float(val) if not pd.isna(val) else 0
                if amt > 0:
                    patient_services.append({"service_id": s_id, "amount": amt})

        # 3. Payments
        patient_payments = []
        for mode_name, m_id in masters["modes"].items():
            if mode_name in norm_cols:
                val = row.iloc[norm_cols.index(mode_name)]
                val_amt = float(val) if not pd.isna(val) else 0
                if val_amt > 0:
                    patient_payments.append({"payment_mode_id": m_id, "value": val_amt})

        total_amount = sum(s["amount"] for s in patient_services)
        p_token = row.get("Token No")
        
        return schemas.PatientPaymentCreate(
            patient_name=str(p_name),
            payment_date=pd.to_datetime(p_date, dayfirst=True).date(),
            total_amount=total_amount,
            gst_amount=float(row.get("GST", 0)) if not pd.isna(row.get("GST")) else 0,
            token_no=int(p_token) if p_token and not pd.isna(p_token) else None,
            notes=str(row.get("Notes", "")) if not pd.isna(row.get("Notes")) else None,
            free_flag=(total_amount == 0),
            identifiers=patient_idents,
            services=patient_services,
            payments=patient_payments
        )

    @staticmethod
    def get_dashboard_stats(db: Session, start_date: date = None, end_date: date = None) -> Dict[str, Any]:
        """
        Aggregates financial data for the dashboard.
        """
        today = date.today()
        first_day_of_month = today.replace(day=1)
        
        # Helper for basic period stats
        kpi_stats = FinanceService._get_kpi_metrics(db, today)
        
        range_start = start_date or first_day_of_month
        range_end = end_date or today
        
        return {
            **kpi_stats,
            "service_distribution": FinanceService._get_service_distribution(db, range_start, range_end),
            "payment_mode_distribution": FinanceService._get_payment_mode_distribution(db, range_start, range_end),
            "recent_trends": FinanceService._get_recent_trends(db, range_start, range_end)
        }

    @staticmethod
    def _get_kpi_metrics(db: Session, today: date) -> Dict[str, Any]:
        yesterday = today - datetime.timedelta(days=1)
        first_of_month = today.replace(day=1)
        
        def get_day_total(d: date):
            return db.query(func.sum(models.PatientPayment.total_amount))\
                .filter(
                    models.PatientPayment.payment_date == d, 
                    models.PatientPayment.is_deleted == False,
                    models.PatientPayment.free_flag == False
                ).scalar() or 0.0

        def get_day_count(d: date):
            return db.query(models.PatientPayment)\
                .filter(models.PatientPayment.payment_date == d, models.PatientPayment.is_deleted == False).count()

        total_today = get_day_total(today)
        total_yesterday = get_day_total(yesterday)
        count_today = get_day_count(today)
        count_yesterday = get_day_count(yesterday)

        # Month-to-Date
        total_month = db.query(func.sum(models.PatientPayment.total_amount))\
            .filter(
                models.PatientPayment.payment_date >= first_of_month, 
                models.PatientPayment.is_deleted == False,
                models.PatientPayment.free_flag == False
            ).scalar() or 0.0
            
        # Prev Month MTD
        last_month_start = (first_of_month - datetime.timedelta(days=1)).replace(day=1)
        days_passed = (today - first_of_month).days
        comp_prev_month_end = min(last_month_start + datetime.timedelta(days=days_passed), first_of_month - datetime.timedelta(days=1))
        
        total_prev_mtd = db.query(func.sum(models.PatientPayment.total_amount))\
            .filter(
                models.PatientPayment.payment_date >= last_month_start,
                models.PatientPayment.payment_date <= comp_prev_month_end,
                models.PatientPayment.is_deleted == False,
                models.PatientPayment.free_flag == False
            ).scalar() or 0.0

        return {
            "total_income_today": float(total_today),
            "total_income_yesterday": float(total_yesterday),
            "total_income_month": float(total_month),
            "total_income_prev_month_mtd": float(total_prev_mtd),
            "patient_count_today": count_today,
            "patient_count_yesterday": count_yesterday,
            "avg_ticket_size": float(total_today / count_today) if count_today > 0 else 0.0,
            "avg_ticket_yesterday": float(total_yesterday / count_yesterday) if count_yesterday > 0 else 0.0,
        }

    @staticmethod
    def _get_service_distribution(db: Session, start: date, end: date) -> List[Dict[str, Any]]:
        data = db.query(
            models.PatientService.service_name,
            func.sum(models.PatientPaymentService.amount).label("total"),
            func.count(models.PatientPaymentService.id).label("count")
        ).join(models.PatientPaymentService).join(models.PatientPayment)\
         .filter(
             models.PatientPayment.payment_date >= start, 
             models.PatientPayment.payment_date <= end, 
             models.PatientPayment.is_deleted == False,
             models.PatientPayment.free_flag == False
         )\
         .group_by(models.PatientService.service_name).all()
        
        return [{"service_name": n, "total_amount": float(t), "count": c} for n, t, c in data]

    @staticmethod
    def _get_payment_mode_distribution(db: Session, start: date, end: date) -> List[Dict[str, Any]]:
        data = db.query(
            models.PaymentModeMaster.mode,
            func.sum(models.PatientPaymentValue.value).label("total"),
            func.count(models.PatientPaymentValue.id).label("count")
        ).join(models.PatientPaymentValue).join(models.PatientPayment)\
         .filter(models.PatientPayment.payment_date >= start, models.PatientPayment.payment_date <= end, models.PatientPayment.is_deleted == False)\
         .group_by(models.PaymentModeMaster.mode).all()
        
        return [{"mode_name": n, "total_value": float(t), "count": c} for n, t, c in data]

    @staticmethod
    def _get_recent_trends(db: Session, start: date, end: date) -> List[Dict[str, Any]]:
        # Trend is usually 7 days unless override provided
        trend_start = start if start > (end - datetime.timedelta(days=6)) else (end - datetime.timedelta(days=6))
        data = db.query(
            models.PatientPayment.payment_date,
            func.sum(models.PatientPayment.total_amount).label("total")
        ).filter(
            models.PatientPayment.payment_date >= trend_start, 
            models.PatientPayment.payment_date <= end, 
            models.PatientPayment.is_deleted == False,
            models.PatientPayment.free_flag == False
        )\
         .group_by(models.PatientPayment.payment_date).order_by(models.PatientPayment.payment_date).all()
        
        return [{"date": d.strftime("%Y-%m-%d"), "amount": float(t)} for d, t in data]

    @staticmethod
    def recalculate_daily_summary(db: Session, summary_date: date) -> models.DailyFinanceSummary:
        """
        Recalculates and updates the daily summary record for a specific date.
        """
        logger.info(f"Summary: Recalculating totals for {summary_date}")
        
        try:
            records = db.query(models.PatientPayment).filter(
                models.PatientPayment.payment_date == summary_date,
                models.PatientPayment.is_deleted == False
            ).all()
            
            p_count = len(records)
            revenue = sum(r.total_amount for r in records if not r.free_flag)
            collected = 0.0
            gst_liability = 0.0
            s_map = {}
            p_map = {}

            for r in records:
                # If free, services don't count towards revenue breakdown
                if not r.free_flag:
                    for s_link in r.services:
                        s_name = s_link.service.service_name
                        s_amt = s_link.amount
                        s_map[s_name] = s_map.get(s_name, 0.0) + s_amt
                        if s_name.lower() in ["pharmacy", "medicine"]:
                            gst_liability += (s_amt * 0.05)
                else:
                    # For free patients, we still track that they received the service (value 0)
                    # so that the breakdown is complete but doesn't add to revenue
                    for s_link in r.services:
                        s_name = s_link.service.service_name
                        if s_name not in s_map:
                            s_map[s_name] = 0.0
                
                for p_link in r.payments:
                    collected += p_link.value
                    p_mode = p_link.payment_mode.mode
                    p_map[p_mode] = p_map.get(p_mode, 0.0) + p_link.value

            # --- EXPENSE AGGREGATION ---
            expense_records = db.query(models.Expense).filter(
                models.Expense.expense_date == summary_date,
                models.Expense.is_deleted == False
            ).all()

            total_exp = 0.0
            total_exp_gst = 0.0
            e_map = {}

            for exp in expense_records:
                # Use total_amount as the debit value
                total_exp += float(exp.total_amount)
                total_exp_gst += float(exp.gst_amount or 0.0)
                e_type = exp.expense_type.name
                e_map[e_type] = e_map.get(e_type, 0.0) + float(exp.total_amount)

            db_summary = db.query(models.DailyFinanceSummary).filter(models.DailyFinanceSummary.summary_date == summary_date).first()
            if not db_summary:
                db_summary = models.DailyFinanceSummary(summary_date=summary_date)
                db.add(db_summary)

            db_summary.patient_count = p_count
            db_summary.total_revenue = revenue
            db_summary.total_collected = collected
            db_summary.total_gst = gst_liability
            
            # Update Expense Fields
            db_summary.total_expenses = total_exp
            db_summary.total_expense_gst = total_exp_gst
            db_summary.expense_breakdown = e_map

            db_summary.service_breakdown = s_map
            db_summary.payment_breakdown = p_map
            db_summary.last_updated = datetime.datetime.now(datetime.timezone.utc)

            # Ensure changes are flushed but commit is left to the caller/transaction manager
            db.flush()
            logger.info(f"Summary: Successfully updated {summary_date}. Total Revenue: ₹{revenue}, Total Expenses: ₹{total_exp}")
            return db_summary

        except Exception as e:
            logger.error(f"Summary: Failed to update {summary_date}: {str(e)}", exc_info=True)
            raise FinanceModuleError(f"Failed to recalculate daily summary: {str(e)}")

    @staticmethod
    def soft_delete_payment(db: Session, payment_id: int, user_id: int) -> bool:
        """
        Performs a soft delete on a payment record.
        """
        logger.info(f"Finance: Admin {user_id} soft-deleting payment {payment_id}")
        
        try:
            db_obj = db.query(models.PatientPayment).filter(
                models.PatientPayment.id == payment_id,
                models.PatientPayment.is_deleted == False
            ).first()
            
            if not db_obj:
                return False

            p_date = db_obj.payment_date
            db_obj.is_deleted = True
            db_obj.deleted_by = user_id
            db_obj.deleted_at = datetime.datetime.now(datetime.timezone.utc)
            
            db.commit()
            FinanceService.recalculate_daily_summary(db, p_date)
            return True

        except Exception as e:
            db.rollback()
            logger.error(f"Finance: Failed to soft-delete payment {payment_id}: {str(e)}")
            raise FinanceModuleError(f"Failed to soft-delete payment: {str(e)}")
    @staticmethod
    def export_ledger_excel(ledger_data: schemas.LedgerReportSchema) -> io.BytesIO:
        """
        Exports the financial ledger to a professionally formatted Excel file.
        """
        output = io.BytesIO()
        
        # Prepare data for DataFrame
        rows = []
        # Add Opening Balance row
        rows.append({
            "Date": ledger_data.start_date,
            "Details": "Opening Balance (B/F)",
            "Credit": 0.0,
            "Debit": 0.0,
            "Credit GST": 0.0,
            "Debit GST": 0.0,
            "Balance": ledger_data.opening_balance
        })
        
        for entry in ledger_data.entries:
            rows.append({
                "Date": entry.date,
                "Details": entry.details,
                "Credit": entry.credit,
                "Debit": entry.debit,
                "Credit GST": entry.credit_gst,
                "Debit GST": entry.debit_gst,
                "Balance": entry.balance
            })
            
        df = pd.DataFrame(rows)
        # Ensure Date is recognized as datetime for Excel formatting
        df['Date'] = pd.to_datetime(df['Date'])
        
        with pd.ExcelWriter(output, engine='xlsxwriter', date_format='dd-mm-yyyy', datetime_format='dd-mm-yyyy') as writer:
            df.to_excel(writer, sheet_name='Financial Ledger', index=False)
            workbook = writer.book
            worksheet = writer.sheets['Financial Ledger']
            
            # Formatting
            header_format = workbook.add_format({
                'bold': True, 'bg_color': '#1E293B', 'font_color': 'white', 'border': 1
            })
            currency_format = workbook.add_format({'num_format': '₹#,##0.00'})
            date_format = workbook.add_format({'num_format': 'dd-mm-yyyy'})
            
            # Write headers
            for col_num, value in enumerate(df.columns.values):
                worksheet.write(0, col_num, value, header_format)
            
            # Column widths
            worksheet.set_column('A:A', 12, date_format)
            worksheet.set_column('B:B', 30)
            worksheet.set_column('C:G', 15, currency_format)
            
        output.seek(0)
        return output
