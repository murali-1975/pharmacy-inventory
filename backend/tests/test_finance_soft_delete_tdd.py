import pytest
from fastapi import status
from datetime import date
from app import models

@pytest.mark.asyncio
async def test_admin_soft_delete_flow(client, db):
    """
    Test the full soft-delete flow as an Admin:
    1. Create a payment.
    2. Check initial summary.
    3. Soft delete the payment.
    4. Verify payment is 'hidden' but still in DB.
    5. Verify summary is updated.
    """
    # 1. Setup Master Data
    service = models.PatientService(service_name="Pharmacy", is_active=True)
    db.add(service)
    mode = models.PaymentModeMaster(mode="Cash", is_active=True)
    db.add(mode)
    db.commit()

    # 2. Create a Payment
    p_date = date.today().isoformat()
    payment_data = {
        "patient_name": "Soft Delete Test",
        "payment_date": p_date,
        "total_amount": 1000.0,
        "gst_amount": 50.0,
        "free_flag": False,
        "services": [{"service_id": service.id, "amount": 1000.0}],
        "payments": [{"payment_mode_id": mode.id, "value": 1000.0}],
        "identifiers": []
    }
    
    resp = client.post("/finance/payments", json=payment_data)
    assert resp.status_code == 201
    payment_id = resp.json()["id"]

    # 3. Check Initial Summary
    summary_resp = client.get(f"/finance/reports/summary?start_date={p_date}&end_date={p_date}")
    assert summary_resp.json()["items"][0]["total_revenue"] == 1000.0
    assert summary_resp.json()["items"][0]["patient_count"] == 1

    # 4. Perform Soft Delete
    del_resp = client.delete(f"/finance/payments/{payment_id}")
    assert del_resp.status_code == 204

    # 5. Verify record is hidden from list
    list_resp = client.get("/finance/payments")
    assert all(p["id"] != payment_id for p in list_resp.json()["items"])

    # 6. Verify summary is filtered out (since it's now 0 patients)
    summary_resp_after = client.get(f"/finance/reports/summary?start_date={p_date}&end_date={p_date}")
    assert len(summary_resp_after.json()["items"]) == 0
    assert summary_resp_after.json()["grand_total"]["total_revenue"] == 0.0

    # 7. Verify DB still has it but is_deleted is True
    db_record = db.query(models.PatientPayment).filter(models.PatientPayment.id == payment_id).first()
    assert db_record is not None
    assert db_record.is_deleted is True

@pytest.mark.asyncio
async def test_staff_cannot_soft_delete(staff_client, db):
    """Verify that a standard staff user cannot delete payments."""
    # Assume a payment exists (from other tests or create one)
    # For isolation, just try to delete ID 9999
    resp = staff_client.delete("/finance/payments/9999")
    assert resp.status_code == 403 # Forbidden
