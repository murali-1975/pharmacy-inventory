import pytest
from datetime import date, timedelta
from app import models, schemas
from app.services.finance_service import FinanceService
from app.services.expense_service import ExpenseService
from app.services.ledger_service import LedgerService

@pytest.fixture
def hardening_setup(db):
    # Fetch seeded Admin User
    admin = db.query(models.User).filter(models.User.username == "admin").first()
    
    # Ensure master data
    service = db.query(models.PatientService).first()
    if not service:
        service = models.PatientService(service_name="Medicine", is_active=True)
        db.add(service)
    
    mode = db.query(models.PaymentModeMaster).first()
    if not mode:
        mode = models.PaymentModeMaster(mode="Cash", is_active=True)
        db.add(mode)
    
    exp_type = db.query(models.ExpenseType).first()
    if not exp_type:
        exp_type = models.ExpenseType(name="General", is_active=True)
        db.add(exp_type)
    
    db.commit()
    return {"admin": admin, "service": service, "mode": mode, "exp_type": exp_type}

def test_summary_empty_state(db, hardening_setup):
    """Edge Case: Recalculating a day with 0 records should zero out the summary."""
    target_date = date.today() + timedelta(days=500) # Future date with no data
    
    summary = FinanceService.recalculate_daily_summary(db, target_date)
    assert summary.patient_count == 0
    assert summary.total_revenue == 0
    assert summary.total_expenses == 0
    assert summary.expense_breakdown == {}

def test_expense_update_recalculates_both_dates(db, hardening_setup):
    """Edge Case: Moving an expense to a new date should refresh both summaries."""
    admin = hardening_setup["admin"]
    exp_type = hardening_setup["exp_type"]
    mode = hardening_setup["mode"]
    
    date_a = date(2026, 5, 1)
    date_b = date(2026, 5, 2)
    
    # 1. Create on Date A
    exp = ExpenseService.record_expense(db, schemas.ExpenseCreate(
        expense_date=date_a,
        expense_type_id=exp_type.id,
        details="Initial Expense",
        amount=100.0,
        gst_amount=0.0,
        total_amount=100.0,
        payments=[{"payment_mode_id": mode.id, "amount": 100.0}]
    ), admin.id)
    db.commit()
    
    summary_a = db.query(models.DailyFinanceSummary).filter(models.DailyFinanceSummary.summary_date == date_a).first()
    assert summary_a.total_expenses == 100.0
    
    # 2. Move to Date B
    ExpenseService.update_expense(db, exp.id, schemas.ExpenseCreate(
        expense_date=date_b,
        expense_type_id=exp_type.id,
        details="Moved Expense",
        amount=100.0,
        gst_amount=0.0,
        total_amount=100.0,
        payments=[{"payment_mode_id": mode.id, "amount": 100.0}]
    ), admin.id)
    db.commit()
    
    # Date A should now be 0
    summary_a_new = db.query(models.DailyFinanceSummary).filter(models.DailyFinanceSummary.summary_date == date_a).first()
    assert summary_a_new.total_expenses == 0.0
    
    # Date B should now be 100
    summary_b = db.query(models.DailyFinanceSummary).filter(models.DailyFinanceSummary.summary_date == date_b).first()
    assert summary_b.total_expenses == 100.0

def test_ledger_opening_balance_no_previous_data(db, hardening_setup):
    """Edge Case: Ledger starting before any data exists."""
    earliest_date = date(2020, 1, 1)
    ledger = LedgerService.get_ledger_data(db, earliest_date, earliest_date)
    assert ledger.opening_balance == 0.0
    assert len(ledger.entries) == 0

def test_expense_soft_delete_recalculates(db, hardening_setup):
    """Edge Case: Soft deleting should remove from summary."""
    admin = hardening_setup["admin"]
    exp_type = hardening_setup["exp_type"]
    mode = hardening_setup["mode"]
    today = date.today()
    
    exp = ExpenseService.record_expense(db, schemas.ExpenseCreate(
        expense_date=today,
        expense_type_id=exp_type.id,
        details="Delete Me",
        amount=500.0,
        total_amount=500.0,
        payments=[{"payment_mode_id": mode.id, "amount": 500.0}]
    ), admin.id)
    db.commit()
    
    # Soft delete
    ExpenseService.soft_delete_expense(db, exp.id, admin.id)
    db.commit()
    
    summary = db.query(models.DailyFinanceSummary).filter(models.DailyFinanceSummary.summary_date == today).first()
    assert summary.total_expenses == 0.0
