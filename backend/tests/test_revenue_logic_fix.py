import pytest
from datetime import date
from app import models, schemas
from app.services.finance_service import FinanceService

def test_free_flag_revenue_exclusion(db):
    """
    TDD / Verification: Records marked as FREE should NOT contribute to revenue,
    even if they have a billable amount. They should still count towards visits.
    """
    # 1. Setup Master Data
    srv = models.PatientService(service_name="Consultation", is_active=True)
    db.add(srv)
    db.commit()
    db.refresh(srv)

    # 2. Record a FREE payment
    # Even though total_amount is 500, since free_flag is True, revenue should be 0.
    payment_in = schemas.PatientPaymentCreate(
        patient_name="Free Patient",
        payment_date=date.today(),
        total_amount=500.0,
        free_flag=True,
        services=[{"service_id": srv.id, "amount": 500.0}],
        payments=[]
    )
    
    db_payment = FinanceService.record_payment(db, payment_in, user_id=1)
    db.commit()

    # 3. Verify Daily Summary
    summary = FinanceService.recalculate_daily_summary(db, date.today())
    
    assert summary.patient_count == 1
    assert summary.total_revenue == 0.0, "Revenue should be 0 for FREE transactions"
    assert summary.service_breakdown["Consultation"] == 0.0, "Breakdown amount should be 0 for FREE transactions"

    # 4. Record a Regular payment for the same day
    payment_reg = schemas.PatientPaymentCreate(
        patient_name="Paid Patient",
        payment_date=date.today(),
        total_amount=1000.0,
        free_flag=False,
        services=[{"service_id": srv.id, "amount": 1000.0}],
        payments=[{"payment_mode_id": 1, "value": 1000.0}] # Assuming mode 1 exists
    )
    # Ensure mode 1 exists
    if not db.query(models.PaymentModeMaster).get(1):
        db.add(models.PaymentModeMaster(id=1, mode="Cash", is_active=True))
        db.commit()

    FinanceService.record_payment(db, payment_reg, user_id=1)
    db.commit()
    
    summary_v2 = FinanceService.recalculate_daily_summary(db, date.today())
    
    assert summary_v2.patient_count == 2
    assert summary_v2.total_revenue == 1000.0, "Only paid transactions should sum to revenue"
    assert summary_v2.service_breakdown["Consultation"] == 1000.0

    # 5. Verify KPI Stats
    stats = FinanceService.get_dashboard_stats(db)
    assert stats["total_income_today"] == 1000.0
    assert stats["patient_count_today"] == 2
