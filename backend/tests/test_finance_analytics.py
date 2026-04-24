import pytest
import datetime
from app import models

def test_get_finance_dashboard_stats(client, db):
    """
    Test the finance dashboard analytics endpoint.
    """
    # 1. Setup Master Data
    service = models.PatientService(service_name="Consultation", is_active=True)
    mode = models.PaymentModeMaster(mode="Cash", is_active=True)
    db.add(service)
    db.add(mode)
    db.commit()

    # 2. Setup a payment record for today
    today = datetime.date.today()
    payment = models.PatientPayment(
        patient_name="Analytics Test",
        payment_date=today,
        total_amount=1000.0,
        gst_amount=0.0,
        created_by=1,
        modified_by=1
    )
    db.add(payment)
    db.flush()

    # Add service link
    ps = models.PatientPaymentService(patient_payment_id=payment.id, service_id=service.id, amount=1000.0)
    db.add(ps)
    
    # Add payment value
    pv = models.PatientPaymentValue(patient_payment_id=payment.id, payment_mode_id=mode.id, value=1000.0, modified_by=1)
    db.add(pv)
    db.commit()

    # 3. Call the analytics endpoint
    response = client.get("/finance/analytics/dashboard")

    assert response.status_code == 200
    data = response.json()
    assert data["total_income_today"] == 1000.0
    assert data["total_income_month"] >= 1000.0
    
    # Verify distributions
    assert any(s["service_name"] == "Consultation" for s in data["service_distribution"])
    assert any(m["mode_name"] == "Cash" for m in data["payment_mode_distribution"])
