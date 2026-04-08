import datetime
from sqlalchemy.orm import Session
from fastapi import HTTPException
from app import models, schemas
from app.core.logging_config import logger

class InvoiceService:
    @staticmethod
    def create_invoice_with_items(db: Session, invoice_in: schemas.InvoiceCreate, user_id: int) -> models.Invoice:
        """
        Creates an invoice along with its line items and updates stock levels atomically.
        
        This method handles:
        - Validating the supplier exists.
        - Creating the invoice header record.
        - Processing each line item:
            - Validating medicine exists (for pharmacy items).
            - Creating the line item record.
            - Updating or creating the `MedicineStock` ledger.
            - Managing `StockBatch` records (new or existing).
            - Recording `StockAdjustment` audit logs.
            
        Args:
            db (Session): The database session.
            invoice_in (schemas.InvoiceCreate): The invoice data from the API/Upload.
            user_id (int): The ID of the user performing the action.
            
        Returns:
            models.Invoice: The created invoice object.
            
        Raises:
            HTTPException: If the supplier or a medicine (when ID is provided) is not found.
        """
        logger.info(f"Service: Starting creation of invoice {invoice_in.reference_number} for supplier ID {invoice_in.supplier_id}")
        
        # 1. Verify supplier exists
        supplier = db.query(models.Supplier).filter(models.Supplier.id == invoice_in.supplier_id).first()
        if not supplier:
            logger.warning(f"Service: Invoice creation failed: Supplier ID {invoice_in.supplier_id} not found.")
            raise HTTPException(status_code=404, detail="Supplier not found")
        
        # 2. Create Invoice Header
        db_invoice = models.Invoice(
            supplier_id=invoice_in.supplier_id,
            invoice_date=invoice_in.invoice_date,
            reference_number=invoice_in.reference_number,
            total_value=invoice_in.total_value,
            gst=invoice_in.gst,
            created_by=user_id
        )
        db.add(db_invoice)
        db.flush() # Get ID for line items
        
        # 3. Create Line Items and update stock atomically
        for item in invoice_in.line_items:
            if item.medicine_id:
                # Verify medicine exists
                medicine = db.query(models.Medicine).filter(models.Medicine.id == item.medicine_id).first()
                if not medicine:
                    logger.warning(f"Service: Invoice line item creation failed: Medicine ID {item.medicine_id} not found.")
                    raise HTTPException(status_code=404, detail=f"Medicine ID {item.medicine_id} not found")
            
            db_item = models.InvoiceLineItem(
                invoice_id=db_invoice.id,
                created_by=user_id,
                **item.model_dump()
            )
            db.add(db_item)
            db.flush()  # Needed so db_item.id is available for the audit record

            # --- Auto Stock Update (only for pharmacy medicine line items) ---
            if item.medicine_id:
                logger.info(f"Service: Updating stock for medicine ID {item.medicine_id} (Invoice: {invoice_in.reference_number})")
                stock_record = db.query(models.MedicineStock).filter(
                    models.MedicineStock.medicine_id == item.medicine_id
                ).first()

                if not stock_record:
                    logger.info(f"Service: Initializing new stock record for medicine ID {item.medicine_id}")
                    # First ever receipt: create the stock ledger entry
                    stock_record = models.MedicineStock(
                        medicine_id=item.medicine_id,
                        quantity_on_hand=0,
                    )
                    db.add(stock_record)
                    db.flush()

                # Increment stock
                total_qty = item.quantity + (item.free_quantity or 0)
                stock_record.quantity_on_hand += total_qty
                stock_record.last_updated_at = datetime.datetime.now(datetime.timezone.utc)

                # --- Batch Tracking ---
                resolved_batch_no = item.batch_no or f"AUTO-{datetime.date.today().strftime('%Y%m%d')}"
                resolved_expiry = item.expiry_date or (datetime.date.today() + datetime.timedelta(days=365))
                
                batch_record = db.query(models.StockBatch).filter(
                    models.StockBatch.medicine_id == item.medicine_id,
                    models.StockBatch.batch_no == resolved_batch_no
                ).first()

                if not batch_record:
                    logger.info(f"Service: Creating new stock batch {resolved_batch_no} for medicine ID {item.medicine_id}")
                    batch_record = models.StockBatch(
                        medicine_id=item.medicine_id,
                        batch_no=resolved_batch_no,
                        expiry_date=resolved_expiry,
                        quantity_on_hand=0,
                        purchase_price=item.price, # Storing purchase price for unit price logic
                        mrp=item.mrp,
                        gst=item.gst,
                    )
                    db.add(batch_record)
                else:
                    logger.info(f"Service: Updating existing batch {resolved_batch_no} for medicine ID {item.medicine_id}")
                
                batch_record.quantity_on_hand += total_qty
                batch_record.purchase_price = item.price
                batch_record.mrp = item.mrp
                batch_record.gst = item.gst

                # Write immutable audit record
                adjustment = models.StockAdjustment(
                    medicine_id=item.medicine_id,
                    quantity_change=total_qty,
                    adjustment_type=models.StockAdjustmentType.INVOICE_RECEIPT,
                    reason=f"Invoice receipt: {invoice_in.reference_number}",
                    invoice_line_item_id=db_item.id,
                    batch_id=batch_record.id,
                    adjusted_by_user_id=user_id,
                )
                db.add(adjustment)
        
        logger.info(f"Service: Successfully completed invoice creation for {invoice_in.reference_number}")
        return db_invoice

    @staticmethod
    def append_line_items_to_pending(
        db: Session,
        db_invoice: models.Invoice,
        line_items: list,
        user_id: int
    ) -> models.Invoice:
        """
        Appends new line items to an existing invoice that is in Pending status.

        This method is used by bulk upload when the same reference number already 
        exists in the system. Instead of rejecting the upload, it merges the new 
        line items into the existing invoice and updates all downstream stock records.

        Business rules:
        - Invoice MUST be in Pending status; raises ValueError otherwise.
        - Each new line item updates stock, batch, and audit records identically
          to the create flow.
        - The invoice total_value is recalculated after appending.

        Args:
            db (Session): The database session.
            db_invoice (models.Invoice): The existing invoice ORM object.
            line_items (list): List of InvoiceLineItemCreate schema objects to append.
            user_id (int): The ID of the user performing the action.

        Returns:
            models.Invoice: The updated invoice object.

        Raises:
            ValueError: If the invoice is not in Pending status.
        """
        if db_invoice.status != models.InvoiceStatus.Pending:
            raise ValueError(
                f"Invoice '{db_invoice.reference_number}' is in '{db_invoice.status}' status. "
                f"Only Pending invoices can have new items added via bulk upload."
            )

        logger.info(
            f"Service: Appending {len(line_items)} line item(s) to existing "
            f"Pending invoice '{db_invoice.reference_number}' (ID: {db_invoice.id})"
        )

        appended_value = 0.0
        for item in line_items:
            if item.medicine_id:
                medicine = db.query(models.Medicine).filter(models.Medicine.id == item.medicine_id).first()
                if not medicine:
                    raise ValueError(f"Medicine ID {item.medicine_id} not found")

            db_item = models.InvoiceLineItem(
                invoice_id=db_invoice.id,
                created_by=user_id,
                **item.model_dump()
            )
            db.add(db_item)
            db.flush()

            appended_value += float(item.price * item.quantity)

            if item.medicine_id:
                logger.info(
                    f"Service: Appending stock for medicine ID {item.medicine_id} "
                    f"(Invoice: {db_invoice.reference_number})"
                )
                stock_record = db.query(models.MedicineStock).filter(
                    models.MedicineStock.medicine_id == item.medicine_id
                ).first()
                if not stock_record:
                    stock_record = models.MedicineStock(
                        medicine_id=item.medicine_id,
                        quantity_on_hand=0
                    )
                    db.add(stock_record)
                    db.flush()

                total_qty = item.quantity + (item.free_quantity or 0)
                stock_record.quantity_on_hand += total_qty
                stock_record.last_updated_at = datetime.datetime.now(datetime.timezone.utc)

                resolved_batch_no = item.batch_no or f"AUTO-{datetime.date.today().strftime('%Y%m%d')}"
                resolved_expiry = item.expiry_date or (datetime.date.today() + datetime.timedelta(days=365))

                batch_record = db.query(models.StockBatch).filter(
                    models.StockBatch.medicine_id == item.medicine_id,
                    models.StockBatch.batch_no == resolved_batch_no
                ).first()

                if not batch_record:
                    logger.info(
                        f"Service: Creating new batch {resolved_batch_no} "
                        f"for medicine ID {item.medicine_id}"
                    )
                    batch_record = models.StockBatch(
                        medicine_id=item.medicine_id,
                        batch_no=resolved_batch_no,
                        expiry_date=resolved_expiry,
                        quantity_on_hand=0,
                        purchase_price=item.price,
                        mrp=item.mrp,
                        gst=item.gst,
                    )
                    db.add(batch_record)
                else:
                    logger.info(
                        f"Service: Updating existing batch {resolved_batch_no} "
                        f"for medicine ID {item.medicine_id}"
                    )

                batch_record.quantity_on_hand += total_qty
                batch_record.purchase_price = item.price
                batch_record.mrp = item.mrp
                batch_record.gst = item.gst

                adjustment = models.StockAdjustment(
                    medicine_id=item.medicine_id,
                    quantity_change=total_qty,
                    adjustment_type=models.StockAdjustmentType.INVOICE_RECEIPT,
                    reason=f"Bulk upload append: {db_invoice.reference_number}",
                    invoice_line_item_id=db_item.id,
                    batch_id=batch_record.id,
                    adjusted_by_user_id=user_id,
                )
                db.add(adjustment)

        # Update the invoice total to reflect appended items
        db_invoice.total_value = (db_invoice.total_value or 0.0) + appended_value
        db_invoice.modified_by = user_id

        logger.info(
            f"Service: Append complete for invoice '{db_invoice.reference_number}'. "
            f"Added value: {appended_value:.2f}"
        )
        return db_invoice
