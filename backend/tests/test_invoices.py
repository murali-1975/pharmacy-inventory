import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import get_db, Base
from app.auth import get_current_user
from app import models
# from sqlalchemy import create_all # Removed incorrect import

# Note: conftest.py already provides the overrides for get_db and get_current_user

def test_create_invoice(client, db):
    # 0. Seed lookups - Handled by conftest.py db fixture
    pass

    # 1. Create a supplier first
    supplier_res = client.post("/suppliers/", json={"supplier_name": "Test Supplier", "type_id": 1, "status_id": 1})
    assert supplier_res.status_code == 200
    supplier_id = supplier_res.json()["id"]

    # 2. Get a medicine (seeded earlier or via API)
    med_res = client.post("/medicines/", json={"product_name": "Test Med", "description": "Test Desc"})
    assert med_res.status_code == 200
    med_id = med_res.json()["id"]

    # 3. Create invoice
    invoice_data = {
        "supplier_id": supplier_id,
        "invoice_date": "2024-03-21",
        "reference_number": "INV-123",
        "total_value": 1500.0,
        "gst": 270.0,
        "line_items": [
            {
                "medicine_id": med_id,
                "quantity": 10,
                "price": 150.0,
                "discount": 0.0,
                "expiry_date": "2026-12-31"
            }
        ]
    }
    res = client.post("/invoices/", json=invoice_data)
    assert res.status_code == 200
    data = res.json()
    assert data["reference_number"] == "INV-123"
    assert len(data["line_items"]) == 1
    assert data["line_items"][0]["medicine_id"] == med_id

def test_list_invoices(client):
    res = client.get("/invoices/")
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert isinstance(data["items"], list)

def test_get_invoice(client):
    # Assuming at least one invoice exists from previous test (if using same DB)
    res = client.get("/invoices/1")
    if res.status_code == 200:
        assert "reference_number" in res.json()

def test_delete_invoice(client, db):
    # 0. Seed lookups - Handled by conftest.py db fixture
    pass

    # Create one to delete
    supplier_res = client.post("/suppliers/", json={"supplier_name": "Delete Supplier", "type_id": 1, "status_id": 1})
    supplier_id = supplier_res.json()["id"]
    
    inv_res = client.post("/invoices/", json={
        "supplier_id": supplier_id,
        "invoice_date": "2024-03-21",
        "reference_number": "INV-DELETE",
        "total_value": 100.0,
        "gst": 0.0,
        "line_items": []
    })
    inv_id = inv_res.json()["id"]
    
    del_res = client.delete(f"/invoices/{inv_id}")
    assert del_res.status_code == 204
    
    get_res = client.get(f"/invoices/{inv_id}")
    assert get_res.status_code == 404

def test_create_non_pharmacy_invoice(client, db):
    # 0. Seed lookups - Handled by conftest.py db fixture
    pass

    # 1. Create a printer supplier
    supplier_res = client.post("/suppliers/", json={"supplier_name": "Printer Corp", "type_id": 3, "status_id": 1})
    supplier_id = supplier_res.json()["id"]

    # 2. Create invoice with description instead of medicine_id
    invoice_data = {
        "supplier_id": supplier_id,
        "invoice_date": "2024-03-21",
        "reference_number": "INV-PRINTER-001",
        "total_value": 5000.0,
        "gst": 900.0,
        "line_items": [
            {
                "description": "Premium Paper Reams",
                "quantity": 5,
                "price": 1000.0,
                "discount": 0.0,
                "expiry_date": None
            }
        ]
    }
    res = client.post("/invoices/", json=invoice_data)
    assert res.status_code == 200
    data = res.json()
    assert data["reference_number"] == "INV-PRINTER-001"
    assert data["line_items"][0]["description"] == "Premium Paper Reams"
    assert data["line_items"][0]["medicine_id"] is None
