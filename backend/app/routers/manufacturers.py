"""
Manufacturer Master Router.
Handles CRUD operations for medicine manufacturers and pharmaceutical brands.
Access: All authenticated users (Read), Admin/Manager (Write/Delete).
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from typing import List
from app import models, database, auth, schemas
from app.core.logging_config import logger

router = APIRouter(
    prefix="/manufacturers",
    tags=["manufacturers"],
    dependencies=[Depends(auth.get_current_user)]
)

admin_manager_required = auth.RoleChecker(["Admin", "Manager"])

@router.get("/", response_model=List[schemas.ManufacturerSchema])
def list_manufacturers(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db)):
    """
    List all manufacturers with optional pagination.
    """
    try:
        return db.query(models.Manufacturer).offset(skip).limit(limit).all()
    except SQLAlchemyError as e:
        logger.error(f"Database error during manufacturers retrieval: {str(e)}")
        raise HTTPException(status_code=500, detail="Could not retrieve manufacturers from database")

@router.post("/", response_model=schemas.ManufacturerSchema)
def create_manufacturer(
    manufacturer_in: schemas.ManufacturerCreate, 
    db: Session = Depends(database.get_db), 
    current_user: models.User = Depends(admin_manager_required)
):
    """
    Add a new manufacturer to the master list.
    Requires: Admin or Manager role.
    """
    try:
        db_manufacturer = models.Manufacturer(**manufacturer_in.model_dump())
        db.add(db_manufacturer)
        db.commit()
        db.refresh(db_manufacturer)
        logger.info(f"User {current_user.username} created manufacturer: {db_manufacturer.name} (ID: {db_manufacturer.id})")
        return db_manufacturer
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error during manufacturer creation: {str(e)}")
        if "unique constraint" in str(e).lower() or "duplicate key" in str(e).lower():
            raise HTTPException(status_code=400, detail="Manufacturer name already exists")
        raise HTTPException(status_code=500, detail="Could not create manufacturer in database")

@router.put("/{manufacturer_id}/", response_model=schemas.ManufacturerSchema)
def update_manufacturer(
    manufacturer_id: int, 
    manufacturer_in: schemas.ManufacturerCreate, 
    db: Session = Depends(database.get_db), 
    current_user: models.User = Depends(admin_manager_required)
):
    """
    Update details for an existing manufacturer.
    Requires: Admin or Manager role.
    """
    try:
        db_manufacturer = db.query(models.Manufacturer).filter(models.Manufacturer.id == manufacturer_id).first()
        if not db_manufacturer:
            logger.warning(f"Manufacturer update failed: ID {manufacturer_id} not found.")
            raise HTTPException(status_code=404, detail="Manufacturer not found")
        
        for field, value in manufacturer_in.model_dump(exclude_unset=True).items():
            setattr(db_manufacturer, field, value)
        
        db.commit()
        db.refresh(db_manufacturer)
        logger.info(f"User {current_user.username} updated manufacturer: {db_manufacturer.name} (ID: {manufacturer_id})")
        return db_manufacturer
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error during manufacturer update (ID: {manufacturer_id}): {str(e)}")
        raise HTTPException(status_code=500, detail="Could not update manufacturer in database")

@router.delete("/{manufacturer_id}/")
def delete_manufacturer(
    manufacturer_id: int, 
    db: Session = Depends(database.get_db), 
    current_user: models.User = Depends(admin_manager_required)
):
    """
    Delete a manufacturer.
    Requires: Admin or Manager role.
    Security: If any medicines are linked to this manufacturer, it is soft-deleted (is_active=False) to maintain catalog history.
    """
    try:
        db_manufacturer = db.query(models.Manufacturer).filter(models.Manufacturer.id == manufacturer_id).first()
        if not db_manufacturer:
            logger.warning(f"Manufacturer deletion failed: ID {manufacturer_id} not found.")
            raise HTTPException(status_code=404, detail="Manufacturer not found")
        
        # Check if manufacturer is linked to medicines
        medicine_count = db.query(models.Medicine).filter(models.Medicine.manufacturer_id == manufacturer_id).count()
        name = db_manufacturer.name

        if medicine_count > 0:
            db_manufacturer.is_active = False
            db.commit()
            logger.info(f"User {current_user.username} soft-deleted manufacturer: {name} (ID: {manufacturer_id})")
            return {"message": "Manufacturer deactivated because it has associated medicines."}
            
        db.delete(db_manufacturer)
        db.commit()
        logger.info(f"User {current_user.username} hard-deleted manufacturer: {name} (ID: {manufacturer_id})")
        return {"message": "Manufacturer deleted successfully"}
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error during manufacturer deletion (ID: {manufacturer_id}): {str(e)}")
        raise HTTPException(status_code=500, detail="Could not delete manufacturer from database")
