import sys
import os
from sqlalchemy.orm import Session
from datetime import date

# Add the backend directory to the path so we can import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models import PatientPayment
from app.services.finance_service import FinanceService

def fix_historical_data():
    """
    Identifies all unique dates in the patient_payments table
    and triggers a recalculation of the daily summary for each date
    using the updated revenue logic.
    """
    db = SessionLocal()
    try:
        print("--- Starting Historical Revenue Recalculation ---")
        
        # 1. Get all unique dates from payments
        unique_dates = db.query(PatientPayment.payment_date)\
            .filter(PatientPayment.is_deleted == False)\
            .distinct().all()
        
        dates_to_fix = [d[0] for d in unique_dates]
        print(f"Found {len(dates_to_fix)} unique dates to process.")

        # 2. Recalculate each
        for target_date in sorted(dates_to_fix):
            print(f"Processing: {target_date}...", end=" ", flush=True)
            FinanceService.recalculate_daily_summary(db, target_date)
            db.commit() # Commit each date individually
            print("Done.")

        print("--- Recalculation Complete ---")
        print("Success: All daily summaries have been updated with the new revenue logic.")

    except Exception as e:
        print(f"\nError during recalculation: {str(e)}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    fix_historical_data()
