"""
Database configuration and session management.
Supports PostgreSQL (Production) and SQLite (Local/Testing).
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env_path = os.path.join(BASE_DIR, ".env")
load_dotenv(dotenv_path=env_path)

DB_PATH = os.path.join(BASE_DIR, "pharmacy_inventory.db")
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DB_PATH}")

# Database engine initialization
if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
    )
else:
    # Use standard engine for PostgreSQL with a larger connection pool
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        pool_size=20,          # Base pool size (was default 5)
        max_overflow=40,       # Extra connections when pool is full (was default 10)
        pool_pre_ping=True,    # Verify connections before use to discard stale ones
        pool_recycle=300,      # Recycle connections every 5 minutes
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    """
    FastAPI dependency that provides a local database session.
    Ensures the session is closed after the request is finished.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
