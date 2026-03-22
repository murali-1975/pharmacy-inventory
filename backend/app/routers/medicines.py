from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from typing import List
from .. import models, schemas, database, auth
from ..core.logging_config import logger

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
    """
    return db.query(models.Medicine).offset(skip).limit(limit).all()

@router.post("/", response_model=schemas.MedicineSchema)
def create_medicine(
    medicine_in: schemas.MedicineCreate, 
    db: Session = Depends(database.get_db), 
    current_user: models.User = Depends(admin_manager_required)
):
    """
    Create a new medicine entry. Restricted to Admin/Manager.
    """
    try:
        if medicine_in.manufacturer_id:
            manufacturer = db.query(models.Manufacturer).filter(models.Manufacturer.id == medicine_in.manufacturer_id).first()
            if not manufacturer:
                logger.warning(f"Medicine creation failed: Manufacturer ID {medicine_in.manufacturer_id} not found.")
                raise HTTPException(status_code=404, detail="Manufacturer not found")
                
        db_medicine = models.Medicine(**medicine_in.model_dump())
        db.add(db_medicine)
        db.commit()
        db.refresh(db_medicine)
        logger.info(f"User {current_user.username} created medicine: {db_medicine.product_name} (ID: {db_medicine.id})")
        return db_medicine
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error during medicine creation: {str(e)}")
        if "unique constraint" in str(e).lower() or "duplicate key" in str(e).lower():
            raise HTTPException(status_code=400, detail="Medicine with this name/HSN already exists")
        raise HTTPException(status_code=500, detail="Could not create medicine in database")

@router.put("/{medicine_id}/", response_model=schemas.MedicineSchema)
def update_medicine(
    medicine_id: int, 
    medicine_in: schemas.MedicineCreate, 
    db: Session = Depends(database.get_db), 
    current_user: models.User = Depends(admin_manager_required)
):
    """
    Update an existing medicine entry. Restricted to Admin/Manager.
    """
    try:
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
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error during medicine update (ID: {medicine_id}): {str(e)}")
        raise HTTPException(status_code=500, detail="Could not update medicine in database")

@router.delete("/{medicine_id}/")
def delete_medicine(
    medicine_id: int, 
    db: Session = Depends(database.get_db), 
    current_user: models.User = Depends(admin_manager_required)
):
    """
    Delete a medicine entry. 
    If used in any invoices, it is deactivated (soft delete).
    """
    try:
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

        db.delete(db_medicine)
        db.commit()
        logger.info(f"User {current_user.username} hard-deleted medicine: {name} (ID: {medicine_id})")
        return {"message": "Medicine deleted successfully"}
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error during medicine deletion (ID: {medicine_id}): {str(e)}")
        raise HTTPException(status_code=500, detail="Could not delete medicine from database")
