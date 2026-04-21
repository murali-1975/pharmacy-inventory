"""
Database Seeding Utility.
Initializes a new database with essential lookup data and the default admin account.
This script is idempotent and can be safely run multiple times.
"""
from sqlalchemy.orm import Session
from . import models, auth, database
from .core.logging_config import logger
import os

def seed_database(db: Session):
    """
    Seeds Statuses, SupplierTypes, and the initial Admin user.
    """
    # 1. Seed Statuses
    statuses = ["Active", "Inactive"]
    for status_name in statuses:
        existing_status = db.query(models.Status).filter(models.Status.name == status_name).first()
        if not existing_status:
            db.add(models.Status(name=status_name, is_active=True))
            logger.info(f"Seeding status: {status_name}")
        else:
            existing_status.is_active = True
    
    db.commit()

    # 2. Seed Supplier Types
    supplier_types = ["Wholesale", "Manufacturer", "Retail", "Other"]
    for type_name in supplier_types:
        existing_type = db.query(models.SupplierType).filter(models.SupplierType.name == type_name).first()
        if not existing_type:
            db.add(models.SupplierType(name=type_name, is_active=True))
            logger.info(f"Seeding supplier type: {type_name}")
        else:
            existing_type.is_active = True
    
    db.commit()

    # 3. Seed Default Admin User
    admin_username = "admin"
    admin_email = "admin@pharmacy.com"
    admin_password = os.getenv("SEED_ADMIN_PASSWORD", "admin1234$")
    
    existing_admin = db.query(models.User).filter(models.User.username == admin_username).first()
    if not existing_admin:
        # Get the 'Active' status id
        active_status = db.query(models.Status).filter(models.Status.name == "Active").first()
        status_id = active_status.id if active_status else 1
        
        hashed_pw = auth.get_password_hash(admin_password)
        new_admin = models.User(
            username=admin_username,
            email=admin_email,
            hashed_password=hashed_pw,
            role="Admin",
            is_active=True,
            status_id=status_id
        )
        db.add(new_admin)
        db.commit()
    
    logger.info("Database seeding check complete.")
