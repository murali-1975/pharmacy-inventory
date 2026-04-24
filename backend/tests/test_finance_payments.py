import pytest
from datetime import date
from app import models

def test_record_patient_payment_complex(client, db):
    """
    Records a complex patient payment involving multiple identifiers,
    services, and payment modes. This is the core transaction test.
    """
    # 1. Setup Master Data
    ident = models.PatientIdentifier(id_name="UHID", is_active=True)
    srv1 = models.PatientService(service_name="Consultation", is_active=True)
    srv2 = models.PatientService(service_name="Pharmacy", is_active=True)
    mode1 = models.PaymentModeMaster(mode="Cash", is_active=True)
    mode2 = models.PaymentModeMaster(mode="UPI", is_active=True)
    db.add_all([ident, srv1, srv2, mode1, mode2])
    db.commit()

    payload = {
        "patient_name": "John Doe",
        "payment_date": str(date.today()),
        "total_amount": 1500.0,
        "gst_amount": 75.0,
        "notes": "Regular checkup",
        "identifiers": [
            {"identifier_id": ident.id, "id_value": "UHID-12345"}
        ],
        "services": [
            {
                "service_id": srv1.id,
                "amount": 500.0
            },
            {
                "service_id": srv2.id,
                "amount": 1000.0
            }
        ],
        "payments": [
            {"payment_mode_id": mode1.id, "value": 1000.0},
            {"payment_mode_id": mode2.id, "value": 500.0}
        ]
    }

    resp = client.post("/finance/payments", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["patient_name"] == "John Doe"
    assert len(data["identifiers"]) == 1
    assert len(data["services"]) == 2
    assert data["total_amount"] == 1500.0

def test_list_payments_pagination(client, db):
    """Verify that payment history supports pagination."""
    # Seed 5 payments
    for i in range(5):
        p = models.PatientPayment(
            patient_name=f"Patient {i}",
            payment_date=date.today(),
            total_amount=100.0,
            created_by=1, # Admin
            modified_by=1
        )
        db.add(p)
    db.commit()

    # Limit to 2
    resp = client.get("/finance/payments?skip=0&limit=2")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 5
    assert len(data["items"]) == 2

def test_update_payment(client, db):
    """Admin/Staff can update basic payment info."""
    p = models.PatientPayment(
        patient_name="Old Name",
        payment_date=date.today(),
        total_amount=100.0,
        created_by=1,
        modified_by=1
    )
    db.add(p)
    db.commit()
    db.refresh(p)

    resp = client.put(f"/finance/payments/{p.id}", json={"patient_name": "New Name", "total_amount": 100.0, "payment_date": str(date.today())})
    assert resp.status_code == 200
    assert resp.json()["patient_name"] == "New Name"

def test_delete_payment_staff_fails(staff_client, db):
    """Staff cannot delete a payment record."""
    p = models.PatientPayment(patient_name="To Delete", payment_date=date.today(), total_amount=100.0, created_by=1, modified_by=1)
    db.add(p)
    db.commit()
    db.refresh(p)
    resp = staff_client.delete(f"/finance/payments/{p.id}")
    assert resp.status_code == 403

def test_delete_payment_admin_works(client, db):
    """Admin can delete a payment record."""
    p = models.PatientPayment(patient_name="To Delete", payment_date=date.today(), total_amount=100.0, created_by=1, modified_by=1)
    db.add(p)
    db.commit()
    db.refresh(p)
    resp = client.delete(f"/finance/payments/{p.id}")
    assert resp.status_code == 204

def test_bulk_upload_staff_fails(staff_client):
    """Staff cannot access the bulk upload endpoint."""
    resp = staff_client.post("/finance/payments/upload")
    assert resp.status_code == 403

def test_bulk_upload_admin_authorized(client):
    """Admin is authorized for bulk upload (returns 422 if file missing)."""
    resp = client.post("/finance/payments/upload")
    assert resp.status_code == 422
