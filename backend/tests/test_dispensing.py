"""
Test suite for the Medicine Dispensing feature.

Tests follow TDD principles and cover:
  - recording a dispensing event (success)
  - automatic stock deduction when dispensing
  - StockAdjustment audit record creation (type=DISPENSED)
  - 404 when medicine not found
  - 400 when insufficient stock
  - listing and filtering dispensing records
  - retrieving a single record
  - admin cancellation with stock restoration
"""
import pytest
import datetime
from app import models


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _seed_medicine(db):
    """Create a test medicine and a stock record with 100 units."""
    med = models.Medicine(
        product_name="Test Paracetamol",
        generic_name="Paracetamol",
        category=models.MedicineCategory.GENERAL,
        uom="Tablet",
    )
    db.add(med)
    db.commit()
    db.refresh(med)

    stock = models.MedicineStock(medicine_id=med.id, quantity_on_hand=100, reorder_level=10)
    db.add(stock)
    
    batch = models.StockBatch(
        medicine_id=med.id,
        batch_no="TEST-BATCH-001",
        expiry_date=datetime.date.today() + datetime.timedelta(days=365),
        quantity_on_hand=100,
        purchase_price=10.0,
        mrp=20.0,
        received_at=datetime.datetime.now(datetime.timezone.utc)
    )
    db.add(batch)
    db.commit()
    db.refresh(med)
    db.refresh(stock)
    db.refresh(batch)

    return med, stock


