"""
Main Application Entry Point.
Initializes the FastAPI app, configures global middleware (CORS, Logging), 
registers exception handlers, and mounts API routers.
"""
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import SQLAlchemyError
from . import models, database
from .routers import auth, suppliers, lookups, users, invoices, medicines, manufacturers
from .core.config import settings
from .core.logging_config import LoggingMiddleware, logger

# Initialize database tables on startup (Synchronous for simplicity in current setup)
models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title=settings.APP_NAME)

# Robust CORS Configuration: Allow specific origins for local development and testing
origins = [
    "http://localhost:5173", "http://127.0.0.1:5173",
    "http://localhost:5174", "http://127.0.0.1:5174",
    "http://localhost:5175", "http://127.0.0.1:5175",
    "http://localhost:5176", "http://127.0.0.1:5176",
    "http://localhost:3000", "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Universal CORS Middleware: Ensures CORS headers are present even on redirects or server errors.
@app.middleware("http")
async def add_cors_headers(request: Request, call_next):
    origin = request.headers.get("origin")
    response = await call_next(request)
    if origin in origins:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "*"
    return response

@app.on_event("startup")
async def startup_event():
    """Log application startup details."""
    logger.info(f"Starting {settings.APP_NAME}...")

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

@app.get("/")
def read_root():
    """API health check endpoint."""
    return {"message": "Welcome to Pharmacy Inventory API"}
