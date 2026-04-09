import pytest
from fastapi import status
from app import models
import datetime

def test_list_stock_all(client, db):
    # Ensure at least one stock record exists
    med = models.Medicine(product_name="Med1", generic_name="G1", uom="Strip")
    db.add(med)
    db.flush()
    stock = models.MedicineStock(medicine_id=med.id, quantity_on_hand=100)
    db.add(stock)
    db.commit()

    response = client.get("/stock/")
    assert response.status_code == status.HTTP_200_OK
    assert len(response.json()) >= 1

def test_list_stock_low_only(client, db):
    # Med with high stock
    med1 = models.Medicine(product_name="High", generic_name="G1", uom="Strip")
    db.add(med1)
    db.flush()
    db.add(models.MedicineStock(medicine_id=med1.id, quantity_on_hand=100, reorder_level=10))
    
    # Med with low stock
    med2 = models.Medicine(product_name="Low", generic_name="G2", uom="Strip")
    db.add(med2)
    db.flush()
    db.add(models.MedicineStock(medicine_id=med2.id, quantity_on_hand=5, reorder_level=10))
    
    db.commit()

    response = client.get("/stock/?low_stock_only=true")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    items = data.get("items", data) # Fallback if not paginated somehow, but should be paginated
    assert all(item["quantity_on_hand"] <= item["reorder_level"] for item in items)
    assert any(item["medicine_id"] == med2.id for item in items)

def test_manual_stock_adjust_success(client, db):
    med = models.Medicine(product_name="AdjustMe", generic_name="G1", uom="Strip")
    db.add(med)
    db.commit()

    adjustment_data = {
        "medicine_id": med.id,
        "quantity_change": 50,
        "adjustment_type": "MANUAL_ADJUSTMENT",
        "reason": "Initial manual count"
    }
    response = client.post("/stock/adjust", json=adjustment_data)
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["quantity_change"] == 50

    # Verify history
    hist_response = client.get(f"/stock/{med.id}/adjustments")
    assert len(hist_response.json()) == 1
    assert hist_response.json()[0]["reason"] == "Initial manual count"

def test_manual_stock_adjust_negative_guard(client, db):
    med = models.Medicine(product_name="NoNegative", generic_name="G1", uom="Strip")
    db.add(med)
    db.flush()
    db.add(models.MedicineStock(medicine_id=med.id, quantity_on_hand=10))
    db.commit()

    adjustment_data = {
        "medicine_id": med.id,
        "quantity_change": -20,
        "adjustment_type": "WRITE_OFF",
        "reason": "Trying to go negative"
    }
    response = client.post("/stock/adjust", json=adjustment_data)
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "cannot go below zero" in response.json()["detail"].lower()

def test_initialize_stock_force_logic(client, db):
    med = models.Medicine(product_name="InitMe", generic_name="G1", uom="Strip")
    db.add(med)
    db.commit()

    init_data = {
        "medicine_id": med.id,
        "quantity": 100,
        "initialized_date": str(datetime.date.today()),
        "notes": "First initialization"
    }
    # First init
    response = client.post("/stock/initialize", json=init_data)
    assert response.status_code == status.HTTP_200_OK

    # Second init without force (should conflict)
    response = client.post("/stock/initialize", json=init_data)
    assert response.status_code == status.HTTP_409_CONFLICT

    # Second init with force
    init_data["quantity"] = 200
    response = client.post("/stock/initialize?force=true", json=init_data)
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["quantity_change"] == 200
