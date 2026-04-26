import pytest
import io
import pandas as pd
from fastapi import status
from datetime import date
from app import models

def test_generate_expense_template(client, db):
    # Setup: Ensure some categories and modes exist
    db.add(models.ExpenseType(name="Test Category", is_active=True))
    db.add(models.PaymentModeMaster(mode="GPay", is_active=True))
    db.commit()

    response = client.get("/finance/expenses/template")
    assert response.status_code == status.HTTP_200_OK
    assert "text/csv" in response.headers["Content-Type"]
    
    content = response.content.decode()
    df = pd.read_csv(io.StringIO(content))
    assert "Date" in df.columns
    assert "Category" in df.columns
    assert "GPay" in df.columns
    assert "Test Category" in df["Category"].values

def test_bulk_upload_expenses_success(client, db):
    # Setup
    cat = models.ExpenseType(name="Maintenance", is_active=True)
    mode1 = models.PaymentModeMaster(mode="Cash", is_active=True)
    mode2 = models.PaymentModeMaster(mode="UPI", is_active=True)
    db.add_all([cat, mode1, mode2])
    db.commit()

    # Create CSV data
    data = [
        {
            "Date": date.today().isoformat(),
            "Category": "Maintenance",
            "Details": "Cleaning Service",
            "Reference": "REF001",
            "Base Amount": 1000,
            "GST Amount": 180,
            "Total Amount": 1180,
            "Cash": 1180,
            "UPI": 0
        },
        {
            "Date": date.today().isoformat(),
            "Category": "maintenance", # Case insensitivity test
            "Details": "Plumbing",
            "Reference": "REF002",
            "Base Amount": 2000,
            "GST Amount": 0,
            "Total Amount": 2000,
            "Cash": 1000,
            "UPI": 1000 # Split payment test
        }
    ]
    df = pd.DataFrame(data)
    csv_stream = io.StringIO()
    df.to_csv(csv_stream, index=False)
    csv_content = csv_stream.getvalue().encode()

    response = client.post(
        "/finance/expenses/upload",
        files={"file": ("test.csv", csv_content, "text/csv")}
    )

    assert response.status_code == status.HTTP_200_OK
    res_data = response.json()
    assert res_data["success_count"] == 2
    assert res_data["error_count"] == 0

    # Verify DB records
    expenses = db.query(models.Expense).all()
    assert len(expenses) == 2
    assert expenses[1].total_amount == 2000
    assert len(expenses[1].payments) == 2

def test_bulk_upload_expenses_reconciliation_fail(client, db):
    # Setup
    db.add(models.ExpenseType(name="Utility", is_active=True))
    db.add(models.PaymentModeMaster(mode="Cash", is_active=True))
    db.commit()

    # Total Amount (1000) != Cash (500)
    data = [{
        "Date": date.today().isoformat(),
        "Category": "Utility",
        "Details": "Water Bill",
        "Base Amount": 1000,
        "Total Amount": 1000,
        "Cash": 500
    }]
    df = pd.DataFrame(data)
    csv_stream = io.StringIO()
    df.to_csv(csv_stream, index=False)

    response = client.post(
        "/finance/expenses/upload",
        files={"file": ("test.csv", csv_stream.getvalue().encode(), "text/csv")}
    )

    assert response.status_code == status.HTTP_200_OK
    res_data = response.json()
    assert res_data["success_count"] == 0
    assert res_data["error_count"] == 1
    assert "Reconciliation Error" in res_data["error_csv_content"]

def test_bulk_upload_unknown_category(client, db):
    # Row with category that doesn't exist
    data = [{
        "Date": date.today().isoformat(),
        "Category": "NonExistent",
        "Details": "Ghost Expense",
        "Base Amount": 100,
        "Total Amount": 100,
        "Cash": 100
    }]
    df = pd.DataFrame(data)
    csv_stream = io.StringIO()
    df.to_csv(csv_stream, index=False)

    response = client.post(
        "/finance/expenses/upload",
        files={"file": ("test.csv", csv_stream.getvalue().encode(), "text/csv")}
    )

    res_data = response.json()
    assert res_data["error_count"] == 1
    assert "Unknown expense category" in res_data["error_csv_content"]
