from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from app import models, database, auth, schemas
from app.core.logging_config import logger

router = APIRouter(tags=["Authentication"])

@router.post("/register/", response_model=schemas.UserSchema)
@router.post("/register", response_model=schemas.UserSchema, include_in_schema=False)
def register_user(user: schemas.UserCreate, db: Session = Depends(database.get_db)):
    """
    Register a new user in the system.
    
    Checks if the username is already taken, hashes the password, 
    and saves the new user with an 'Active' status by default.
    """
    try:
        db_user = db.query(models.User).filter(models.User.username == user.username).first()
        if db_user:
            logger.warning(f"Registration failed: Username '{user.username}' already exists.")
            raise HTTPException(status_code=400, detail="Username already registered")
        
        hashed_password = auth.get_password_hash(user.password)
        new_user = models.User(
            username=user.username,
            email=user.email,
            hashed_password=hashed_password,
            role=user.role,
            status_id=user.status_id,
            is_active=True
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        logger.info(f"Successfully registered new user: {user.username} with role {user.role}")
        return new_user
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error during user registration: {str(e)}")
        raise HTTPException(status_code=500, detail="Database error occurred during registration")
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        logger.error(f"Unexpected error during registration: {str(e)}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred")

@router.post("/token/", response_model=schemas.Token)
@router.post("/token", response_model=schemas.Token, include_in_schema=False)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    """
    Authenticate user and return a JWT access token.
    """
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        logger.warning(f"Failed login attempt for username: {form_data.username}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        logger.warning(f"Login attempt for inactive user: {form_data.username}")
        raise HTTPException(status_code=403, detail="User account is inactive")

    access_token = auth.create_access_token(data={"sub": user.username})
    logger.info(f"User logged in successfully: {user.username}")
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/users/me/", response_model=schemas.UserSchema)
@router.get("/users/me", response_model=schemas.UserSchema, include_in_schema=False)
async def read_users_me(current_user: models.User = Depends(auth.get_current_user)):
    """
    Return the profile of the currently authenticated user.
    """
    return current_user
