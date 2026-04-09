import pytest
from app import models, schemas

def test_record_payment_and_auto_status(client, db):
    """
    Test that recording a payment for an invoice correctly calculates the total paid 
    and updates the invoice status to 'Paid' when fully settled.
    """
    # 1. Setup: Create Supplier, Medicine, and Invoice
    # SupplierType(id=1) is not seeded by conftest, so we add it here.
    if not db.query(models.SupplierType).filter(models.SupplierType.id == 1).first():
        db.add(models.SupplierType(id=1, name="Standard"))
        db.commit()

    sup_res = client.post("/suppliers/", json={"supplier_name": "Pay Supplier", "type_id": 1, "status_id": 1})
    supplier_id = sup_res.json()["id"]

    inv_res = client.post("/invoices/", json={
        "supplier_id": supplier_id,
        "invoice_date": "2024-03-22",
        "reference_number": "PAY-INV-001",
        "total_value": 1000.0,
        "gst": 0.0,
        "line_items": []
    })
    invoice_id = inv_res.json()["id"]
    assert inv_res.json()["status"] == "Pending"

    # 2. Record Partial Payment
    payment_data = {
        "invoice_id": invoice_id,
        "payment_mode": "Cash",
        "payment_date": "2024-03-22",
        "paid_amount": 400.0,
        "payment_reference": "PARTIAL-1",
        "remarks": "Part 1"
    }
    pay_res1 = client.post(f"/invoices/{invoice_id}/payments", json=payment_data)
    assert pay_res1.status_code == 200
    
    # Check status remains Pending
    inv_check1 = client.get(f"/invoices/{invoice_id}")
    assert inv_check1.json()["status"] == "Pending"

    # 3. Record Final Settling Payment
    payment_data2 = {
        "invoice_id": invoice_id,
        "payment_mode": "Bank Transfer",
        "payment_date": "2024-03-23",
        "paid_amount": 600.0,
        "payment_reference": "FINAL-1",
        "remarks": "Fully Paid"
    }
    pay_res2 = client.post(f"/invoices/{invoice_id}/payments", json=payment_data2)
    assert pay_res2.status_code == 200

    # 4. Verify Auto-Status Update to 'Paid'
    inv_check2 = client.get(f"/invoices/{invoice_id}")
    assert inv_check2.json()["status"] == "Paid"
    assert len(inv_check2.json()["payments"]) == 2

    # Verify audit columns recorded
    db_payment = db.query(models.InvoicePayment).filter(models.InvoicePayment.invoice_id == invoice_id).first()
    assert db_payment.created_by is not None
    assert db_payment.created_date is not None

def test_get_payments_list(client, db):
    """Test retrieving all payments for a specific invoice."""
    # Seed minimal data
    if not db.query(models.SupplierType).filter(models.SupplierType.id == 1).first():
        db.add(models.SupplierType(id=1, name="Standard"))
    db.commit()
    
    sup = client.post("/suppliers/", json={"supplier_name": "List Supplier", "type_id": 1, "status_id": 1})
    inv = client.post("/invoices/", json={
        "supplier_id": sup.json()["id"],
        "invoice_date": "2024-03-22",
        "reference_number": "LIST-PAY-001",
        "total_value": 100.0,
        "gst": 0.0,
        "line_items": []
    })
    inv_id = inv.json()["id"]
    
    client.post(f"/invoices/{inv_id}/payments", json={
        "invoice_id": inv_id,
        "payment_mode": "UPI",
        "payment_date": "2024-03-22",
        "paid_amount": 50.0
    })
    
    res = client.get(f"/invoices/{inv_id}/payments")
    assert res.status_code == 200
    assert len(res.json()) == 1
    assert res.json()[0]["paid_amount"] == 50.0
