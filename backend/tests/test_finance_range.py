import pytest
from datetime import date, timedelta
from fastapi import status

def test_get_payments_range_filter(client, db):
    """
    Verifies that get_patient_payments supports from_date and to_date range filtering.
    """
    from app import models
    
    # 0. Get the user ID from the seeded admin
    admin = db.query(models.User).filter(models.User.username == "testadmin").first()
    user_id = admin.id
    
    # 1. Setup Data: Records across different days
    today = date.today()
    yesterday = today - timedelta(days=1)
    last_week = today - timedelta(days=7)
    
    p1 = models.PatientPayment(patient_name="P1 Today", payment_date=today, total_amount=100, created_by=user_id, modified_by=user_id)
    p2 = models.PatientPayment(patient_name="P2 Yesterday", payment_date=yesterday, total_amount=200, created_by=user_id, modified_by=user_id)
    p3 = models.PatientPayment(patient_name="P3 LastWeek", payment_date=last_week, total_amount=300, created_by=user_id, modified_by=user_id)
    
    db.add_all([p1, p2, p3])
    db.commit()
    
    # 2. Test Range Filter: Yesterday to Today
    resp = client.get(
        f"/finance/payments?from_date={yesterday}&to_date={today}"
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 2
    names = [p["patient_name"] for p in data["items"]]
    assert "P1 Today" in names
    assert "P2 Yesterday" in names
    assert "P3 LastWeek" not in names
    
    # 3. Test Range Filter: Only Today
    resp = client.get(
        f"/finance/payments?from_date={today}"
    )
    assert resp.json()["total"] == 1
    assert resp.json()["items"][0]["patient_name"] == "P1 Today"
    
    # 4. Test Range Filter: Up to Yesterday
    resp = client.get(
        f"/finance/payments?to_date={yesterday}"
    )
    assert resp.json()["total"] == 2
    names = [p["patient_name"] for p in resp.json()["items"]]
    assert "P2 Yesterday" in names
    assert "P3 LastWeek" in names
