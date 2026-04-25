import pytest
from datetime import date, timedelta
from app.services.finance_service import FinanceService
from app import models

def test_dashboard_range_filter(db):
    # 1. Setup Master Data
    admin_user_id = 1
    service = models.PatientService(service_name="Test Service", is_active=True)
    mode = models.PaymentModeMaster(mode="Cash", is_active=True)
    db.add_all([service, mode])
    db.commit()

    # 2. Add payments across different dates
    # Today
    p_today = models.PatientPayment(
        patient_name="Today Patient",
        payment_date=date.today(),
        total_amount=1000,
        created_by=admin_user_id,
        modified_by=admin_user_id
    )
    db.add(p_today)
    db.flush()
    db.add(models.PatientPaymentService(patient_payment_id=p_today.id, service_id=service.id, amount=1000))
    db.add(models.PatientPaymentValue(patient_payment_id=p_today.id, payment_mode_id=mode.id, value=1000, modified_by=admin_user_id))

    # Yesterday
    yesterday = date.today() - timedelta(days=1)
    p_yesterday = models.PatientPayment(
        patient_name="Yesterday Patient",
        payment_date=yesterday,
        total_amount=500,
        created_by=admin_user_id,
        modified_by=admin_user_id
    )
    db.add(p_yesterday)
    db.flush()
    db.add(models.PatientPaymentService(patient_payment_id=p_yesterday.id, service_id=service.id, amount=500))
    db.add(models.PatientPaymentValue(patient_payment_id=p_yesterday.id, payment_mode_id=mode.id, value=500, modified_by=admin_user_id))

    # Last Week
    last_week = date.today() - timedelta(days=7)
    p_old = models.PatientPayment(
        patient_name="Old Patient",
        payment_date=last_week,
        total_amount=200,
        created_by=admin_user_id,
        modified_by=admin_user_id
    )
    db.add(p_old)
    db.flush()
    db.add(models.PatientPaymentService(patient_payment_id=p_old.id, service_id=service.id, amount=200))
    db.add(models.PatientPaymentValue(patient_payment_id=p_old.id, payment_mode_id=mode.id, value=200, modified_by=admin_user_id))

    db.commit()

    # 3. Test Filter: Only Today
    stats = FinanceService.get_dashboard_stats(db, start_date=date.today(), end_date=date.today())
    assert any(s["total_amount"] == 1000 for s in stats["service_distribution"])
    # Trend should only show 1 day
    assert len(stats["recent_trends"]) == 1

    # 4. Test Filter: Last 2 days
    stats = FinanceService.get_dashboard_stats(db, start_date=yesterday, end_date=date.today())
    # 1000 + 500 = 1500
    assert any(s["total_amount"] == 1500 for s in stats["service_distribution"])
    assert len(stats["recent_trends"]) == 2

    # 5. Test Filter: Custom Range (Old Patient only)
    stats = FinanceService.get_dashboard_stats(db, start_date=last_week, end_date=last_week)
    assert any(s["total_amount"] == 200 for s in stats["service_distribution"])
    assert len(stats["recent_trends"]) == 1
