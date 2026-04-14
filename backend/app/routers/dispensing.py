"""
Dispensing Router.

Records daily medicine dispensing events (per patient), and automatically deducts
stock in an atomic transaction. Every dispensing write creates an immutable
StockAdjustment audit record (type=DISPENSED).

Routes:
    POST /dispensing/          - Record a new dispensing event (all authenticated users)
    GET  /dispensing/          - List all records with optional filters (all users)
    GET  /dispensing/{id}      - Retrieve a specific dispensing record (all users)
    DELETE /dispensing/{id}    - Cancel a record and restore stock (Admin only)

Stock rules:
    - Dispensing quantity cannot exceed current quantity_on_hand.
    - Returns HTTP 400 if insufficient stock.
    - Cancel (DELETE) restores stock and writes a reversal adjustment record.
"""
import datetime
import io
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File, Response
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from typing import List, Optional
from app import models, schemas, database, auth, utils
from app.core.logging_config import logger
from app.services.dispensing_service import DispensingService

router = APIRouter(
    prefix="/dispensing",
    tags=["Dispensing"],
    dependencies=[Depends(auth.get_current_user)],
)

admin_required = auth.RoleChecker(["Admin"])


# ---------------------------------------------------------------------------
# READ Endpoints
# ---------------------------------------------------------------------------

@router.get("/template")
def download_template():
    """
    Generate and return a CSV template for bulk dispensing upload.
    
    The template includes required columns: Date, Patient Name, Medicine Name, and Quantity.
    It also provides guidance for optional price and tax fields.
    """
    logger.info("Dispensing: Template download requested.")
    cols = ["Date", "Patient Name", "Medicine Name", "Quantity", "Notes", "Unit Price", "GST Percent"]
    df = pd.DataFrame(columns=cols)
    # Add a sample row
    sample_row = {
        "Date": datetime.date.today().strftime("%Y-%m-%d"),
        "Patient Name": "Sample Patient",
        "Medicine Name": "Example Medicine 500mg",
        "Quantity": 10,
        "Notes": "Post-surgery dose",
        "Unit Price": "",
        "GST Percent": ""
    }
    df = pd.concat([df, pd.DataFrame([sample_row])], ignore_index=True)
    
    stream = io.StringIO()
    df.to_csv(stream, index=False)
    
    return Response(
        content=stream.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=dispensing_template.csv"}
    )


@router.get("/price/{medicine_id}")
def get_medicine_price(
    medicine_id: int,
    db: Session = Depends(database.get_db)
):
    """
    Fetch the current calculated price for a medicine based on FEFO batch MRP and discount.
    
    This helps the frontend prepopulate unit prices during manual entry.
    """
    with utils.db_error_handler(f"fetching price for medicine {medicine_id}"):
        medicine = db.query(models.Medicine).filter(models.Medicine.id == medicine_id).first()
        if not medicine:
            logger.warning(f"Price check failed: Medicine ID {medicine_id} not found.")
            raise HTTPException(status_code=404, detail="Medicine not found")
        
        return DispensingService.get_medicine_price(db, medicine)

@router.get("/", response_model=schemas.PaginatedDispensing)
def list_dispensing(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=200),
    date: Optional[datetime.date] = Query(default=None, description="Filter by dispensed_date"),
    medicine_id: Optional[int] = Query(default=None, description="Filter by medicine"),
    patient_name: Optional[str] = Query(default=None, description="Partial match on patient name"),
    db: Session = Depends(database.get_db),
):
    """
    List all dispensing records with optional filters.

    Query Parameters:
        date         : Filter by exact dispensed date.
        medicine_id  : Filter by medicine.
        patient_name : Case-insensitive partial match.
    """
    with utils.db_error_handler("listing dispensing records"):
        query = db.query(models.Dispensing)
        if date:
            query = query.filter(models.Dispensing.dispensed_date == date)
        if medicine_id:
            query = query.filter(models.Dispensing.medicine_id == medicine_id)
        if patient_name:
            query = query.filter(
                models.Dispensing.patient_name.ilike(f"%{patient_name}%")
            )
        total = query.count()
        items = (
            query.order_by(models.Dispensing.dispensed_date.desc(), models.Dispensing.id.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )
        return {"total": total, "items": items}


@router.get("/{dispensing_id}", response_model=schemas.DispensingSchema)
@router.get("/{dispensing_id}/", response_model=schemas.DispensingSchema, include_in_schema=False)
def get_dispensing(
    dispensing_id: int,
    db: Session = Depends(database.get_db),
):
    """Retrieve a single dispensing record by ID."""
    with utils.db_error_handler("retrieving dispensing record"):
        record = db.query(models.Dispensing).filter(
            models.Dispensing.id == dispensing_id
        ).first()
        if not record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Dispensing record with ID {dispensing_id} not found.",
            )
        return record


