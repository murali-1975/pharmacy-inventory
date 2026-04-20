import pytest
from datetime import date, datetime, timezone, timedelta
from fastapi import status
from app import models

def test_period_portfolio_summary_reconciliation(client, db):
    """
    Test the complex point-in-time valuation and financial reconciliation logic.
    Story:
    1. Start of Period: 100 units @ Rs 10 cost.
    2. Mid Period: Sell 10 units @ Rs 25 revenue.
    3. End Period: Purchase 50 more units @ Rs 12 cost.
    """
    t0 = date.today() - timedelta(days=7) # Pre-start initialization
    t1 = date.today() - timedelta(days=5) # Report Start
    t2 = date.today() - timedelta(days=3) # Mid-period sale
    t3 = date.today() - timedelta(days=1) # End-period purchase/closing
    
    # Setup Medicine
    med = models.Medicine(product_name="ReconcileMed", unit_price=25.0)
    db.add(med)
    db.flush()

    # 1. Opening Balance (happened at t0)
    batch1 = models.StockBatch(
        medicine_id=med.id, batch_no="BATCH-001", quantity_on_hand=90, 
        purchase_price=10.0, mrp=30.0, expiry_date=date(2030,1,1),
        received_at=datetime.combine(t0, datetime.min.time()).replace(tzinfo=timezone.utc)
    )
    db.add(batch1)
    db.flush()
    
    # Opening Adjustment at t0
    db.add(models.StockAdjustment(
        medicine_id=med.id, batch_id=batch1.id, quantity_change=100,
        adjustment_type=models.StockAdjustmentType.OPENING_BALANCE, reason="init",
        adjusted_by_user_id=1, adjusted_at=datetime.combine(t0, datetime.min.time()).replace(tzinfo=timezone.utc)
    ))

    # 2. Dispensing (Mid-period)
    disp = models.Dispensing(
        dispensed_date=t2, patient_name="Test Patient", medicine_id=med.id,
        quantity=10, unit_price=25.0, total_amount=250.0, recorded_by_user_id=1
    )
    db.add(disp)
    db.flush()
    db.add(models.StockAdjustment(
        medicine_id=med.id, batch_id=batch1.id, quantity_change=-10,
        adjustment_type=models.StockAdjustmentType.DISPENSED, reason="sale",
        dispensing_id=disp.id, adjusted_by_user_id=1,
        adjusted_at=datetime.combine(t2, datetime.min.time()).replace(tzinfo=timezone.utc)
    ))

    # 3. New Purchase (End-period)
    batch2 = models.StockBatch(
        medicine_id=med.id, batch_no="BATCH-002", quantity_on_hand=50,
        purchase_price=12.0, mrp=35.0, expiry_date=date(2030,1,1),
        received_at=datetime.combine(t3, datetime.min.time()).replace(tzinfo=timezone.utc)
    )
    db.add(batch2)
    db.flush()
    db.add(models.StockAdjustment(
        medicine_id=med.id, batch_id=batch2.id, quantity_change=50,
        adjustment_type=models.StockAdjustmentType.INVOICE_RECEIPT, reason="purchase",
        adjusted_by_user_id=1, adjusted_at=datetime.combine(t3, datetime.min.time()).replace(tzinfo=timezone.utc)
    ))

    db.commit()

    # Query the summary
    response = client.get(f"/financials/period-summary?start_date={t1}&end_date={t3}")
    # Query the summary
    response = client.get(f"/financials/period-summary?start_date={t1}&end_date={t3}")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    print("\nDEBUG Period Summary Data:", data)

    # Validations
    # Opening: 100 * 10 = 1000
    assert data["opening_valuation"] == 1000.0
    
    # Purchases: 50 * 12 = 600
    assert data["purchases_value"] == 600.0
    assert data["initial_stock_value"] == 0.0
    
    # Revenue: 250
    assert data["revenue"] == 250.0
    
    # COGS: 10 * 10 = 100
    assert data["cost_of_goods_sold"] == 100.0
    
    # Adjustments: None in this period
    assert data["adjustments_value"] == 0.0
    assert data["write_offs_value"] == 0.0

    # Profit: 250 - 100 = 150
    assert data["gross_profit"] == 150.0
    
    # Closing: 1000 + 600 - 100 + 0 = 1500
    assert data["closing_valuation"] == 1500.0

