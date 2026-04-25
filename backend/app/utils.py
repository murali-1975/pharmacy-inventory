"""
Shared Utility Helpers for the Pharmacy Inventory API.
"""
from contextlib import contextmanager
from typing import Any
from fastapi import HTTPException
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from app.core.logging_config import logger

class AppError(Exception):
    """Base class for application-specific errors."""
    def __init__(self, message: str, status_code: int = 500, detail: Any = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.detail = detail

class ResourceNotFoundError(AppError):
    def __init__(self, resource: str, identifier: Any):
        super().__init__(f"{resource} with ID {identifier} not found", status_code=404)

class ValidationError(AppError):
    def __init__(self, message: str, detail: Any = None):
        super().__init__(message, status_code=400, detail=detail)

class FinanceModuleError(AppError):
    def __init__(self, message: str, detail: Any = None):
        super().__init__(f"Finance Error: {message}", status_code=400, detail=detail)


@contextmanager
def db_error_handler(operation_name: str, db_session=None):
    """
    Context manager for consistent SQLAlchemy error handling across routers.
    """
    try:
        yield
    except AppError as e:
        # Re-raise our custom application errors
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except IntegrityError as e:
        if db_session:
            db_session.rollback()
        error_msg = f"Integrity constraint violation during {operation_name}: {str(e.orig)}"
        logger.warning(error_msg)
        raise HTTPException(
            status_code=409,
            detail=f"A conflict occurred during {operation_name}. The resource may already exist or violate a uniqueness constraint."
        )
    except SQLAlchemyError as e:
        if db_session:
            db_session.rollback()
        error_msg = f"Database error during {operation_name}: {str(e)}"
        logger.error(error_msg)
        raise HTTPException(
            status_code=500,
            detail=f"Internal database error occurred during {operation_name}"
        )
    except HTTPException:
        raise
    except Exception as e:
        if db_session:
            db_session.rollback()
        logger.error(f"Unexpected error during {operation_name}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"An unexpected error occurred during {operation_name}"
        )
