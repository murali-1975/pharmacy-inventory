"""
Test suite for Stock Management API.

Follows Test-Driven Development (TDD) principles to validate:
1.  Auto-stock update when a pharmacy invoice is created.
2.  Stock accumulation across multiple invoices for the same medicine.
3.  Manual stock adjustment (Admin only).
4.  Negative-stock guard (reject adjustments that would go below zero).
5.  RBAC: Staff users cannot make manual adjustments.
6.  Audit log entries are correctly written for both auto and manual updates.
7.  GET endpoints return correct stock levels.

All tests are isolated with a fresh SQLite database per function via conftest.py.
"""
import pytest
from app import models


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _seed_supplier_and_medicine(client, db):
    """Seed the minimum required lookup data, supplier, and medicine for invoice tests."""
    # SupplierType(id=1) is not seeded by conftest, so we add it here.
    # Status(id=1) is already seeded by conftest.py's 'db' fixture.
    if not db.query(models.SupplierType).filter(models.SupplierType.id == 1).first():
        db.add(models.SupplierType(id=1, name="Wholesale"))
        db.commit()
    
    sup = client.post("/suppliers/", json={"supplier_name": "StockTest Supplier", "type_id": 1, "status_id": 1})
    assert sup.status_code == 200
    med = client.post("/medicines/", json={"product_name": "Paracetamol 500mg", "description": "Analgesic"})
    assert med.status_code == 200
    return sup.json()["id"], med.json()["id"]


def _create_invoice_with_medicine(client, supplier_id, medicine_id, qty, ref="STOCK-INV-001"):
    """Helper to create a pharmacy invoice with one medicine line item."""
    return client.post("/invoices/", json={
        "supplier_id": supplier_id,
        "invoice_date": "2024-06-01",
        "reference_number": ref,
        "total_value": qty * 10.0,
        "gst": 0.0,
        "line_items": [
            {
                "medicine_id": medicine_id,
                "quantity": qty,
                "price": 10.0,
                "discount": 0.0,
                "expiry_date": "2026-12-31",
                "mrp": 15.0,
                "gst": 5.0,
                "free_quantity": 0,
            }
        ],
    })


# ---------------------------------------------------------------------------
# 1. Auto-Stock Update on Invoice Creation
# ---------------------------------------------------------------------------

def test_stock_auto_created_on_invoice(client, db):
    """
    When a pharmacy invoice is created with a medicine line item,
    the stock for that medicine must be automatically created and incremented.
    """
    supplier_id, med_id = _seed_supplier_and_medicine(client, db)

    res = _create_invoice_with_medicine(client, supplier_id, med_id, qty=50)
    assert res.status_code == 200, f"Invoice creation failed: {res.json()}"

    # Check stock was auto-created
    stock_res = client.get(f"/stock/{med_id}")
    assert stock_res.status_code == 200, f"Stock not found: {stock_res.json()}"
    assert stock_res.json()["quantity_on_hand"] == 50


def test_stock_accumulates_across_multiple_invoices(client, db):
    """
    Receiving multiple invoices for the same medicine should accumulate stock
    correctly (additive, not replace).
    """
    supplier_id, med_id = _seed_supplier_and_medicine(client, db)

    _create_invoice_with_medicine(client, supplier_id, med_id, qty=30, ref="ACC-INV-001")
    _create_invoice_with_medicine(client, supplier_id, med_id, qty=20, ref="ACC-INV-002")

    stock_res = client.get(f"/stock/{med_id}")
    assert stock_res.status_code == 200
    assert stock_res.json()["quantity_on_hand"] == 50  # 30 + 20

def test_stock_includes_free_quantity(client, db):
    """
    The stock should be incremented by (purchased quantity + free quantity).
    """
    supplier_id, med_id = _seed_supplier_and_medicine(client, db)

    # 10 purchased + 2 free = 12 total
    client.post("/invoices/", json={
        "supplier_id": supplier_id,
        "invoice_date": "2024-06-01",
        "reference_number": "FREE-QTY-INV-001",
        "total_value": 100.0,
        "gst": 0.0,
        "line_items": [
            {
                "medicine_id": med_id,
                "quantity": 10,
                "free_quantity": 2,
                "price": 10.0,
                "discount": 0.0,
                "mrp": 15.0,
                "gst": 0.0
            }
        ],
    })

    stock_res = client.get(f"/stock/{med_id}")
    assert stock_res.status_code == 200
    assert stock_res.json()["quantity_on_hand"] == 12