def _dispense_payload(medicine_id, quantity=5):
    return {
        "dispensed_date": str(datetime.date.today()),
        "patient_name": "John Doe",
        "medicine_id": int(medicine_id),
        "quantity": int(quantity),
        "unit_price": 10.0,
        "gst_percent": 5.0,
    }


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestRecordDispensing:
    def test_record_dispensing_success(self, client, db):
        """Should create a dispensing record and return 201."""
        med, _ = _seed_medicine(db)
        payload = _dispense_payload(med.id)
        response = client.post("/dispensing/", json=payload)
        assert response.status_code == 201, str(response.json())
        data = response.json()
        assert data["patient_name"] == "John Doe"
        assert data["quantity"] == 5
        assert data["medicine_id"] == med.id

    def test_record_dispensing_computes_total(self, client, db):
        """Total amount = qty × unit_price. GST is inclusive now."""
        med, _ = _seed_medicine(db)
        # 10 units at ₹20 = ₹200 (inclusive)
        payload = {
            **_dispense_payload(med.id, quantity=10),
            "unit_price": 20.0,
            "gst_percent": 10.0,
        }
        response = client.post("/dispensing/", json=payload)
        assert response.status_code == 201
        assert response.json()["total_amount"] == 200

    def test_record_dispensing_total_rounding(self, client, db):
        """Total amount should be rounded to the nearest whole rupee."""
        med, _ = _seed_medicine(db)
        
        # Test Case 1: Round Up (10 * 10.55 = 105.5 -> 106)
        payload_up = {
            **_dispense_payload(med.id, quantity=10),
            "unit_price": 10.55,
        }
        res_up = client.post("/dispensing/", json=payload_up)
        assert res_up.status_code == 201
        assert res_up.json()["total_amount"] == 106

        # Test Case 2: Round Down (10 * 10.44 = 104.4 -> 104)
        payload_down = {
            **_dispense_payload(med.id, quantity=10),
            "unit_price": 10.44,
        }
        res_down = client.post("/dispensing/", json=payload_down)
        assert res_down.status_code == 201
        assert res_down.json()["total_amount"] == 104

    def test_get_medicine_price_rounding(self, client, db):
        """The /price/{id} endpoint should return a rounded unit price."""
        med, stock = _seed_medicine(db)
        
        # Seed a batch with MRP that results in decimal price
        # Price = MRP - (MRP * SP%)
        # Set SP% to 10%
        med.selling_price_percent = 10.0
        db.commit()
        
        # MRP = 105.5 -> Price = 105.5 - 10.55 = 94.95 -> 95
        batch = db.query(models.StockBatch).filter(models.StockBatch.medicine_id == med.id).first()
        batch.mrp = 105.5
        db.commit()
        
        res = client.get(f"/dispensing/price/{med.id}")
        assert res.status_code == 200
        assert res.json()["unit_price"] == 95

        # MRP = 105.4 -> Price = 105.4 - 10.54 = 94.86 -> 95 (Actually let's find one that rounds down)
        # MRP = 10.4, SP% = 0 -> Price = 10.4 -> 10
        med.selling_price_percent = 0.0
        batch.mrp = 10.4
        db.commit()
        
        res2 = client.get(f"/dispensing/price/{med.id}")
        assert res2.json()["unit_price"] == 10

    def test_record_dispensing_deducts_stock(self, client, db):
        """Dispensing should reduce MedicineStock.quantity_on_hand."""
        med, stock = _seed_medicine(db)
        initial_qty = stock.quantity_on_hand

        client.post("/dispensing/", json=_dispense_payload(med.id, quantity=7))

        db.refresh(stock)
        assert stock.quantity_on_hand == initial_qty - 7

    def test_record_dispensing_creates_audit_record(self, client, db):
        """A DISPENSED StockAdjustment should be created on each dispensing."""
        med, _ = _seed_medicine(db)
        client.post("/dispensing/", json=_dispense_payload(med.id, quantity=3))

        adjustment = (
            db.query(models.StockAdjustment)
            .filter(
                models.StockAdjustment.medicine_id == med.id,
                models.StockAdjustment.adjustment_type == models.StockAdjustmentType.DISPENSED,
            )
            .first()
        )
        assert adjustment is not None
        assert adjustment.quantity_change == -3  # negative = stock out

    def test_record_dispensing_unknown_medicine(self, client, db):
        """Should return 404 for a medicine that doesn't exist."""
        payload = _dispense_payload(medicine_id=99999)
        response = client.post("/dispensing/", json=payload)
        assert response.status_code == 404

    def test_record_dispensing_insufficient_stock(self, client, db):
        """Should return 400 if requested quantity > stock on hand."""
        med, stock = _seed_medicine(db)
        # Deplete stock to 5
        stock.quantity_on_hand = 5
        db.commit()

        payload = _dispense_payload(med.id, quantity=10)  # request 10, only 5 available
        response = client.post("/dispensing/", json=payload)
        assert response.status_code == 400
        assert "Insufficient stock" in response.json()["detail"]

    def test_record_dispensing_insufficient_stock_does_not_deduct(self, client, db):
        """Stock must NOT change if the insufficient-stock guard fires."""
        med, stock = _seed_medicine(db)
        stock.quantity_on_hand = 3
        db.commit()

        client.post("/dispensing/", json=_dispense_payload(med.id, quantity=10))
        db.refresh(stock)
        assert stock.quantity_on_hand == 3  # unchanged

    def test_record_dispensing_invalid_quantity(self, client, db):
        """Quantity must be >= 1 (schema validation)."""
        med, _ = _seed_medicine(db)
        payload = {**_dispense_payload(med.id), "quantity": 0}
        response = client.post("/dispensing/", json=payload)
        assert response.status_code == 422  # Pydantic validation error


