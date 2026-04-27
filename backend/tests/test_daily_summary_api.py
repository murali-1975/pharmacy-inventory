import pytest
from datetime import date, timedelta
from app import models, schemas
from app.services.finance_service import FinanceService
from app.services.expense_service import ExpenseService

def test_daily_summary_api_grand_totals(client, db):
    """
    Verifies that the /finance/summaries endpoint returns correct grand totals
    including the newly added expense fields.
    """
    # 1. Setup Master Data
    srv = models.PatientService(service_name="Consultation", is_active=True)
    exp_type = models.ExpenseType(name="Utility", is_active=True)
    mode = models.PaymentModeMaster(mode="Cash", is_active=True)
    db.add_all([srv, exp_type, mode])
    db.commit()

    # 2. Record Income and Expenses for 2 days
    day1 = date.today()
    day2 = day1 - timedelta(days=1)

    for target_date in [day1, day2]:
        # Record Income (1000)
        payment_in = schemas.PatientPaymentCreate(
            patient_name=f"Patient {target_date}",
            payment_date=target_date,
            total_amount=1000.0,
            services=[{"service_id": srv.id, "amount": 1000.0}],
            payments=[{"payment_mode_id": mode.id, "value": 1000.0}]
        )
        FinanceService.record_payment(db, payment_in, user_id=1)
        
        # Record Expense (200 + 36 GST = 236)
        expense_in = schemas.ExpenseCreate(
            expense_date=target_date,
            expense_type_id=exp_type.id,
            details="Bill",
            amount=200.0,
            gst_amount=36.0,
            total_amount=236.0,
            payments=[{"payment_mode_id": mode.id, "amount": 236.0}]
        )
        ExpenseService.record_expense(db, expense_in, user_id=1)
    
    db.commit()

    # Trigger recalculation for both days
    FinanceService.recalculate_daily_summary(db, day1)
    FinanceService.recalculate_daily_summary(db, day2)

    # 3. Call the API
    resp = client.get(f"/finance/reports/summary?start_date={day2}&end_date={day1}")
    assert resp.status_code == 200
    data = resp.json()

    # 4. Verify Grand Totals
    # Total Revenue: 1000 + 1000 = 2000
    # Total Expenses: 236 + 236 = 472
    # Total Expense GST: 36 + 36 = 72
    
    grand_totals = data.get("grand_total") # Note: it was "grand_total" in finance.py
    assert grand_totals is not None
    assert grand_totals["total_revenue"] == 2000.0
    assert grand_totals["total_expenses"] == 472.0
    assert grand_totals["total_expense_gst"] == 72.0
    
    # Verify expense breakdown in grand totals
    assert "Utility" in grand_totals["expense_breakdown"]
    assert grand_totals["expense_breakdown"]["Utility"] == 472.0

    # 5. Verify Item structure
    items = data["items"]
    assert len(items) == 2
    for item in items:
        assert "expense_breakdown" in item
        assert item["expense_breakdown"]["Utility"] == 236.0
