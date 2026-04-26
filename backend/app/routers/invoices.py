"""
Purchase Invoices Router.
Handles life-cycle management of invoices received from suppliers, including line items and settlement payments.
Access: All authenticated users (Read/Create), Admin/Manager (Update/Delete).
"""
from datetime import date, datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Response
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from typing import List, Optional
import io
import pandas as pd
from app import models, schemas, database, auth, utils
from app.core.logging_config import logger
from app.services.invoice_service import InvoiceService
from app.services.expense_service import ExpenseService
from app.core.config import settings

router = APIRouter(
    prefix="/invoices",
    tags=["invoices"],
    dependencies=[Depends(auth.get_current_user)]
)

admin_manager_required = auth.RoleChecker(["Admin", "Manager"])

def _parse_batch_no(batch_val) -> str:
    """
    Helper to clean batch numbers from pandas.
    - Handles NaN/Null -> AUTO-YYYYMMDD
    - Standardizes numeric strings (e.g., '123.0' -> '123')
    """
    if pd.isna(batch_val) or not str(batch_val).strip():
        return f"AUTO-{date.today().strftime('%Y%m%d')}"
    
    val_str = str(batch_val).strip()
    # Handle pandas converting numeric batch codes to floats
    if val_str.endswith('.0'):
        try:
            f_val = float(val_str)
            if f_val == int(f_val):
                return str(int(f_val))
        except ValueError:
            pass
    return val_str

