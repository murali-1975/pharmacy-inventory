import pytest
from datetime import date, timedelta
from app import models, schemas
from app.services.ledger_service import LedgerService
from app.services.finance_service import FinanceService

def test_ledger_aggregation_logic(db):
    # Fetch seeded Admin User
    admin_user = db.query(models.User).filter(models.User.username == "admin").first()

    # 1. Setup Master Data
    service = db.query(models.PatientService).first()
    if not service:
        service = models.PatientService(service_name="Pharmacy", is_active=True)
        db.add(service)
        db.flush()
        
    expense_type = db.query(models.ExpenseType).first()
    if not expense_type:
        expense_type = models.ExpenseType(name="Rent", is_active=True)
        db.add(expense_type)
        db.flush()
        
    mode = db.query(models.PaymentModeMaster).first()
    if not mode:
        mode = models.PaymentModeMaster(mode="Cash", is_active=True)
        db.add(mode)
        db.flush()
    
    db.commit()

    # 2. Create Historical Data (Opening Balance)
    past_date = date.today() - timedelta(days=10)
    FinanceService.record_payment(db, schemas.PatientPaymentCreate(
        patient_name="Old Patient",
        payment_date=past_date,
        total_amount=1000.0,
        services=[{"service_id": service.id, "amount": 1000.0}],
        payments=[{"payment_mode_id": mode.id, "value": 1000.0}]
    ), admin_user.id)

    # 3. Create Current Period Data
    today = date.today()
    # Credit Row
    FinanceService.record_payment(db, schemas.PatientPaymentCreate(
        patient_name="Today Patient",
        payment_date=today,
        total_amount=500.0,
        gst_amount=25.0,
        services=[{"service_id": service.id, "amount": 500.0}],
        payments=[{"payment_mode_id": mode.id, "value": 500.0}]
    ), admin_user.id)

    # Debit Row
    db_expense = models.Expense(
        expense_date=today,
        expense_type_id=expense_type.id,
        details="Rent Payment",
        amount=200.0,
        gst_amount=36.0,
        total_amount=236.0,
        created_by=admin_user.id,
        modified_by=admin_user.id
    )
    db.add(db_expense)
    db.commit()

    # 4. Fetch Ledger
    ledger = LedgerService.get_ledger_data(db, today, today)

    # 5. Assertions
    assert ledger.opening_balance == 1000.0
    # entries: [Pharmacy Credit Row, Rent Debit Row]
    assert len(ledger.entries) == 2 
    
    credit_entry = next(e for e in ledger.entries if e.credit > 0)
    debit_entry = next(e for e in ledger.entries if e.debit > 0)

    assert credit_entry.credit == 500.0
    assert credit_entry.credit_gst == 25.0 # 5% of 500
    assert debit_entry.debit == 236.0
    
    # Running balance: 1000 + 500 - 236 = 1264
    assert ledger.closing_balance == 1264.0

def test_ledger_admin_access(client):
    # Admin (client fixture) should access
    res = client.get("/financials/ledger?from_date=2024-01-01&to_date=2024-12-31")
    assert res.status_code == 200

def test_ledger_staff_access(staff_client):
    # Staff (staff_client fixture) should be forbidden
    res = staff_client.get("/financials/ledger?from_date=2024-01-01&to_date=2024-12-31")
    assert res.status_code == 403
