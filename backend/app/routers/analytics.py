from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
import datetime
from app import models, schemas, database, auth, utils
from app.core.logging_config import logger

router = APIRouter(
    prefix="/analytics",
    tags=["Analytics"],
    dependencies=[Depends(auth.get_current_user)],
)

@router.get("/stats", response_model=schemas.DashboardStats)
def get_dashboard_stats(db: Session = Depends(database.get_db)):
    """
    Calculate and return key statistics for the dashboard cards.
    
    Includes:
    - total_medicines: Unique medicines currently in stock.
    - pending_invoices_amount: Total value of unpaid purchase invoices.
    - monthly_procurement: Sum of non-cancelled invoices for the current calendar month.
    - low_stock_alerts: Count of medicines below their reorder threshold.
    """
    with utils.db_error_handler("calculating dashboard statistics"):
        # 1. Total Unique Medicines with Stock > 0
        total_medicines = (
            db.query(models.MedicineStock)
            .filter(models.MedicineStock.quantity_on_hand > 0)
            .count()
        )

        # 2. Pending Invoices Amount (status == Pending)
        pending_invoices_amount = (
            db.query(func.sum(models.Invoice.total_value))
            .filter(models.Invoice.status.in_([models.InvoiceStatus.Pending, models.InvoiceStatus.Hold]))
            .scalar()
        ) or 0.0

        # 3. Monthly Procurement (sum of invoice values for current month)
        today = datetime.date.today()
        first_day_of_month = today.replace(day=1)
        
        monthly_procurement = (
            db.query(func.sum(models.Invoice.total_value))
            .filter(models.Invoice.invoice_date >= first_day_of_month)
            .filter(models.Invoice.status != models.InvoiceStatus.Cancelled)
            .scalar()
        ) or 0.0

        # 4. Low Stock Alerts (quantity_on_hand <= reorder_level)
        low_stock_alerts = (
            db.query(models.MedicineStock)
            .filter(models.MedicineStock.quantity_on_hand <= models.MedicineStock.reorder_level)
            .count()
        )

        logger.info(f"Dashboard analytics refreshed: meds={total_medicines}, pending=₹{pending_invoices_amount:.2f}")

        return {
            "total_medicines": total_medicines,
            "pending_invoices_amount": round(float(pending_invoices_amount), 2),
            "monthly_procurement": round(float(monthly_procurement), 2),
            "low_stock_alerts": low_stock_alerts
        }
