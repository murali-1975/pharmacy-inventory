"""
Main Application Entry Point.

Initializes the FastAPI application with:
  - Global middleware: CORS, request logging
  - Exception handlers: validation errors, DB errors, and catch-all
  - Lifespan events: database table creation and seed data on startup
  - Router registration for all API domains
"""
from contextlib import asynccontextmanager
import os
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, Request, status, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import SQLAlchemyError
from typing import List
from . import models, database, schemas
from .routers import auth, suppliers, lookups, users, invoices, medicines, manufacturers, stock, dispensing, analytics, financials
from .api.endpoints import finance, expenses
from .core.config import settings
from .core.logging_config import LoggingMiddleware, logger
from . import seed

# Initialize database tables synchronously before app startup
# Database schema is now managed by Alembic migrations.
# models.Base.metadata.create_all(bind=database.engine)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle application startup and shutdown lifecycle events."""
    logger.info(f"Starting {settings.APP_NAME}...")
    # Seed essential lookup data and default admin account
    # Skip seeding during test runs to avoid fixture conflicts
    if not os.getenv("PYTEST_CURRENT_TEST"):
        db = database.SessionLocal()
        try:
            seed.seed_database(db)
        finally:
            db.close()
    yield
    # Shutdown: nothing to clean up in this setup
    logger.info(f"{settings.APP_NAME} shutting down.")

app = FastAPI(title=settings.APP_NAME, lifespan=lifespan)

# CORS Configuration: Allow specific origins for development and production
# CORS Configuration: Allow all origins for simplified LAN access.
# Since we are using an Nginx proxy, the Origin header will match the host's IP/Hostname.
origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)


# --- Global Exception Handlers ---

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle Pydantic validation errors with a structured JSON response."""
    logger.error(f"Validation error: {exc.errors()} on path {request.url.path}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": "Input validation failed", "errors": exc.errors()},
    )

@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError):
    """Handle database layer errors to prevent leaking raw connection/schema details."""
    logger.error(f"Database error: {str(exc)} on path {request.url.path}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "A database error occurred. Please contact support."},
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch-all for unhandled exceptions to ensure the API always returns JSON."""
    logger.error(f"Unexpected error: {str(exc)} on path {request.url.path}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An unexpected server error occurred."},
    )

# --- Router Registration ---
app.include_router(auth.router)
app.include_router(suppliers.router)
app.include_router(lookups.router)
app.include_router(users.router)
app.include_router(invoices.router)
app.include_router(medicines.router)
app.include_router(manufacturers.router)
app.include_router(stock.router)
app.include_router(dispensing.router)
app.include_router(analytics.router)
app.include_router(financials.router)

# Conditionally include staging/feature-flagged routers
if "FINANCE_MANAGEMENT" in [f.strip() for f in settings.FEATURE_FLAGS.split(",") if f.strip()]:
    app.include_router(finance.router)
    app.include_router(expenses.router)

@app.get("/")
def read_root():
    """API root — basic sanity check that the service is reachable."""
    return {"message": "Welcome to Pharmacy Inventory API"}

@app.get("/health", tags=["Health"])
def health_check():
    """
    Lightweight health check for container orchestration (Docker, Kubernetes).
    Returns 200 OK when the application process is running.
    The database connectivity check is handled at startup via seeding.
    """
    return {"status": "healthy", "service": settings.APP_NAME}

@app.get("/status", response_model=List[schemas.StatusSchema], tags=["Health"])
def get_statuses(db: Session = Depends(database.get_db)):
    """
    Returns all statuses. Used by legacy tests and health checks.
    """
    return db.query(models.Status).all()

@app.get("/config/features", tags=["System"])
def get_feature_flags():
    """
    Exposes the active feature flags parsed from the deployment environment.
    Frontend consumes this to toggle staging components.
    """
    flags = [f.strip() for f in settings.FEATURE_FLAGS.split(",") if f.strip()]
    return {"features": flags}
