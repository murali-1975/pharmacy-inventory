from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from typing import List
from .. import models, database, auth, schemas
from ..core.logging_config import logger

router = APIRouter(prefix="/users", tags=["Users"])

admin_required = auth.RoleChecker(["Admin"])

@router.get("/", response_model=List[schemas.UserSchema])
@router.get("", response_model=List[schemas.UserSchema], include_in_schema=False)
def get_users(
    db: Session = Depends(database.get_db), 
    current_user: models.User = Depends(admin_required)
):
    """
    List all users in the system. Restricted to Admins.
    """
    return db.query(models.User).all()

@router.post("/", response_model=schemas.UserSchema)
@router.post("", response_model=schemas.UserSchema, include_in_schema=False)
def create_user(
    user_in: schemas.UserCreate, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(admin_required)
):
    """
    Create a new user. Restricted to Admins.
    """
    try:
        db_user = db.query(models.User).filter(models.User.username == user_in.username).first()
        if db_user:
            logger.warning(f"User creation failed: Username '{user_in.username}' already exists.")
            raise HTTPException(status_code=400, detail="Username already registered")
        
        hashed_password = auth.get_password_hash(user_in.password)
        new_user = models.User(
            username=user_in.username,
            email=user_in.email,
            hashed_password=hashed_password,
            role=user_in.role,
            status_id=user_in.status_id
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        logger.info(f"Admin {current_user.username} created new user: {new_user.username}")
        return new_user
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error during user creation: {str(e)}")
        raise HTTPException(status_code=500, detail="Could not create user in database")
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        logger.error(f"Unexpected error in create_user: {str(e)}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred")

@router.put("/{user_id}/", response_model=schemas.UserSchema)
@router.put("/{user_id}", response_model=schemas.UserSchema, include_in_schema=False)
def update_user(
    user_id: int, 
    user_in: schemas.UserUpdate, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(admin_required)
):
    """
    Update an existing user. Restricted to Admins.
    """
    try:
        db_user = db.query(models.User).filter(models.User.id == user_id).first()
        if not db_user:
            logger.warning(f"User update failed: User ID {user_id} not found.")
            raise HTTPException(status_code=404, detail="User not found")
        
        update_data = user_in.model_dump(exclude_unset=True)
        if "password" in update_data:
            db_user.hashed_password = auth.get_password_hash(update_data["password"])
            del update_data["password"]
        
        for field, value in update_data.items():
            setattr(db_user, field, value)
        
        db.commit()
        db.refresh(db_user)
        logger.info(f"Admin {current_user.username} updated user {db_user.username} (ID: {user_id})")
        return db_user
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error during user update (ID: {user_id}): {str(e)}")
        raise HTTPException(status_code=500, detail="Could not update user in database")

@router.delete("/{user_id}/")
@router.delete("/{user_id}", include_in_schema=False)
def delete_user(
    user_id: int, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(admin_required)
):
    """
    Delete a user. Users cannot delete themselves. Restricted to Admins.
    """
    try:
        if current_user.id == user_id:
            logger.warning(f"Admin {current_user.username} attempted to delete themselves.")
            raise HTTPException(status_code=400, detail="Cannot delete self")
        
        db_user = db.query(models.User).filter(models.User.id == user_id).first()
        if not db_user:
            logger.warning(f"User deletion failed: User ID {user_id} not found.")
            raise HTTPException(status_code=404, detail="User not found")
        
        username = db_user.username
        db.delete(db_user)
        db.commit()
        logger.info(f"Admin {current_user.username} deleted user {username} (ID: {user_id})")
        return {"message": "User deleted successfully"}
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error during user deletion (ID: {user_id}): {str(e)}")
        raise HTTPException(status_code=500, detail="Could not delete user from database")
