import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient
import os

from app.database import Base, get_db
from app.auth import get_current_user
from app import models
from app.main import app

# Use a separate SQLite database for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_pharmacy_inventory.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def db():
    # Create the database tables
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    # Pre-seed some lookups if needed (optional)
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function")
def client(db):
    # Mock user for authentication-protected routes
    mock_user = models.User(
        username="testuser", 
        email="test@example.com", 
        hashed_password="fakehashedpassword",
        role="Admin"
    )
    db.add(mock_user)
    db.commit()
    db.refresh(mock_user)

    def override_get_db():
        try:
            yield db
        finally:
            pass
    
    def override_get_current_user():
        return mock_user

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    
    with TestClient(app) as c:
        yield c
    
    app.dependency_overrides.clear()
