import pytest
from app import models, auth

def test_create_user_admin_only(client, db):
    """Test that only admins can create users."""
    user_data = {
        "username": "newstaff",
        "email": "staff@test.com",
        "password": "secretpassword",
        "role": "Staff"
    }
    # conftest.py mocks an Admin user by default for 'client'
    res = client.post("/users/", json=user_data)
    assert res.status_code == 200
    assert res.json()["username"] == "newstaff"

def test_self_password_update(client, db):
    """Test that a user can update their own password."""
    # Note: client is logged in as 'testadmin' (Admin) with 'fakehashedpassword' from conftest
    # We need to bridge the gap: our override uses 'fakehashedpassword'
    # but verify_password in user logic will use the DB record.
    
    # Update the DB record's hash to match what verify_password expects
    user = db.query(models.User).filter(models.User.username == "testadmin").first()
    user.hashed_password = auth.get_password_hash("oldpass123")
    db.commit()
    
    update_data = {
        "old_password": "oldpass123",
        "new_password": "newsecurepass"
    }
    res = client.put("/users/me/password", json=update_data)
    assert res.status_code == 200
    assert res.json()["message"] == "Password updated successfully"
    
    # Verify in DB
    db.refresh(user)
    assert auth.verify_password("newsecurepass", user.hashed_password)

def test_delete_user_protection(client, db):
    """Test that admins cannot delete themselves."""
    # Find the current user ID
    user = db.query(models.User).filter(models.User.username == "testadmin").first()
    user_id = user.id
    
    res = client.delete(f"/users/{user_id}")
    assert res.status_code == 400
    assert res.json()["detail"] == "Cannot delete self"


def test_list_users_requires_admin(staff_client, db):
    """
    GET /users/ is Admin-only — a Staff user should receive HTTP 403 Forbidden.
    Uses the staff_client fixture from conftest.py which is authenticated as a Staff role.
    """
    res = staff_client.get("/users/")
    assert res.status_code == 403
