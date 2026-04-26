"""
Finance Management API Endpoints.
"""
import datetime
from datetime import date
import io
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File, Response
from sqlalchemy.orm import Session
from typing import List, Optional
import logging

from app.database import get_db
from app.auth import get_current_user, RoleChecker, admin_required
from app import models, schemas, utils
from app.services.finance_service import FinanceService
from app.utils import ResourceNotFoundError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/finance", tags=["Finance Management"])

# =============================================================================
# Master Data Endpoints
# =============================================================================

@router.post("/masters/patient_identifiers", response_model=schemas.PatientIdentifierSchema)
def create_patient_identifier(
    ident_in: schemas.PatientIdentifierCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(admin_required),
):
    with utils.db_error_handler("creating patient identifier", db):
        db_obj = models.PatientIdentifier(**ident_in.model_dump())
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

@router.put("/masters/patient_identifiers/{id}", response_model=schemas.PatientIdentifierSchema)
def update_patient_identifier(
    id: int,
    ident_in: schemas.PatientIdentifierUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(admin_required),
):
    with utils.db_error_handler("updating patient identifier", db):
        db_obj = db.query(models.PatientIdentifier).filter(models.PatientIdentifier.id == id).first()
        if not db_obj:
            raise ResourceNotFoundError("Identifier", id)
        for key, value in ident_in.model_dump().items():
            setattr(db_obj, key, value)
        db.commit()
        db.refresh(db_obj)
        return db_obj

@router.post("/masters/patient_services", response_model=schemas.PatientServiceSchema)
def create_patient_service(
    srv_in: schemas.PatientServiceCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(admin_required),
):
    with utils.db_error_handler("creating patient service", db):
        db_obj = models.PatientService(**srv_in.model_dump())
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

@router.post("/masters/payment_modes", response_model=schemas.PaymentModeMasterSchema)
def create_payment_mode(
    pm_in: schemas.PaymentModeMasterCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(admin_required),
):
    with utils.db_error_handler("creating payment mode", db):
        db_obj = models.PaymentModeMaster(**pm_in.model_dump())
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

@router.put("/masters/patient_services/{id}", response_model=schemas.PatientServiceSchema)
def update_patient_service(
    id: int,
    srv_in: schemas.PatientServiceUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(admin_required),
):
    with utils.db_error_handler("updating patient service", db):
        db_obj = db.query(models.PatientService).filter(models.PatientService.id == id).first()
        if not db_obj:
            raise ResourceNotFoundError("Service", id)
        for key, value in srv_in.model_dump().items():
            setattr(db_obj, key, value)
        db.commit()
        db.refresh(db_obj)
        return db_obj

@router.put("/masters/payment_modes/{id}", response_model=schemas.PaymentModeMasterSchema)
def update_payment_mode(
    id: int,
    pm_in: schemas.PaymentModeMasterUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(admin_required),
):
    with utils.db_error_handler("updating payment mode", db):
        db_obj = db.query(models.PaymentModeMaster).filter(models.PaymentModeMaster.id == id).first()
        if not db_obj:
            raise ResourceNotFoundError("Payment mode", id)
        for key, value in pm_in.model_dump().items():
            setattr(db_obj, key, value)
        db.commit()
        db.refresh(db_obj)
        return db_obj

@router.post("/masters/expense_types", response_model=schemas.ExpenseTypeSchema)
def create_expense_type(
    exp_in: schemas.ExpenseTypeCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(admin_required),
):
    with utils.db_error_handler("creating expense type", db):
        db_obj = models.ExpenseType(**exp_in.model_dump())
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

@router.put("/masters/expense_types/{id}", response_model=schemas.ExpenseTypeSchema)
def update_expense_type(
    id: int,
    exp_in: schemas.ExpenseTypeUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(admin_required),
):
    with utils.db_error_handler("updating expense type", db):
        db_obj = db.query(models.ExpenseType).filter(models.ExpenseType.id == id).first()
        if not db_obj:
            raise ResourceNotFoundError("Expense type", id)
        for key, value in exp_in.model_dump().items():
            setattr(db_obj, key, value)
        db.commit()
        db.refresh(db_obj)
        return db_obj

@router.patch("/masters/{entity}/{id}/toggle", response_model=None)
def toggle_master_data(
    entity: str,
    id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(admin_required),
):
    with utils.db_error_handler(f"toggling {entity}", db):
        model = None
        if entity == "patient_identifiers": model = models.PatientIdentifier
        elif entity == "patient_services": model = models.PatientService
        elif entity == "payment_modes": model = models.PaymentModeMaster
        elif entity == "expense_types": model = models.ExpenseType
        else: raise HTTPException(status_code=400, detail="Invalid entity")

        db_obj = db.query(model).filter(model.id == id).first()
        if not db_obj:
            raise ResourceNotFoundError(entity, id)
        
        db_obj.is_active = not db_obj.is_active
        db.commit()
        return {"id": id, "is_active": db_obj.is_active}

