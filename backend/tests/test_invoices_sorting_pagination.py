import pytest
from app import models

def test_list_invoices_sorting(client, db):
    """Verify that sorting works for date, ref no, and total value."""
    # 1. Setup
    st = db.query(models.SupplierType).filter(models.SupplierType.name == "Wholesale").first()
    if not st:
        st = models.SupplierType(name="Wholesale")
        db.add(st)
        db.commit()
        db.refresh(st)
    type_id = st.id
    sup = client.post("/suppliers/", json={"supplier_name": "Sort Supplier", "type_id": type_id, "status_id": 1})
    sup_id = sup.json()["id"]
    
    # 2. Create 3 invoices with different dates, ref nos, and totals
    # (A) Newest, lowest value
    client.post("/invoices/", json={
        "supplier_id": sup_id, "invoice_date": "2024-06-10", "reference_number": "A100", "total_value": 100.0, "line_items": []
    })
    # (B) Middle date, highest value
    client.post("/invoices/", json={
        "supplier_id": sup_id, "invoice_date": "2024-06-05", "reference_number": "B200", "total_value": 500.0, "line_items": []
    })
    # (C) Oldest, middle value
    client.post("/invoices/", json={
        "supplier_id": sup_id, "invoice_date": "2024-06-01", "reference_number": "C300", "total_value": 250.0, "line_items": []
    })
    
    # 3. Test Sorting - Date DESC (Default)
    res = client.get("/invoices/?sort_by=invoice_date&sort_order=desc")
    items = res.json()["items"]
    assert items[0]["reference_number"] == "A100" # 2024-06-10
    assert items[2]["reference_number"] == "C300" # 2024-06-01
    
    # 4. Test Sorting - Date ASC
    res = client.get("/invoices/?sort_by=invoice_date&sort_order=asc")
    items = res.json()["items"]
    assert items[0]["reference_number"] == "C300"
    
    # 5. Test Sorting - Total Value DESC
    res = client.get("/invoices/?sort_by=total_value&sort_order=desc")
    items = res.json()["items"]
    assert items[0]["total_value"] == 500.0
    assert items[1]["total_value"] == 250.0
    assert items[2]["total_value"] == 100.0

def test_list_invoices_search_wildcard_fix(client, db):
    """Verify that searching for _1 correctly escapes the wildcard (only literal matching)."""
    # 1. Setup
    st = db.query(models.SupplierType).filter(models.SupplierType.name == "Wholesale").first()
    if not st:
        st = models.SupplierType(name="Wholesale")
        db.add(st)
        db.commit()
        db.refresh(st)
    type_id = st.id
    sup = client.post("/suppliers/", json={"supplier_name": "Search Supplier", "type_id": type_id, "status_id": 1})
    sup_id = sup.json()["id"]
    
    # (A) Contains literal _1
    client.post("/invoices/", json={
        "supplier_id": sup_id, "invoice_date": "2024-06-01", "reference_number": "INV_1-SPECIAL", "total_value": 100, "line_items": []
    })
    # (B) Contains 1 but not _1
    client.post("/invoices/", json={
        "supplier_id": sup_id, "invoice_date": "2024-06-01", "reference_number": "INV-2024-1", "total_value": 100, "line_items": []
    })
    # (C) Contains _ but not 1
    client.post("/invoices/", json={
        "supplier_id": sup_id, "invoice_date": "2024-06-01", "reference_number": "INV_TEST-REF", "total_value": 100, "line_items": []
    })
    
    # 2. Search for "_1"
    res = client.get("/invoices/?q=_1")
    assert res.status_code == 200
    data = res.json()
    
    # 3. Verify: only (A) should match if escaping works. 
    # If it was a wildcard, (B) would match (since ? matches any char, INV-2024-1 matches INV%1).
    # Wait, _ in SQL is ANY SINGLE character.
    assert data["total"] == 1
    assert data["items"][0]["reference_number"] == "INV_1-SPECIAL"
