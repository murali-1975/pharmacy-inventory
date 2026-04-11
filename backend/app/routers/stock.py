"""
Stock Management Router.

Provides endpoints to view current medicine stock levels, query adjustment history,
and manually adjust stock (Admin only). All adjustments are recorded in an immutable
audit trail (StockAdjustment) for traceability and pharmaceutical compliance.

Routes:
    GET  /stock/               - List all medicines with their current stock (all users)
    GET  /stock/{medicine_id}  - Get stock + history for a specific medicine (all users)
    POST /stock/adjust         - Manually adjust stock up or down (Admin only)
    GET  /stock/adjustments    - Full audit log of every adjustment (Admin only)

Access:
    Read:  All authenticated users
    Write: Admin only
"""
import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, case
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import SQLAlchemyError
from typing import List
from app import models, schemas, database, auth, utils
from app.core.logging_config import logger
from app.services.dispensing_service import DispensingService

router = APIRouter(
    prefix="/stock",
    tags=["Stock Management"],
    dependencies=[Depends(auth.get_current_user)],
)

admin_required = auth.RoleChecker(["Admin"])


# ---------------------------------------------------------------------------
# READ Endpoints (All authenticated users)
# ---------------------------------------------------------------------------

@router.get("/adjustments", response_model=List[schemas.StockAdjustmentSchema])
def list_all_adjustments(
    skip: int = 0,
    limit: int = 200,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(admin_required),
):
    """
    Retrieve the full audit log of every stock adjustment in the system.

    Returns adjustments ordered by timestamp descending (most recent first).
    Requires: Admin role.
    """
    with utils.db_error_handler("stock adjustments retrieval"):
        logger.info(f"Admin '{current_user.username}' requested full stock adjustment audit log (skip={skip}, limit={limit}).")
        adjustments = (
            db.query(models.StockAdjustment)
            .order_by(models.StockAdjustment.adjusted_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )
        logger.info(f"Admin {current_user.username} accessed all stock adjustments.")
        return adjustments


@router.get("/", response_model=schemas.PaginatedStockSchema)
def list_stock(
    skip: int = 0,
    limit: int = 20, # Updated default to 20 for FE consistency
    low_stock_only: bool = False,
    search: str = None,
    db: Session = Depends(database.get_db),
):
    """
    List the current on-hand stock for all medicines. Includes total count for pagination.
    """
    if search:
        logger.info(f"Stock list requested with search filter: '{search}'")
    with utils.db_error_handler("stock list retrieval"):
        # Auto-Heal: Ensure all medicines have a stock record so they are visible
        missing_stocks = db.query(models.Medicine.id).outerjoin(models.Medicine.stock).filter(models.MedicineStock.id == None).all()
        if missing_stocks:
            logger.info(f"Auto-healing missing MedicineStock records for {len(missing_stocks)} medicines.")
            for (med_id,) in missing_stocks:
                db.add(models.MedicineStock(medicine_id=med_id, quantity_on_hand=0))
            try:
                db.commit()
            except SQLAlchemyError as e:
                db.rollback()
                logger.error(f"Auto-heal failed: {e}")

        query = db.query(models.MedicineStock).join(models.MedicineStock.medicine)
        
        if low_stock_only:
            query = query.filter(
                models.MedicineStock.quantity_on_hand <= models.MedicineStock.reorder_level
            )
            
        if search:
            search_query = f"%{search}%"
            query = query.filter(
                (models.Medicine.product_name.ilike(search_query)) |
                (models.Medicine.generic_name.ilike(search_query))
            )
        
        total = query.count()
        
        items = query.options(
            joinedload(models.MedicineStock.medicine).joinedload(models.Medicine.batches)
        ).order_by(models.MedicineStock.quantity_on_hand.desc()).offset(skip).limit(limit).all()
        
        # Populate pricing for each item
        for item in items:
            if item.medicine:
                pricing = DispensingService.get_medicine_price(db, item.medicine)
                item.unit_price = pricing["unit_price"]
                item.gst_percent = pricing["gst_percent"]
        
        return {"total": total, "items": items}


# ---------------------------------------------------------------------------
# LEDGER Endpoint (Audit & Reconciliation)
# ---------------------------------------------------------------------------

@router.get("/ledger", response_model=schemas.PaginatedStockLedger)
def get_stock_ledger(
    from_date: datetime.date,
    to_date: datetime.date,
    search: str = None,
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(database.get_db),
):
    """
    Generate a period-based inventory ledger for all medicines.
    Provides Open Balance, Additions, Deletions, and Closing Balance for a date range.
    Includes zero-activity medicines for complete audit visibility.
    """
    from_dt = datetime.datetime.combine(from_date, datetime.time.min)
    to_dt = datetime.datetime.combine(to_date, datetime.time.max)
    
    logger.info(f"Inventory Ledger request received: from={from_date} to={to_date}, search='{search}'")
    
    with utils.db_error_handler("stock ledger generation"):
        try:
            # 1. Subquery for Opening Balance (all changes BEFORE from_date)
            opening_sub = db.query(
                models.StockAdjustment.medicine_id,
                func.sum(models.StockAdjustment.quantity_change).label("opening")
            ).filter(models.StockAdjustment.adjusted_at < from_dt).group_by(models.StockAdjustment.medicine_id).subquery()

            # 2. Subquery for Period Movements (changes BETWEEN from_date and to_date)
            movement_sub = db.query(
                models.StockAdjustment.medicine_id,
                func.sum(case(((models.StockAdjustment.quantity_change > 0), models.StockAdjustment.quantity_change)), else_=0).label("qty_in"),
                func.sum(case(((models.StockAdjustment.quantity_change < 0), models.StockAdjustment.quantity_change)), else_=0).label("qty_out")
            ).filter(
                models.StockAdjustment.adjusted_at >= from_dt,
                models.StockAdjustment.adjusted_at <= to_dt
            ).group_by(models.StockAdjustment.medicine_id).subquery()

            # 3. Main Query: Join Medicine with subqueries to get the full list (standard accounting includes static balances)
            query = db.query(
                models.Medicine.id.label("medicine_id"),
                models.Medicine.product_name,
                models.Medicine.generic_name,
                models.Medicine.category,
                models.Medicine.uom,
                func.coalesce(opening_sub.c.opening, 0).label("opening_balance"),
                func.coalesce(movement_sub.c.qty_in, 0).label("quantity_in"),
                func.coalesce(movement_sub.c.qty_out, 0).label("quantity_out_raw")
            ).outerjoin(opening_sub, models.Medicine.id == opening_sub.c.medicine_id)\
             .outerjoin(movement_sub, models.Medicine.id == movement_sub.c.medicine_id)
            
            if search:
                query = query.filter(models.Medicine.product_name.ilike(f"%{search}%"))
            
            total = query.count()
            items_raw = query.order_by(models.Medicine.product_name.asc()).offset(skip).limit(limit).all()
            
            # 4. Final Calculations (Closing = Opening + In - abs(Out))
            results = []
            for row in items_raw:
                qty_out = abs(row.quantity_out_raw)
                results.append({
                    "medicine_id": row.medicine_id,
                    "product_name": row.product_name,
                    "generic_name": row.generic_name,
                    "category": row.category,
                    "uom": row.uom,
                    "opening_balance": row.opening_balance,
                    "quantity_in": row.quantity_in,
                    "quantity_out": qty_out,
                    "stock_in_hand": row.opening_balance + row.quantity_in - qty_out
                })
                
            return {"total": total, "items": results}
        except Exception as e:
            logger.error(f"Unexpected error in stock ledger: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An unexpected error occurred during ledger generation."
            )


@router.get("/{medicine_id}", response_model=schemas.MedicineStockSchema)
@router.get("/{medicine_id}/", response_model=schemas.MedicineStockSchema, include_in_schema=False)
def get_stock_for_medicine(
    medicine_id: int,
    db: Session = Depends(database.get_db),
):
    """
    Retrieve the current stock level for a specific medicine.

    Returns the stock record including the medicine details (name, category, UoM).
    Raises 404 if the medicine has no stock record (never received on any invoice).
    """
    with utils.db_error_handler("stock retrieval"):
        medicine = db.query(models.Medicine).filter(models.Medicine.id == medicine_id).first()
        if not medicine:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Medicine with ID {medicine_id} not found.",
            )

        stock_record = (
            db.query(models.MedicineStock)
            .options(
                joinedload(models.MedicineStock.medicine).joinedload(models.Medicine.batches)
            )
            .filter(models.MedicineStock.medicine_id == medicine_id)
            .first()
        )
        if not stock_record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No stock record found for Medicine ID {medicine_id}. "
                       "It may not have been received on any invoice yet.",
            )
        return stock_record


