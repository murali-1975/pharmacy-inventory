import pytest
import io
import pandas as pd
from datetime import date
from app import models

def test_bulk_upload_columnar_success(client, db):
    """
    Verifies that the columnar CSV upload correctly parses multiple 
    services and payment modes in a single row.
    """
    # 1. Setup Master Data
    ident = models.PatientIdentifier(id_name="UHID", is_active=True)
    srv1 = models.PatientService(service_name="Consultation", is_active=True)
    srv2 = models.PatientService(service_name="Pharmacy", is_active=True)
    mode1 = models.PaymentModeMaster(mode="Cash", is_active=True)
    mode2 = models.PaymentModeMaster(mode="UPI", is_active=True)
    db.add_all([ident, srv1, srv2, mode1, mode2])
    db.commit()

    # 2. Create Columnar CSV
    # Structure: Date, Patient Name, Token No, Identifier Type, ID Value, Consultation, Pharmacy, Cash, UPI, GST, Notes
    data = {
        "Date": [str(date.today()), str(date.today())],
        "Patient Name": ["Bulk Patient 1", "Bulk Patient 2"],
        "Token No": [101, 102],
        "Identifier Type": ["UHID", "UHID"],
        "ID Value": ["U1", "U2"],
        "Consultation": [500, 0],
        "Pharmacy": [1000, 2000],
        "Cash": [1500, 0],
        "UPI": [0, 2000],
        "GST": [75, 100],
        "Notes": ["N1", "N2"]
    }
    df = pd.DataFrame(data)
    stream = io.BytesIO()
    df.to_csv(stream, index=False)
    stream.seek(0)

    # 3. Upload
    files = {"file": ("bulk.csv", stream, "text/csv")}
    resp = client.post("/finance/payments/upload", files=files)
    
    assert resp.status_code == 200
    res_data = resp.json()
    if res_data["success_count"] != 2:
        print(f"DEBUG: Errors: {res_data['errors']}")
    assert res_data["success_count"] == 2
    assert res_data["error_count"] == 0

    # 4. Verify DB
    p1 = db.query(models.PatientPayment).filter(models.PatientPayment.patient_name == "Bulk Patient 1").first()
    assert p1 is not None
    assert p1.total_amount == 1500.0
    assert len(p1.services) == 2
    assert len(p1.payments) == 1
    assert p1.payments[0].value == 1500.0

def test_bulk_upload_columnar_balance_error(client, db):
    """
    Verifies that a row with mismatched service/payment totals fails.
    """
    # Setup
    srv = models.PatientService(service_name="Consultation", is_active=True)
    mode = models.PaymentModeMaster(mode="Cash", is_active=True)
    db.add_all([srv, mode])
    db.commit()

    data = {
        "Date": [str(date.today())],
        "Patient Name": ["Bad Balance"],
        "Consultation": [1000],
        "Cash": [500], # Mismatch
    }
    df = pd.DataFrame(data)
    stream = io.BytesIO()
    df.to_csv(stream, index=False)
    stream.seek(0)

    files = {"file": ("bulk_error.csv", stream, "text/csv")}
    resp = client.post("/finance/payments/upload", files=files)
    
    assert resp.status_code == 200
    res_data = resp.json()
    assert res_data["success_count"] == 0
    assert res_data["error_count"] == 1
    # Check if error CSV content is present
    assert res_data["error_csv_content"] is not None

def test_bulk_upload_automated_free_flag(client, db):
    """
    Verifies that a row with zero service amounts is automatically
    marked as a Free visit.
    """
    # 1. Setup
    srv = models.PatientService(service_name="Consultation", is_active=True)
    db.add(srv)
    db.commit()

    # 2. CSV with 0 amount for service
    data = {
        "Date": [str(date.today())],
        "Patient Name": ["Free Bulk Patient"],
        "Consultation": [0],
        "Notes": ["Charity Visit"]
    }
    df = pd.DataFrame(data)
    stream = io.BytesIO()
    df.to_csv(stream, index=False)
    stream.seek(0)

    # 3. Upload
    files = {"file": ("bulk_free.csv", stream, "text/csv")}
    resp = client.post("/finance/payments/upload", files=files)
    
    assert resp.status_code == 200
    res_data = resp.json()
    assert res_data["success_count"] == 1
    
    # 4. Verify DB
    p = db.query(models.PatientPayment).filter(models.PatientPayment.patient_name == "Free Bulk Patient").first()
    assert p is not None
    assert p.free_flag is True
    assert p.total_amount == 0.0
    assert len(p.services) == 0

def test_bulk_upload_date_parsing_dd_mm_yyyy(client, db):
    """
    TDD: Verifies that DD-MM-YYYY dates (Indian format) are parsed correctly.
    Specifically checks that 11-04-2026 is April 11th, not November 4th.
    """
    # Setup
    srv = models.PatientService(service_name="Consultation", is_active=True)
    mode = models.PaymentModeMaster(mode="Cash", is_active=True)
    db.add_all([srv, mode])
    db.commit()

    # CSV with DD-MM-YYYY
    data = {
        "Date": ["11-04-2026"], # April 11th
        "Patient Name": ["Date Test Patient"],
        "Consultation": [1000],
        "Cash": [1000]
    }
    df = pd.DataFrame(data)
    stream = io.BytesIO()
    df.to_csv(stream, index=False)
    stream.seek(0)

    # Upload
    files = {"file": ("date_test.csv", stream, "text/csv")}
    client.post("/finance/payments/upload", files=files)
    
    # Verify DB
    p = db.query(models.PatientPayment).filter(models.PatientPayment.patient_name == "Date Test Patient").first()
    assert p is not None
    # Check that month is 4 (April), not 11 (November)
    assert p.payment_date.month == 4
    assert p.payment_date.day == 11
