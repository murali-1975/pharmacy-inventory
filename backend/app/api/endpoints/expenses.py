import datetime
import logging
import io
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File, Response
from sqlalchemy.orm import Session
from typing import List, Optional

from app import models, schemas, utils
from app.database import get_db
from app.auth import get_current_user, admin_required
from app.services.expense_service import ExpenseService

# --- Configuration & Logging ---
router = APIRouter(prefix="/finance/expenses", tags=["Finance Management"])
logger = logging.getLogger(__name__)

# --- Endpoints ---

@router.post("", response_model=schemas.ExpenseSchema, status_code=status.HTTP_201_CREATED)
def record_expense(
    exp_in: schemas.ExpenseCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Records a new operational expense with optional split payments.
    """
    logger.info(f"Initiating expense record for User: {current_user.username}")
    
    # Permission check: Non-admins cannot record 'Salary' expenses
    if current_user.role != 'Admin':
        exp_type = db.query(models.ExpenseType).filter(models.ExpenseType.id == exp_in.expense_type_id).first()
        if exp_type and exp_type.name == 'Salary':
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, 
                detail="Staff users are not authorized to record salary expenses."
            )

    with utils.db_error_handler("recording expense", db):
        db_expense = ExpenseService.record_expense(db, exp_in, current_user.id)
        db.commit()
        db.refresh(db_expense)
        logger.info(f"Successfully recorded expense ID {db_expense.id}. User: {current_user.username}")
        return db_expense

@router.get("", response_model=schemas.PaginatedExpense)
def list_expenses(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    expense_type_id: Optional[int] = None,
    from_date: Optional[datetime.date] = None,
    to_date: Optional[datetime.date] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Retrieves a paginated list of operational expenses with optional filtering.
    """
    logger.debug(f"Listing expenses: skip={skip}, limit={limit}")
    query = db.query(models.Expense).filter(models.Expense.is_deleted == False)
    
    # Permission check: Hide 'Salary' expenses from non-admins
    if current_user.role != 'Admin':
        query = query.join(models.ExpenseType).filter(models.ExpenseType.name != 'Salary')
    
    if expense_type_id:
        query = query.filter(models.Expense.expense_type_id == expense_type_id)
    if from_date:
        query = query.filter(models.Expense.expense_date >= from_date)
    if to_date:
        query = query.filter(models.Expense.expense_date <= to_date)
        
    total = query.count()
    items = query.order_by(models.Expense.expense_date.desc(), models.Expense.id.desc()).offset(skip).limit(limit).all()
    
    return {"total": total, "items": items}

@router.get("/template")
def download_expense_template(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(admin_required)
):
    """
    Generates and returns a CSV template for bulk expense upload.
    Includes active payment modes as columns.
    """
    try:
        stream = ExpenseService.generate_template(db)
        return Response(
            content=stream.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=expense_bulk_template.csv"}
        )
    except Exception as e:
        logger.error(f"Template generation failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to generate template")

@router.post("/upload", response_model=schemas.BulkExpenseResult)
async def upload_expenses(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(admin_required),
):
    """
    Processes a bulk upload of expenses from CSV or Excel.
    Restricted to Admin for audit security.
    """
    try:
        contents = await file.read()
        if file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(contents))
        else:
            df = pd.read_excel(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {str(e)}")

    with utils.db_error_handler("bulk expense upload", db):
        result = ExpenseService.process_bulk_upload(db, df, current_user.id)
        db.commit()
        
        error_csv = None
        if result["errors"]:
            error_df = pd.DataFrame(result["errors"])
            stream = io.StringIO()
            error_df.to_csv(stream, index=False)
            error_csv = stream.getvalue()

        return {
            "success_count": result["success_count"],
            "error_count": len(result["errors"]),
            "error_csv_content": error_csv
        }

@router.get("/{id}", response_model=schemas.ExpenseSchema)
def get_expense(
    id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Retrieves detailed information for a specific expense record.
    """
    query = db.query(models.Expense).filter(
        models.Expense.id == id, 
        models.Expense.is_deleted == False
    )
    
    # Permission check: Hide 'Salary' expenses from non-admins
    if current_user.role != 'Admin':
        query = query.join(models.ExpenseType).filter(models.ExpenseType.name != 'Salary')
        
    exp = query.first()
    
    if not exp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Expense record not found.")
    return exp

@router.delete("/{id}")
def cancel_expense(
    id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(admin_required),
):
    """
    Soft-deletes (cancels) an operational expense record.
    """
    with utils.db_error_handler("cancelling expense", db):
        success = ExpenseService.soft_delete_expense(db, id, current_user.id)
        if not success:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Expense record not found.")
        
        db.commit()
        return {"message": "Expense cancelled successfully."}

@router.put("/{id}", response_model=schemas.ExpenseSchema)
def update_expense(
    id: int,
    exp_in: schemas.ExpenseCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(admin_required),
):
    """
    Updates an existing expense record.
    Uses the clean-slate approach for split payments.
    """
    with utils.db_error_handler("updating expense", db):
        db_expense = ExpenseService.update_expense(db, id, exp_in, current_user.id)
        db.commit()
        db.refresh(db_expense)
        return db_expense