def test_no_stock_record_for_non_medicine_line_items(client, db):
    """
    An invoice with only description-based (non-pharmacy) line items
    should NOT create any stock record.
    """
    if not db.query(models.SupplierType).filter(models.SupplierType.id == 3).first():
        db.add(models.SupplierType(id=3, name="General"))
    db.commit()
    sup = client.post("/suppliers/", json={"supplier_name": "Office Supply Co", "type_id": 3, "status_id": 1})
    client.post("/invoices/", json={
        "supplier_id": sup.json()["id"],
        "invoice_date": "2024-06-01",
        "reference_number": "NONMED-INV-001",
        "total_value": 500.0,
        "gst": 0.0,
        "line_items": [
            {
                "description": "A4 Paper Reams",
                "quantity": 10,
                "price": 50.0,
                "discount": 0.0,
                "mrp": 60.0,
                "gst": 12.0,
            }
        ],
    })
    all_stock = client.get("/stock/")
    assert all_stock.status_code == 200
    data = all_stock.json()
    assert data["total"] == 0
    assert len(data["items"]) == 0  # No stock records should exist


def test_auto_adjustment_audit_record_created(client, db):
    """
    Every auto-stock update from an invoice must create a StockAdjustment
    audit record with type INVOICE_RECEIPT.
    """
    supplier_id, med_id = _seed_supplier_and_medicine(client, db)
    _create_invoice_with_medicine(client, supplier_id, med_id, qty=25)

    history = client.get(f"/stock/{med_id}/adjustments")
    assert history.status_code == 200
    assert len(history.json()) == 1
    record = history.json()[0]
    assert record["quantity_change"] == 25
    assert record["adjustment_type"] == "INVOICE_RECEIPT"
    assert "STOCK-INV-001" in record["reason"]


# ---------------------------------------------------------------------------
# 2. GET Endpoints
# ---------------------------------------------------------------------------

def test_list_stock_returns_all_medicines(client, db):
    """GET /stock/ should return a list of all medicine stock records."""
    supplier_id, med_id = _seed_supplier_and_medicine(client, db)
    _create_invoice_with_medicine(client, supplier_id, med_id, qty=10)

    res = client.get("/stock/")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 1
    assert data["items"][0]["medicine_id"] == med_id


def test_get_stock_for_unknown_medicine_returns_404(client):
    """GET /stock/99999 for a non-existent medicine should return 404."""
    res = client.get("/stock/99999")
    assert res.status_code == 404


def test_get_stock_for_never_received_medicine_returns_zero(client, db):
    """
    A medicine that exists in the master but has never been received
    on any invoice should return its auto-healed MedicineStock with 0 quantity.
    """
    med_res = client.post("/medicines/", json={"product_name": "Orphan Med"})
    med_id = med_res.json()["id"]
    res = client.get(f"/stock/{med_id}")
    assert res.status_code == 200
    assert res.json()["quantity_on_hand"] == 0


# ---------------------------------------------------------------------------
# 3. Manual Stock Adjustment (Admin)
# ---------------------------------------------------------------------------

def test_admin_can_manually_increase_stock(client, db):
    """Admin POSTing to /stock/adjust with a positive quantity should increase stock."""
    supplier_id, med_id = _seed_supplier_and_medicine(client, db)
    _create_invoice_with_medicine(client, supplier_id, med_id, qty=10)

    adj_res = client.post("/stock/adjust", json={
        "medicine_id": med_id,
        "quantity_change": 5,
        "adjustment_type": "MANUAL_ADJUSTMENT",
        "reason": "Physical count correction - found extra units",
    })
    assert adj_res.status_code == 200
    assert adj_res.json()["quantity_change"] == 5

    stock_res = client.get(f"/stock/{med_id}")
    assert stock_res.json()["quantity_on_hand"] == 15  # 10 + 5


def test_admin_can_write_off_stock(client, db):
    """Admin POSTing a negative quantity_change should decrease stock (write-off)."""
    supplier_id, med_id = _seed_supplier_and_medicine(client, db)
    _create_invoice_with_medicine(client, supplier_id, med_id, qty=20)

    adj_res = client.post("/stock/adjust", json={
        "medicine_id": med_id,
        "quantity_change": -8,
        "adjustment_type": "WRITE_OFF",
        "reason": "Damaged units disposed",
    })
    assert adj_res.status_code == 200

    stock_res = client.get(f"/stock/{med_id}")
    assert stock_res.json()["quantity_on_hand"] == 12  # 20 - 8


