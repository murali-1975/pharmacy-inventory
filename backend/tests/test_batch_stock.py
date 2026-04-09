import pytest
import datetime
from app import models

def test_invoice_creates_batch(client, db):
    """Verify that an invoice receipt creates a StockBatch."""
    # 1. Create a medicine
    med_res = client.post("/medicines/", json={
        "product_name": "Batch Test Med",
        "category": "GENERAL",
        "uom": "Strip",
        "hsn_code": "BT001",
        "selling_price_percent": 10.0
    })
    med_id = med_res.json()["id"]
    
    # 2. Add Supplier (V2 schema requires more fields or handles defaults)
    sup_res = client.post("/suppliers/", json={"supplier_name": "Batch Supplier"})
    sup_id = sup_res.json()["id"]

    # 3. Create Invoice
    client.post("/invoices/", json={
        "supplier_id": sup_id,
        "invoice_date": str(datetime.date.today()),
        "reference_number": "BATCH-001",
        "total_value": 1000,
        "line_items": [{
            "medicine_id": med_id,
            "quantity": 100,
            "batch_no": "EXP-2025",
            "expiry_date": "2025-12-31",
            "price": 10.0,
            "mrp": 20.0
        }]
    })

    # 4. Verify StockBatch exists
    batch = db.query(models.StockBatch).filter(models.StockBatch.medicine_id == med_id).first()
    assert batch is not None
    assert batch.batch_no == "EXP-2025"
    assert batch.quantity_on_hand == 100
    assert batch.purchase_price == 10.0
    assert batch.mrp == 20.0

def test_fefo_dispensing(client, db):
    """Verify that dispensing pulls from the soonest expiry batch first (FEFO)."""
    import datetime
    # Setup: 1 med, 2 batches (Batch A expires 2024, Batch B expires 2025)
    med_res = client.post("/medicines/", json={"product_name": "FEFO Med", "uom": "Box", "category": "GENERAL", "selling_price_percent": 0})
    med_id = med_res.json()["id"]
    sup_res = client.post("/suppliers/", json={"supplier_name": "FEFO Sup"})
    sup_id = sup_res.json()["id"]

    # Batch B (later expiry)
    client.post("/invoices/", json={
        "supplier_id": sup_id, "invoice_date": str(datetime.date.today()), "reference_number": "INV-B",
        "total_value": 500, "line_items": [{"medicine_id": med_id, "quantity": 50, "batch_no": "B-2025", "expiry_date": "2025-12-31", "price": 10.0, "mrp": 20.0}]
    })
    # Batch A (earlier expiry)
    client.post("/invoices/", json={
        "supplier_id": sup_id, "invoice_date": str(datetime.date.today()), "reference_number": "INV-A",
        "total_value": 500, "line_items": [{"medicine_id": med_id, "quantity": 50, "batch_no": "A-2024", "expiry_date": "2024-12-31", "price": 8.0, "mrp": 15.0}]
    })

    # Dispense 60 units (should take 50 from A and 10 from B)
    client.post("/dispensing/", json={
        "dispensed_date": str(datetime.date.today()), "patient_name": "Test", "medicine_id": med_id,
        "quantity": 60, "unit_price": 15.0, "gst_percent": 0
    })

    # Verify batches
    batch_a = db.query(models.StockBatch).filter(models.StockBatch.batch_no == "A-2024").first()
    batch_b = db.query(models.StockBatch).filter(models.StockBatch.batch_no == "B-2025").first()
    
    assert batch_a.quantity_on_hand == 0
    assert batch_b.quantity_on_hand == 40
    
    # Verify adjustments (2 records for 1 dispensing event)
    adjs = db.query(models.StockAdjustment).filter(models.StockAdjustment.medicine_id == med_id).all()
    # 2 (Receipts) + 2 (Dispensing splits) = 4
    disp_adjs = [a for a in adjs if a.adjustment_type == models.StockAdjustmentType.DISPENSED]
    assert len(disp_adjs) == 2
    assert sum(a.quantity_change for a in disp_adjs) == -60
