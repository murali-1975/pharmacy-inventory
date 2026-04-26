import pytest
from datetime import date
from sqlalchemy.orm import Session
from app import models, schemas, auth
from app.services.expense_service import ExpenseService
from app.core.config import settings

def test_record_expense_from_invoice_payment_logic(db: Session):
    """
    Test the logic for creating an expense from an invoice payment.
    This test bypasses the API and tests the ExpenseService method directly.
    """
    # 1. Setup User
    admin_user = models.User(
        username="admin_test",
        email="admin@test.com",
        hashed_password=auth.get_password_hash("test"),
        role="Admin"
    )
    db.add(admin_user)
    db.flush()

    # 2. Setup Master Data (Wholesale is pre-seeded by conftest)
    supplier_type = db.query(models.SupplierType).filter(models.SupplierType.name == "Wholesale").first()
    if not supplier_type:
        supplier_type = models.SupplierType(name="Wholesale")
        db.add(supplier_type)
        db.flush()
    
    supplier = models.Supplier(
        supplier_name="Test Pharma",
        type_id=supplier_type.id,
        status_id=1
    )
    db.add(supplier)
    db.flush()
    
    # 3. Setup Invoice
    invoice = models.Invoice(
        supplier_id=supplier.id,
        invoice_date=date.today(),
        reference_number="INV-AUTO-001",
        total_value=1180.0,
        gst=180.0,
        status=models.InvoiceStatus.Pending,
        created_by=admin_user.id
    )
    db.add(invoice)
    db.flush()
    
    # 4. Setup Payment
    payment = models.InvoicePayment(
        invoice_id=invoice.id,
        payment_mode=models.PaymentMode.UPI,
        payment_date=date.today(),
        paid_amount=500.0,
        payment_reference="UPI12345",
        created_by=admin_user.id
    )
    db.add(payment)
    db.flush()
    
    # 5. Execute Automation Logic
    ExpenseService.record_expense_from_invoice_payment(
        db=db,
        invoice=invoice,
        payment=payment,
        user_id=admin_user.id
    )
    db.commit()
    
    # 6. Verify Expense Record
    expense = db.query(models.Expense).filter(models.Expense.reference_number == "INV-AUTO-001").first()
    assert expense is not None
    assert expense.total_amount == 1180.0
    assert expense.gst_amount == 180.0
    assert expense.amount == 1180.0 # Base Cost is now Total
    assert expense.details == "Procurement: Test Pharma"
    assert expense.expense_type.name == "Wholesale"
    
    # 7. Verify Expense Payment
    assert len(expense.payments) == 1
    exp_pay = expense.payments[0]
    assert exp_pay.amount == 500.0
    assert exp_pay.payment_mode.mode == "UPI"

def test_feature_toggle_check(db: Session):
    """Simple check that flag logic is callable."""
    assert hasattr(settings, 'is_feature_enabled')
    # Default is false unless set in env
    assert isinstance(settings.is_feature_enabled("ANY"), bool)

@pytest.mark.asyncio
async def test_record_payment_api_triggers_expense(client, db):
    """
    Integration test: Recording a payment via API should create an expense if flag is on.
    """
    # Force the feature flag to be ON for this test
    from app.core.config import settings
    original_flags = settings.FEATURE_FLAGS
    settings.FEATURE_FLAGS = "FINANCE_MANAGEMENT"
    
    try:
        # 1. Setup Supplier (Retail is pre-seeded)
        supplier_type = db.query(models.SupplierType).filter(models.SupplierType.name == "Retail").first()
        supplier = models.Supplier(supplier_name="API Supplier", type_id=supplier_type.id, status_id=1)
        db.add(supplier)
        db.flush()
        db.commit()

        # 2. Setup Invoice
        invoice_data = {
            "supplier_id": supplier.id,
            "invoice_date": str(date.today()),
            "reference_number": "API-AUTO-EXP",
            "total_value": 1000.0,
            "gst": 0.0,
            "line_items": []
        }
        resp = client.post("/invoices/", json=invoice_data)
        assert resp.status_code == 200
        inv_id = resp.json()["id"]
        
        # 3. Record Payment
        payment_data = {
            "invoice_id": inv_id,
            "payment_mode": "Cash",
            "payment_date": str(date.today()),
            "paid_amount": 1000.0,
            "payment_reference": "CASH001"
        }
        resp = client.post(f"/invoices/{inv_id}/payments", json=payment_data)
        assert resp.status_code == 200
        
        # 4. Verify Expense
        expense = db.query(models.Expense).filter(models.Expense.reference_number == "API-AUTO-EXP").first()
        assert expense is not None
        assert expense.total_amount == 1000.0
        assert len(expense.payments) == 1
        assert expense.payments[0].amount == 1000.0
    finally:
        settings.FEATURE_FLAGS = original_flags
