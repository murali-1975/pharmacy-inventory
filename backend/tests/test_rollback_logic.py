import pytest
from unittest.mock import patch
from sqlalchemy.exc import SQLAlchemyError
from fastapi import status
import datetime
from app import models

def test_supplier_creation_rollback(client, db):
    """
    Test that if bank account creation fails, the supplier is not created.
    """
    supplier_data = {
        "supplier_name": "Rollback Supplier",
        "type_id": 1,
        "status_id": 1,
        "contact_details": {"address_line_1": "Test Address", "email_id": "test@test.com"},
        "bank_details": [{"bank_name": "Fail Bank", "account_number": "123", "ifsc_code": "FAIL001"}]
    }

    # Patch the SupplierBankAccount model instantiation OR the db.add for it to raise an error
    with patch("app.models.SupplierBankAccount", side_effect=SQLAlchemyError("Simulated DB Failure")):
        response = client.post("/suppliers/", json=supplier_data)
        assert response.status_code == 500
        assert "Internal database error" in response.json()["detail"]

    # Verify supplier was NOT created
    supplier = db.query(models.Supplier).filter(models.Supplier.supplier_name == "Rollback Supplier").first()
    assert supplier is None

def test_invoice_creation_rollback(client, db):
    """
    Test that if stock adjustment fails, the invoice is not created.
    """
    # Create a medicine first
    med = models.Medicine(product_name="RollbackMed", generic_name="G1", uom="Strip")
    db.add(med)
    db.commit()

    invoice_data = {
        "supplier_id": 1, # Assume supplier 1 exists or create one if needed
        "invoice_date": str(datetime.date.today()),
        "reference_number": "REF-ROLLBACK",
        "total_value": 1000,
        "gst": 180,
        "line_items": [
            {
                "medicine_id": med.id,
                "quantity": 10,
                "price": 100,
                "expiry_date": "2027-12-31"
            }
        ]
    }
    
    # Ensure a supplier exists
    if not db.query(models.Supplier).filter(models.Supplier.id == 1).first():
        db.add(models.Supplier(id=1, supplier_name="S1", type_id=1, status_id=1))
        db.commit()

    # Patch StockAdjustment creation to fail
    with patch("app.models.StockAdjustment", side_effect=SQLAlchemyError("Simulated Stock Failure")):
        response = client.post("/invoices/", json=invoice_data)
        assert response.status_code == 500

    # Verify invoice was NOT created
    invoice = db.query(models.Invoice).filter(models.Invoice.reference_number == "REF-ROLLBACK").first()
    assert invoice is None