class TestListDispensing:
    def test_list_dispensing_empty(self, client, db):
        """Empty list returns 200 and total=0."""
        response = client.get("/dispensing/")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0
        assert data["items"] == []

    def test_list_dispensing_returns_records(self, client, db):
        """Should return created records."""
        med, _ = _seed_medicine(db)
        client.post("/dispensing/", json=_dispense_payload(med.id))
        client.post("/dispensing/", json={**_dispense_payload(med.id), "patient_name": "Jane"})

        response = client.get("/dispensing/")
        assert response.status_code == 200
        assert response.json()["total"] == 2

    def test_list_dispensing_filter_by_medicine(self, client, db):
        """Filter by medicine_id should work."""
        med, _ = _seed_medicine(db)
        client.post("/dispensing/", json=_dispense_payload(med.id))

        response = client.get(f"/dispensing/?medicine_id={med.id}")
        assert response.status_code == 200
        items = response.json()["items"]
        assert all(i["medicine_id"] == med.id for i in items)

    def test_list_dispensing_filter_by_patient(self, client, db):
        """Partial match patient_name filter should work."""
        med, _ = _seed_medicine(db)
        client.post("/dispensing/", json={**_dispense_payload(med.id), "patient_name": "Alice Smith"})
        client.post("/dispensing/", json={**_dispense_payload(med.id), "patient_name": "Bob Jones"})

        response = client.get("/dispensing/?patient_name=alice")
        assert response.status_code == 200
        assert response.json()["total"] == 1
        assert "Alice" in response.json()["items"][0]["patient_name"]

    def test_list_dispensing_pagination(self, client, db):
        """Should correctly offset records using 'skip' and 'limit'."""
        med, _ = _seed_medicine(db)
        # Create 25 records
        for i in range(25):
            client.post("/dispensing/", json={
                **_dispense_payload(med.id), 
                "patient_name": f"Patient {i:02d}",
                "quantity": 1
            })

        # Page 1: first 20 (default limit)
        res1 = client.get("/dispensing/?skip=0&limit=20")
        assert len(res1.json()["items"]) == 20
        assert res1.json()["total"] == 25

        # Page 2: remaining 5
        res2 = client.get("/dispensing/?skip=20&limit=20")
        assert len(res2.json()["items"]) == 5
        assert res2.json()["total"] == 25

    def test_list_dispensing_limit_validation(self, client, db):
        """Should reject limit > 200."""
        response = client.get("/dispensing/?limit=201")
        assert response.status_code == 422


class TestGetDispensing:
    def test_get_single_dispensing(self, client, db):
        """Should return the correct single record by ID."""
        med, _ = _seed_medicine(db)
        create_resp = client.post("/dispensing/", json=_dispense_payload(med.id))
        dispensing_id = create_resp.json()["id"]

        response = client.get(f"/dispensing/{dispensing_id}")
        assert response.status_code == 200
        assert response.json()["id"] == dispensing_id

    def test_get_dispensing_not_found(self, client, db):
        """Should return 404 for a non-existent record."""
        response = client.get("/dispensing/99999")
        assert response.status_code == 404


class TestCancelDispensing:
    def test_cancel_restores_stock(self, client, db):
        """Admin DELETE should restore deducted stock to both total and batch levels."""
        med, stock = _seed_medicine(db)
        batch = db.query(models.StockBatch).filter(models.StockBatch.medicine_id == med.id).first()
        
        initial_total = stock.quantity_on_hand
        initial_batch = batch.quantity_on_hand

        create_resp = client.post("/dispensing/", json=_dispense_payload(med.id, quantity=5))
        dispensing_id = create_resp.json()["id"]
        
        db.refresh(stock)
        db.refresh(batch)
        assert stock.quantity_on_hand == initial_total - 5
        assert batch.quantity_on_hand == initial_batch - 5

        client.delete(f"/dispensing/{dispensing_id}")
        
        db.refresh(stock)
        db.refresh(batch)
        assert stock.quantity_on_hand == initial_total  # total restored
        assert batch.quantity_on_hand == initial_batch  # batch restored

    def test_cancel_removes_record(self, client, db):
        """Deleted dispensing record should not be retrievable."""
        med, _ = _seed_medicine(db)
        create_resp = client.post("/dispensing/", json=_dispense_payload(med.id))
        dispensing_id = create_resp.json()["id"]

        client.delete(f"/dispensing/{dispensing_id}")
        response = client.get(f"/dispensing/{dispensing_id}")
        assert response.status_code == 404

    def test_cancel_not_found(self, client, db):
        """Should return 404 when cancelling a non-existent record."""
        response = client.delete("/dispensing/99999")
        assert response.status_code == 404