def test_adjust_creates_audit_record(client, db):
    """A manual adjustment must always create a corresponding audit record."""
    supplier_id, med_id = _seed_supplier_and_medicine(client, db)
    _create_invoice_with_medicine(client, supplier_id, med_id, qty=10)

    client.post("/stock/adjust", json={
        "medicine_id": med_id,
        "quantity_change": 3,
        "adjustment_type": "MANUAL_ADJUSTMENT",
        "reason": "Found 3 extra units during shelf audit",
    })

    history = client.get(f"/stock/{med_id}/adjustments")
    assert history.status_code == 200
    # Should have 2: 1 from invoice, 1 from manual adjust
    assert len(history.json()) == 2
    manual = next(r for r in history.json() if r["adjustment_type"] == "MANUAL_ADJUSTMENT")
    assert manual["quantity_change"] == 3


def test_adjust_for_nonexistent_medicine_returns_404(client):
    """Adjusting stock for a non-existent medicine should return 404."""
    res = client.post("/stock/adjust", json={
        "medicine_id": 99999,
        "quantity_change": 10,
        "adjustment_type": "MANUAL_ADJUSTMENT",
        "reason": "Test",
    })
    assert res.status_code == 404


# ---------------------------------------------------------------------------
# 4. Negative Stock Guard
# ---------------------------------------------------------------------------

def test_cannot_write_off_more_than_available_stock(client, db):
    """
    An adjustment that would result in stock going below zero must be
    rejected with HTTP 400.
    """
    supplier_id, med_id = _seed_supplier_and_medicine(client, db)
    _create_invoice_with_medicine(client, supplier_id, med_id, qty=5)

    adj_res = client.post("/stock/adjust", json={
        "medicine_id": med_id,
        "quantity_change": -10,  # Would result in -5
        "adjustment_type": "WRITE_OFF",
        "reason": "Would make stock negative",
    })
    assert adj_res.status_code == 400
    assert "negative" in adj_res.json()["detail"].lower()


def test_stock_unchanged_after_rejected_adjustment(client, db):
    """
    After a rejected adjustment, the stock count must remain exactly as it was.
    """
    supplier_id, med_id = _seed_supplier_and_medicine(client, db)
    _create_invoice_with_medicine(client, supplier_id, med_id, qty=5)

    # This should fail
    client.post("/stock/adjust", json={
        "medicine_id": med_id,
        "quantity_change": -100,
        "adjustment_type": "WRITE_OFF",
        "reason": "Bad adjustment",
    })

    # Stock should be unchanged
    stock_res = client.get(f"/stock/{med_id}")
    assert stock_res.json()["quantity_on_hand"] == 5


# ---------------------------------------------------------------------------
# 5. Audit Log
# ---------------------------------------------------------------------------

def test_all_adjustments_audit_log(client, db):
    """GET /stock/adjustments should return all adjustments system-wide."""
    supplier_id, med_id = _seed_supplier_and_medicine(client, db)
    _create_invoice_with_medicine(client, supplier_id, med_id, qty=10)
    client.post("/stock/adjust", json={
        "medicine_id": med_id,
        "quantity_change": 2,
        "adjustment_type": "MANUAL_ADJUSTMENT",
        "reason": "Audit test",
    })

    all_adj = client.get("/stock/adjustments")
    assert all_adj.status_code == 200
    assert len(all_adj.json()) == 2  # 1 auto + 1 manual


# ---------------------------------------------------------------------------
# 6. Low Stock Filter
# ---------------------------------------------------------------------------

def test_low_stock_only_filter(client, db):
    """
    GET /stock/?low_stock_only=true should only return medicines
    where quantity_on_hand <= reorder_level.
    """
    supplier_id, med_id = _seed_supplier_and_medicine(client, db)
    _create_invoice_with_medicine(client, supplier_id, med_id, qty=5)

    # Set reorder_level above current stock to trigger low-stock flag
    from app import models as _models
    stock = db.query(_models.MedicineStock).filter(_models.MedicineStock.medicine_id == med_id).first()
    stock.reorder_level = 10  # quantity (5) <= reorder_level (10) → low stock
    db.commit()

    res = client.get("/stock/?low_stock_only=true")
    assert res.status_code == 200
    data = res.json()["items"]
    assert len(data) >= 1
    assert any(s["medicine_id"] == med_id for s in data)


