import pytest
from app import models, auth
import datetime

def test_admin_sees_all_expenses(client, db):
    # Setup Salary/Utility types (Note: conftest seed might have already added some)
    salary_type = db.query(models.ExpenseType).filter(models.ExpenseType.name == "Salary").first()
    if not salary_type:
        salary_type = models.ExpenseType(name="Salary", is_active=True)
        db.add(salary_type)
    
    utility_type = db.query(models.ExpenseType).filter(models.ExpenseType.name == "Utility").first()
    if not utility_type:
        utility_type = models.ExpenseType(name="Utility", is_active=True)
        db.add(utility_type)
    
    db.flush()
    
    admin = db.query(models.User).filter(models.User.username == "testadmin").first()
    
    salary_exp = models.Expense(
        expense_date=datetime.date.today(),
        expense_type_id=salary_type.id,
        details="April Salary",
        total_amount=50000.0,
        amount=50000.0,
        created_by=admin.id,
        modified_by=admin.id
    )
    utility_exp = models.Expense(
        expense_date=datetime.date.today(),
        expense_type_id=utility_type.id,
        details="Electricity",
        total_amount=2000.0,
        amount=2000.0,
        created_by=admin.id,
        modified_by=admin.id
    )
    db.add_all([salary_exp, utility_exp])
    db.commit()
    
    response = client.get("/finance/expenses")
    assert response.status_code == 200
    items = response.json()["items"]
    types = [item["expense_type"]["name"] for item in items]
    assert "Salary" in types
    assert "Utility" in types

def test_staff_sees_only_utility(staff_client, db):
    # Setup types
    salary_type = db.query(models.ExpenseType).filter(models.ExpenseType.name == "Salary").first()
    if not salary_type:
        salary_type = models.ExpenseType(name="Salary", is_active=True)
        db.add(salary_type)
    
    utility_type = db.query(models.ExpenseType).filter(models.ExpenseType.name == "Utility").first()
    if not utility_type:
        utility_type = models.ExpenseType(name="Utility", is_active=True)
        db.add(utility_type)
    db.flush()
    
    admin = db.query(models.User).filter(models.User.role == "Admin").first()
    
    salary_exp = models.Expense(
        expense_date=datetime.date.today(),
        expense_type_id=salary_type.id,
        details="April Salary",
        total_amount=50000.0,
        amount=50000.0,
        created_by=admin.id,
        modified_by=admin.id
    )
    utility_exp = models.Expense(
        expense_date=datetime.date.today(),
        expense_type_id=utility_type.id,
        details="Electricity",
        total_amount=2000.0,
        amount=2000.0,
        created_by=admin.id,
        modified_by=admin.id
    )
    db.add_all([salary_exp, utility_exp])
    db.commit()
    
    response = staff_client.get("/finance/expenses")
    assert response.status_code == 200
    items = response.json()["items"]
    types = [item["expense_type"]["name"] for item in items]
    assert "Salary" not in types
    assert "Utility" in types

def test_staff_cannot_access_salary_by_id(staff_client, db):
    salary_type = db.query(models.ExpenseType).filter(models.ExpenseType.name == "Salary").first()
    if not salary_type:
        salary_type = models.ExpenseType(name="Salary", is_active=True)
        db.add(salary_type)
        db.flush()
        
    admin = db.query(models.User).filter(models.User.role == "Admin").first()
    salary_exp = models.Expense(
        expense_date=datetime.date.today(),
        expense_type_id=salary_type.id,
        details="April Salary",
        total_amount=50000.0,
        amount=50000.0,
        created_by=admin.id,
        modified_by=admin.id
    )
    db.add(salary_exp)
    db.commit()
    
    response = staff_client.get(f"/finance/expenses/{salary_exp.id}")
    assert response.status_code == 404

def test_staff_cannot_see_salary_in_masters(staff_client, db):
    salary_type = db.query(models.ExpenseType).filter(models.ExpenseType.name == "Salary").first()
    if not salary_type:
        salary_type = models.ExpenseType(name="Salary", is_active=True)
        db.add(salary_type)
        db.commit()
        
    response = staff_client.get("/finance/masters")
    assert response.status_code == 200
    types = [t["name"] for t in response.json()["expense_types"]]
    assert "Salary" not in types

def test_staff_sees_filtered_summaries(staff_client, db):
    # Create Daily Summary with Salary
    summary = models.DailyFinanceSummary(
        summary_date=datetime.date.today(),
        patient_count=10,
        total_revenue=10000.0,
        total_collected=10000.0,
        total_expenses=52000.0,
        expense_breakdown={"Salary": 50000.0, "Utility": 2000.0},
        service_breakdown={"Consultation": 10000.0},
        payment_breakdown={"Cash": 10000.0},
        last_updated=datetime.datetime.now(datetime.timezone.utc)
    )
    db.add(summary)
    db.commit()
    
    response = staff_client.get("/finance/reports/summary")
    assert response.status_code == 200
    data = response.json()
    
    # Check individual item
    item = data["items"][0]
    assert item["total_expenses"] == 2000.0
    assert "Salary" not in item["expense_breakdown"]
    
    # Check grand total
    gt = data["grand_total"]
    assert gt["total_expenses"] == 2000.0
    assert "Salary" not in gt["expense_breakdown"]

def test_staff_cannot_create_salary_expense(staff_client, db):
    salary_type = db.query(models.ExpenseType).filter(models.ExpenseType.name == "Salary").first()
    if not salary_type:
        salary_type = models.ExpenseType(name="Salary", is_active=True)
        db.add(salary_type)
        db.commit()
    
    payload = {
        "expense_date": str(datetime.date.today()),
        "expense_type_id": salary_type.id,
        "details": "Sneaky Salary",
        "amount": 1000.0,
        "total_amount": 1000.0,
        "payments": []
    }
    response = staff_client.post("/finance/expenses", json=payload)
    assert response.status_code == 403
