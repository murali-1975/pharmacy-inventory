import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app import models, auth
from datetime import date, timedelta

def test_initialization_pulls_price_from_master(client: TestClient, db: Session):
    """
    Test Case: Verify Stock Initialization pulls MRP/Price from Medicine Master.
    """
    # 1. Create a medicine with a specific unit price
    manufacturer = models.Manufacturer(name="Price Test Mfg")
    db.add(manufacturer)
    db.commit()
    
    medicine = models.Medicine(
        product_name="Pricing Logic Tablet",
        unit_price=599.50,
        manufacturer_id=manufacturer.id,
        category=models.MedicineCategory.GENERAL
    )
    db.add(medicine)
    db.commit()
    db.refresh(medicine)
    
    # 2. Initialize stock
    init_data = {
        "medicine_id": medicine.id,
        "quantity": 100,
        "initialized_date": str(date.today()),
        "notes": "Test pricing sync"
    }
    
    response = client.post("/stock/initialize", json=init_data)
    assert response.status_code == 200
    
    # 3. Verify Batch MRP in Database
    batch = db.query(models.StockBatch).filter(
        models.StockBatch.medicine_id == medicine.id,
        models.StockBatch.batch_no == "OPENING-STOCK"
    ).first()
    
    assert batch is not None
    assert batch.mrp == 599.50
    assert batch.purchase_price == 599.50
    assert batch.quantity_on_hand == 100

def test_invoice_receipt_overrides_initialization_price(client: TestClient, db: Session):
    """
    Test Case: Verify that subsequent invoices use their own price, not the master price.
    """
    # 1. Create medicine
    manufacturer = models.Manufacturer(name="Multi Price Mfg")
    db.add(manufacturer)
    db.commit()
    
    medicine = models.Medicine(
        product_name="Multi Price Tablet",
        unit_price=100.00, # Master price
        manufacturer_id=manufacturer.id
    )
    db.add(medicine)
    db.commit()
    
    # 2. Initialize stock (should use 100.00)
    client.post("/stock/initialize", json={
        "medicine_id": medicine.id,
        "quantity": 10,
        "initialized_date": str(date.today())
    })
    
    # 3. Add via Invoice with a DIFFERENT price (120.00)
    status = db.query(models.Status).filter(models.Status.name == "Active").first()
    supplier = models.Supplier(supplier_name="Modern Agency", status_id=status.id)
    db.add(supplier)
    db.commit()
    
    invoice_data = {
        "supplier_id": supplier.id,
        "invoice_date": str(date.today()),
        "reference_number": "INV-PRC-001",
        "total_value": 1200.00,
        "line_items": [
            {
                "medicine_id": medicine.id,
                "quantity": 10,
                "price": 90.00, # Cost
                "mrp": 120.00, # Selling
                "batch_no": "BATCH-NEW-PRICE",
                "expiry_date": str(date.today() + timedelta(days=365))
            }
        ]
    }
    
    resp = client.post("/invoices/", json=invoice_data)
    assert resp.status_code == 200
    
    # 4. Verify both batches exist with different prices
    opening_batch = db.query(models.StockBatch).filter(
        models.StockBatch.medicine_id == medicine.id,
        models.StockBatch.batch_no == "OPENING-STOCK"
    ).first()
    
    new_batch = db.query(models.StockBatch).filter(
        models.StockBatch.medicine_id == medicine.id,
        models.StockBatch.batch_no == "BATCH-NEW-PRICE"
    ).first()
    
    assert opening_batch.mrp == 100.00
    assert new_batch.mrp == 120.00
