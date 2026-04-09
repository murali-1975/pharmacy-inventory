import pytest
from fastapi import status
from app import auth, models

def test_login_user_not_found(client, db):
    """Test that a non-existent user returns 404 with specific message."""
    login_data = {
        "username": "nonexistentuser",
        "password": "somepassword"
    }
    # Form data for OAuth2
    response = client.post("/token", data=login_data)
    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert response.json()["detail"] == "We couldn't find an account with that username."

def test_login_incorrect_password(client, db):
    """Test that an existing user with wrong password returns 401 with specific message."""
    # Create a user first
    password = "correctpassword"
    hashed_password = auth.get_password_hash(password)
    user = models.User(
        username="existinguser",
        email="existing@example.com",
        hashed_password=hashed_password,
        role="Staff",
        is_active=True
    )
    db.add(user)
    db.commit()
    
    login_data = {
        "username": "existinguser",
        "password": "wrongpassword"
    }
    response = client.post("/token", data=login_data)
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.json()["detail"] == "The password you entered is incorrect. Please try again."

def test_login_success(client, db):
    """Test that correct credentials still work."""
    password = "correctpassword"
    hashed_password = auth.get_password_hash(password)
    user = models.User(
        username="validuser",
        email="valid@example.com",
        hashed_password=hashed_password,
        role="Staff",
        is_active=True
    )
    db.add(user)
    db.commit()
    
    login_data = {
        "username": "validuser",
        "password": "correctpassword"
    }
    response = client.post("/token", data=login_data)
    assert response.status_code == status.HTTP_200_OK
    assert "access_token" in response.json()
