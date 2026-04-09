import pytest
from datetime import date, datetime, timezone
from app.services.invoice_service import InvoiceService
from app import models, schemas
from fastapi import HTTPException

def test_create_pharmacy_invoice_updates_stock(db):
    """Verify that creating an invoice for a pharmacy supplier correctly updates stock."""
    # 1. Setup - Seed SupplierType (Status is already seeded in conftest.py)
    # Use existing seeded type or add new one without conflicting ID
    st = db.query(models.SupplierType).filter(models.SupplierType.name == "Pharmacy").first()
    if not st:
        st = models.SupplierType(name="Pharmacy")
        db.add(st)
        db.commit()
        db.refresh(st)
    
    # 2. Create Supplier
    supplier = models.Supplier(supplier_name="Test Pharma", type_id=st.id, status_id=1)
    db.add(supplier)
    db.commit()
    
    # 3. Create Medicine
    medicine = models.Medicine(product_name="Para 500", hsn_code="1234")
    db.add(medicine)
    db.commit()
    
    # 4. Input Data
    invoice_in = schemas.InvoiceCreate(
        supplier_id=supplier.id,
        invoice_date=date.today(),
        reference_number="INV-SERVICE-01",
        total_value=100.0,
        gst=12.0,
        line_items=[
            schemas.InvoiceLineItemCreate(
                medicine_id=medicine.id,
                quantity=10,
                price=10.0,
                batch_no="B1",
                mrp=15.0,
                gst=12.0
            )
        ]
    )
    
    # 5. Execute
    invoice = InvoiceService.create_invoice_with_items(db, invoice_in, user_id=1)
    db.commit()
    
    # 6. Verify
    assert invoice.id is not None
    assert invoice.reference_number == "INV-SERVICE-01"
    
    # Verify Stock
    stock = db.query(models.MedicineStock).filter(models.MedicineStock.medicine_id == medicine.id).first()
    assert stock is not None
    assert stock.quantity_on_hand == 10
    
    # Verify Batch
    batch = db.query(models.StockBatch).filter(
        models.StockBatch.medicine_id == medicine.id,
        models.StockBatch.batch_no == "B1"
    ).first()
    assert batch is not None
    assert batch.quantity_on_hand == 10
    assert batch.purchase_price == 10.0
    
    # Verify Audit
    adjustment = db.query(models.StockAdjustment).filter(models.StockAdjustment.medicine_id == medicine.id).first()
    assert adjustment is not None
    assert adjustment.quantity_change == 10
    assert adjustment.adjustment_type == models.StockAdjustmentType.INVOICE_RECEIPT

def test_create_non_pharmacy_invoice_no_stock_impact(db):
    """Verify that non-pharmacy line items (description only) don't affect medicine stock."""
    # 1. Setup
    st = db.query(models.SupplierType).filter(models.SupplierType.name == "Printer").first()
    if not st:
        st = models.SupplierType(name="Printer")
        db.add(st)
        db.commit()
        db.refresh(st)
    supplier = models.Supplier(supplier_name="Tony Printers", type_id=st.id, status_id=1)
    db.add(supplier)
    db.commit()
    
    # 2. Input
    invoice_in = schemas.InvoiceCreate(
        supplier_id=supplier.id,
        invoice_date=date.today(),
        reference_number="INV-PRINTER-01",
        total_value=500.0,
        line_items=[
            schemas.InvoiceLineItemCreate(
                description="Paper Ream",
                quantity=5,
                price=100.0
            )
        ]
    )
    
    # 3. Execute
    invoice = InvoiceService.create_invoice_with_items(db, invoice_in, user_id=1)
    db.commit()
    
    # 4. Verify
    assert len(invoice.line_items) == 1
    assert invoice.line_items[0].description == "Paper Ream"
    assert invoice.line_items[0].medicine_id is None
    
    # Ensure no stock records created
    stock_count = db.query(models.MedicineStock).count()
    assert stock_count == 0

def test_create_invoice_fails_on_missing_supplier(db):
    """Verify that an exception is raised if the supplier ID is invalid."""
    invoice_in = schemas.InvoiceCreate(
        supplier_id=999,
        invoice_date=date.today(),
        reference_number="ERROR-01",
        total_value=0,
        line_items=[]
    )
    
    with pytest.raises(HTTPException) as excinfo:
        InvoiceService.create_invoice_with_items(db, invoice_in, user_id=1)
    assert excinfo.value.status_code == 404
    assert "Supplier not found" in excinfo.value.detail

def test_create_invoice_fails_on_missing_medicine(db):
    """Verify that an exception is raised if a medicine ID in a line item is invalid."""
    st = db.query(models.SupplierType).filter(models.SupplierType.name == "Pharmacy").first()
    if not st:
        st = models.SupplierType(name="Pharmacy")
        db.add(st)
        db.commit()
        db.refresh(st)
    supplier = models.Supplier(supplier_name="Pharma", type_id=st.id, status_id=1)
    db.add(supplier)
    db.commit()
    
    invoice_in = schemas.InvoiceCreate(
        supplier_id=supplier.id,
        invoice_date=date.today(),
        reference_number="ERROR-MED",
        total_value=100,
        line_items=[
            schemas.InvoiceLineItemCreate(medicine_id=999, quantity=1, price=100)
        ]
    )
    
    with pytest.raises(HTTPException) as excinfo:
        InvoiceService.create_invoice_with_items(db, invoice_in, user_id=1)
    assert excinfo.value.status_code == 404
    assert "Medicine ID 999 not found" in excinfo.value.detail
