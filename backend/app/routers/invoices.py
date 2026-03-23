"""
Purchase Invoices Router.
Handles life-cycle management of invoices received from suppliers, including line items and settlement payments.
Access: All authenticated users (Read/Create), Admin/Manager (Update/Delete).
"""
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
    Validation: Ensures Supplier and all referenced Medicines exist.
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
        db.flush() # Get ID for line items
        
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
    List all invoices with server-side pagination.
    Returns: PaginatedInvoices (total count + items).
    Sorting: By invoice date descending.
    """
    query = db.query(models.Invoice)
    total = query.count()
    items = query.order_by(models.Invoice.invoice_date.desc()).offset(skip).limit(limit).all()
    return {"total": total, "items": items}

@router.get("/{id}", response_model=schemas.InvoiceSchema)
def get_invoice(id: int, db: Session = Depends(database.get_db)):
    """
    Retrieve a specific invoice by its ID, including all line items and payments.
    """
    invoice = db.query(models.Invoice).filter(models.Invoice.id == id).first()
    if not invoice:
        logger.warning(f"Invoice retrieval failed: ID {id} not found.")
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice

@router.put("/{id}", response_model=schemas.InvoiceSchema)
def update_invoice(id: int, invoice_in: schemas.InvoiceUpdate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """
    Update an existing invoice's header details.
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
    Delete an invoice, along with its line items and payments.
    Requires: Admin or Manager role.
    """
    try:
        db_invoice = db.query(models.Invoice).filter(models.Invoice.id == id).first()
        if not db_invoice:
            logger.warning(f"Invoice deletion failed: ID {id} not found.")
            raise HTTPException(status_code=404, detail="Invoice not found")
        
        ref = db_invoice.reference_number
        # Explicitly delete related line items and payments
        db.query(models.InvoiceLineItem).filter(models.InvoiceLineItem.invoice_id == id).delete()
        db.query(models.InvoicePayment).filter(models.InvoicePayment.invoice_id == id).delete()
        
        db.delete(db_invoice)
        db.commit()
        logger.info(f"User {current_user.username} deleted invoice: {ref} (ID: {id})")
        return None
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error during invoice deletion (ID: {id}): {str(e)}")
        raise HTTPException(status_code=500, detail="Could not delete invoice from database")

# --- Invoice Payments ---

@router.post("/{invoice_id}/payments", response_model=schemas.InvoicePaymentSchema)
def record_payment(
    invoice_id: int, 
    payment: schemas.InvoicePaymentCreate, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Record a payment against an invoice.
    Logic: Automatically updates the invoice status to "Paid" if total payments settle the invoice value.
    """
    try:
        db_invoice = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
        if not db_invoice:
            logger.warning(f"Payment record failed: Invoice ID {invoice_id} not found.")
            raise HTTPException(status_code=404, detail="Invoice not found")
        
        db_payment = models.InvoicePayment(**payment.model_dump())
        db_payment.invoice_id = invoice_id
        db.add(db_payment)
        
        # Flush to allow calculation including the new payment
        db.flush()
        
        # Calculate settlement progress
        all_payments = db.query(models.InvoicePayment).filter(models.InvoicePayment.invoice_id == invoice_id).all()
        total_paid = sum(p.paid_amount for p in all_payments)
        
        # Auto-settlement logic
        if total_paid >= db_invoice.total_value:
            db_invoice.status = models.InvoiceStatus.Paid
            
        db.commit()
        db.refresh(db_payment)
        logger.info(f"User {current_user.username} recorded payment of {db_payment.paid_amount} for invoice ID {invoice_id}")
        return db_payment
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error during payment recording (Invoice: {invoice_id}): {str(e)}")
        raise HTTPException(status_code=500, detail="Could not record payment in database")

@router.get("/{invoice_id}/payments", response_model=List[schemas.InvoicePaymentSchema])
def get_invoice_payments(
    invoice_id: int, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Retrieve all payments recorded for a specific invoice.
    """
    try:
        payments = db.query(models.InvoicePayment).filter(models.InvoicePayment.invoice_id == invoice_id).all()
        return payments
    except SQLAlchemyError as e:
        logger.error(f"Database error during payments retrieval (Invoice: {invoice_id}): {str(e)}")
        raise HTTPException(status_code=500, detail="Could not retrieve payments from database")