def test_period_summary_invalid_dates(client):
    today = date.today()
    tomorrow = today + timedelta(days=1)
    response = client.get(f"/financials/period-summary?start_date={tomorrow}&end_date={today}")
    assert response.status_code == status.HTTP_400_BAD_REQUEST

def test_period_portfolio_batchless_reconciliation(client, db):
    """
    Test reconciliation with 'Batch-less' manual adjustments.
    Story:
    1. Start: 0 stock.
    2. Mid: Manual Adjust +10 units (no batch).
    3. Mid: Dispense 3 units.
    Verify math: Open(0) + Added(0) - COGS(75) + NetAdj(250) = Closing(175).
    """
    t1 = date.today() - timedelta(days=5) # Start
    t2 = date.today() - timedelta(days=2) # Movements
    t3 = date.today() # End
    
    # Medicine with unit_price = 25
    med = models.Medicine(product_name="BatchlessMed", unit_price=25.0)
    db.add(med)
    db.flush()
    
    # Ensure a stock record exists
    stock = models.MedicineStock(medicine_id=med.id, quantity_on_hand=7)
    db.add(stock)

    # 1. Manual Adjustment (+10) - NO BATCH
    db.add(models.StockAdjustment(
        medicine_id=med.id, quantity_change=10,
        adjustment_type=models.StockAdjustmentType.MANUAL_ADJUSTMENT, reason="manual add",
        adjusted_by_user_id=1, adjusted_at=datetime.combine(t2, datetime.min.time()).replace(tzinfo=timezone.utc)
    ))

    # 2. Dispensing (-3)
    disp = models.Dispensing(
        dispensed_date=t2, patient_name="B-Less Patient", medicine_id=med.id,
        quantity=3, unit_price=50.0, total_amount=150.0, recorded_by_user_id=1
    )
    db.add(disp)
    db.flush()
    db.add(models.StockAdjustment(
        medicine_id=med.id, quantity_change=-3,
        adjustment_type=models.StockAdjustmentType.DISPENSED, reason="sale",
        dispensing_id=disp.id, adjusted_by_user_id=1,
        adjusted_at=datetime.combine(t2, datetime.min.time()).replace(tzinfo=timezone.utc)
    ))

    db.commit()

    # Query
    response = client.get(f"/financials/period-summary?start_date={t1}&end_date={t3}")
    assert response.status_code == 200
    data = response.json()
    
    # Verifications
    assert data["opening_valuation"] == 0.0
    assert data["purchases_value"] == 0.0
    assert data["initial_stock_value"] == 0.0
    assert data["adjustments_value"] == 250.0 # 10 * 25
    assert data["cost_of_goods_sold"] == 75.0 # 3 * 25
    assert data["closing_valuation"] == 175.0 # 0 + 0 - 75 + 250
    assert data["revenue"] == 150.0
    assert data["gross_profit"] == 75.0

