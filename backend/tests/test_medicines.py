import pytest
from app import models

def test_manufacturer_crud(client, db):
    """Test full CRUD lifecycle for manufacturers."""
    # Create
    man_data = {"name": "Test Labs", "contact_email": "labs@test.com", "phone_number": "9999999999"}
    res = client.post("/manufacturers/", json=man_data)
    assert res.status_code == 200
    man_id = res.json()["id"]
    
    # Read (List)
    list_res = client.get("/manufacturers/")
    assert any(m["id"] == man_id for m in list_res.json())
    
    # Update (No explicit PUT but can add later, currently testing if List works)
    # Delete
    del_res = client.delete(f"/manufacturers/{man_id}")
    assert del_res.status_code == 200
    
    # Verify Deactivated (Soft delete check)
    check_res = client.get("/manufacturers/")
    assert all(m["id"] != man_id for m in check_res.json())

def test_medicine_crud(client, db):
    """Test full CRUD lifecycle for medicines."""
    # Setup Manufacturer
    man_res = client.post("/manufacturers/", json={"name": "Alkem"})
    man_id = man_res.json()["id"]
    
    # Create Medicine
    med_data = {
        "product_name": "Pan 40",
        "generic_name": "Pantoprazole",
        "manufacturer_id": man_id,
        "unit_price": 10.5,
        "selling_price_percent": 15.0,
        "category": "SCHEDULE_H"
    }
    res = client.post("/medicines/", json=med_data)
    assert res.status_code == 200
    med_id = res.json()["id"]
    
    # Verify MedicineStock was auto-created
    stock = db.query(models.MedicineStock).filter(models.MedicineStock.medicine_id == med_id).first()
    assert stock is not None
    assert stock.quantity_on_hand == 0
    
    # Read (List)
    list_res = client.get("/medicines/")
    assert any(m["product_name"] == "Pan 40" for m in list_res.json())
    
    # Soft Delete
    del_res = client.delete(f"/medicines/{med_id}")
    assert del_res.status_code == 200
    
    # Verify excluded from list
    check_res = client.get("/medicines/")
    assert all(m["id"] != med_id for m in check_res.json())
