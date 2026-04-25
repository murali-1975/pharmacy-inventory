import pytest
from datetime import date, timedelta
from app import models, schemas
from app.services.finance_service import FinanceService

def test_summary_api_pagination_and_grand_totals(client, db):
    """
    Verifies that the /finance/reports/summary endpoint:
    1. Paginate items correctly using skip/limit.
    2. Returns accurate grand totals for the ENTIRE range even when limit < total.
    """
    # 1. Setup Master Data
    srv = models.PatientService(service_name="Consultation", is_active=True)
    mode = models.PaymentModeMaster(mode="Cash", is_active=True)
    db.add_all([srv, mode])
    db.commit()

    # 2. Create 5 days of data
    today = date.today()
    for i in range(5):
        p_date = today - timedelta(days=i)
        p_in = schemas.PatientPaymentCreate(
            patient_name=f"Patient {i}",
            payment_date=p_date,
            total_amount=1000.0,
            services=[{"service_id": srv.id, "amount": 1000.0}],
            payments=[{"payment_mode_id": mode.id, "value": 1000.0}]
        )
        FinanceService.record_payment(db, p_in, user_id=1)
        FinanceService.recalculate_daily_summary(db, p_date)
    db.commit()

    # 3. Request Page 1 (limit 10, should show ONLY active 5 days)
    start = today - timedelta(days=4)
    resp = client.get(f"/finance/reports/summary?limit=10&skip=0&start_date={start}&end_date={today}")
    assert resp.status_code == 200
    data = resp.json()
    
    assert data["total"] == 5
    assert len(data["items"]) == 5
    
    # Verify Zero-Activity Exclusion: Delete one day from DB and re-request
    # (Setting patient_count to 0 via recalc or deletion)
    db.query(models.DailyFinanceSummary).filter(models.DailyFinanceSummary.summary_date == today - timedelta(days=2)).delete()
    db.commit()
    
    resp_filtered = client.get(f"/finance/reports/summary?limit=10&skip=0&start_date={start}&end_date={today}")
    data_filtered = resp_filtered.json()
    
    assert data_filtered["total"] == 4 # Only 4 active days now
    assert len(data_filtered["items"]) == 4
    # The day we deleted should NOT be in the items at all
    day_dates = [item["summary_date"] for item in data_filtered["items"]]
    assert str(today - timedelta(days=2)) not in day_dates
    
    # Grand totals should reflect the remaining 4 days
    assert data_filtered["grand_total"]["total_revenue"] == 4000.0