# ---------------------------------------------------------------------------
# WRITE Endpoints
# ---------------------------------------------------------------------------

@router.post("/", response_model=schemas.DispensingSchema, status_code=status.HTTP_201_CREATED)
def record_dispensing(
    dispensing_in: schemas.DispensingCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """
    Record a medicine dispensing event for a patient.
    Uses DispensingService for FEFO logic and atomicity.
    """
    with utils.db_error_handler("recording dispensing", db):
        db_dispensing = DispensingService.record_dispensing_event(db, dispensing_in, current_user.id)
        db.commit()
        db.refresh(db_dispensing)
        logger.info(
            f"User '{current_user.username}' recorded dispensing for patient '{dispensing_in.patient_name}' "
            f"(Medicine ID: {dispensing_in.medicine_id}, Qty: {dispensing_in.quantity})."
        )
        return db_dispensing


@router.post("/upload", response_model=schemas.BulkDispensingResult)
async def upload_dispensing(
    file: UploadFile = File(...),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """
    Process a bulk upload of dispensing records from CSV or Excel.
    """
    logger.info(f"Bulk Dispensing: Upload started for {file.filename}")
    try:
        contents = await file.read()
        if file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(contents))
        else:
            df = pd.read_excel(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {str(e)}")

    # Standardize column names
    df.columns = [c.strip().lower().replace(' ', '_') for c in df.columns]
    
    required = ["date", "patient_name", "medicine_name", "quantity"]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing required columns: {', '.join(missing)}")

    result = DispensingService.process_bulk_upload(db, df, current_user.id)
    db.commit()
    
    # Prepare error CSV if any
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


@router.delete("/{dispensing_id}", status_code=status.HTTP_204_NO_CONTENT)
@router.delete("/{dispensing_id}/", status_code=status.HTTP_204_NO_CONTENT, include_in_schema=False)
def cancel_dispensing(
    dispensing_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(admin_required),
):
    """
    Cancel a dispensing record and restore the deducted stock.

    This is an Admin-only emergency correction. It:
    1. Restores the quantity back to MedicineStock.
    2. Creates a reversal StockAdjustment audit record (type=MANUAL_ADJUSTMENT).
    3. Deletes the Dispensing record.

    Raises:
        404: Record not found.
        500: Database error.
    """
    with utils.db_error_handler("cancelling dispensing", db):
        record = db.query(models.Dispensing).filter(
            models.Dispensing.id == dispensing_id
        ).first()
        if not record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Dispensing record with ID {dispensing_id} not found.",
            )

        # 1. Restore quantity to original batches (if batches exist)
        # This fixes the bug where stock was only restored to the global total.
        original_adjustments = db.query(models.StockAdjustment).filter(
            models.StockAdjustment.dispensing_id == dispensing_id
        ).all()
        
        for adj in original_adjustments:
            if adj.batch_id:
                batch = db.query(models.StockBatch).filter(models.StockBatch.id == adj.batch_id).first()
                if batch:
                    batch.quantity_on_hand += abs(adj.quantity_change)
            
            # 2. Break the link to dispensing record to satisfy ForeignKey constraint (fixes 409 Conflict)
            adj.dispensing_id = None

        # Flush the updates to database so the upcoming DELETE doesn't violate Postgres constraints
        db.flush()

        # 3. Restore master medicine stock total
        stock_record = (
            db.query(models.MedicineStock)
            .filter(models.MedicineStock.medicine_id == record.medicine_id)
            .first()
        )
        if stock_record:
            stock_record.quantity_on_hand += record.quantity
            stock_record.last_updated_at = datetime.datetime.now(datetime.timezone.utc)

        # 4. Write reversal audit record
        reversal = models.StockAdjustment(
            medicine_id=record.medicine_id,
            quantity_change=record.quantity,
            adjustment_type=models.StockAdjustmentType.MANUAL_ADJUSTMENT,
            reason=f"Reversal of cancelled dispensing ID {dispensing_id} (patient: '{record.patient_name}', date: {record.dispensed_date})",
            adjusted_by_user_id=current_user.id,
        )
        db.add(reversal)
        
        # 5. Delete the dispensing record
        db.delete(record)
        db.commit()

        logger.info(
            f"Admin '{current_user.username}' cancelled dispensing ID {dispensing_id}. Stock restored."
        )
