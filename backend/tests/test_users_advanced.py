import pytest
from fastapi import status
from app import models, auth

def test_get_users(client):
    response = client.get("/users/")
    assert response.status_code == status.HTTP_200_OK
    assert isinstance(response.json(), list)
    assert len(response.json()) >= 1 # At least the mock user from conftest

def test_create_user_success(client):
    user_data = {
        "username": "newuser",
        "email": "new@example.com",
        "password": "newpassword123",
        "role": "Staff",
        "status_id": 1
    }
    response = client.post("/users/", json=user_data)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["username"] == "newuser"
    assert "hashed_password" not in data

def test_create_user_duplicate(client):
    user_data = {
        "username": "testadmin", # Already exists from conftest
        "email": "another@example.com",
        "password": "password123",
        "role": "Staff",
        "status_id": 1
    }
    response = client.post("/users/", json=user_data)
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json()["detail"] == "Username already registered"

def test_update_user(client, db):
    # Create a user to update
    user = models.User(username="toupdate", email="up@ex.com", hashed_password="...", role="Staff")
    db.add(user)
    db.commit()
    db.refresh(user)

    update_data = {"email": "updated@example.com", "role": "Manager"}
    response = client.put(f"/users/{user.id}", json=update_data)
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["email"] == "updated@example.com"
    assert response.json()["role"] == "Manager"

def test_delete_user_success(client, db):
    # Create a user to delete
    user = models.User(username="todelete", email="del@ex.com", hashed_password="...", role="Staff")
    db.add(user)
    db.commit()
    db.refresh(user)

    response = client.delete(f"/users/{user.id}")
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["message"] == "User deleted successfully"

def test_delete_self_prevention(client, db):
    # Get current user id (mock user is created in conftest and has username 'testuser')
    current_user = db.query(models.User).filter(models.User.username == "testadmin").first()
    
    response = client.delete(f"/users/{current_user.id}")
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json()["detail"] == "Cannot delete self"

def test_update_own_password(client):
    password_data = {
        "old_password": "testpassword", # From conftest mock_user
        "new_password": "newsecurepassword"
    }
    response = client.put("/users/me/password", json=password_data)
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["message"] == "Password updated successfully"

def test_update_own_password_incorrect_old(client):
    password_data = {
        "old_password": "wrongoldpassword",
        "new_password": "newsecurepassword"
    }
    response = client.put("/users/me/password", json=password_data)
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json()["detail"] == "Incorrect current password"