@router.get("/masters", response_model=schemas.FinanceMastersSchema)
def get_finance_masters(
    include_inactive: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query_ids = db.query(models.PatientIdentifier)
    query_srvs = db.query(models.PatientService)
    query_modes = db.query(models.PaymentModeMaster)
    query_exps = db.query(models.ExpenseType)

    if not include_inactive:
        query_ids = query_ids.filter(models.PatientIdentifier.is_active == True)
        query_srvs = query_srvs.filter(models.PatientService.is_active == True)
        query_modes = query_modes.filter(models.PaymentModeMaster.is_active == True)
        query_exps = query_exps.filter(models.ExpenseType.is_active == True)

    return {
        "identifiers": query_ids.all(),
        "services": query_srvs.all(),
        "payment_modes": query_modes.all(),
        "expense_types": query_exps.all(),
    }

# =============================================================================
# Patient Payments Endpoints
# =============================================================================

@router.post("/payments", response_model=schemas.PatientPaymentSchema, status_code=status.HTTP_201_CREATED)
def create_patient_payment(
    payment_in: schemas.PatientPaymentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    with utils.db_error_handler("recording patient payment", db):
        db_payment = FinanceService.record_payment(db, payment_in, current_user.id)
        db.commit()
        db.refresh(db_payment)
        return db_payment

@router.get("/payments", response_model=schemas.PaginatedPatientPayment)
def get_patient_payments(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    patient_name: Optional[str] = Query(None),
    date: Optional[str] = Query(None),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.PatientPayment).filter(models.PatientPayment.is_deleted == False)
    
    if patient_name:
        query = query.filter(models.PatientPayment.patient_name.ilike(f"%{patient_name}%"))
    if date:
        query = query.filter(models.PatientPayment.payment_date == date)
    if from_date:
        query = query.filter(models.PatientPayment.payment_date >= from_date)
    if to_date:
        query = query.filter(models.PatientPayment.payment_date <= to_date)
        
    total = query.count()
    items = (
        query.order_by(models.PatientPayment.payment_date.desc(), models.PatientPayment.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return {"total": total, "items": items}

@router.get("/payments/{id}", response_model=schemas.PatientPaymentSchema)
def get_patient_payment(
    id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    record = db.query(models.PatientPayment).filter(
        models.PatientPayment.id == id,
        models.PatientPayment.is_deleted == False
    ).first()
    if not record:
        raise ResourceNotFoundError("Payment record", id)
    return record

@router.put("/payments/{id}", response_model=schemas.PatientPaymentSchema)
def update_patient_payment(
    id: int,
    payment_in: schemas.PatientPaymentUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    with utils.db_error_handler("updating patient payment", db):
        db_obj = db.query(models.PatientPayment).filter(
            models.PatientPayment.id == id,
            models.PatientPayment.is_deleted == False
        ).first()
        if not db_obj:
            raise ResourceNotFoundError("Payment record", id)
        
        for key, value in payment_in.model_dump(exclude={"identifiers", "services"}).items():
            setattr(db_obj, key, value)
        
        db_obj.modified_by = current_user.id
        db_obj.modified_date = datetime.datetime.now(datetime.timezone.utc)
        db.commit()
        db.refresh(db_obj)
        FinanceService.recalculate_daily_summary(db, db_obj.payment_date)
        return db_obj

@router.delete("/payments/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_patient_payment(
    id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(admin_required),
):
    with utils.db_error_handler("deleting patient payment", db):
        success = FinanceService.soft_delete_payment(db, id, current_user.id)
        if not success:
            raise ResourceNotFoundError("Payment record", id)
        return Response(status_code=status.HTTP_204_NO_CONTENT)

# =============================================================================
# Bulk Upload & Analytics Endpoints
# =============================================================================

@router.post("/payments/upload", response_model=schemas.BulkPaymentResult)
async def upload_payments(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(admin_required),
):
    try:
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents)) if file.filename.endswith('.csv') else pd.read_excel(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {str(e)}")

    result = FinanceService.process_bulk_upload(db, df, current_user.id)
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

@router.get("/analytics/dashboard", response_model=schemas.FinanceDashboardStats)
def get_finance_dashboard(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return FinanceService.get_dashboard_stats(db, start_date, end_date)

@router.get("/reports/summary", response_model=schemas.PaginatedDailySummary)
def get_daily_summaries(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.DailyFinanceSummary).filter(models.DailyFinanceSummary.patient_count > 0)
    if start_date:
        query = query.filter(models.DailyFinanceSummary.summary_date >= start_date)
    if end_date:
        query = query.filter(models.DailyFinanceSummary.summary_date <= end_date)
        
    all_summaries = query.order_by(models.DailyFinanceSummary.summary_date.desc()).all()
    total = len(all_summaries)
    
    # Restoring Grand Totals calculation
    grand_total = {
        "patient_count": 0, "total_revenue": 0.0, "total_collected": 0.0, "total_gst": 0.0,
        "service_breakdown": {}, "payment_breakdown": {}
    }
    for s in all_summaries:
        grand_total["patient_count"] += s.patient_count
        grand_total["total_revenue"] += s.total_revenue
        grand_total["total_collected"] += s.total_collected
        grand_total["total_gst"] += s.total_gst
        for name, amt in s.service_breakdown.items():
            grand_total["service_breakdown"][name] = grand_total["service_breakdown"].get(name, 0.0) + amt
        for mode, amt in s.payment_breakdown.items():
            grand_total["payment_breakdown"][mode] = grand_total["payment_breakdown"].get(mode, 0.0) + amt

    items = all_summaries[skip : skip + limit]
    return {"total": total, "items": items, "grand_total": grand_total}
