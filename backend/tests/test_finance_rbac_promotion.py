import pytest
from fastapi import status

def test_staff_access_finance_dashboard(staff_client):
    """
    RBAC Update: Staff role must now have READ access to the Finance Dashboard.
    """
    response = staff_client.get("/finance/analytics/dashboard")
    # This should now be 200 OK instead of 403
    assert response.status_code == status.HTTP_200_OK

def test_staff_access_daily_summaries(staff_client):
    """
    RBAC Update: Staff role must now have READ access to Daily Summaries.
    """
    response = staff_client.get("/finance/reports/summary")
    # This should now be 200 OK instead of 403
    assert response.status_code == status.HTTP_200_OK

def test_staff_access_payment_history(staff_client):
    """
    Verification: Staff should continue to have access to Payment History.
    """
    response = staff_client.get("/finance/payments")
    assert response.status_code == status.HTTP_200_OK

def test_staff_cannot_access_ledger(staff_client):
    """
    RBAC Integrity: Staff should STILL be blocked from the detailed Financial Ledger.
    """
    response = staff_client.get("/financials/ledger?from_date=2026-01-01&to_date=2026-12-31")
    assert response.status_code == status.HTTP_403_FORBIDDEN

def test_staff_cannot_access_masters_setup(staff_client):
    """
    RBAC Integrity: Staff should STILL be blocked from modifying Master Data.
    """
    response = staff_client.post("/finance/masters/patient_services", json={"service_name": "Hack", "is_active": True})
    assert response.status_code == status.HTTP_403_FORBIDDEN
