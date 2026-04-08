"""
Manufacturer Master Router.
Handles CRUD operations for medicine manufacturers and pharmaceutical brands.
Access: All authenticated users (Read), Admin/Manager (Write/Delete).
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from typing import List
from app import models, database, auth, schemas, utils
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
    with utils.db_error_handler("manufacturers retrieval"):
        return db.query(models.Manufacturer).offset(skip).limit(limit).all()

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
    with utils.db_error_handler("manufacturer creation", db):
        db_manufacturer = models.Manufacturer(**manufacturer_in.model_dump())
        db.add(db_manufacturer)
        db.commit()
        db.refresh(db_manufacturer)
        logger.info(f"User {current_user.username} created manufacturer: {db_manufacturer.name} (ID: {db_manufacturer.id})")
        return db_manufacturer

@router.put("/{manufacturer_id}/", response_model=schemas.ManufacturerSchema)
@router.put("/{manufacturer_id}", response_model=schemas.ManufacturerSchema, include_in_schema=False)
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
    with utils.db_error_handler("manufacturer update", db):
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

@router.delete("/{manufacturer_id}/")
@router.delete("/{manufacturer_id}", include_in_schema=False)
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
    with utils.db_error_handler("manufacturer deletion", db):
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