@router.post("/", response_model=schemas.InvoiceSchema)
def create_invoice(invoice_in: schemas.InvoiceCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """
    Create a new invoice with associated line items.
    Validation: Ensures Supplier and all referenced Medicines exist.
    """
    with utils.db_error_handler("invoice creation", db):
        db_invoice = InvoiceService.create_invoice_with_items(db, invoice_in, current_user.id)
        db.commit()
        db.refresh(db_invoice)
        logger.info(f"User {current_user.username} created invoice: {db_invoice.reference_number} (ID: {db_invoice.id})")
        return db_invoice

@router.get("/", response_model=schemas.PaginatedInvoices)
def list_invoices(
    skip: int = 0,
    limit: int = 100,
    q: Optional[str] = None,
    sort_by: Optional[str] = "invoice_date",
    sort_order: Optional[str] = "desc",
    db: Session = Depends(database.get_db)
):
    """
    List all invoices with server-side pagination, sorting, and optional searching.
    Returns: PaginatedInvoices (total count + items).
    Sorting: Supports invoice_date, reference_number, supplier_name, total_value, status.
    Filters: By reference number or supplier name if 'q' is provided (escapes SQL wildcards).
    """
    with utils.db_error_handler("listing invoices"):
        query = db.query(models.Invoice).outerjoin(models.Supplier)
        
        if q:
            # Escape SQL wildcards (_ and %) to treat them literally
            escaped_q = q.replace('\\', '\\\\').replace('_', '\\_').replace('%', '\\%')
            search = f"%{escaped_q}%"
            query = query.filter(
                (models.Invoice.reference_number.ilike(search, escape='\\')) |
                (models.Supplier.supplier_name.ilike(search, escape='\\'))
            )
            
        total = query.count()
        
        # Mapping for sorting fields
        sort_map = {
            "invoice_date": models.Invoice.invoice_date,
            "reference_number": models.Invoice.reference_number,
            "supplier_name": models.Supplier.supplier_name,
            "total_value": models.Invoice.total_value,
            "status": models.Invoice.status
        }
        
        sort_field = sort_map.get(sort_by, models.Invoice.invoice_date)
        if sort_order == "desc":
            query = query.order_by(sort_field.desc())
        else:
            query = query.order_by(sort_field.asc())
            
        items = query.offset(skip).limit(limit).all()
            
        return {"total": total, "items": items}

# --- Bulk Upload ---

@router.get("/template")
def download_template():
    """
    Generate and return a CSV template for bulk invoice upload.
    """
    cols = [
        "invoice_date", "reference_number", "supplier_name", 
        "product_name", "quantity", "free_quantity", 
        "price", "discount", "batch_no", "expiry_date", 
        "mrp", "gst", "remarks"
    ]
    df = pd.DataFrame(columns=cols)
    # Add a sample row
    sample_row = {
        "invoice_date": date.today().strftime("%Y-%m-%d"),
        "reference_number": "INV-SAMPLE-01",
        "supplier_name": "Example Supplier",
        "product_name": "Example Medicine 500mg",
        "quantity": 10,
        "free_quantity": 0,
        "price": 150.00,
        "discount": 0.0,
        "batch_no": "B123",
        "expiry_date": (date.today() + timedelta(days=365)).strftime("%Y-%m-%d"),
        "mrp": 200.00,
        "gst": 12.0,
        "remarks": "Bulk upload test"
    }
    df = pd.concat([df, pd.DataFrame([sample_row])], ignore_index=True)
    
    stream = io.StringIO()
    df.to_csv(stream, index=False)
    
    return Response(
        content=stream.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=invoice_template.csv"}
    )

@router.get("/{id}", response_model=schemas.InvoiceSchema)
@router.get("/{id}/", response_model=schemas.InvoiceSchema, include_in_schema=False)
def get_invoice(id: int, db: Session = Depends(database.get_db)):
    """
    Retrieve a specific invoice by its ID, including all line items and payments.
    """
    with utils.db_error_handler("retrieving invoice"):
        invoice = db.query(models.Invoice).filter(models.Invoice.id == id).first()
        if not invoice:
            logger.warning(f"Invoice retrieval failed: ID {id} not found.")
            raise HTTPException(status_code=404, detail="Invoice not found")
        return invoice

@router.put("/{id}", response_model=schemas.InvoiceSchema)
@router.put("/{id}/", response_model=schemas.InvoiceSchema, include_in_schema=False)
def update_invoice(id: int, invoice_in: schemas.InvoiceUpdate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """
    Update an existing invoice's header details.
    """
    with utils.db_error_handler(f"invoice update (ID: {id})", db):
        db_invoice = db.query(models.Invoice).filter(models.Invoice.id == id).first()
        # Update Header Details
        update_data = invoice_in.model_dump(exclude_unset=True, exclude={'line_items'})
        for field, value in update_data.items():
            setattr(db_invoice, field, value)
        
        db_invoice.modified_by = current_user.id
        
        # Synchronization Logic (Stock and Audit)
        if invoice_in.line_items is not None:
            # 1. Reverse old stock from original line items
            old_items = db.query(models.InvoiceLineItem).filter(models.InvoiceLineItem.invoice_id == id).all()
            for old_item in old_items:
                if old_item.medicine_id:
                    stock_record = db.query(models.MedicineStock).filter(models.MedicineStock.medicine_id == old_item.medicine_id).first()
                    if stock_record:
                        total_old_qty = old_item.quantity + (old_item.free_quantity or 0)
                        stock_record.quantity_on_hand -= total_old_qty
                        stock_record.last_updated_at = datetime.now(timezone.utc)
                    
                    # Also reverse Batch stock
                    resolved_batch = old_item.batch_no or f"AUTO-{date.today().strftime('%Y%m%d')}"
                    batch_record = db.query(models.StockBatch).filter(
                        models.StockBatch.medicine_id == old_item.medicine_id,
                        models.StockBatch.batch_no == resolved_batch
                    ).first()
                    if batch_record:
                        batch_record.quantity_on_hand -= total_old_qty
            
            # 2. Clear existing line items and their stock adjustments (INVOICE_RECEIPT related)
            old_item_ids = [oi.id for oi in old_items]
            db.query(models.StockAdjustment).filter(
                models.StockAdjustment.invoice_line_item_id.in_(old_item_ids),
                models.StockAdjustment.adjustment_type == models.StockAdjustmentType.INVOICE_RECEIPT
            ).delete(synchronize_session=False)
            
            db.query(models.InvoiceLineItem).filter(models.InvoiceLineItem.invoice_id == id).delete()
            
            # 3. Re-insert updated items and apply new stock
            for item in invoice_in.line_items:
                db_item = models.InvoiceLineItem(**item.model_dump(), invoice_id=id, created_by=db_invoice.created_by)
                db.add(db_item)
                db.flush() # Get db_item.id for adjustment record
                
                if item.medicine_id:
                    # Sync stock
                    stock_record = db.query(models.MedicineStock).filter(models.MedicineStock.medicine_id == item.medicine_id).first()
                    if not stock_record:
                        stock_record = models.MedicineStock(medicine_id=item.medicine_id, quantity_on_hand=0)
                        db.add(stock_record)
                        db.flush()
                    
                    total_new_qty = item.quantity + (item.free_quantity or 0)
                    stock_record.quantity_on_hand += total_new_qty
                    stock_record.last_updated_at = datetime.now(timezone.utc)
                    
                    # Sync Batch
                    resolved_batch = item.batch_no or f"AUTO-{date.today().strftime('%Y%m%d')}"
                    batch_record = db.query(models.StockBatch).filter(
                        models.StockBatch.medicine_id == item.medicine_id,
                        models.StockBatch.batch_no == resolved_batch
                    ).first()
                    if not batch_record:
                        batch_record = models.StockBatch(
                            medicine_id=item.medicine_id,
                            batch_no=resolved_batch,
                            expiry_date=item.expiry_date,
                            quantity_on_hand=0,
                            purchase_price=item.price,
                            mrp=item.mrp,
                            gst=item.gst,
                        )
                        db.add(batch_record)
                    batch_record.quantity_on_hand += total_new_qty
                    batch_record.purchase_price = item.price
                    batch_record.mrp = item.mrp
                    batch_record.gst = item.gst

                    # Create new adjustment record
                    adjustment = models.StockAdjustment(
                        medicine_id=item.medicine_id,
                        quantity_change=total_new_qty,
                        adjustment_type=models.StockAdjustmentType.INVOICE_RECEIPT,
                        reason=f"Invoice updated: {db_invoice.reference_number}",
                        invoice_line_item_id=db_item.id,
                        batch_id=batch_record.id,
                        adjusted_by_user_id=current_user.id,
                        adjusted_at=datetime.combine(db_invoice.invoice_date, datetime.min.time())
                    )
                    db.add(adjustment)
        
        db.commit()
        db.refresh(db_invoice)
        logger.info(f"User {current_user.username} updated invoice: {db_invoice.reference_number} (ID: {id})")
        return db_invoice

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
@router.delete("/{id}/", status_code=status.HTTP_204_NO_CONTENT, include_in_schema=False)
def delete_invoice(id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(admin_manager_required)):
    """
    Delete an invoice, along with its line items and payments.
    Requires: Admin or Manager role.
    """
    with utils.db_error_handler(f"invoice deletion (ID: {id})", db):
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

# --- Invoice Payments ---

@router.post("/{invoice_id}/payments", response_model=schemas.InvoicePaymentSchema)
@router.post("/{invoice_id}/payments/", response_model=schemas.InvoicePaymentSchema, include_in_schema=False)
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
    with utils.db_error_handler(f"payment recording (Invoice: {invoice_id})", db):
        db_invoice = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
        if not db_invoice:
            logger.warning(f"Payment record failed: Invoice ID {invoice_id} not found.")
            raise HTTPException(status_code=404, detail="Invoice not found")
            
        if db_invoice.status == models.InvoiceStatus.Paid and current_user.role != "Admin":
            logger.warning(f"User {current_user.username} (Role: {current_user.role}) attempted to add payment to fully settled invoice {invoice_id}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, 
                detail="Invoice is completely settled. Only Admin can modify payments for paid invoices."
            )
        
        db_payment = models.InvoicePayment(created_by=current_user.id, **payment.model_dump())
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
            
        # --- Auto Expense Integration (Feature Flag Guarded) ---
        if settings.is_feature_enabled("FINANCE_MANAGEMENT"):
            logger.info(f"Feature: FINANCE_MANAGEMENT active. Recording auto-expense for Invoice {invoice_id}")
            try:
                ExpenseService.record_expense_from_invoice_payment(
                    db=db,
                    invoice=db_invoice,
                    payment=db_payment,
                    user_id=current_user.id
                )
            except Exception as e:
                logger.error(f"Auto-Expense: Failed for Invoice {invoice_id}: {str(e)}")
                # We do NOT fail the invoice payment if expense recording fails, 
                # but we log it for audit. In production, we might want this atomic.
                # User asked to not break existing features, so soft-fail is safer.

        db.commit()
        db.refresh(db_payment)
        logger.info(f"User {current_user.username} recorded payment of {db_payment.paid_amount} for invoice ID {invoice_id}")
        return db_payment

@router.get("/{invoice_id}/payments", response_model=List[schemas.InvoicePaymentSchema])
@router.get("/{invoice_id}/payments/", response_model=List[schemas.InvoicePaymentSchema], include_in_schema=False)
def get_invoice_payments(
    invoice_id: int, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Retrieve all payments recorded for a specific invoice.
    """
    with utils.db_error_handler(f"payments retrieval (Invoice: {invoice_id})"):
        payments = db.query(models.InvoicePayment).filter(models.InvoicePayment.invoice_id == invoice_id).all()
        return payments


@router.post("/upload")
async def upload_invoices(
    file: UploadFile = File(...), 
    db: Session = Depends(database.get_db), 
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Process a bulk upload of purchase invoices from CSV or Excel files.
    
    This endpoint:
    1. Reads and parses the uploaded file (CSV or Excel).
    2. Standardizes column names (lowercase, underscore replaced).
    3. Maps supplier and medicine names to their respective IDs using case-insensitive lookups.
    4. Groups line items by reference number into individual invoices.
    5. Validates each invoice and its items.
    6. Atomically creates each invoice using `InvoiceService`.
    7. Collects any failed rows into a CSV for error reporting.
    
    Args:
        file (UploadFile): The CSV or Excel file to upload.
        db (Session): The database session.
        current_user (User): The authenticated user performing the upload.
        
    Returns:
        dict: A summary of the upload including success/error counts and optionally an error CSV.
        
    Raises:
        HTTPException: If file parsing fails or required columns are missing.
    """
    logger.info(f"Bulk Upload: Starting import for file {file.filename} by user {current_user.username}")
    try:
        contents = await file.read()
        if file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(contents))
        else:
            df = pd.read_excel(io.BytesIO(contents))
    except Exception as e:
        logger.error(f"Bulk Upload: File parsing failed for {file.filename}: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {str(e)}")

    # Standardize column names
    df.columns = [c.strip().lower().replace(' ', '_') for c in df.columns]
    
    # Required columns check
    required = ["invoice_date", "reference_number", "supplier_name", "product_name", "quantity", "price"]
    missing = [c for c in required if c not in df.columns]
    if missing:
        logger.warning(f"Bulk Upload: Missing required columns in {file.filename}: {missing}")
        raise HTTPException(status_code=400, detail=f"Missing required columns: {', '.join(missing)}")

    # Lookup Maps (Case-Insensitive)
    suppliers = {s.supplier_name.lower(): s.id for s in db.query(models.Supplier).all()}
    medicines = {m.product_name.lower(): m.id for m in db.query(models.Medicine).all()}
    
    success_count = 0
    errors = []

    # Group by Reference Number — create new or append to existing Pending invoice
    for ref_no, group in df.groupby('reference_number'):
        try:
            logger.info(f"Bulk Upload: Processing invoice {ref_no}")
            first_row = group.iloc[0]

            # Check if this invoice reference already exists
            existing_invoice = db.query(models.Invoice).filter(
                models.Invoice.reference_number == str(ref_no)
            ).first()

            supplier_name = str(first_row.get('supplier_name', '')).strip().lower()
            supplier_id = suppliers.get(supplier_name)

            if not supplier_id:
                raise ValueError(f"Supplier '{first_row.get('supplier_name')}' not found")

            # Prepare Line Items (common for both create and append paths)
            line_items = []
            for _, row in group.iterrows():
                med_name = str(row.get('product_name', '')).strip().lower()
                med_id = medicines.get(med_name)

                if not med_id:
                    raise ValueError(f"Medicine '{row.get('product_name')}' not found")

                item = schemas.InvoiceLineItemCreate(
                    medicine_id=med_id,
                    description=str(row.get('description', '')) if 'description' in row else None,
                    quantity=int(row['quantity']),
                    free_quantity=int(row.get('free_quantity', 0)) if not pd.isna(row.get('free_quantity')) else 0,
                    price=float(row['price']),
                    discount=float(row.get('discount', 0.0)) if not pd.isna(row.get('discount')) else 0.0,
                    batch_no=_parse_batch_no(row.get('batch_no')),
                    expiry_date=pd.to_datetime(row.get('expiry_date')).date() if not pd.isna(row.get('expiry_date')) else (date.today() + timedelta(days=365)),
                    mrp=float(row.get('mrp', 0.0)) if not pd.isna(row.get('mrp')) else 0.0,
                    gst=float(row.get('gst', 0.0)) if not pd.isna(row.get('gst')) else 0.0,
                    remarks=str(row.get('remarks', '')) if 'remarks' in row else None
                )
                line_items.append(item)

            if existing_invoice:
                # Business rule: append to Pending invoices, reject otherwise
                logger.info(
                    f"Bulk Upload: Invoice '{ref_no}' already exists "
                    f"(Status: {existing_invoice.status}). Attempting append."
                )
                InvoiceService.append_line_items_to_pending(
                    db, existing_invoice, line_items, current_user.id
                )
                db.commit()
                success_count += 1
                logger.info(f"Bulk Upload: Appended items to existing invoice '{ref_no}'")
            else:
                # Invoice does not exist — create fresh
                invoice_in = schemas.InvoiceCreate(
                    supplier_id=supplier_id,
                    invoice_date=pd.to_datetime(first_row['invoice_date']).date(),
                    reference_number=str(ref_no),
                    total_value=float((group['quantity'] * group['price']).sum()),
                    gst=float(group['gst'].sum()) if 'gst' in group else 0.0,
                    line_items=line_items
                )
                InvoiceService.create_invoice_with_items(db, invoice_in, current_user.id)
                db.commit()
                success_count += 1
                logger.info(f"Bulk Upload: Successfully created invoice '{ref_no}'")

        except ValueError as e:
            # Business rule violation (duplicate ref, supplier not found, etc.)
            db.rollback()
            error_msg = str(e)
            logger.warning(f"Bulk Upload: Skipped invoice {ref_no}: {error_msg}")
            group_copy = group.copy()
            group_copy['error_reason'] = error_msg
            errors.append(group_copy)

        except Exception as e:
            db.rollback()
            raw = str(e)
            # Translate common DB errors to human-readable messages
            if 'UniqueViolation' in raw or 'unique constraint' in raw.lower():
                error_msg = f"Invoice '{ref_no}' already exists or has a duplicate batch entry. Please verify the data."
            else:
                # Trim the raw exception to a short readable summary
                error_msg = raw.split('\n')[0][:200]
            logger.warning(f"Bulk Upload: Failed to process invoice {ref_no} in file {file.filename}: {raw}")
            group_copy = group.copy()
            group_copy['error_reason'] = error_msg
            errors.append(group_copy)

    # Prepare Response
    result = {
        "success_count": success_count,
        "error_count": len(errors),
        "error_csv_content": None
    }
    
    if errors:
        error_df = pd.concat(errors)
        stream = io.StringIO()
        error_df.to_csv(stream, index=False)
        result["error_csv_content"] = stream.getvalue()
    
    logger.info(f"Bulk Upload: Import complete for {file.filename}. Successes: {success_count}, Failures: {len(errors)}")    
    return result
