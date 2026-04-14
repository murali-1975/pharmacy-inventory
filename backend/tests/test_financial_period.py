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
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    print("\nDEBUG Period Summary Data:", data)

    # Validations
    # Opening: 100 * 10 = 1000
    assert data["opening_valuation"] == 1000.0
    
    # Added: 50 * 12 = 600
    assert data["inventory_added"] == 600.0
    
    # Revenue: 250
    assert data["revenue"] == 250.0
    
    # COGS: 10 * 10 = 100
    assert data["cost_of_goods_sold"] == 100.0
    
    # Net Adjustments: None in this period
    assert data["net_adjustments"] == 0.0

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
    assert data["inventory_added"] == 0.0
    assert data["net_adjustments"] == 250.0 # 10 * 25
    assert data["cost_of_goods_sold"] == 75.0 # 3 * 25
    assert data["closing_valuation"] == 175.0 # 0 + 0 - 75 + 250
    assert data["revenue"] == 150.0
    assert data["gross_profit"] == 75.0
