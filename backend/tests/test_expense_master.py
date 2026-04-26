"""
Expense Master Data — TDD Test Suite.
Following Section 4 of rules.md: Unit tests first.
"""
import pytest
from app import models

# =============================================================================
# Expense Master — Create (POST)
# =============================================================================

def test_create_expense_type(client):
    """Admin can create a new expense type."""
    resp = client.post(
        "/finance/masters/expense_types",
        json={"name": "Electricity", "is_active": True},
    )
    # This will fail initially with 404 or 405 as endpoint doesn't exist
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Electricity"
    assert data["is_active"] is True
    assert data["id"] is not None

def test_create_expense_type_duplicate(client):
    """Creating a duplicate expense type should return 409."""
    client.post("/finance/masters/expense_types", json={"name": "Rent", "is_active": True})
    resp = client.post("/finance/masters/expense_types", json={"name": "Rent", "is_active": True})
    assert resp.status_code == 409

# =============================================================================
# Expense Master — RBAC
# =============================================================================

def test_staff_cannot_create_expense_type(staff_client):
    """Staff user should get 403 when creating expense master."""
    resp = staff_client.post(
        "/finance/masters/expense_types",
        json={"name": "Travel", "is_active": True},
    )
    assert resp.status_code == 403

# =============================================================================
# Expense Master — Update (PUT)
# =============================================================================

def test_update_expense_type(client):
    """Admin can update an expense type name."""
    create_resp = client.post(
        "/finance/masters/expense_types",
        json={"name": "Internet", "is_active": True},
    )
    exp_id = create_resp.json()["id"]

    resp = client.put(
        f"/finance/masters/expense_types/{exp_id}",
        json={"name": "High Speed Internet", "is_active": True},
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "High Speed Internet"

# =============================================================================
# Expense Master — Toggle Status (PATCH)
# =============================================================================

def test_toggle_expense_type(client):
    """Admin can toggle the active status of an expense type."""
    create_resp = client.post(
        "/finance/masters/expense_types",
        json={"name": "Cleaning", "is_active": True},
    )
    exp_id = create_resp.json()["id"]

    # Deactivate
    resp = client.patch(f"/finance/masters/expense_types/{exp_id}/toggle")
    assert resp.status_code == 200
    assert resp.json()["is_active"] is False

    # Reactivate
    resp2 = client.patch(f"/finance/masters/expense_types/{exp_id}/toggle")
    assert resp2.status_code == 200
    assert resp2.json()["is_active"] is True

# =============================================================================
# Expense Master — Aggregated Masters (GET)
# =============================================================================

def test_get_finance_masters_includes_expenses(client):
    """Aggregated masters endpoint should now include expense_types."""
    client.post("/finance/masters/expense_types", json={"name": "Maintenance", "is_active": True})
    
    resp = client.get("/finance/masters")
    assert resp.status_code == 200
    data = resp.json()
    assert "expense_types" in data
    assert any(e["name"] == "Maintenance" for e in data["expense_types"])
