"""
Finance Management API Endpoints.

Provides CRUD operations for finance master data (Patient Identifiers,
Patient Services, Payment Modes) and patient payment transaction management.
"""
import datetime
import io
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File, Response
from sqlalchemy.orm import Session
from typing import List, Optional
import logging

from app.database import get_db
from app.auth import get_current_user, RoleChecker
from app import models, schemas, utils
from app.services.finance_service import FinanceService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/finance", tags=["Finance Management"])

admin_required = RoleChecker(["Admin"])

# =============================================================================
# Master Data — CREATE (Admin Restricted)
# =============================================================================

@router.post("/masters/patient_identifiers", response_model=schemas.PatientIdentifierSchema)
def create_patient_identifier(
    ident_in: schemas.PatientIdentifierCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(admin_required),
):
    """Create a new patient identifier type. Admin only."""
    with utils.db_error_handler("creating patient identifier", db):
        db_obj = models.PatientIdentifier(**ident_in.model_dump())
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        logger.info(f"User {current_user.username} created patient identifier: {db_obj.id_name}")
        return db_obj


@router.post("/masters/patient_services", response_model=schemas.PatientServiceSchema)
def create_patient_service(
    srv_in: schemas.PatientServiceCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(admin_required),
):
    """Create a new patient service. Admin only."""
    with utils.db_error_handler("creating patient service", db):
        db_obj = models.PatientService(**srv_in.model_dump())
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        logger.info(f"User {current_user.username} created patient service: {db_obj.service_name}")
        return db_obj


@router.post("/masters/payment_modes", response_model=schemas.PaymentModeMasterSchema)
def create_payment_mode(
    pm_in: schemas.PaymentModeMasterCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(admin_required),
):
    """Create a new payment mode. Admin only."""
    with utils.db_error_handler("creating payment mode", db):
        db_obj = models.PaymentModeMaster(**pm_in.model_dump())
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        logger.info(f"User {current_user.username} created payment mode: {db_obj.mode}")
        return db_obj


# =============================================================================
# Master Data — UPDATE (Admin Restricted)
# =============================================================================

@router.put("/masters/patient_identifiers/{id}", response_model=schemas.PatientIdentifierSchema)
def update_patient_identifier(
    id: int,
    ident_in: schemas.PatientIdentifierUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(admin_required),
):
    """Update an existing patient identifier type."""
    with utils.db_error_handler("updating patient identifier", db):
        db_obj = db.query(models.PatientIdentifier).filter(models.PatientIdentifier.id == id).first()
        if not db_obj:
            raise HTTPException(status_code=404, detail="Identifier not found")
        for key, value in ident_in.model_dump().items():
            setattr(db_obj, key, value)
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
    """Update an existing patient service."""
    with utils.db_error_handler("updating patient service", db):
        db_obj = db.query(models.PatientService).filter(models.PatientService.id == id).first()
        if not db_obj:
            raise HTTPException(status_code=404, detail="Service not found")
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
    """Update an existing payment mode."""
    with utils.db_error_handler("updating payment mode", db):
        db_obj = db.query(models.PaymentModeMaster).filter(models.PaymentModeMaster.id == id).first()
        if not db_obj:
            raise HTTPException(status_code=404, detail="Payment mode not found")
        for key, value in pm_in.model_dump().items():
            setattr(db_obj, key, value)
        db.commit()
        db.refresh(db_obj)
        return db_obj


# =============================================================================
# Master Data — TOGGLE (Admin Restricted)
# =============================================================================

@router.patch("/masters/{entity}/{id}/toggle", response_model=None)
def toggle_master_data(
    entity: str,
    id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(admin_required),
):
    """Toggle active status for any master data entity."""
    with utils.db_error_handler(f"toggling {entity}", db):
        model = None
        if entity == "patient_identifiers": model = models.PatientIdentifier
        elif entity == "patient_services": model = models.PatientService
        elif entity == "payment_modes": model = models.PaymentModeMaster
        else: raise HTTPException(status_code=400, detail="Invalid entity")

        db_obj = db.query(model).filter(model.id == id).first()
        if not db_obj:
            raise HTTPException(status_code=404, detail="Item not found")
        
        db_obj.is_active = not db_obj.is_active
        db.commit()
        return {"id": id, "is_active": db_obj.is_active}


# =============================================================================
# Master Data — READ (Authenticated Users)
# =============================================================================

