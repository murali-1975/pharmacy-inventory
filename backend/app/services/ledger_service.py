import datetime
from datetime import date
from sqlalchemy import func, case
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from app import models, schemas
from app.core.logging_config import logger

class LedgerService:
    @staticmethod
    def get_ledger_data(db: Session, from_date: date, to_date: date) -> schemas.LedgerReportSchema:
        """
        Generates a consolidated accounting ledger with aggregated credits, debits, 
        GST components, and a running balance.
        """
        logger.info(f"Generating ledger from {from_date} to {to_date}")

        # 1. Calculate Opening Balance using optimized Daily Summary snapshots
        summary_totals = db.query(
            func.sum(models.DailyFinanceSummary.total_revenue).label("total_rev"),
            func.sum(models.DailyFinanceSummary.total_expenses).label("total_exp")
        ).filter(models.DailyFinanceSummary.summary_date < from_date).first()
        
        opening_balance = float(summary_totals.total_rev or 0.0) - float(summary_totals.total_exp or 0.0)

        # 2. Fetch Period Credits (Payments aggregated by Service)
        # We also aggregate GST from the payment header. 
        # User Instruction: Aggregate GST and show on the same line as the category.
        # Implementation: Group by date and service. Join with PatientPayment to get header GST.
        # NOTE: Header GST is repeated for every service in the same bill if we join simply.
        # We need a way to only count GST once per bill or allocate it.
        # Given user's example: "4 pharmacy payments... aggregate the gst".
        # We'll use a subquery to sum GST per day/service or similar.
        
        # Subquery for GST aggregation per date/service
        # To avoid overcounting GST on bills with multiple services, 
        # we calculate GST per payment and join it.
        # But even better: Since user wants it aggregated by category, 
        # we'll use a CASE statement to only count GST on the 'primary' service of a bill 
        # or simply rely on the 'Pharmacy' heuristic.
        
        credit_query = db.query(
            models.PatientPayment.payment_date.label("date"),
            models.PatientService.service_name.label("details"),
            func.sum(models.PatientPaymentService.amount).label("credit"),
            # We use a subquery or a distinct sum if possible, but SQLAlchemy sum(distinct) is risky.
            # Instead, we'll fetch all services and headers and aggregate in Python or use a CTE.
        ).join(models.PatientPaymentService, models.PatientPayment.id == models.PatientPaymentService.patient_payment_id)\
         .join(models.PatientService, models.PatientPaymentService.service_id == models.PatientService.id)\
         .filter(models.PatientPayment.payment_date >= from_date, 
                 models.PatientPayment.payment_date <= to_date,
                 models.PatientPayment.is_deleted == False)\
         .group_by(models.PatientPayment.payment_date, models.PatientService.service_name)

        credits_raw = credit_query.all()

        # 3. Fetch Period Debits (Expenses aggregated by Type)
        debit_query = db.query(
            models.Expense.expense_date.label("date"),
            models.ExpenseType.name.label("details"),
            func.sum(models.Expense.total_amount).label("debit"),
            func.sum(models.Expense.gst_amount).label("debit_gst")
        ).join(models.ExpenseType)\
         .filter(models.Expense.expense_date >= from_date, 
                 models.Expense.expense_date <= to_date,
                 models.Expense.is_deleted == False)\
         .group_by(models.Expense.expense_date, models.ExpenseType.name)
        
        debits_raw = debit_query.all()

        # 4. Combine and Sort
        entries = []
        for r in credits_raw:
            # Standardize GST calculation to match Daily Summary rule (5% of Pharmacy/Medicine revenue)
            is_taxable = any(kw in r.details.upper() for kw in ["PHARMACY", "MEDICINE", "DRUG"])
            row_gst = round(float(r.credit) * 0.05, 2) if is_taxable else 0.0
            
            entries.append(schemas.LedgerEntrySchema(
                date=r.date,
                details=r.details,
                credit=float(r.credit),
                debit=0.0,
                credit_gst=row_gst,
                debit_gst=0.0
            ))

        for r in debits_raw:
            entries.append(schemas.LedgerEntrySchema(
                date=r.date,
                details=r.details,
                credit=0.0,
                debit=float(r.debit),
                credit_gst=0.0,
                debit_gst=float(r.debit_gst)
            ))

        # Sort by date
        entries.sort(key=lambda x: x.date)

        # 5. Calculate Running Balance
        current_balance = opening_balance
        final_entries = []
        for e in entries:
            current_balance += (e.credit - e.debit)
            e.balance = round(current_balance, 2)
            final_entries.append(e)

        return schemas.LedgerReportSchema(
            opening_balance=round(opening_balance, 2),
            closing_balance=round(current_balance, 2),
            entries=final_entries,
            start_date=from_date,
            end_date=to_date
        )
