import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.auth import get_current_user
from app.database import get_db
from app import models

def get_user_override(role: str):
    def override():
        return models.User(
            id=1,
            username="testuser",
            email="test@example.com",
            role=role,
            status_id=1
        )
    return override

@pytest.fixture
def clean_overrides():
    yield
    app.dependency_overrides.clear()

def test_admin_can_access_users(clean_overrides):
    app.dependency_overrides[get_current_user] = get_user_override("Admin")
    with TestClient(app) as client:
        response = client.get("/users/")
        # Status code should be 200 or 404 (if db empty but authorized)
        assert response.status_code != 403

def test_staff_cannot_access_users(clean_overrides):
    app.dependency_overrides[get_current_user] = get_user_override("Staff")
    with TestClient(app) as client:
        response = client.get("/users/")
        assert response.status_code == 403

def test_manager_cannot_access_users(clean_overrides):
    app.dependency_overrides[get_current_user] = get_user_override("Manager")
    with TestClient(app) as client:
        response = client.get("/users/")
        assert response.status_code == 403

def test_staff_cannot_delete_supplier(clean_overrides):
    app.dependency_overrides[get_current_user] = get_user_override("Staff")
    with TestClient(app) as client:
        response = client.delete("/suppliers/1")
        assert response.status_code == 403

def test_manager_cannot_delete_supplier(clean_overrides):
    app.dependency_overrides[get_current_user] = get_user_override("Manager")
    with TestClient(app) as client:
        response = client.delete("/suppliers/1")
        assert response.status_code == 403

def test_admin_can_delete_supplier_access(clean_overrides):
    app.dependency_overrides[get_current_user] = get_user_override("Admin")
    with TestClient(app) as client:
        response = client.delete("/suppliers/9999") # Use non-existent to avoid 403 but get 404
        assert response.status_code != 403

def test_staff_cannot_delete_invoice(clean_overrides):
    app.dependency_overrides[get_current_user] = get_user_override("Staff")
    with TestClient(app) as client:
        response = client.delete("/invoices/1")
        assert response.status_code == 403

def test_manager_can_delete_invoice_access(clean_overrides):
    app.dependency_overrides[get_current_user] = get_user_override("Manager")
    with TestClient(app) as client:
        response = client.delete("/invoices/9999")
        assert response.status_code != 403
