"""
Medicine Master Router.
Handles CRUD operations for medicine master data, brand names, and drug details.
Access: All authenticated users (Read), Admin/Manager (Write/Delete).
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from typing import List
from app import models, database, auth, schemas, utils
from app.core.logging_config import logger

router = APIRouter(
    prefix="/medicines",
    tags=["medicines"],
    dependencies=[Depends(auth.get_current_user)]
)

admin_manager_required = auth.RoleChecker(["Admin", "Manager"])

@router.get("/", response_model=List[schemas.MedicineSchema])
def list_medicines(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db)):
    """
    List all medicines with optional pagination.
    Returns: List[schemas.MedicineSchema]
    """
    with utils.db_error_handler("medicines retrieval"):
        return db.query(models.Medicine).offset(skip).limit(limit).all()

@router.post("/", response_model=schemas.MedicineSchema)
def create_medicine(
    medicine_in: schemas.MedicineCreate, 
    db: Session = Depends(database.get_db), 
    current_user: models.User = Depends(admin_manager_required)
):
    """
    Create a new medicine entry.
    Requires: Admin or Manager role.
    Validation: Ensures Manufacturer ID exists and product name/HSN is unique.
    """
    with utils.db_error_handler("medicine creation", db):
        if medicine_in.manufacturer_id:
            manufacturer = db.query(models.Manufacturer).filter(models.Manufacturer.id == medicine_in.manufacturer_id).first()
            if not manufacturer:
                logger.warning(f"Medicine creation failed: Manufacturer ID {medicine_in.manufacturer_id} not found.")
                raise HTTPException(status_code=404, detail="Manufacturer not found")
                
        db_medicine = models.Medicine(**medicine_in.model_dump())
        db.add(db_medicine)
        db.flush() # Get the new medicine's ID
        
        # Ensure a MedicineStock tracker exists for it
        db_stock = models.MedicineStock(medicine_id=db_medicine.id, quantity_on_hand=0)
        db.add(db_stock)
        
        db.commit()
        db.refresh(db_medicine)
        logger.info(f"User {current_user.username} created medicine: {db_medicine.product_name} (ID: {db_medicine.id})")
        return db_medicine

@router.put("/{medicine_id}/", response_model=schemas.MedicineSchema)
@router.put("/{medicine_id}", response_model=schemas.MedicineSchema, include_in_schema=False)
def update_medicine(
    medicine_id: int, 
    medicine_in: schemas.MedicineCreate, 
    db: Session = Depends(database.get_db), 
    current_user: models.User = Depends(admin_manager_required)
):
    """
    Update an existing medicine entry.
    Requires: Admin or Manager role.
    """
    with utils.db_error_handler("medicine update", db):
        db_medicine = db.query(models.Medicine).filter(models.Medicine.id == medicine_id).first()
        if not db_medicine:
            logger.warning(f"Medicine update failed: ID {medicine_id} not found.")
            raise HTTPException(status_code=404, detail="Medicine not found")
        
        if medicine_in.manufacturer_id:
            manufacturer = db.query(models.Manufacturer).filter(models.Manufacturer.id == medicine_in.manufacturer_id).first()
            if not manufacturer:
                logger.warning(f"Medicine update failed: Manufacturer ID {medicine_in.manufacturer_id} not found.")
                raise HTTPException(status_code=404, detail="Manufacturer not found")

        for field, value in medicine_in.model_dump(exclude_unset=True).items():
            setattr(db_medicine, field, value)
        
        db.commit()
        db.refresh(db_medicine)
        logger.info(f"User {current_user.username} updated medicine: {db_medicine.product_name} (ID: {medicine_id})")
        return db_medicine

@router.delete("/{medicine_id}/")
@router.delete("/{medicine_id}", include_in_schema=False)
def delete_medicine(
    medicine_id: int, 
    db: Session = Depends(database.get_db), 
    current_user: models.User = Depends(admin_manager_required)
):
    """
    Delete a medicine entry.
    Requires: Admin or Manager role.
    Logic: If the medicine is referenced in any historic invoice, it is soft-deleted (is_active=False).
    Otherwise, it is hard-deleted from the database.
    """
    with utils.db_error_handler("medicine deletion", db):
        db_medicine = db.query(models.Medicine).filter(models.Medicine.id == medicine_id).first()
        if not db_medicine:
            logger.warning(f"Medicine deletion failed: ID {medicine_id} not found.")
            raise HTTPException(status_code=404, detail="Medicine not found")
        
        # Check if used in invoices
        usage_count = db.query(models.InvoiceLineItem).filter(models.InvoiceLineItem.medicine_id == medicine_id).count()
        name = db_medicine.product_name

        if usage_count > 0:
            db_medicine.is_active = False
            db.commit()
            logger.info(f"User {current_user.username} soft-deleted medicine: {name} (ID: {medicine_id})")
            return {"message": "Medicine deactivated (soft delete) because it is used in invoices."}

        # Delete automatically created MedicineStock before hard-deleting the medicine
        db_stock = db.query(models.MedicineStock).filter(models.MedicineStock.medicine_id == medicine_id).first()
        if db_stock:
            db.delete(db_stock)
            
        db.delete(db_medicine)
        db.commit()
        logger.info(f"User {current_user.username} hard-deleted medicine: {name} (ID: {medicine_id})")
        return {"message": "Medicine deleted successfully"}
