import pytest
from app import auth

@pytest.mark.unit
def test_password_hashing_logic():
    """Verify that password hashing and verification is consistent."""
    password = "secret_password_123"
    hashed = auth.get_password_hash(password)
    assert hashed != password
    assert auth.verify_password(password, hashed) is True
    assert auth.verify_password("wrong_password", hashed) is False

@pytest.mark.unit
def test_password_hash_uniqueness():
    """Verify that same password results in different hashes (salting)."""
    password = "same_password"
    hash1 = auth.get_password_hash(password)
    hash2 = auth.get_password_hash(password)
    assert hash1 != hash2