@router.get("/masters", response_model=schemas.FinanceMastersSchema)
def get_finance_masters(
    include_inactive: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Fetch all finance master data (identifiers, services, payment modes)."""
    if include_inactive:
        identifiers = db.query(models.PatientIdentifier).all()
        services = db.query(models.PatientService).all()
        payment_modes = db.query(models.PaymentModeMaster).all()
    else:
        identifiers = db.query(models.PatientIdentifier).filter(models.PatientIdentifier.is_active == True).all()
        services = db.query(models.PatientService).filter(models.PatientService.is_active == True).all()
        payment_modes = db.query(models.PaymentModeMaster).filter(models.PaymentModeMaster.is_active == True).all()

    return {
        "identifiers": identifiers,
        "services": services,
        "payment_modes": payment_modes,
    }


# =============================================================================
# Patient Payments — Transaction Endpoints
# =============================================================================

@router.post("/payments", response_model=schemas.PatientPaymentSchema, status_code=status.HTTP_201_CREATED)
def create_patient_payment(
    payment_in: schemas.PatientPaymentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Record a new patient payment transaction."""
    with utils.db_error_handler("recording patient payment", db):
        db_payment = FinanceService.record_payment(db, payment_in, current_user.id)
        db.commit()
        db.refresh(db_payment)
        logger.info(f"Payment recorded for {db_payment.patient_name} by {current_user.username}")
        return db_payment


@router.get("/payments", response_model=schemas.PaginatedPatientPayment)
def get_patient_payments(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    patient_name: Optional[str] = Query(None),
    date: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Retrieve paginated patient payment history with filtering."""
    query = db.query(models.PatientPayment)
    
    if patient_name:
        query = query.filter(models.PatientPayment.patient_name.ilike(f"%{patient_name}%"))
    if date:
        query = query.filter(models.PatientPayment.payment_date == date)
        
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
    """Retrieve a specific payment record by ID."""
    record = db.query(models.PatientPayment).filter(models.PatientPayment.id == id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Payment record not found")
    return record


@router.put("/payments/{id}", response_model=schemas.PatientPaymentSchema)
def update_patient_payment(
    id: int,
    payment_in: schemas.PatientPaymentUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Update basic patient payment details."""
    with utils.db_error_handler("updating patient payment", db):
        db_obj = db.query(models.PatientPayment).filter(models.PatientPayment.id == id).first()
        if not db_obj:
            raise HTTPException(status_code=404, detail="Payment record not found")
        for key, value in payment_in.model_dump(exclude={"identifiers", "services"}).items():
            setattr(db_obj, key, value)
        db_obj.modified_by = current_user.id
        db_obj.modified_date = datetime.datetime.now(datetime.timezone.utc)
        db.commit()
        db.refresh(db_obj)
        return db_obj


@router.delete("/payments/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_patient_payment(
    id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(admin_required),
):
    """Delete a patient payment record (Admin only)."""
    with utils.db_error_handler("deleting patient payment", db):
        db_obj = db.query(models.PatientPayment).filter(models.PatientPayment.id == id).first()
        if not db_obj:
            raise HTTPException(status_code=404, detail="Payment record not found")
        db.delete(db_obj)
        db.commit()
        return Response(status_code=status.HTTP_204_NO_CONTENT)


# =============================================================================
# Bulk Upload Endpoints (Admin Only)
# =============================================================================

@router.get("/payments/template")
def download_payment_template(current_user: models.User = Depends(admin_required)):
    """Generate and return a CSV template for bulk payment upload."""
    cols = ["Date", "Patient Name", "Token No", "Identifier Type", "ID Value", "Service Name", "Payment Mode", "Amount", "GST", "Notes"]
    df = pd.DataFrame(columns=cols)
    sample = {
        "Date": datetime.date.today().strftime("%Y-%m-%d"),
        "Patient Name": "Sample Patient",
        "Token No": 101,
        "Identifier Type": "UHID",
        "ID Value": "12345",
        "Service Name": "Consultation",
        "Payment Mode": "Cash",
        "Amount": 500,
        "GST": 0,
        "Notes": "Regular visit"
    }
    df = pd.concat([df, pd.DataFrame([sample])], ignore_index=True)
    
    stream = io.StringIO()
    df.to_csv(stream, index=False)
    
    return Response(
        content=stream.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=payment_bulk_template.csv"}
    )


@router.post("/payments/upload", response_model=schemas.BulkPaymentResult)
async def upload_payments(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(admin_required),
):
    """Process a bulk upload of patient payment records."""
    logger.info(f"Bulk Payment: Upload started for {file.filename} by {current_user.username}")
    try:
        contents = await file.read()
        if file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(contents))
        else:
            df = pd.read_excel(io.BytesIO(contents))
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


# =============================================================================
# Dashboard & Analytics
# =============================================================================

@router.get("/analytics/dashboard", response_model=schemas.FinanceDashboardStats)
def get_finance_dashboard(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Fetch high-level financial statistics for the dashboard.
    """
    return FinanceService.get_dashboard_stats(db)
