import pytest
from datetime import date, datetime, timezone
from fastapi import status
from app import models

def test_financials_rbac_enforcement(staff_client):
    """Ensure non-admin users cannot access financial data."""
    endpoints = [
        "/financials/valuation",
        "/financials/aging",
        "/financials/gst",
        "/financials/profit",
        "/financials/ledger",
        "/financials/period-summary"
    ]
    for ep in endpoints:
        response = staff_client.get(ep)
        assert response.status_code == status.HTTP_403_FORBIDDEN

def test_inventory_valuation(client, db):
    # Setup test data
    med1 = models.Medicine(product_name="ValMed1", unit_price=10.0)
    db.add(med1)
    db.flush()

    batch1 = models.StockBatch(
        medicine_id=med1.id, batch_no="B1", quantity_on_hand=100, 
        purchase_price=8.0, mrp=15.0, expiry_date=date(2030,1,1),
        received_at=datetime.now(timezone.utc)
    )
    batch2 = models.StockBatch(
        medicine_id=med1.id, batch_no="B2", quantity_on_hand=50, 
        purchase_price=9.0, mrp=20.0, expiry_date=date(2030,1,1),
        received_at=datetime.now(timezone.utc)
    )
    db.add_all([batch1, batch2])
    db.commit()

    response = client.get("/financials/valuation")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    
    # Cost: (100 * 8.0) + (50 * 9.0) = 800 + 450 = 1250
    # MRP: (100 * 15.0) + (50 * 20.0) = 1500 + 1000 = 2500
    assert data["total_cost_value"] == 1250.0
    assert data["total_mrp_value"] == 2500.0
    assert data["medicine_count"] == 1
    assert data["batch_count"] == 2

def test_supplier_aging(client, db):
    suptype = models.SupplierType(name="Generic")
    db.add(suptype)
    db.flush()

    sup1 = models.Supplier(supplier_name="AgingSupplier", type_id=suptype.id)
    db.add(sup1)
    db.flush()

    # Invoice 1: 5000 Total, 2000 Paid
    inv1 = models.Invoice(supplier_id=sup1.id, invoice_date=date.today(), reference_number="INV-A1", total_value=5000)
    db.add(inv1)
    db.flush()
    db.add(models.InvoicePayment(invoice_id=inv1.id, payment_mode=models.PaymentMode.Cash, payment_date=date.today(), paid_amount=2000))

    # Invoice 2: 3000 Total, 3000 Paid (Cleared)
    inv2 = models.Invoice(supplier_id=sup1.id, invoice_date=date.today(), reference_number="INV-A2", total_value=3000)
    db.add(inv2)
    db.flush()
    db.add(models.InvoicePayment(invoice_id=inv2.id, payment_mode=models.PaymentMode.Cash, payment_date=date.today(), paid_amount=3000))

    db.commit()

    response = client.get("/financials/aging")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    
    # Total Invoiced = 8000. Total Paid = 5000. Balance Due = 3000.
    sup_data = next((item for item in data if item["supplier_id"] == sup1.id), None)
    assert sup_data is not None
    assert sup_data["total_invoiced"] == 8000.0
    assert sup_data["total_paid"] == 5000.0
    assert sup_data["balance_due"] == 3000.0

def test_gst_reconciliation(client, db):
    start = date.today().replace(day=1)
    end = date.today()

    sup1 = models.Supplier(supplier_name="GSTSupplier")
    db.add(sup1)
    db.flush()

    inv = models.Invoice(supplier_id=sup1.id, invoice_date=start, reference_number="INV-GST", total_value=110)
    db.add(inv)
    db.flush()
    
    # Input GST = 10.0
    db.add(models.InvoiceLineItem(invoice_id=inv.id, quantity=1, price=100.0, gst=10.0))

    med = models.Medicine(product_name="GSTMed")
    db.add(med)
    db.flush()

    # Output GST = 5.0 (Qty 1 * 100 * 5%)
    disp = models.Dispensing(
        dispensed_date=start, patient_name="John Doe", medicine_id=med.id, 
        quantity=1, unit_price=100.0, gst_percent=5.0, total_amount=105.0, recorded_by_user_id=1
    )
    db.add(disp)
    db.commit()

    response = client.get(f"/financials/gst?start_date={start.isoformat()}&end_date={end.isoformat()}")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()

    assert data["input_gst"] == 10.0
    assert data["output_gst"] == 5.0
    assert data["net_gst_liability"] == -5.0 # (Output - Input)

def test_profit_summary(client, db):
    start = date.today().replace(day=1)
    end = date.today()

    med = models.Medicine(product_name="ProfitMed")
    db.add(med)
    db.flush()

    batch = models.StockBatch(
        medicine_id=med.id, batch_no="P1", quantity_on_hand=100, 
        purchase_price=50.0, expiry_date=date(2030,1,1),
        received_at=datetime.now(timezone.utc)
    )
    db.add(batch)
    db.flush()

    # Dispensed 2 units @ 100/ea -> Revenue 200. COGS = 2 * 50 = 100. Profit = 100.
    disp = models.Dispensing(
        dispensed_date=start, patient_name="Jane Doe", medicine_id=med.id, 
        quantity=2, unit_price=100.0, total_amount=200.0, recorded_by_user_id=1
    )
    db.add(disp)
    db.flush()

    # Add the stock adjustment linked to the dispensing
    adj = models.StockAdjustment(
        medicine_id=med.id, batch_id=batch.id, quantity_change=-2, 
        adjustment_type=models.StockAdjustmentType.DISPENSED, reason="test", 
        dispensing_id=disp.id, adjusted_by_user_id=1
    )
    db.add(adj)
    db.commit()

    response = client.get(f"/financials/profit?start_date={start.isoformat()}&end_date={end.isoformat()}")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()

    assert len(data) >= 1
    med_data = next((item for item in data if item["medicine_id"] == med.id), None)
    assert med_data is not None
    assert med_data["revenue"] == 200.0
    assert med_data["cost_of_goods_sold"] == 100.0
    assert med_data["gross_profit"] == 100.0
    assert med_data["margin_percent"] == 50.0