@router.get("/{medicine_id}/adjustments", response_model=List[schemas.StockAdjustmentSchema])
@router.get("/{medicine_id}/adjustments/", response_model=List[schemas.StockAdjustmentSchema], include_in_schema=False)
def get_adjustments_for_medicine(
    medicine_id: int,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(database.get_db),
):
    """
    Retrieve the complete adjustment history for a specific medicine.

    Returns adjustments ordered by timestamp descending (most recent first).
    Useful for stock reconciliation and audit reviews. Includes batch information if available.
    """
    logger.info(f"Fetching adjustment history for Medicine ID: {medicine_id}")
    with utils.db_error_handler("adjustment history retrieval"):
        medicine = db.query(models.Medicine).filter(models.Medicine.id == medicine_id).first()
        if not medicine:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Medicine with ID {medicine_id} not found.",
            )

        adjustments = (
            db.query(models.StockAdjustment)
            .options(joinedload(models.StockAdjustment.batch))
            .filter(models.StockAdjustment.medicine_id == medicine_id)
            .order_by(models.StockAdjustment.adjusted_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )
        return adjustments


@router.get("/{medicine_id}/batches", response_model=List[schemas.StockBatchSchema])
@router.get("/{medicine_id}/batches/", response_model=List[schemas.StockBatchSchema], include_in_schema=False)
def get_batches_for_medicine(
    medicine_id: int,
    active_only: bool = True,
    db: Session = Depends(database.get_db),
):
    """
    Retrieve all inventory batches for a specific medicine.
    
    Args:
        active_only: If True, returns only batches with quantity_on_hand > 0.
    """
    with utils.db_error_handler("medicine batches retrieval"):
        query = db.query(models.StockBatch).filter(models.StockBatch.medicine_id == medicine_id)
        if active_only:
            query = query.filter(models.StockBatch.quantity_on_hand > 0)
        
        return query.order_by(models.StockBatch.expiry_date.asc()).all()


# ---------------------------------------------------------------------------
# WRITE Endpoint (Admin only)
# ---------------------------------------------------------------------------

@router.post("/adjust", response_model=schemas.StockAdjustmentSchema)
def manual_stock_adjust(
    adjustment_in: schemas.StockAdjustmentCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(admin_required),
):
    """
    Apply a manual stock adjustment for a medicine.

    This is the Admin-only escape hatch for:
    - Correcting stock after a physical count (type: MANUAL_ADJUSTMENT)
    - Writing off damaged or expired inventory (type: WRITE_OFF)

    Rules:
    - Requires 'Admin' role.
    - Quantity_change can be positive (stock-in) or negative (stock-out).
    - The resulting quantity_on_hand cannot go below 0.
    - An immutable audit record is always created regardless of type.

    Raises:
        404: If medicine_id does not exist.
        400: If the adjustment would result in negative stock.
        500: On unexpected database failure.
    """
    with utils.db_error_handler("manual stock adjustment", db):
        # --- Validate medicine exists ---
        medicine = db.query(models.Medicine).filter(
            models.Medicine.id == adjustment_in.medicine_id
        ).first()
        if not medicine:
            logger.warning(
                f"Manual stock adjustment failed: Medicine ID {adjustment_in.medicine_id} not found."
            )
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Medicine with ID {adjustment_in.medicine_id} not found.",
            )

        # --- Find or create stock record ---
        stock_record = (
            db.query(models.MedicineStock)
            .filter(models.MedicineStock.medicine_id == adjustment_in.medicine_id)
            .first()
        )
        if not stock_record:
            stock_record = models.MedicineStock(
                medicine_id=adjustment_in.medicine_id,
                quantity_on_hand=0,
            )
            db.add(stock_record)
            db.flush()

        # --- Guard: Prevent negative stock ---
        new_quantity = stock_record.quantity_on_hand + adjustment_in.quantity_change
        if new_quantity < 0:
            logger.warning(
                f"Manual stock adjustment rejected: Would result in negative stock "
                f"for Medicine ID {adjustment_in.medicine_id} "
                f"(current: {stock_record.quantity_on_hand}, change: {adjustment_in.quantity_change})"
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Adjustment would result in negative stock "
                    f"({stock_record.quantity_on_hand} + {adjustment_in.quantity_change} = {new_quantity}). "
                    "Stock cannot go below zero."
                ),
            )

        # --- Apply adjustment ---
        stock_record.quantity_on_hand = new_quantity
        stock_record.last_updated_at = datetime.datetime.now(datetime.timezone.utc)

        # --- Write audit record ---
        db_adjustment = models.StockAdjustment(
            medicine_id=adjustment_in.medicine_id,
            quantity_change=adjustment_in.quantity_change,
            adjustment_type=models.StockAdjustmentType[adjustment_in.adjustment_type.name],
            reason=adjustment_in.reason,
            adjusted_by_user_id=current_user.id,
        )
        db.add(db_adjustment)
        db.commit()
        db.refresh(db_adjustment)

        logger.info(
            f"Admin {current_user.username} manually adjusted stock for Medicine ID "
            f"{adjustment_in.medicine_id}: {adjustment_in.quantity_change:+d} units. "
            f"New quantity: {new_quantity}. Reason: '{adjustment_in.reason}'"
        )
        return db_adjustment


