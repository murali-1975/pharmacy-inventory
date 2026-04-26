"""
Record Expense Feature — TDD Test Suite.
Following Section 4 of rules.md: Unit tests first.
"""
import pytest
from app import models
import datetime

# =============================================================================
# Expense Recording — POST /expenses
# =============================================================================

def test_create_expense_with_split_payments(client):
    """Admin can record an expense with multiple payment modes."""
    # Setup: Create Expense Type and Payment Modes
    exp_type_resp = client.post("/finance/masters/expense_types", json={"name": "Utilities", "is_active": True})
    exp_type_id = exp_type_resp.json()["id"]

    pm1_resp = client.post("/finance/masters/payment_modes", json={"mode": "Cash", "is_active": True})
    pm1_id = pm1_resp.json()["id"]
    pm2_resp = client.post("/finance/masters/payment_modes", json={"mode": "GPay", "is_active": True})
    pm2_id = pm2_resp.json()["id"]

    payload = {
        "expense_date": "2026-04-25",
        "expense_type_id": exp_type_id,
        "details": "Monthly Electricity Bill",
        "reference_number": "ELE-2026-04",
        "amount": 1000.0,
        "gst_amount": 180.0,
        "total_amount": 1180.0,
        "notes": "Paid via split modes",
        "payments": [
            {"payment_mode_id": pm1_id, "amount": 500.0, "notes": "From petty cash"},
            {"payment_mode_id": pm2_id, "amount": 680.0, "notes": "Remaining via GPay"}
        ]
    }

    resp = client.post("/finance/expenses", json=payload)
    # Initially fails with 404 or 405
    assert resp.status_code == 201
    data = resp.json()
    assert data["total_amount"] == 1180.0
    assert len(data["payments"]) == 2
    assert "created_by" in data
    assert "created_date" in data

def test_create_expense_invalid_total(client):
    """Recording an expense where payments don't match total should fail (or at least be validated)."""
    exp_type_resp = client.post("/finance/masters/expense_types", json={"name": "Rent", "is_active": True})
    exp_type_id = exp_type_resp.json()["id"]

    payload = {
        "expense_date": "2026-04-25",
        "expense_type_id": exp_type_id,
        "details": "Office Rent",
        "amount": 5000.0,
        "gst_amount": 0.0,
        "total_amount": 5000.0,
        "payments": [
            {"payment_mode_id": 1, "amount": 100.0} # Incorrect sum
        ]
    }
    resp = client.post("/finance/expenses", json=payload)
    assert resp.status_code == 400

# =============================================================================
# Expense Retrieval — GET /expenses
# =============================================================================

def test_get_expenses_paginated(client):
    """GET /finance/expenses returns paginated results."""
    resp = client.get("/finance/expenses?limit=10&offset=0")
    assert resp.status_code == 200
    assert "items" in resp.json()
    assert "total" in resp.json()

# =============================================================================
# Expense RBAC & Soft Delete
# =============================================================================

def test_staff_cannot_cancel_expense(staff_client, db):
    """Staff users cannot delete/cancel expense records."""
    # Note: Logic to create a dummy expense directly in DB if needed
    resp = staff_client.delete("/finance/expenses/1")
    assert resp.status_code == 403

def test_admin_can_soft_delete_expense(client, db):
    """Admin can cancel an expense (Soft Delete)."""
    # Create an expense first
    exp_type_resp = client.post("/finance/masters/expense_types", json={"name": "Misc", "is_active": True})
    exp_type_id = exp_type_resp.json()["id"]
    
    pm_resp = client.post("/finance/masters/payment_modes", json={"mode": "Cash", "is_active": True})
    pm_id = pm_resp.json()["id"]
    
    payload = {
        "expense_date": "2026-04-25",
        "expense_type_id": exp_type_id,
        "details": "To be deleted",
        "amount": 100.0,
        "gst_amount": 0.0,
        "total_amount": 100.0,
        "payments": [{"payment_mode_id": pm_id, "amount": 100.0}]
    }
    create_resp = client.post("/finance/expenses", json=payload)
    exp_id = create_resp.json()["id"]

    # Delete
    del_resp = client.delete(f"/finance/expenses/{exp_id}")
    assert del_resp.status_code == 200
    
    # Verify soft delete
    get_resp = client.get(f"/finance/expenses/{exp_id}")
    assert get_resp.status_code == 404 # Assuming GET excludes deleted items

# =============================================================================
# Expense Update — PUT /expenses/{id}
# =============================================================================

def test_update_expense_success(client, db):
    """Admin can update an existing expense and its payments."""
    # 1. Create
    exp_type_resp = client.post("/finance/masters/expense_types", json={"name": "Travel", "is_active": True})
    exp_type_id = exp_type_resp.json()["id"]
    pm_resp = client.post("/finance/masters/payment_modes", json={"mode": "Credit Card", "is_active": True})
    pm_id = pm_resp.json()["id"]

    payload = {
        "expense_date": "2026-04-25",
        "expense_type_id": exp_type_id,
        "details": "Original Flight",
        "amount": 5000.0,
        "total_amount": 5000.0,
        "payments": [{"payment_mode_id": pm_id, "amount": 5000.0}]
    }
    create_resp = client.post("/finance/expenses", json=payload)
    exp_id = create_resp.json()["id"]

    # 2. Update
    update_payload = payload.copy()
    update_payload["details"] = "Updated Flight (Business)"
    update_payload["amount"] = 8000.0
    update_payload["total_amount"] = 8000.0
    update_payload["payments"] = [{"payment_mode_id": pm_id, "amount": 8000.0}]

    update_resp = client.put(f"/finance/expenses/{exp_id}", json=update_payload)
    assert update_resp.status_code == 200
    data = update_resp.json()
    assert data["details"] == "Updated Flight (Business)"
    assert data["total_amount"] == 8000.0
    assert len(data["payments"]) == 1
    assert data["payments"][0]["amount"] == 8000.0

def test_update_expense_mismatched_total(client, db):
    """Updating an expense with mismatched payments should fail."""
    # 1. Create (existing logic)
    exp_type_resp = client.post("/finance/masters/expense_types", json={"name": "Food", "is_active": True})
    exp_type_id = exp_type_resp.json()["id"]
    pm_resp = client.post("/finance/masters/payment_modes", json={"mode": "Cash", "is_active": True})
    pm_id = pm_resp.json()["id"]
    payload = {
        "expense_date": "2026-04-25",
        "expense_type_id": exp_type_id,
        "details": "Dinner",
        "amount": 100.0,
        "total_amount": 100.0,
        "payments": [{"payment_mode_id": pm_id, "amount": 100.0}]
    }
    create_resp = client.post("/finance/expenses", json=payload)
    exp_id = create_resp.json()["id"]

    # 2. Invalid Update
    update_payload = payload.copy()
    update_payload["total_amount"] = 200.0 # Mismatch
    resp = client.put(f"/finance/expenses/{exp_id}", json=update_payload)
    assert resp.status_code == 400
