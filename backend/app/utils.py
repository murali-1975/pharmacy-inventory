"""
Shared Utility Helpers for the Pharmacy Inventory API.

This module provides reusable building blocks used across all routers:

  db_error_handler  — A context manager that wraps database operations to catch
                      SQLAlchemy errors, roll back the session if needed, log the
                      problem, and return a clean HTTP error to the client. It also
                      distinguishes IntegrityError (e.g., duplicate unique keys) from
                      generic DB failures so callers receive a meaningful 409 vs 500.

Usage:
    with utils.db_error_handler("invoice creation", db):
        # ... database operations ...
        db.commit()
"""
from contextlib import contextmanager
from fastapi import HTTPException
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from app.core.logging_config import logger


@contextmanager
def db_error_handler(operation_name: str, db_session=None):
    """
    Context manager for consistent SQLAlchemy error handling across routers.

    Behaviour:
    - ``IntegrityError`` (e.g., unique constraint violation, FK violation)
      → rolls back, logs a warning, raises HTTP 409 Conflict.
    - Other ``SQLAlchemyError`` (connection issues, query errors, etc.)
      → rolls back, logs an error, raises HTTP 500 Internal Server Error.
    - ``HTTPException`` (404, 400, 403, etc. raised by business logic)
      → re-raised as-is without modification.
    - Any other unexpected exception
      → rolls back, logs an error, raises HTTP 500.

    Args:
        operation_name: A short human-readable label used in log messages
                        (e.g., ``"invoice creation"``, ``"stock adjustment"``).
        db_session:     The SQLAlchemy ``Session`` to roll back on error.
                        Pass ``None`` for read-only operations where rollback
                        is not required.
    """
    try:
        yield
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
        # Re-raise HTTPExceptions (404s, 400s, 403s, etc.) without modification
        raise
    except Exception as e:
        if db_session:
            db_session.rollback()
        logger.error(f"Unexpected error during {operation_name}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"An unexpected error occurred during {operation_name}"
        )
