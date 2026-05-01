"""
Supplier Management Router.
Handles CRUD operations for suppliers, including their associated contact and bank details.
Access: All authenticated users (Read), Admin/Manager/Staff (Create/Update), Admin (Delete).
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from typing import List
from app import models, database, auth, schemas, utils
from app.core.logging_config import logger

router = APIRouter(prefix="/suppliers", tags=["Suppliers"])

admin_manager_required = auth.RoleChecker(["Admin", "Manager"])
admin_manager_staff_required = auth.RoleChecker(["Admin", "Manager", "Staff"])
admin_required = auth.RoleChecker(["Admin"])

@router.get("/", response_model=List[schemas.SupplierSchema])
@router.get("", response_model=List[schemas.SupplierSchema], include_in_schema=False)
def get_suppliers(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """
    List all suppliers and their primary details.
    """
    with utils.db_error_handler("suppliers retrieval"):
        return db.query(models.Supplier).all()

@router.post("/", response_model=schemas.SupplierSchema)
@router.post("", response_model=schemas.SupplierSchema, include_in_schema=False)
def create_supplier(
    supplier_in: schemas.SupplierCreate, 
    db: Session = Depends(database.get_db), 
    current_user: models.User = Depends(admin_manager_staff_required)
):
    """
    Create a new supplier with optional nested contact and bank details.
    Requires: Admin, Manager or Staff role.
    """
    with utils.db_error_handler("supplier creation", db):
        db_supplier = models.Supplier(
            supplier_name=supplier_in.supplier_name,
            type_id=supplier_in.type_id,
            status_id=supplier_in.status_id
        )
        db.add(db_supplier)
        db.flush() # Secure ID for sub-record linking

        if supplier_in.contact_details:
            db_contact = models.SupplierContactDetail(
                **supplier_in.contact_details.model_dump(), 
                supplier_id=db_supplier.id
            )
            db.add(db_contact)
        
        for bank_data in supplier_in.bank_details:
            if bank_data.bank_name.strip() or bank_data.account_number.strip():
                db_bank = models.SupplierBankAccount(
                    **bank_data.model_dump(), 
                    supplier_id=db_supplier.id
                )
                db.add(db_bank)
        
        db.commit()
        db.refresh(db_supplier)
        logger.info(f"User {current_user.username} created supplier: {db_supplier.supplier_name} (ID: {db_supplier.id})")
        return db_supplier

@router.put("/{supplier_id}/", response_model=schemas.SupplierSchema)
@router.put("/{supplier_id}", response_model=schemas.SupplierSchema, include_in_schema=False)
def update_supplier(
    supplier_id: int, 
    supplier_in: schemas.SupplierCreate, 
    db: Session = Depends(database.get_db), 
    current_user: models.User = Depends(admin_manager_staff_required)
):
    """
    Update an existing supplier and its associated details.
    Requires: Admin, Manager or Staff role.
    Logic: Syncs contact details and rebuilds bank account list.
    """
    with utils.db_error_handler(f"supplier update (ID: {supplier_id})", db):
        db_supplier = db.query(models.Supplier).filter(models.Supplier.id == supplier_id).first()
        if not db_supplier:
            logger.warning(f"Supplier update failed: ID {supplier_id} not found.")
            raise HTTPException(status_code=404, detail="Supplier not found")
        
        db_supplier.supplier_name = supplier_in.supplier_name
        db_supplier.type_id = supplier_in.type_id
        db_supplier.status_id = supplier_in.status_id

        # Update contact record
        if supplier_in.contact_details:
            if db_supplier.contact_details:
                for key, val in supplier_in.contact_details.model_dump().items():
                    setattr(db_supplier.contact_details, key, val)
            else:
                db_contact = models.SupplierContactDetail(
                    **supplier_in.contact_details.model_dump(), 
                    supplier_id=db_supplier.id
                )
                db.add(db_contact)

        # Update bank details (Full sync: purge matches and re-insert)
        db.query(models.SupplierBankAccount).filter(models.SupplierBankAccount.supplier_id == supplier_id).delete()
        for bank_data in supplier_in.bank_details:
            if bank_data.bank_name.strip() or bank_data.account_number.strip():
                db_bank = models.SupplierBankAccount(
                    **bank_data.model_dump(), 
                    supplier_id=db_supplier.id
                )
                db.add(db_bank)

        db.commit()
        db.refresh(db_supplier)
        logger.info(f"User {current_user.username} updated supplier: {db_supplier.supplier_name} (ID: {supplier_id})")
        return db_supplier

@router.delete("/{supplier_id}/")
@router.delete("/{supplier_id}", include_in_schema=False)
def delete_supplier(
    supplier_id: int, 
    db: Session = Depends(database.get_db), 
    current_user: models.User = Depends(admin_required)
):
    """
    Permanently delete a supplier and all its associated records (cascade delete).
    Requires: Admin role.
    """
    with utils.db_error_handler(f"supplier deletion (ID: {supplier_id})", db):
        db_supplier = db.query(models.Supplier).filter(models.Supplier.id == supplier_id).first()
        if not db_supplier:
            logger.warning(f"Supplier deletion failed: ID {supplier_id} not found.")
            raise HTTPException(status_code=404, detail="Supplier not found")
        
        name = db_supplier.supplier_name
        db.delete(db_supplier)
        db.commit()
        logger.info(f"Admin {current_user.username} deleted supplier: {name} (ID: {supplier_id})")
        return {"message": "Supplier deleted successfully"}
