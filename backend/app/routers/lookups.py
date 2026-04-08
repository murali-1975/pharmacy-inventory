"""
Lookup Tables Router.
Manages auxiliary master data used for dropdowns and classification (Status, Supplier Types).
Access: All authenticated users (Read), Admin (Create/Update/Delete).
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from typing import List
from app import models, database, auth, schemas, utils
from app.core.logging_config import logger

router = APIRouter(prefix="/lookups", tags=["Lookups"])

admin_required = auth.RoleChecker(["Admin"])

# --- Status Management ---

@router.get("/status/", response_model=List[schemas.StatusSchema])
@router.get("/status", response_model=List[schemas.StatusSchema], include_in_schema=False)
def get_statuses(
    db: Session = Depends(database.get_db), 
    current_user: models.User = Depends(auth.get_current_user),
    include_inactive: bool = False
):
    """
    List all statuses.
    - Default: Returns only active records.
    - include_inactive=True: Returns all records (useful for Admin Hub).
    """
    with utils.db_error_handler("statuses retrieval"):
        query = db.query(models.Status)
        if not include_inactive:
            query = query.filter(models.Status.is_active == True)
        return query.all()

@router.post("/status/", response_model=schemas.StatusSchema)
@router.post("/status", response_model=schemas.StatusSchema, include_in_schema=False)
def create_status(
    status_in: schemas.StatusCreate, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(admin_required)
):
    """
    Create a new status entry.
    Requires: Admin role.
    """
    with utils.db_error_handler("status creation", db):
        db_status = models.Status(name=status_in.name)
        db.add(db_status)
        db.commit()
        db.refresh(db_status)
        logger.info(f"Admin {current_user.username} created status: {db_status.name} (ID: {db_status.id})")
        return db_status

@router.put("/status/{status_id}/", response_model=schemas.StatusSchema)
@router.put("/status/{status_id}", response_model=schemas.StatusSchema, include_in_schema=False)
def update_status(
    status_id: int, 
    status_in: schemas.StatusCreate, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(admin_required)
):
    """
    Update a status name.
    Requires: Admin role.
    """
    with utils.db_error_handler(f"status update (ID: {status_id})", db):
        db_status = db.query(models.Status).filter(models.Status.id == status_id).first()
        if not db_status:
            logger.warning(f"Status update failed: ID {status_id} not found.")
            raise HTTPException(status_code=404, detail="Status not found")
        
        old_name = db_status.name
        db_status.name = status_in.name
        db.commit()
        db.refresh(db_status)
        logger.info(f"Admin {current_user.username} updated status ID {status_id}: {old_name} -> {db_status.name}")
        return db_status

@router.delete("/status/{status_id}/")
@router.delete("/status/{status_id}", include_in_schema=False)
def delete_status(
    status_id: int, 
    hard: bool = False,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(admin_required)
):
    """
    Deactivates (soft delete) or permanently removes (hard delete) a status.
    Returns 409 Conflict if hard delete is attempted on a referenced status.
    """
    with utils.db_error_handler(f"status deletion (ID: {status_id})", db):
        db_status = db.query(models.Status).filter(models.Status.id == status_id).first()
        if not db_status:
            raise HTTPException(status_code=404, detail="Status not found")

        # Check references in User and Supplier tables
        user_count = db.query(models.User).filter(models.User.status_id == status_id).count()
        supplier_count = db.query(models.Supplier).filter(models.Supplier.status_id == status_id).count()
        total_refs = user_count + supplier_count

        # Case 1: Explicit hard delete (Admin only)
        if hard:
            if total_refs > 0:
                logger.warning(f"Admin {current_user.username} blocked from hard-deleting status ID {status_id} (used by {total_refs} entities)")
                raise HTTPException(
                    status_code=409,
                    detail={
                        "message": "referenced",
                        "count": total_refs,
                        "description": f"This status is used by {total_refs} system entities. Use soft delete instead."
                    }
                )
            
            name = db_status.name
            db.delete(db_status)
            db.commit()
            logger.info(f"Admin {current_user.username} permanently deleted status: {name} (ID: {status_id})")
            return {"message": "Status permanently deleted successfully"}

        # Case 2: Soft delete (Deactivation)
        # Default behavior: If soft=True OR any references exist OR even if no references exist
        # We prefer soft-delete to maintain audit consistency unless hard delete is requested.
        db_status.is_active = False
        db.commit()
        logger.info(f"Admin {current_user.username} deactivated status: {db_status.name} (ID: {status_id})")
        return {"message": "Status deactivated (soft delete) successfully"}

# --- Supplier Type Management ---

@router.get("/supplier-types/", response_model=List[schemas.SupplierTypeSchema])
@router.get("/supplier-types", response_model=List[schemas.SupplierTypeSchema], include_in_schema=False)
def get_supplier_types(
    db: Session = Depends(database.get_db), 
    current_user: models.User = Depends(auth.get_current_user),
    include_inactive: bool = False
):
    """
    List all supplier types.
    - Default: Returns only active records for all roles.
    - include_inactive=True: Returns all records (including deactivated ones).
    """
    with utils.db_error_handler("supplier types retrieval"):
        query = db.query(models.SupplierType)
        if not include_inactive:
            query = query.filter(models.SupplierType.is_active == True)
        return query.all()

@router.post("/supplier-types/", response_model=schemas.SupplierTypeSchema)
@router.post("/supplier-types", response_model=schemas.SupplierTypeSchema, include_in_schema=False)
def create_supplier_type(
    type_in: schemas.SupplierTypeCreate, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(admin_required)
):
    """
    Create a new supplier type.
    Requires: Admin role.
    """
    with utils.db_error_handler("supplier type creation", db):
        db_type = models.SupplierType(name=type_in.name)
        db.add(db_type)
        db.commit()
        db.refresh(db_type)
        logger.info(f"Admin {current_user.username} created supplier type: {db_type.name} (ID: {db_type.id})")
        return db_type

@router.put("/supplier-types/{type_id}/", response_model=schemas.SupplierTypeSchema)
@router.put("/supplier-types/{type_id}", response_model=schemas.SupplierTypeSchema, include_in_schema=False)
def update_supplier_type(
    type_id: int, 
    type_in: schemas.SupplierTypeCreate, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(admin_required)
):
    """
    Update a supplier type name.
    Requires: Admin role.
    """
    with utils.db_error_handler(f"supplier type update (ID: {type_id})", db):
        db_type = db.query(models.SupplierType).filter(models.SupplierType.id == type_id).first()
        if not db_type:
            logger.warning(f"Supplier type update failed: ID {type_id} not found.")
            raise HTTPException(status_code=404, detail="Supplier type not found")
        
        old_name = db_type.name
        db_type.name = type_in.name
        db.commit()
        db.refresh(db_type)
        logger.info(f"Admin {current_user.username} updated supplier type ID {type_id}: {old_name} -> {db_type.name}")
        return db_type

@router.delete("/supplier-types/{type_id}/")
@router.delete("/supplier-types/{type_id}", include_in_schema=False)
def delete_supplier_type(
    type_id: int, 
    hard: bool = False,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(admin_required)
):
    """
    Deactivates (soft delete) or permanently removes (hard delete) a supplier type.
    """
    with utils.db_error_handler(f"supplier type deletion (ID: {type_id})", db):
        db_type = db.query(models.SupplierType).filter(models.SupplierType.id == type_id).first()
        if not db_type:
            raise HTTPException(status_code=404, detail="Supplier type not found")

        supplier_count = db.query(models.Supplier).filter(models.Supplier.type_id == type_id).count()

        # Case 1: Explicit hard delete (Admin only)
        if hard:
            if supplier_count > 0:
                logger.warning(f"Admin {current_user.username} blocked from hard-deleting supplier type ID {type_id} (used by {supplier_count} suppliers)")
                raise HTTPException(
                    status_code=409,
                    detail={
                        "message": "referenced",
                        "count": supplier_count,
                        "description": f"This type is used by {supplier_count} suppliers. Use soft delete instead."
                    }
                )
            
            name = db_type.name
            db.delete(db_type)
            db.commit()
            logger.info(f"Admin {current_user.username} permanently deleted supplier type: {name} (ID: {type_id})")
            return {"message": "Supplier type permanently deleted successfully"}

        # Case 2: Soft delete (Deactivation)
        db_type.is_active = False
        db.commit()
        logger.info(f"Admin {current_user.username} deactivated supplier type: {db_type.name} (ID: {type_id})")
        return {"message": "Supplier type deactivated (soft delete) successfully"}
