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
    
    # 4. Seed Finance Identifiers
    finance_idents = ['File No', 'Easy Clinic Reference', 'RCH ID', 'UHID']
    for ident in finance_idents:
        if not db.query(models.PatientIdentifier).filter(models.PatientIdentifier.id_name == ident).first():
            db.add(models.PatientIdentifier(id_name=ident, is_active=True))

    # 5. Seed Finance Services
    finance_services = ['Consultation', 'Medicine', 'Scan', 'Investigation', 'Services']
    for srv in finance_services:
        if not db.query(models.PatientService).filter(models.PatientService.service_name == srv).first():
            db.add(models.PatientService(service_name=srv, is_active=True))

    # 6. Seed Payment Modes
    payment_modes = ['Cash', 'UPI - (Gpay)', 'Credit Card', 'Bank Transfer']
    for mode in payment_modes:
        if not db.query(models.PaymentModeMaster).filter(models.PaymentModeMaster.mode == mode).first():
            db.add(models.PaymentModeMaster(mode=mode, is_active=True))

    # 7. Seed Expense Types
    expense_types = [
        'Pharmacy', 'Rent', 'Consumables', 'Utilities', 'Salary', 'Subscription', 
        'Government', 'Tax', 'License', 'Maintenance', 'Petty Expense', 
        'Insurance', 'Transport', 'Printer', 'Diagnostics', 'Loan'
    ]
    for et in expense_types:
        if not db.query(models.ExpenseType).filter(models.ExpenseType.name == et).first():
            db.add(models.ExpenseType(name=et, is_active=True))
    
    db.commit()
    logger.info("Database seeding check complete (including Finance Masters).")
