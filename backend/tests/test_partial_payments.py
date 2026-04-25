import pytest
from app import models, schemas
from app.services.finance_service import FinanceService
from datetime import date

def test_partial_payment_status_logic(client, db):
    """
    TDD: Verifies that payment_status is correctly assigned based on the paid amount.
    """
    admin_user = db.query(models.User).filter(models.User.role == "Admin").first()
    # 1. Setup Master Data
    srv = models.PatientService(service_name="Consultation", is_active=True)
    mode = models.PaymentModeMaster(mode="Cash", is_active=True)
    db.add_all([srv, mode])
    db.commit()

    # Case A: Partial Payment (1000 billed, 400 paid)
    payment_in = schemas.PatientPaymentCreate(
        patient_name="Partial Patient",
        payment_date=date.today(),
        total_amount=1000.0,
        gst_amount=0.0,
        services=[schemas.PatientPaymentServiceCreate(service_id=srv.id, amount=1000.0)],
        payments=[schemas.PatientPaymentValueCreate(payment_mode_id=mode.id, value=400.0)]
    )
    p1 = FinanceService.record_payment(db, payment_in, admin_user.id)
    assert p1.payment_status == "PARTIAL"

    # Case B: Due Payment (1000 billed, 0 paid)
    payment_in_due = schemas.PatientPaymentCreate(
        patient_name="Due Patient",
        payment_date=date.today(),
        total_amount=1000.0,
        gst_amount=0.0,
        services=[schemas.PatientPaymentServiceCreate(service_id=srv.id, amount=1000.0)],
        payments=[]
    )
    p2 = FinanceService.record_payment(db, payment_in_due, admin_user.id)
    assert p2.payment_status == "DUE"

    # Case C: Full Payment
    payment_in_full = schemas.PatientPaymentCreate(
        patient_name="Full Patient",
        payment_date=date.today(),
        total_amount=1000.0,
        gst_amount=0.0,
        services=[schemas.PatientPaymentServiceCreate(service_id=srv.id, amount=1000.0)],
        payments=[schemas.PatientPaymentValueCreate(payment_mode_id=mode.id, value=1000.0)]
    )
    p3 = FinanceService.record_payment(db, payment_in_full, admin_user.id)
    assert p3.payment_status == "PAID"

def test_summary_tracks_collections_separately(client, db):
    """
    Verifies that DailyFinanceSummary correctly distinguishes between 
    Revenue (Billed) and Collected (Cash).
    """
    admin_user = db.query(models.User).filter(models.User.role == "Admin").first()
    # Setup
    srv = models.PatientService(service_name="Consultation", is_active=True)
    mode = models.PaymentModeMaster(mode="Cash", is_active=True)
    db.add_all([srv, mode])
    db.commit()

    test_date = date(2026, 5, 1)

    # 1. Record a partial payment: 1000 billed, 200 collected
    p1 = schemas.PatientPaymentCreate(
        patient_name="Partial",
        payment_date=test_date,
        total_amount=1000.0,
        services=[schemas.PatientPaymentServiceCreate(service_id=srv.id, amount=1000.0)],
        payments=[schemas.PatientPaymentValueCreate(payment_mode_id=mode.id, value=200.0)]
    )
    FinanceService.record_payment(db, p1, admin_user.id)

    # 2. Record a full payment: 500 billed, 500 collected
    p2 = schemas.PatientPaymentCreate(
        patient_name="Full",
        payment_date=test_date,
        total_amount=500.0,
        services=[schemas.PatientPaymentServiceCreate(service_id=srv.id, amount=500.0)],
        payments=[schemas.PatientPaymentValueCreate(payment_mode_id=mode.id, value=500.0)]
    )
    FinanceService.record_payment(db, p2, admin_user.id)

    # Verify Summary
    summary = db.query(models.DailyFinanceSummary).filter(models.DailyFinanceSummary.summary_date == test_date).first()
    assert summary is not None
    assert summary.total_revenue == 1500.0 # 1000 + 500
    assert summary.total_collected == 700.0 # 200 + 500
    assert summary.payment_breakdown["Cash"] == 700.0
