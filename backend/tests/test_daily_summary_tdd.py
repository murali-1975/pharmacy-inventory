import pytest
from datetime import date
from app import models, schemas
from app.services.finance_service import FinanceService

def test_gst_calculation_rule(db):
    """
    TDD: Verifies that GST is calculated as exactly 5% of 'Pharmacy' or 'Medicine' services.
    Other services should NOT contribute to GST liability in the daily summary.
    """
    # 1. Setup Master Data
    srv_med = models.PatientService(service_name="Pharmacy", is_active=True)
    srv_con = models.PatientService(service_name="Consultation", is_active=True)
    mode = models.PaymentModeMaster(mode="Cash", is_active=True)
    db.add_all([srv_med, srv_con, mode])
    db.commit()

    # 2. Record a payment with mixed services
    payment_in = schemas.PatientPaymentCreate(
        patient_name="TDD Patient",
        payment_date=date.today(),
        total_amount=1500.0,
        gst_amount=0.0, # This is the legacy field, we are calculating liability separately now
        identifiers=[],
        services=[
            {"service_id": srv_med.id, "amount": 1000.0}, # GST should be 50.0
            {"service_id": srv_con.id, "amount": 500.0}   # GST should be 0.0
        ],
        payments=[{"payment_mode_id": mode.id, "value": 1500.0}]
    )
    
    # We use user_id=1 (Admin)
    FinanceService.record_payment(db, payment_in, user_id=1)
    db.commit()

    # 3. Trigger recalculation
    FinanceService.recalculate_daily_summary(db, date.today())
    
    # 4. Verify Summary Table
    summary = db.query(models.DailyFinanceSummary).filter(models.DailyFinanceSummary.summary_date == date.today()).first()
    assert summary is not None
    assert summary.total_gst == 50.0 # 5% of 1000
    assert summary.total_revenue == 1500.0
    assert summary.patient_count == 1
    assert summary.service_breakdown["Pharmacy"] == 1000.0
    assert summary.service_breakdown["Consultation"] == 500.0

def test_summary_update_on_deletion(db):
    """
    TDD: Verifies that deleting a payment record triggers a recalculation
    and correctly updates the daily summary totals.
    """
    # Setup
    srv = models.PatientService(service_name="Pharmacy", is_active=True)
    mode = models.PaymentModeMaster(mode="Cash", is_active=True)
    db.add_all([srv, mode])
    db.commit()

    # Record two payments
    p1_in = schemas.PatientPaymentCreate(
        patient_name="P1", payment_date=date.today(), total_amount=100.0,
        services=[{"service_id": srv.id, "amount": 100.0}],
        payments=[{"payment_mode_id": mode.id, "value": 100.0}]
    )
    p2_in = schemas.PatientPaymentCreate(
        patient_name="P2", payment_date=date.today(), total_amount=200.0,
        services=[{"service_id": srv.id, "amount": 200.0}],
        payments=[{"payment_mode_id": mode.id, "value": 200.0}]
    )
    
    FinanceService.record_payment(db, p1_in, user_id=1)
    p2 = FinanceService.record_payment(db, p2_in, user_id=1)
    db.commit()

    # Recalculate
    FinanceService.recalculate_daily_summary(db, date.today())
    summary_before = db.query(models.DailyFinanceSummary).filter(models.DailyFinanceSummary.summary_date == date.today()).first()
    assert summary_before.total_revenue == 300.0
    assert summary_before.patient_count == 2

    # Delete P2 (Simulate what the router would do)
    db.delete(p2)
    db.commit()
    
    # Recalculate
    FinanceService.recalculate_daily_summary(db, date.today())
    summary_after = db.query(models.DailyFinanceSummary).filter(models.DailyFinanceSummary.summary_date == date.today()).first()
    assert summary_after.total_revenue == 100.0
    assert summary_after.patient_count == 1

def test_summary_expense_aggregation(db):
    """
    TDD: Verifies that expenses are correctly aggregated into the daily summary.
    """
    from app.services.expense_service import ExpenseService
    
    # 1. Setup Master Data
    exp_type = models.ExpenseType(name="Utility", is_active=True)
    mode = models.PaymentModeMaster(mode="Bank Transfer", is_active=True)
    db.add_all([exp_type, mode])
    db.commit()

    # 2. Record an expense
    expense_in = schemas.ExpenseCreate(
        expense_date=date.today(),
        expense_type_id=exp_type.id,
        details="Electricity Bill",
        amount=1000.0,
        gst_amount=180.0,
        total_amount=1180.0,
        payments=[{"payment_mode_id": mode.id, "amount": 1180.0}]
    )
    
    ExpenseService.record_expense(db, expense_in, user_id=1)
    db.commit()

    # 3. Verify Summary
    summary = db.query(models.DailyFinanceSummary).filter(models.DailyFinanceSummary.summary_date == date.today()).first()
    assert summary is not None
    assert summary.total_expenses == 1180.0
    assert summary.total_expense_gst == 180.0
    assert summary.expense_breakdown["Utility"] == 1180.0

    # 4. Soft Delete Expense
    ExpenseService.soft_delete_expense(db, 1, user_id=1) # ID should be 1
    db.commit()

    # 5. Verify Summary Refreshed
    summary_after = db.query(models.DailyFinanceSummary).filter(models.DailyFinanceSummary.summary_date == date.today()).first()
    assert summary_after.total_expenses == 0.0
    assert summary_after.total_expense_gst == 0.0
    assert summary_after.expense_breakdown == {}
