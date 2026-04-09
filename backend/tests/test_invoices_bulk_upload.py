import pytest
import io
import pandas as pd
from app import models

def test_bulk_upload_success_csv(client, db):
    """Verify that a valid CSV file with multiple invoices can be imported successfully."""
    # 1. Setup - Seed SupplierType (Status is already seeded in conftest.py)
    # Check if Pharmacy type exists
    st = db.query(models.SupplierType).filter(models.SupplierType.name == "Pharmacy").first()
    if not st:
        st = models.SupplierType(name="Pharmacy")
        db.add(st)
        db.commit()
        db.refresh(st)
    type_id = st.id
    
    # 2. Create Supplier and Medicines
    client.post("/suppliers/", json={"supplier_name": "Test Pharma", "type_id": type_id, "status_id": 1})
    client.post("/medicines/", json={"product_name": "Para 500", "hsn_code": "HSN1"})
    client.post("/medicines/", json={"product_name": "Cough Syrup", "hsn_code": "HSN2"})
    
    # 3. Create CSV content
    # columns: invoice_date, reference_number, supplier_name, product_name, quantity, price, batch_no, gst
    data = [
        {"invoice_date": "2024-03-21", "reference_number": "BULK-01", "supplier_name": "Test Pharma", "product_name": "Para 500", "quantity": 10, "price": 100, "batch_no": "B1", "gst": 12},
        {"invoice_date": "2024-03-21", "reference_number": "BULK-01", "supplier_name": "Test Pharma", "product_name": "Cough Syrup", "quantity": 5, "price": 200, "batch_no": "B2", "gst": 12},
        {"invoice_date": "2024-03-22", "reference_number": "BULK-02", "supplier_name": "Test Pharma", "product_name": "Para 500", "quantity": 20, "price": 110, "batch_no": "B3", "gst": 12},
    ]
    df = pd.DataFrame(data)
    csv_stream = io.BytesIO()
    df.to_csv(csv_stream, index=False)
    csv_stream.seek(0)
    
    # 4. Upload
    res = client.post(
        "/invoices/upload",
        files={"file": ("upload.csv", csv_stream, "text/csv")}
    )
    
    # 5. Verify
    assert res.status_code == 200
    res_data = res.json()
    assert res_data["success_count"] == 2 # 2 unique reference numbers
    assert res_data["error_count"] == 0
    
    # Verify DB
    inv_count = db.query(models.Invoice).count()
    assert inv_count == 2
    
    # Verify Stock for Para 500 (10 + 20 = 30)
    med = db.query(models.Medicine).filter(models.Medicine.product_name == "Para 500").first()
    stock = db.query(models.MedicineStock).filter(models.MedicineStock.medicine_id == med.id).first()
    assert stock.quantity_on_hand == 30

def test_bulk_upload_partial_failure_reports_errors(client, db):
    """Verify that failed rows are collected and returned in the error CSV."""
    st = db.query(models.SupplierType).filter(models.SupplierType.name == "Pharmacy").first()
    if not st:
        st = models.SupplierType(name="Pharmacy")
        db.add(st)
        db.commit()
        db.refresh(st)
    type_id = st.id
    
    # Create one valid supplier and one valid medicine
    client.post("/suppliers/", json={"supplier_name": "Valid Pharma", "type_id": type_id, "status_id": 1})
    client.post("/medicines/", json={"product_name": "Valid Med", "hsn_code": "HSN1"})
    
    # CSV content with one valid invoice and one invalid (bad supplier name)
    data = [
        {"invoice_date": "2024-03-21", "reference_number": "VALID-01", "supplier_name": "Valid Pharma", "product_name": "Valid Med", "quantity": 10, "price": 100},
        {"invoice_date": "2024-03-21", "reference_number": "FAIL-01", "supplier_name": "Bad Pharma", "product_name": "Valid Med", "quantity": 10, "price": 100},
    ]
    df = pd.DataFrame(data)
    csv_stream = io.BytesIO()
    df.to_csv(csv_stream, index=False)
    csv_stream.seek(0)
    
    res = client.post(
        "/invoices/upload",
        files={"file": ("upload.csv", csv_stream, "text/csv")}
    )
    
    assert res.status_code == 200
    res_data = res.json()
    assert res_data["success_count"] == 1
    assert res_data["error_count"] == 1
    assert "error_csv_content" in res_data
    assert "Supplier 'Bad Pharma' not found" in res_data["error_csv_content"]

def test_download_template(client):
    """Verify that the template endpoint returns a CSV with the correct columns."""
    res = client.get("/invoices/template")
    assert res.status_code == 200
    assert res.headers["content-type"] == "text/csv; charset=utf-8"
    
    # Read CSV from response
    csv_content = res.content.decode('utf-8')
    df = pd.read_csv(io.StringIO(csv_content))
    
    expected_cols = ["invoice_date", "reference_number", "supplier_name", "product_name", "quantity", "price"]
    for col in expected_cols:
        assert col in df.columns
