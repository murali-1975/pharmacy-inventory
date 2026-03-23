from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from typing import List
from app import models, schemas, database, auth
from app.core.logging_config import logger

router = APIRouter(
    prefix="/invoices",
    tags=["invoices"],
    dependencies=[Depends(auth.get_current_user)]
)

admin_manager_required = auth.RoleChecker(["Admin", "Manager"])

@router.post("/", response_model=schemas.InvoiceSchema)
def create_invoice(invoice_in: schemas.InvoiceCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """
    Create a new invoice with associated line items.
    """
    try:
        # Verify supplier exists
        supplier = db.query(models.Supplier).filter(models.Supplier.id == invoice_in.supplier_id).first()
        if not supplier:
            logger.warning(f"Invoice creation failed: Supplier ID {invoice_in.supplier_id} not found.")
            raise HTTPException(status_code=404, detail="Supplier not found")
        
        # Create Invoice
        db_invoice = models.Invoice(
            supplier_id=invoice_in.supplier_id,
            invoice_date=invoice_in.invoice_date,
            reference_number=invoice_in.reference_number,
            total_value=invoice_in.total_value,
            gst=invoice_in.gst
        )
        db.add(db_invoice)
        db.flush() # Get ID
        
        # Create Line Items
        for item in invoice_in.line_items:
            if item.medicine_id:
                # Verify medicine exists
                medicine = db.query(models.Medicine).filter(models.Medicine.id == item.medicine_id).first()
                if not medicine:
                    logger.warning(f"Invoice line item creation failed: Medicine ID {item.medicine_id} not found.")
                    raise HTTPException(status_code=404, detail=f"Medicine ID {item.medicine_id} not found")
            
            db_item = models.InvoiceLineItem(
                invoice_id=db_invoice.id,
                **item.model_dump()
            )
            db.add(db_item)
        
        db.commit()
        db.refresh(db_invoice)
        logger.info(f"User {current_user.username} created invoice: {db_invoice.reference_number} (ID: {db_invoice.id})")
        return db_invoice
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error during invoice creation: {str(e)}")
        raise HTTPException(status_code=500, detail="Could not create invoice in database")

@router.get("/", response_model=schemas.PaginatedInvoices)
def list_invoices(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db)):
    """
    List all invoices with optional pagination, sorted by date descending.
    """
    query = db.query(models.Invoice)
    total = query.count()
    items = query.order_by(models.Invoice.invoice_date.desc()).offset(skip).limit(limit).all()
    return {"total": total, "items": items}

@router.get("/{id}", response_model=schemas.InvoiceSchema)
def get_invoice(id: int, db: Session = Depends(database.get_db)):
    """
    Retrieve a specific invoice by ID.
    """
    invoice = db.query(models.Invoice).filter(models.Invoice.id == id).first()
    if not invoice:
        logger.warning(f"Invoice retrieval failed: ID {id} not found.")
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice

@router.put("/{id}", response_model=schemas.InvoiceSchema)
def update_invoice(id: int, invoice_in: schemas.InvoiceUpdate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """
    Update an existing invoice's details.
    """
    try:
        db_invoice = db.query(models.Invoice).filter(models.Invoice.id == id).first()
        if not db_invoice:
            logger.warning(f"Invoice update failed: ID {id} not found.")
            raise HTTPException(status_code=404, detail="Invoice not found")
        
        for field, value in invoice_in.model_dump(exclude_unset=True).items():
            setattr(db_invoice, field, value)
        
        db.commit()
        db.refresh(db_invoice)
        logger.info(f"User {current_user.username} updated invoice: {db_invoice.reference_number} (ID: {id})")
        return db_invoice
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error during invoice update (ID: {id}): {str(e)}")
        raise HTTPException(status_code=500, detail="Could not update invoice in database")

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_invoice(id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(admin_manager_required)):
    """
    Delete an invoice. Line items are normally cascade-deleted or manually cleaned.
    Restricted to Admin/Manager.
    """
    try:
        db_invoice = db.query(models.Invoice).filter(models.Invoice.id == id).first()
        if not db_invoice:
            logger.warning(f"Invoice deletion failed: ID {id} not found.")
            raise HTTPException(status_code=404, detail="Invoice not found")
        
        ref = db_invoice.reference_number
        # Delete line items first (manual cleanup if not cascade-configured in models)
        db.query(models.InvoiceLineItem).filter(models.InvoiceLineItem.invoice_id == id).delete()
        db.delete(db_invoice)
        db.commit()
        logger.info(f"User {current_user.username} deleted invoice: {ref} (ID: {id})")
        return None
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error during invoice deletion (ID: {id}): {str(e)}")
        raise HTTPException(status_code=500, detail="Could not delete invoice from database")