# ---------------------------------------------------------------------------
# 7. Pagination and Sorting
# ---------------------------------------------------------------------------

def test_list_stock_pagination(client, db):
    """GET /stock/ should correctly support skip and limit."""
    supplier_id, med_id = _seed_supplier_and_medicine(client, db)
    
    # Create 5 stock records
    for i in range(5):
        m_res = client.post("/medicines/", json={"product_name": f"Paginated Med {i}"})
        m_id = m_res.json()["id"]
        _create_invoice_with_medicine(client, supplier_id, m_id, qty=10, ref=f"PAG-INV-{i}")

    # Test limit
    res = client.get("/stock/?limit=2")
    assert res.status_code == 200
    data = res.json()
    assert len(data["items"]) == 2
    # 1 medicine seeded in _seed_supplier_and_medicine + 5 seeded here = 6
    assert data["total"] == 6

    # Test skip
    res_skip = client.get("/stock/?skip=1&limit=2")
    assert len(res_skip.json()["items"]) == 2
    assert res_skip.json()["items"][0]["id"] != data["items"][0]["id"]


def test_list_stock_sorting_by_quantity(client, db):
    """GET /stock/ should sort by quantity_on_hand descending by default."""
    supplier_id, _ = _seed_supplier_and_medicine(client, db)
    
    # Create medicines with different quantities
    quantities = [10, 50, 20, 100, 30]
    for qty in quantities:
        m_res = client.post("/medicines/", json={"product_name": f"Sort Med {qty}"})
        m_id = m_res.json()["id"]
        _create_invoice_with_medicine(client, supplier_id, m_id, qty=qty, ref=f"SORT-INV-{qty}")

    res = client.get("/stock/")
    assert res.status_code == 200
    items = res.json()["items"]
    
    # Check that quantities are in descending order
    qtys = [s["quantity_on_hand"] for s in items if "Sort Med" in s["medicine"]["product_name"]]
    assert qtys == sorted(qtys, reverse=True)
    assert qtys[0] == 100
    assert qtys[-1] == 10


def test_stock_initialize_sets_opening_balance(client, db):
    """
    POST /stock/initialize should set the opening balance for a medicine
    and create an OPENING_BALANCE audit record.
    """
    med_res = client.post("/medicines/", json={"product_name": "Init Med"})
    assert med_res.status_code == 200
    med_id = med_res.json()["id"]

    init_res = client.post("/stock/initialize", json={
        "medicine_id": med_id,
        "quantity": 150,
        "initialized_date": "2024-01-01",
        "notes": "Go-live opening balance"
    })
    assert init_res.status_code == 200
    data = init_res.json()
    assert data["quantity_change"] == 150
    assert data["adjustment_type"] == "OPENING_BALANCE"

    # Verify live stock reflects the initialization
    stock_res = client.get(f"/stock/{med_id}")
    assert stock_res.status_code == 200
    assert stock_res.json()["quantity_on_hand"] == 150


def test_stock_initialize_conflict_without_force(client, db):
    """
    POST /stock/initialize on a medicine that already has an Opening Balance
    should return HTTP 409 Conflict unless force=true is passed.
    """
    med_res = client.post("/medicines/", json={"product_name": "Conflict Med"})
    med_id = med_res.json()["id"]

    # First initialization — should succeed
    client.post("/stock/initialize", json={
        "medicine_id": med_id,
        "quantity": 50,
        "initialized_date": "2024-01-01",
    })

    # Second initialization without force — should be rejected
    conflict_res = client.post("/stock/initialize", json={
        "medicine_id": med_id,
        "quantity": 75,
        "initialized_date": "2024-02-01",
    })
    assert conflict_res.status_code == 409
    assert "Opening Balance" in conflict_res.json()["detail"]


