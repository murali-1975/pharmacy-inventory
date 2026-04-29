import pytest
from datetime import date
from fastapi.testclient import TestClient
from app.main import app
from app import models, schemas, seed
from app.services.finance_service import FinanceService

@pytest.fixture
def export_setup(db):
    # Pre-seed finance masters
    seed.seed_finance_masters(db)
    
    # Fetch seeded Admin User
    admin = db.query(models.User).filter(models.User.username == "admin").first()
    
    # Get a seeded payment mode ID
    mode = db.query(models.PaymentModeMaster).first()
    mode_id = mode.id if mode else 1
    
    # Create test payments
    day1 = date(2026, 4, 25)
    
    # Record a payment
    FinanceService.record_payment(db, schemas.PatientPaymentCreate(
        patient_name="Export Patient 1",
        payment_date=day1,
        total_amount=1000.0,
        services=[],
        identifiers=[],
        payments=[{"payment_mode_id": mode_id, "value": 1000.0}],
        notes="Test export 1"
    ), admin.id)
    
    FinanceService.record_payment(db, schemas.PatientPaymentCreate(
        patient_name="Export Patient 2",
        payment_date=day1,
        total_amount=500.0,
        services=[],
        identifiers=[],
        payments=[{"payment_mode_id": mode_id, "value": 250.0}],
        notes="Test export 2"
    ), admin.id)
    
    db.commit()
    return {"admin": admin, "date": day1}

def test_export_payments_excel_status(client, db, export_setup):
    """Verify that the Excel export endpoint returns 200 and correct media type."""
    test_date = export_setup["date"]
    
    # Requesting export for the specific date
    response = client.get(
        f"/finance/reports/payments/excel?date={test_date}"
    )
    
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    assert "attachment; filename=Patient_Payments_" in response.headers["content-disposition"]
    assert len(response.content) > 0

def test_export_payments_excel_filters(client, db, export_setup):
    """Verify that filters are correctly applied to the export."""
    # Requesting export for a name that doesn't exist
    response = client.get(
        "/finance/reports/payments/excel?patient_name=NonExistent"
    )
    assert response.status_code == 200
    # Even with no results, it should return a valid Excel file (just headers)
    assert response.headers["content-type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
