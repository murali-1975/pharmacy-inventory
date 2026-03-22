from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from . import models, database
from .routers import auth, suppliers, lookups, users, invoices, medicines, manufacturers
from .core.config import settings
from .core.logging_config import LoggingMiddleware, logger

# Initialize database
models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title=settings.APP_NAME)

# Robust CORS Configuration
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

# Universal CORS Middleware for Redirects/Errors
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
    logger.info(f"Starting {settings.APP_NAME}...")

# Global Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global error caught: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An unexpected error occurred. Please try again later."},
    )

# Include Routers
app.include_router(auth.router)
app.include_router(suppliers.router)
app.include_router(lookups.router)
app.include_router(users.router)
app.include_router(invoices.router)
app.include_router(medicines.router)
app.include_router(manufacturers.router)

@app.get("/")
def read_root():
    return {"message": "Welcome to Pharmacy Inventory API"}
