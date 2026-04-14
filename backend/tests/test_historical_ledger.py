import pytest
import datetime
from app import models

@pytest.mark.unit
def test_historical_opening_balance(db, client):
    # 1. Create a medicine
    medicine = models.Medicine(
        product_name="Historical Test Med",
        generic_name="Test Salt",
        unit_price=100.0,
        category=models.MedicineCategory.GENERAL
    )
    db.add(medicine)
    db.commit()
    db.refresh(medicine)

    # 2. Initialize stock for a date in the past (e.g., 2026-01-01)
    init_date = datetime.date(2026, 1, 1)
    init_payload = {
        "medicine_id": medicine.id,
        "quantity": 500,
        "initialized_date": str(init_date),
        "notes": "Go-live opening balance"
    }
    
    # Correct route: /stock/initialize (no /api in TestClient unless prefixed in main.py)
    response = client.post(
        "/stock/initialize",
        json=init_payload
    )
    assert response.status_code == 200
    
    # 3. Query ledger for a range AFTER the initialization (e.g., 2026-02-01 to 2026-02-28)
    ledger_url = f"/stock/ledger?from_date=2026-02-01&to_date=2026-02-28&search=Historical"
    response = client.get(ledger_url)
    assert response.status_code == 200
    data = response.json()
    
    assert data["total"] >= 1
    target_item = next((item for item in data["items"] if item["medicine_id"] == medicine.id), None)
    assert target_item is not None
    
    # CRITICAL CHECK: Opening balance should be 500
    assert target_item["opening_balance"] == 500
    # Qty In should be 0 (since initialization is BEFORE the range)
    assert target_item["quantity_in"] == 0
    # In Hand should be 500
    assert target_item["stock_in_hand"] == 500

@pytest.mark.unit
def test_movement_and_opening_balance(db, client):
    # 1. Create another med
    medicine = models.Medicine(
        product_name="Movement Test Med",
        unit_price=50.0
    )
    db.add(medicine)
    db.commit()
    db.refresh(medicine)

    # 2. Init stock on 2026-01-01 with 100 units
    client.post("/stock/initialize", json={
        "medicine_id": medicine.id, "quantity": 100, "initialized_date": "2026-01-01"
    })

    # 3. Dispense 10 units on 2026-01-15
    # Correct route: /dispensing/
    client.post("/dispensing/", json={
        "medicine_id": medicine.id,
        "patient_name": "Test Patient",
        "quantity": 10,
        "unit_price": 60,
        "dispensed_date": "2026-01-15"
    })

    # 4. Check Ledger for February
    # Expected: Opening = 100 - 10 = 90
    ledger_url = f"/stock/ledger?from_date=2026-02-01&to_date=2026-02-28&search=Movement"
    response = client.get(ledger_url)
    assert response.status_code == 200
    data = response.json()
    target_item = next((item for item in data["items"] if item["medicine_id"] == medicine.id), None)
    
    assert target_item["opening_balance"] == 90
    assert target_item["stock_in_hand"] == 90
