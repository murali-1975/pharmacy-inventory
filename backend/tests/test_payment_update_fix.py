import pytest
from datetime import date
from app import models, schemas
from app.services.finance_service import FinanceService

def test_update_free_to_gpay_status_fix(db):
    """
    Verification: Updating a FREE record to a PAID (GPay) record should correctly
    update the payment status and the payment breakdown in the DB.
    """
    # 1. Setup Master Data
    srv = models.PatientService(service_name="Consultation", is_active=True)
    mode = models.PaymentModeMaster(id=2, mode="GPay", is_active=True) # ID 2 for GPay
    db.add_all([srv, mode])
    db.commit()

    # 2. Record a FREE payment
    payment_in = schemas.PatientPaymentCreate(
        patient_name="Parkavi",
        payment_date=date.today(),
        total_amount=851.0,
        free_flag=True,
        services=[{"service_id": srv.id, "amount": 851.0}],
        payments=[]
    )
    
    db_payment = FinanceService.record_payment(db, payment_in, user_id=1)
    db.commit()
    
    assert db_payment.payment_status == "PAID"
    assert len(db_payment.payments) == 0

    # 3. Update to GPay (is_free = False, payments = [GPay])
    update_in = schemas.PatientPaymentUpdate(
        patient_name="Parkavi",
        payment_date=date.today(),
        total_amount=851.0,
        free_flag=False,
        services=[{"service_id": srv.id, "amount": 851.0}],
        payments=[{"payment_mode_id": mode.id, "value": 851.0}]
    )
    
    updated_obj = FinanceService.update_payment(db, db_payment.id, update_in, user_id=1)
    db.commit()
    db.refresh(updated_obj)

    # 4. Verify Fix
    assert updated_obj.free_flag is False
    assert len(updated_obj.payments) == 1
    assert updated_obj.payments[0].payment_mode_id == mode.id
    assert updated_obj.payment_status == "PAID"
    
    # Check Daily Summary
    summary = FinanceService.recalculate_daily_summary(db, date.today())
    assert summary.total_revenue == 851.0
    assert summary.total_collected == 851.0
    assert summary.payment_breakdown["GPay"] == 851.0
