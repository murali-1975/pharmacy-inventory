import pytest
from datetime import date
from sqlalchemy.orm import Session
from app import models, schemas
from app.services.finance_service import FinanceService
from app.utils import AppError, ResourceNotFoundError, ValidationError

def seed_finance_masters(db: Session):
    # Seed Identifiers
    if not db.query(models.PatientIdentifier).filter(models.PatientIdentifier.id == 1).first():
        db.add(models.PatientIdentifier(id=1, id_name="UHID", is_active=True))
    # Seed Services
    if not db.query(models.PatientService).filter(models.PatientService.id == 1).first():
        db.add(models.PatientService(id=1, service_name="Consultation", is_active=True))
    # Seed Payment Modes
    if not db.query(models.PaymentModeMaster).filter(models.PaymentModeMaster.id == 1).first():
        db.add(models.PaymentModeMaster(id=1, mode="Cash", is_active=True))
    db.commit()

def test_soft_delete_integrity(db: Session):
    seed_finance_masters(db)
    # 1. Create a payment
    payment_in = schemas.PatientPaymentCreate(
        patient_name="Security Test",
        payment_date=date.today(),
        total_amount=1000,
        services=[{"service_id": 1, "amount": 1000}], # Use ID 1 which usually exists in dev db
        payments=[{"payment_mode_id": 1, "value": 1000}]
    )
    db_payment = FinanceService.record_payment(db, payment_in, user_id=1)
    db.commit()
    payment_id = db_payment.id

    # 2. Soft delete it
    success = FinanceService.soft_delete_payment(db, payment_id, user_id=1)
    assert success is True
    
    # 3. Verify it's marked as deleted
    db.refresh(db_payment)
    assert db_payment.is_deleted is True
    assert db_payment.deleted_by == 1

    # 4. Attempt to soft delete again - should return False
    success = FinanceService.soft_delete_payment(db, payment_id, user_id=1)
    assert success is False

def test_negative_amount_validation(db: Session):
    seed_finance_masters(db)
    # This should be caught by Pydantic or the Service layer
    # We will test the service layer's robustness
    with pytest.raises(Exception): # Pydantic ValidationError or similar
        payment_in = schemas.PatientPaymentCreate(
            patient_name="Negative Test",
            payment_date=date.today(),
            total_amount=-500,
            services=[{"service_id": 1, "amount": -500}],
            payments=[]
        )
        FinanceService.record_payment(db, payment_in, user_id=1)

def test_bulk_upload_malformed_data(db: Session):
    import pandas as pd
    import io
    
    # Missing required 'Date' column
    csv_content = "Patient Name\nBad Row"
    df = pd.read_csv(io.StringIO(csv_content))
    
    with pytest.raises(ValidationError) as exc:
        FinanceService.process_bulk_upload(db, df, user_id=1)
    assert "Missing required bulk column: Date" in str(exc.value)

def test_dashboard_stats_deleted_records_exclusion(db: Session):
    seed_finance_masters(db)
    # 1. Create and then delete a payment
    payment_in = schemas.PatientPaymentCreate(
        patient_name="Deleted Trend Test",
        payment_date=date.today(),
        total_amount=5000,
        services=[{"service_id": 1, "amount": 5000}],
        payments=[{"payment_mode_id": 1, "value": 5000}]
    )
    db_payment = FinanceService.record_payment(db, payment_in, user_id=1)
    db.commit()
    
    # Get stats before delete
    stats_before = FinanceService.get_dashboard_stats(db)
    
    # Soft delete
    FinanceService.soft_delete_payment(db, db_payment.id, user_id=1)
    db.commit()
    
    # Get stats after delete
    stats_after = FinanceService.get_dashboard_stats(db)
    
    # The total income today should have decreased by 5000
    assert stats_before["total_income_today"] - stats_after["total_income_today"] == 5000