def test_dispensed_adjustment_in_history(client, db):
    """
    REGRESSION TEST: Verify that 'Dispensed' stock adjustments (created via dispensing)
    are correctly serialized in the adjustment history results.
    """
    supplier_id, med_id = _seed_supplier_and_medicine(client, db)
    
    # 1. Initialize stock to 100
    client.post("/stock/initialize", json={
        "medicine_id": med_id,
        "quantity": 100,
        "initialized_date": "2024-01-01",
    })
    
    # 2. Dispense 10 units
    dispense_res = client.post("/dispensing/", json={
        "dispensed_date": "2024-06-01",
        "patient_name": "Regression Patient",
        "medicine_id": med_id,
        "quantity": 10,
        "unit_price": 5.0,
        "gst_percent": 0.0,
    })
    assert dispense_res.status_code == 201
    
    # 3. Fetch history — this is where the serialization failure happened
    history_res = client.get(f"/stock/{med_id}/adjustments")
    assert history_res.status_code == 200
    
    history = history_res.json()
    assert len(history) == 2  # Opening Balance + Dispensed
    
    # Verify the 'DISPENSED' record exists and is correctly typed
    dispensed_record = next((r for r in history if r["adjustment_type"] == "DISPENSED"), None)
    assert dispensed_record is not None
    assert dispensed_record["quantity_change"] == -10
    assert "Dispensed to Regression Patient (Bulk/Single)" in dispensed_record["reason"]


# ---------------------------------------------------------------------------
# 8. RBAC / Staff Access (Stock Promotion)
# ---------------------------------------------------------------------------

def test_staff_can_view_stock_and_history(staff_client, db):
    """
    As part of the Stock Promotion feature, Staff users must be able to
    view the stock list and adjustment history for reconciliation.
    """
    # 1. Setup - use the admin 'client' or raw 'db' to create an initial state
    # Since 'staff_client' can't adjust, we'll manually seed the DB
    med = models.Medicine(product_name="Staff View Med")
    db.add(med)
    db.commit()
    db.refresh(med)
    
    stock = models.MedicineStock(medicine_id=med.id, quantity_on_hand=50)
    db.add(stock)
    db.commit()

    # 2. Verify Staff can see the stock list
    list_res = staff_client.get("/stock/")
    assert list_res.status_code == 200
    data = list_res.json()
    assert any(s["medicine_id"] == med.id for s in data["items"])

    # 3. Verify Staff can see the history
    history_res = staff_client.get(f"/stock/{med.id}/adjustments")
    assert history_res.status_code == 200


def test_staff_cannot_perform_manual_adjustments(staff_client, db):
    """
    Staff users must NOT be able to manually adjust stock or initialize it.
    These operations remain Admin-only.
    """
    med = models.Medicine(product_name="Protected Med")
    db.add(med)
    db.commit()
    db.refresh(med)

    # Attempt adjustment
    adj_res = staff_client.post("/stock/adjust", json={
        "medicine_id": med.id,
        "quantity_change": 10,
        "adjustment_type": "MANUAL_ADJUSTMENT",
        "reason": "Illegal stuff"
    })
    assert adj_res.status_code == 403  # Forbidden

    # Attempt initialization
    init_res = staff_client.post("/stock/initialize", json={
        "medicine_id": med.id,
        "quantity": 100,
        "initialized_date": "2024-01-01"
    })
    assert init_res.status_code == 403  # Forbidden

def test_list_stock_auto_heals_missing_records(client, db):
    """
    Medicines without a MedicineStock record should be auto-healed 
    (given a 0-quantity tracking record) and appear in the stock list.
    """
    # Create Medicine natively to bypass the medicine API logic
    med = models.Medicine(product_name="Naked Medicine", generic_name="Test Salt")
    db.add(med)
    db.commit()
    db.refresh(med)
    
    # Assert MedicineStock does NOT exist
    assert db.query(models.MedicineStock).filter(models.MedicineStock.medicine_id == med.id).first() is None
    
    # Trigger auto-heal by fetching the stock list
    res = client.get("/stock/")
    assert res.status_code == 200
    items = res.json()["items"]
    
    # Assert Medicine appears with zero stock
    healed_item = next((s for s in items if s["medicine_id"] == med.id), None)
    assert healed_item is not None
    assert healed_item["quantity_on_hand"] == 0
    
    # Assert the DB row was actually created and persisted
    persisted = db.query(models.MedicineStock).filter(models.MedicineStock.medicine_id == med.id).first()
    assert persisted is not None
    assert persisted.quantity_on_hand == 0