def test_period_summary_reconciliation_after_cancellation(client, db):
    """
    Test Case: Verify that COGS is neutralized if a sale is cancelled.
    Story:
    1. Start: 0 stock.
    2. t2: Initialize 10 units @ 10 cost. (Initial stock)
    3. t3: Dispense 5 units @ 20. (Sale)
    4. t4: Cancel Dispensing ID 3. (Reversal)
    Verify: Revenue=0, COGS=0, Adj=0, Closing=100.
    """
    t1 = date.today() - timedelta(days=5) # Start
    t2 = date.today() - timedelta(days=4) # Init
    t3 = date.today() - timedelta(days=3) # Sale
    t4 = date.today() - timedelta(days=2) # Cancel
    t5 = date.today() # End
    
    # 1. Setup
    med = models.Medicine(product_name="CancelMed", unit_price=20.0)
    db.add(med)
    db.flush()
    
    # 2. Init Stock
    batch = models.StockBatch(
        medicine_id=med.id, batch_no="OPENING-STOCK", quantity_on_hand=10,
        purchase_price=10.0, mrp=25.0, expiry_date=date(2030,1,1),
        received_at=datetime.combine(t2, datetime.min.time()).replace(tzinfo=timezone.utc)
    )
    db.add(batch)
    db.flush()
    db.add(models.StockAdjustment(
        medicine_id=med.id, batch_id=batch.id, quantity_change=10,
        adjustment_type=models.StockAdjustmentType.OPENING_BALANCE, reason="init",
        adjusted_by_user_id=1, adjusted_at=datetime.combine(t2, datetime.min.time()).replace(tzinfo=timezone.utc)
    ))

    # 3. Sale (Dispensing ID 3 mock)
    # We don't add the dispensing record to DB to mock a DELETED/CANCELLED sale
    # in the eyes of the Revenue query (which would return 0).
    db.add(models.StockAdjustment(
        medicine_id=med.id, batch_id=batch.id, quantity_change=-5,
        adjustment_type=models.StockAdjustmentType.DISPENSED, reason="sale",
        dispensing_id=3, adjusted_by_user_id=1,
        adjusted_at=datetime.combine(t3, datetime.min.time()).replace(tzinfo=timezone.utc)
    ))
    
    # 4. Cancellation Reversal
    db.add(models.StockAdjustment(
        medicine_id=med.id, batch_id=batch.id, quantity_change=5,
        adjustment_type=models.StockAdjustmentType.MANUAL_ADJUSTMENT, 
        reason="Reversal of cancelled dispensing ID 3",
        adjusted_by_user_id=1, adjusted_at=datetime.combine(t4, datetime.min.time()).replace(tzinfo=timezone.utc)
    ))

    db.commit()

    # Query
    response = client.get(f"/financials/period-summary?start_date={t1}&end_date={t5}")
    assert response.status_code == 200
    data = response.json()
    
    # Verifications
    assert data["revenue"] == 0.0
    assert data["cost_of_goods_sold"] == 0.0 # 5*10 - 5*10
    assert data["adjustments_value"] == 0.0   # Reversal should be excluded from general adjustments
    assert data["initial_stock_value"] == 100.0
    assert data["gross_profit"] == 0.0
    assert data["closing_valuation"] == 100.0

def test_no_cartesian_product_on_adjustments(client, db):
    """
    Regression Test: Ensure that having multiple medicines doesn't multiply adjustment values.
    Story:
    1. Seed 5 different medicines.
    2. Create 1 adjustment of +₹50 (at cost) for ONLY 1 medicine.
    3. Verify report shows ₹50, not ₹250 (50*5).
    """
    t1 = date.today() - timedelta(days=2)
    t2 = date.today() - timedelta(days=1)
    
    # 1. Setup 5 medicines
    for i in range(5):
        m = models.Medicine(product_name=f"Med_{i}", unit_price=10.0)
        db.add(m)
    db.flush()
    
    # 2. Add 1 adjustment to Med_0
    target_med = db.query(models.Medicine).filter_by(product_name="Med_0").first()
    db.add(models.StockAdjustment(
        medicine_id=target_med.id, quantity_change=5, # 5 units * 10 unit_price = 50
        adjustment_type=models.StockAdjustmentType.MANUAL_ADJUSTMENT, reason="Test Correction",
        adjusted_by_user_id=1, adjusted_at=datetime.combine(t2, datetime.min.time()).replace(tzinfo=timezone.utc)
    ))
    db.commit()

    # Query
    response = client.get(f"/financials/period-summary?start_date={t1}&end_date={t2}")
    assert response.status_code == 200
    data = response.json()
    
    # Verification
    assert data["adjustments_value"] == 50.0 # Must be exactly 50, not 250!