# ---------------------------------------------------------------------------
# INITIALIZE Endpoint (Admin only)
# ---------------------------------------------------------------------------

@router.post("/initialize", response_model=schemas.StockAdjustmentSchema)
def initialize_stock(
    init_in: schemas.StockInitializeRequest,
    force: bool = False,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(admin_required),
):
    """
    Initialize the opening stock balance for a medicine.

    Designed for use during system go-live to seed pre-existing stock that was
    present in the pharmacy before digitization. This sets the stock to an
    absolute quantity (not additive like a manual adjustment).

    Args:
        init_in: Payload containing medicine_id, absolute quantity, initialization date, and optional notes.
        force:   If True, allows re-initialization even if an Opening Balance already exists.
                 Use with caution — this REPLACES the current stock level.

    Rules:
        - Requires 'Admin' role.
        - The initialized_date is stored as the audit timestamp for traceability.
        - If an Opening Balance already exists for the medicine, the endpoint
          returns HTTP 409 Conflict unless force=True is passed.

    Raises:
        404: If medicine_id does not exist.
        409: If an Opening Balance already exists and force=False.
        500: On unexpected database failure.
    """
    with utils.db_error_handler("stock initialization", db):
        # --- Validate medicine exists ---
        medicine = db.query(models.Medicine).filter(
            models.Medicine.id == init_in.medicine_id
        ).first()
        if not medicine:
            logger.warning(
                f"Stock initialization failed: Medicine ID {init_in.medicine_id} not found."
            )
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Medicine with ID {init_in.medicine_id} not found.",
            )

        # --- Guard: Prevent accidental re-initialization ---
        existing_opening = (
            db.query(models.StockAdjustment)
            .filter(
                models.StockAdjustment.medicine_id == init_in.medicine_id,
                models.StockAdjustment.adjustment_type == models.StockAdjustmentType.OPENING_BALANCE,
            )
            .first()
        )
        if existing_opening and not force:
            logger.warning(
                f"Stock initialization rejected: Medicine ID {init_in.medicine_id} already has "
                f"an Opening Balance (ID: {existing_opening.id}). Use force=True to override."
            )
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Medicine '{medicine.product_name}' already has an Opening Balance "
                    f"of {existing_opening.quantity_change} units set on "
                    f"{existing_opening.adjusted_at.date()}. "
                    "To replace it, pass ?force=true."
                ),
            )

        # --- Find or create stock record and SET (not add) the quantity ---
        stock_record = (
            db.query(models.MedicineStock)
            .filter(models.MedicineStock.medicine_id == init_in.medicine_id)
            .first()
        )
        if not stock_record:
            stock_record = models.MedicineStock(
                medicine_id=init_in.medicine_id,
                quantity_on_hand=init_in.quantity,
            )
            db.add(stock_record)
        else:
            # SET to the opening quantity (absolute, not additive)
            stock_record.quantity_on_hand = init_in.quantity

        stock_record.notes = init_in.notes
        stock_record.last_updated_at = datetime.datetime.now(datetime.timezone.utc)

        # --- Handle "Opening Stock" Batch for FEFO visibility ---
        # We use a default expiry 2 years in the future since it's not provided
        default_expiry = datetime.date.today() + datetime.timedelta(days=730)
        
        batch_record = (
            db.query(models.StockBatch)
            .filter(
                models.StockBatch.medicine_id == init_in.medicine_id,
                models.StockBatch.batch_no == "OPENING-STOCK"
            )
            .first()
        )
        
        if not batch_record:
            batch_record = models.StockBatch(
                medicine_id=init_in.medicine_id,
                batch_no="OPENING-STOCK",
                expiry_date=default_expiry,
                quantity_on_hand=init_in.quantity,
                purchase_price=medicine.unit_price, # Use master price for opening stock cost basis
                mrp=medicine.unit_price,           # Initialize MRP from medicine master
            )
            db.add(batch_record)
        else:
            # For initialize stock, we SET the batch quantity to match the total
            batch_record.quantity_on_hand = init_in.quantity
            # Sync pricing even on override if requested via force
            batch_record.mrp = medicine.unit_price
            batch_record.purchase_price = medicine.unit_price
            # If multiple batches existed before, this initialization effectively 
            # consolidates them into the "Opening" record if force=True was used.

        db.flush() # Ensure batch_record.id is available

        # --- Write audit record ---
        reason_text = (
            init_in.notes.strip()
            if init_in.notes
            else f"Opening balance initialized as of {init_in.initialized_date}"
        )
        db_adjustment = models.StockAdjustment(
            medicine_id=init_in.medicine_id,
            quantity_change=init_in.quantity,
            adjustment_type=models.StockAdjustmentType.OPENING_BALANCE,
            reason=reason_text,
            batch_id=batch_record.id,
            adjusted_by_user_id=current_user.id,
        )
        db.add(db_adjustment)
        db.commit()
        db.refresh(db_adjustment)

        action = "re-initialized" if existing_opening else "initialized"
        logger.info(
            f"Admin {current_user.username} {action} opening stock for "
            f"'{medicine.product_name}' (ID: {init_in.medicine_id}): "
            f"{init_in.quantity} units as of {init_in.initialized_date}."
        )
        return db_adjustment
        return db_adjustment
