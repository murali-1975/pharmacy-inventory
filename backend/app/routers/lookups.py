"""
Lookup Tables Router.
Manages auxiliary master data used for dropdowns and classification (Status, Supplier Types).
Access: All authenticated users (Read), Admin (Create/Update/Delete).
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from typing import List
from app import models, database, auth, schemas
from app.core.logging_config import logger

router = APIRouter(tags=["Lookups"])

admin_required = auth.RoleChecker(["Admin"])

# --- Status Management ---

@router.get("/status/", response_model=List[schemas.StatusSchema])
@router.get("/status", response_model=List[schemas.StatusSchema], include_in_schema=False)
def get_status(
    db: Session = Depends(database.get_db), 
    current_user: models.User = Depends(auth.get_current_user),
    include_inactive: bool = False
):
    """
    List all available statuses for users and suppliers.
    Filters: By default, non-admins only see active statuses.
    """
    try:
        query = db.query(models.Status)
        if not include_inactive and current_user.role != "Admin":
            query = query.filter(models.Status.is_active == True)
        return query.all()
    except SQLAlchemyError as e:
        logger.error(f"Database error during status retrieval: {str(e)}")
        raise HTTPException(status_code=500, detail="Could not retrieve statuses from database")

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
    try:
        db_status = models.Status(name=status_in.name)
        db.add(db_status)
        db.commit()
        db.refresh(db_status)
        logger.info(f"Admin {current_user.username} created status: {db_status.name} (ID: {db_status.id})")
        return db_status
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error during status creation: {str(e)}")
        raise HTTPException(status_code=500, detail="Could not create status in database")

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
    try:
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
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error during status update (ID: {status_id}): {str(e)}")
        raise HTTPException(status_code=500, detail="Could not update status in database")

@router.delete("/status/{status_id}/")
@router.delete("/status/{status_id}", include_in_schema=False)
def delete_status(
    status_id: int, 
    soft: bool = False,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(admin_required)
):
    """
    Delete a status.
    Requires: Admin role.
    Security: If referenced by users or suppliers, only soft delete (deactivation) is allowed to maintain referential integrity.
    """
    try:
        db_status = db.query(models.Status).filter(models.Status.id == status_id).first()
        if not db_status:
            logger.warning(f"Status deletion failed: ID {status_id} not found.")
            raise HTTPException(status_code=404, detail="Status not found")
        
        # Check references (referential integrity check)
        user_count = db.query(models.User).filter(models.User.status_id == status_id).count()
        supplier_count = db.query(models.Supplier).filter(models.Supplier.status_id == status_id).count()
        total_refs = user_count + supplier_count

        if total_refs > 0 and not soft:
            logger.warning(f"Attempted hard delete of status ID {status_id} which has {total_refs} references.")
            raise HTTPException(
                status_code=409, 
                detail={
                    "message": "referenced", 
                    "count": total_refs,
                    "description": f"This status is used by {user_count} users and {supplier_count} suppliers. Use soft delete instead."
                }
            )

        if soft or total_refs > 0:
            db_status.is_active = False
            db.commit()
            logger.info(f"Admin {current_user.username} soft-deleted status: {db_status.name} (ID: {status_id})")
            return {"message": "Status deactivated (soft delete) successfully"}
        
        name = db_status.name
        db.delete(db_status)
        db.commit()
        logger.info(f"Admin {current_user.username} hard-deleted status: {name} (ID: {status_id})")
        return {"message": "Status deleted (hard delete) successfully"}
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error during status deletion (ID: {status_id}): {str(e)}")
        raise HTTPException(status_code=500, detail="Could not delete status from database")

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
    """
    try:
        query = db.query(models.SupplierType)
        if not include_inactive and current_user.role != "Admin":
            query = query.filter(models.SupplierType.is_active == True)
        return query.all()
    except SQLAlchemyError as e:
        logger.error(f"Database error during supplier types retrieval: {str(e)}")
        raise HTTPException(status_code=500, detail="Could not retrieve supplier types from database")

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
    try:
        db_type = models.SupplierType(name=type_in.name)
        db.add(db_type)
        db.commit()
        db.refresh(db_type)
        logger.info(f"Admin {current_user.username} created supplier type: {db_type.name} (ID: {db_type.id})")
        return db_type
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error during supplier type creation: {str(e)}")
        raise HTTPException(status_code=500, detail="Could not create supplier type in database")

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
    try:
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
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error during supplier type update (ID: {type_id}): {str(e)}")
        raise HTTPException(status_code=500, detail="Could not update supplier type in database")

@router.delete("/supplier-types/{type_id}/")
@router.delete("/supplier-types/{type_id}", include_in_schema=False)
def delete_supplier_type(
    type_id: int, 
    soft: bool = False,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(admin_required)
):
    """
    Delete a supplier type.
    Requires: Admin role.
    Security: If referenced by suppliers, only soft delete (deactivation) is allowed.
    """
    try:
        db_type = db.query(models.SupplierType).filter(models.SupplierType.id == type_id).first()
        if not db_type:
            logger.warning(f"Supplier type deletion failed: ID {type_id} not found.")
            raise HTTPException(status_code=404, detail="Supplier type not found")
        
        # Check references (referential integrity check)
        supplier_count = db.query(models.Supplier).filter(models.Supplier.type_id == type_id).count()
        
        if supplier_count > 0 and not soft:
            logger.warning(f"Attempted hard delete of supplier type ID {type_id} which has {supplier_count} references.")
            raise HTTPException(
                status_code=409,
                detail={
                    "message": "referenced",
                    "count": supplier_count,
                    "description": f"This type is used by {supplier_count} suppliers. Use soft delete instead."
                }
            )

        if soft or supplier_count > 0:
            db_type.is_active = False
            db.commit()
            logger.info(f"Admin {current_user.username} soft-deleted supplier type: {db_type.name} (ID: {type_id})")
            return {"message": "Supplier type deactivated (soft delete) successfully"}
            
        name = db_type.name
        db.delete(db_type)
        db.commit()
        logger.info(f"Admin {current_user.username} hard-deleted supplier type: {name} (ID: {type_id})")
        return {"message": "Supplier type deleted (hard delete) successfully"}
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error during supplier type deletion (ID: {type_id}): {str(e)}")
        raise HTTPException(status_code=500, detail="Could not delete supplier type from database")
