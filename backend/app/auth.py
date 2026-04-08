"""
Authentication and Authorization module.

Responsibilities:
  - Password hashing and verification using PBKDF2-SHA256 (via passlib).
  - JWT access token creation and validation using python-jose.
  - FastAPI dependency ``get_current_user`` for all authenticated routes.
  - ``RoleChecker`` dependency class for RBAC (Admin, Manager, Staff).
"""
from datetime import datetime, timedelta, timezone
from typing import Optional, List
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
import os

from . import models, database
from .core.config import settings
from .core.logging_config import logger

# Configuration - Now using centralized settings
SECRET_KEY = settings.SECRET_KEY
ALGORITHM = settings.ALGORITHM
ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES

# Security: Using pbkdf2_sha256 as primary to avoid bcrypt 72-byte strictness in some environments.
pwd_context = CryptContext(schemes=["pbkdf2_sha256", "bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plain text password against its stored PBKDF2-SHA256 hash."""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Generates a secure PBKDF2-SHA256 hash of a plain text password."""
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Generates a signed JWT access token.

    Args:
        data:          Payload dict (must include ``sub`` key with the username).
        expires_delta: Optional custom lifetime; defaults to ACCESS_TOKEN_EXPIRE_MINUTES.

    Returns:
        A signed JWT string.
    """
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    logger.info(f"Token created for user: {data.get('sub')}")
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(database.get_db)):
    """
    FastAPI dependency that extracts the user from a JWT token.
    Security: Verifies token integrity AND checks if the user account is active.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    inactive_exception = HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="User account is deactivated. Please contact an administrator.",
    )
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    user = db.query(models.User).filter(models.User.username == username).first()
    if user is None:
        raise credentials_exception
    
    # Fix [V08]: Prevent inactive users from accessing the system even with a valid token.
    if not user.is_active:
        logger.warning(f"Deactivated user {username} attempted access with a valid token.")
        raise inactive_exception
        
    return user

class RoleChecker:
    """
    Dependency to check if the current user has at least one of the allowed roles.
    Example: Depends(RoleChecker(["Admin", "Manager"]))
    """
    def __init__(self, allowed_roles: List[str]):
        self.allowed_roles = allowed_roles

    def __call__(self, user: models.User = Depends(get_current_user)):
        if user.role not in self.allowed_roles:
            logger.warning(f"Unauthorized access attempt by user {user.username} (Role: {user.role}) to restricted resource")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have enough privileges to perform this operation"
            )
        return user
