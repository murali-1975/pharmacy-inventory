import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient
import os

from app.database import Base, get_db
from app.auth import get_current_user
from app import models, seed, auth
from app.main import app

# Use an in-memory SQLite database for testing to avoid disk I/O issues in some environments
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, 
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def db():
    # Create the database tables
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    # Pre-seed essential lookup data for tests
    seed.seed_database(db)
    
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
        username="testadmin", 
        email="test@example.com", 
        hashed_password=auth.get_password_hash("testpassword"),
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

@pytest.fixture(scope="function")
def staff_client(db):
    """
    Test client authenticated as a Staff (non-admin) user.
    Used in RBAC tests to verify that 403 is returned for admin-only endpoints.
    """
    staff_user = models.User(
        username="staffuser",
        email="staff@example.com",
        hashed_password=auth.get_password_hash("staffpassword"),
        role="Staff",
        is_active=True
    )
    db.add(staff_user)
    db.commit()
    db.refresh(staff_user)

    def override_get_db():
        try:
            yield db
        finally:
            pass

    def override_get_current_user():
        return staff_user

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    with TestClient(app) as c:
        yield c

    app.dependency_overrides.clear()
