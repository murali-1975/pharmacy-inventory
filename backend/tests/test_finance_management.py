"""
Finance Management Module — Test Suite.

Covers CRUD operations for master data (Patient Identifiers, Patient Services,
Payment Modes) and the patient payment transaction flow.
Tests are written FIRST per TDD (rules.md §4).
"""
import pytest
from app import models


# =============================================================================
# Master Data — Create (POST)
# =============================================================================

def test_create_patient_identifier(client):
    """Admin can create a new patient identifier type."""
    resp = client.post(
        "/finance/masters/patient_identifiers",
        json={"id_name": "UHID", "is_active": True},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["id_name"] == "UHID"
    assert data["is_active"] is True
    assert data["id"] is not None


def test_create_patient_service(client):
    """Admin can create a new patient service."""
    resp = client.post(
        "/finance/masters/patient_services",
        json={"service_name": "Scan", "is_active": True},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["service_name"] == "Scan"
    assert data["id"] is not None


def test_create_payment_mode(client):
    """Admin can create a new payment mode."""
    resp = client.post(
        "/finance/masters/payment_modes",
        json={"mode": "UPI - (Gpay)", "is_active": True},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["mode"] == "UPI - (Gpay)"
    assert data["id"] is not None


# =============================================================================
# Master Data — RBAC (Admin vs Staff)
# =============================================================================

def test_staff_cannot_create_master(client, staff_client):
    """Staff user should get 403 when creating master data."""
    resp = staff_client.post(
        "/finance/masters/payment_modes",
        json={"mode": "UPI", "is_active": True},
    )
    assert resp.status_code == 403


def test_staff_cannot_update_master(db, staff_client):
    """Staff user should get 403 when updating master data."""
    # Create master data directly in DB to avoid dependency override conflict
    pm = models.PaymentModeMaster(mode="Cash", is_active=True)
    db.add(pm)
    db.commit()
    db.refresh(pm)

    # Staff tries to update
    resp = staff_client.put(
        f"/finance/masters/payment_modes/{pm.id}",
        json={"mode": "Card", "is_active": True},
    )
    assert resp.status_code == 403


def test_staff_cannot_toggle_master(db, staff_client):
    """Staff user should get 403 when toggling master data."""
    srv = models.PatientService(service_name="X-Ray", is_active=True)
    db.add(srv)
    db.commit()
    db.refresh(srv)

    resp = staff_client.patch(f"/finance/masters/patient_services/{srv.id}/toggle")
    assert resp.status_code == 403


# =============================================================================
# Master Data — Read (GET)
# =============================================================================

def test_get_finance_masters(client):
    """GET /finance/masters returns all three master lists."""
    client.post("/finance/masters/patient_services", json={"service_name": "Scan", "is_active": True})
    client.post("/finance/masters/patient_identifiers", json={"id_name": "UHID", "is_active": True})
    client.post("/finance/masters/payment_modes", json={"mode": "UPI - (Gpay)", "is_active": True})

    resp = client.get("/finance/masters")
    assert resp.status_code == 200
    data = resp.json()
    assert "services" in data
    assert "payment_modes" in data
    assert "identifiers" in data
    assert len(data["services"]) >= 1
    assert len(data["identifiers"]) >= 1
    assert len(data["payment_modes"]) >= 1


def test_get_finance_masters_includes_inactive(client):
    """GET /finance/masters?include_inactive=true returns inactive items too."""
    create_resp = client.post(
        "/finance/masters/payment_modes",
        json={"mode": "Cheque", "is_active": True},
    )
    pm_id = create_resp.json()["id"]
    # Toggle to inactive
    client.patch(f"/finance/masters/payment_modes/{pm_id}/toggle")

    # Without include_inactive
    resp = client.get("/finance/masters")
    active_modes = [m for m in resp.json()["payment_modes"] if m["mode"] == "Cheque"]
    assert len(active_modes) == 0

    # With include_inactive
    resp = client.get("/finance/masters?include_inactive=true")
    all_modes = [m for m in resp.json()["payment_modes"] if m["mode"] == "Cheque"]
    assert len(all_modes) == 1
    assert all_modes[0]["is_active"] is False


# =============================================================================
# Master Data — Update (PUT)
# =============================================================================

def test_update_patient_identifier(client):
    """Admin can update a patient identifier name."""
    create_resp = client.post(
        "/finance/masters/patient_identifiers",
        json={"id_name": "Aadhar", "is_active": True},
    )
    ident_id = create_resp.json()["id"]

    resp = client.put(
        f"/finance/masters/patient_identifiers/{ident_id}",
        json={"id_name": "Aadhaar Card", "is_active": True},
    )
    assert resp.status_code == 200
    assert resp.json()["id_name"] == "Aadhaar Card"


def test_update_patient_identifier_not_found(client):
    """PUT on non-existent identifier returns 404."""
    resp = client.put(
        "/finance/masters/patient_identifiers/9999",
        json={"id_name": "Missing", "is_active": True},
    )
    assert resp.status_code == 404


def test_update_patient_identifier_duplicate(client):
    """PUT with duplicate name returns 409 Conflict."""
    client.post("/finance/masters/patient_identifiers", json={"id_name": "Aadhar", "is_active": True})
    create2 = client.post("/finance/masters/patient_identifiers", json={"id_name": "PAN", "is_active": True})
    pan_id = create2.json()["id"]

    resp = client.put(
        f"/finance/masters/patient_identifiers/{pan_id}",
        json={"id_name": "Aadhar", "is_active": True},
    )
    assert resp.status_code == 409


def test_update_patient_service(client):
    """Admin can update a patient service name."""
    create_resp = client.post(
        "/finance/masters/patient_services",
        json={"service_name": "Consultation", "is_active": True},
    )
    srv_id = create_resp.json()["id"]

    resp = client.put(
        f"/finance/masters/patient_services/{srv_id}",
        json={"service_name": "General Consultation", "is_active": True},
    )
    assert resp.status_code == 200
    assert resp.json()["service_name"] == "General Consultation"


def test_update_payment_mode(client):
    """Admin can update a payment mode name."""
    create_resp = client.post(
        "/finance/masters/payment_modes",
        json={"mode": "Cash", "is_active": True},
    )
    pm_id = create_resp.json()["id"]

    resp = client.put(
        f"/finance/masters/payment_modes/{pm_id}",
        json={"mode": "Cash Payment", "is_active": True},
    )
    assert resp.status_code == 200
    assert resp.json()["mode"] == "Cash Payment"


# =============================================================================
# Master Data — Toggle Active (PATCH)
# =============================================================================

def test_toggle_patient_identifier(client):
    """PATCH toggle flips is_active from True to False."""
    create_resp = client.post(
        "/finance/masters/patient_identifiers",
        json={"id_name": "Aadhar", "is_active": True},
    )
    ident_id = create_resp.json()["id"]

    resp = client.patch(f"/finance/masters/patient_identifiers/{ident_id}/toggle")
    assert resp.status_code == 200
    assert resp.json()["is_active"] is False

    # Toggle back
    resp2 = client.patch(f"/finance/masters/patient_identifiers/{ident_id}/toggle")
    assert resp2.status_code == 200
    assert resp2.json()["is_active"] is True


def test_toggle_patient_service(client):
    """PATCH toggle flips is_active on a patient service."""
    create_resp = client.post(
        "/finance/masters/patient_services",
        json={"service_name": "Lab Test", "is_active": True},
    )
    srv_id = create_resp.json()["id"]

    resp = client.patch(f"/finance/masters/patient_services/{srv_id}/toggle")
    assert resp.status_code == 200
    assert resp.json()["is_active"] is False


def test_toggle_payment_mode(client):
    """PATCH toggle flips is_active on a payment mode."""
    create_resp = client.post(
        "/finance/masters/payment_modes",
        json={"mode": "Card", "is_active": True},
    )
    pm_id = create_resp.json()["id"]

    resp = client.patch(f"/finance/masters/payment_modes/{pm_id}/toggle")
    assert resp.status_code == 200
    assert resp.json()["is_active"] is False


def test_toggle_not_found(client):
    """PATCH toggle on non-existent ID returns 404."""
    resp = client.patch("/finance/masters/patient_identifiers/9999/toggle")
    assert resp.status_code == 404


# =============================================================================
# Patient Payment — Transaction Flow
# =============================================================================

def test_create_patient_payment(client):
    """Full patient payment creation with identifiers and services."""
    srv_resp = client.post("/finance/masters/patient_services", json={"service_name": "Consultation", "is_active": True})
    srv_id = srv_resp.json()["id"]

    pm_resp = client.post("/finance/masters/payment_modes", json={"mode": "Cash", "is_active": True})
    pm_id = pm_resp.json()["id"]

    id_resp = client.post("/finance/masters/patient_identifiers", json={"id_name": "Aadhar", "is_active": True})
    ident_id = id_resp.json()["id"]

    payload = {
        "patient_name": "John Doe",
        "payment_date": "2026-04-23",
        "total_amount": 500.0,
        "gst_amount": 0.0,
        "notes": "Regular checkup",
        "free_flag": False,
        "identifiers": [
            {"identifier_id": ident_id, "id_value": "123456789"}
        ],
        "services": [
            {
                "service_id": srv_id,
                "amount": 500.0
            }
        ],
        "payments": [
            {"payment_mode_id": pm_id, "value": 500.0, "notes": "Paid in full"}
        ]
    }

    resp = client.post("/finance/payments", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["patient_name"] == "John Doe"
    assert "id" in data
    assert len(data["services"]) == 1
    assert data["services"][0]["service_id"] == srv_id
    assert len(data["payments"]) == 1


def test_create_payment_invalid_foreign_key(client):
    """Invalid foreign keys are caught and rolled back cleanly."""
    payload = {
        "patient_name": "Jane Doe",
        "payment_date": "2026-04-23",
        "total_amount": 100.0,
        "gst_amount": 0.0,
        "services": [
            {
                "service_id": 9999,
                "amount": 100.0
            }
        ],
        "payments": []
    }
    resp = client.post("/finance/payments", json=payload)
    assert resp.status_code in [400, 404, 422, 409]


def test_create_free_payment(client):
    """Verify that a payment can be recorded with free_flag=True and no payments."""
    srv_resp = client.post("/finance/masters/patient_services", json={"service_name": "Consultation", "is_active": True})
    srv_id = srv_resp.json()["id"]

    payload = {
        "patient_name": "Fathima",
        "payment_date": "2026-04-23",
        "total_amount": 400.0,
        "gst_amount": 0.0,
        "free_flag": True,
        "services": [{"service_id": srv_id, "amount": 400.0}],
        "payments": []
    }

    resp = client.post("/finance/payments", json=payload)
    assert resp.status_code == 201
    assert resp.json()["free_flag"] is True
    assert len(resp.json()["payments"]) == 0


def test_create_split_payment(client):
    """Verify that a payment can be split across multiple modes."""
    srv_resp = client.post("/finance/masters/patient_services", json={"service_name": "Scan", "is_active": True})
    srv_id = srv_resp.json()["id"]
    
    pm1_resp = client.post("/finance/masters/payment_modes", json={"mode": "Cash", "is_active": True})
    pm1_id = pm1_resp.json()["id"]
    pm2_resp = client.post("/finance/masters/payment_modes", json={"mode": "UPI", "is_active": True})
    pm2_id = pm2_resp.json()["id"]

    payload = {
        "patient_name": "Priya",
        "payment_date": "2026-04-23",
        "total_amount": 1140.0,
        "gst_amount": 0.0,
        "free_flag": False,
        "services": [{"service_id": srv_id, "amount": 1140.0}],
        "payments": [
            {"payment_mode_id": pm1_id, "value": 1000.0},
            {"payment_mode_id": pm2_id, "value": 140.0}
        ]
    }

    resp = client.post("/finance/payments", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert len(data["payments"]) == 2
    assert sum(p["value"] for p in data["payments"]) == 1140.0


def test_get_payment_history(client):
    """GET /finance/payments returns paginated result."""
    resp = client.get("/finance/payments?limit=10&offset=0")
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data
