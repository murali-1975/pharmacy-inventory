from datetime import datetime, date, timezone, timedelta
import pandas as pd
from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi import HTTPException
from typing import List, Optional, Dict, Any
from app import models, schemas
from app.core.logging_config import logger

class DispensingService:
    @staticmethod
    def get_medicine_price(db: Session, medicine: models.Medicine) -> Dict[str, float]:
        """
        Logic: Unit Price = Batch MRP - (Batch MRP * Medicine Selling Price %)
        Pulls from the earliest expiring batch.
        """
        best_batch = (
            db.query(models.StockBatch)
            .filter(
                models.StockBatch.medicine_id == medicine.id,
                models.StockBatch.quantity_on_hand > 0
            )
            .order_by(models.StockBatch.expiry_date.asc(), models.StockBatch.received_at.asc())
            .first()
        )

        if not best_batch:
            return {"unit_price": medicine.unit_price or 0.0, "gst_percent": 0.0}

        mrp = float(best_batch.mrp) or 0.0
        sp_percent = float(medicine.selling_price_percent) or 0.0
        
        calc_price = mrp
        if mrp > 0:
            calc_price = mrp - (mrp * (sp_percent / 100))
        
        return {
            "unit_price": round(calc_price),
            "gst_percent": float(best_batch.gst or 0.0)
        }

    @staticmethod
    def record_dispensing_event(
        db: Session, 
        dispensing_in: schemas.DispensingCreate, 
        user_id: int
    ) -> models.Dispensing:
        """
        Atomically records a dispensing event, deducts stock (FEFO), and creates audit adjustments.
        """
        # 1. Validate medicine
        medicine = db.query(models.Medicine).filter(models.Medicine.id == dispensing_in.medicine_id).first()
        if not medicine:
            raise HTTPException(status_code=404, detail=f"Medicine ID {dispensing_in.medicine_id} not found.")

        # 2. Check stock
        stock_record = db.query(models.MedicineStock).filter(models.MedicineStock.medicine_id == medicine.id).first()
        current_qty = stock_record.quantity_on_hand if stock_record else 0
        if current_qty < dispensing_in.quantity:
            raise HTTPException(
                status_code=400, 
                detail=f"Insufficient stock for {medicine.product_name}. Available: {current_qty}, Requested: {dispensing_in.quantity}"
            )

        # 3. FEFO Deduction
        remaining = dispensing_in.quantity
        active_batches = (
            db.query(models.StockBatch)
            .filter(models.StockBatch.medicine_id == medicine.id, models.StockBatch.quantity_on_hand > 0)
            .order_by(models.StockBatch.expiry_date.asc(), models.StockBatch.received_at.asc())
            .all()
        )

        if not active_batches and remaining > 0:
            raise HTTPException(status_code=400, detail=f"No active batches found for {medicine.product_name}")

        adjustments = []
        for batch in active_batches:
            if remaining <= 0: break
            deduct_qty = min(remaining, batch.quantity_on_hand)
            batch.quantity_on_hand -= deduct_qty
            remaining -= deduct_qty

            # Audit record (don't add to DB yet, collect in list)
            adjustment = models.StockAdjustment(
                medicine_id=medicine.id,
                batch_id=batch.id,
                quantity_change=-deduct_qty,
                adjustment_type=models.StockAdjustmentType.DISPENSED,
                reason=f"Dispensed to {dispensing_in.patient_name} (Bulk/Single)",
                adjusted_by_user_id=user_id
            )
            adjustments.append(adjustment)
            db.add(adjustment)

        if remaining > 0:
            raise HTTPException(status_code=400, detail=f"Insufficient batch stock for {medicine.product_name}")

        # 4. Update core stock
        stock_record.quantity_on_hand -= dispensing_in.quantity
        stock_record.last_updated_at = datetime.now(timezone.utc)

        # 5. Persist Dispensing Record
        total_amount = round(dispensing_in.quantity * dispensing_in.unit_price)
        db_dispensing = models.Dispensing(
            dispensed_date=dispensing_in.dispensed_date,
            patient_name=dispensing_in.patient_name.strip(),
            medicine_id=medicine.id,
            quantity=dispensing_in.quantity,
            unit_price=dispensing_in.unit_price,
            gst_percent=dispensing_in.gst_percent,
            total_amount=total_amount,
            notes=dispensing_in.notes.strip() if dispensing_in.notes else None,
            recorded_by_user_id=user_id
        )
        db.add(db_dispensing)
        db.flush() # Obtain db_dispensing.id

        # Link all adjustments created in step 3
        for adj in adjustments:
            adj.dispensing_id = db_dispensing.id
            
        return db_dispensing

    @staticmethod
    def process_bulk_upload(db: Session, df: Any, user_id: int) -> Dict[str, Any]:
        """
        Processes a dataframe of dispensing records.
        """
        # Prep lookups
        medicines = {m.product_name.lower().strip(): m for m in db.query(models.Medicine).all()}
        
        success_count = 0
        errors = []
        
        # We wrap the whole loop in a transaction if desired, or per-row.
        # Given the "Validate First" approach, we'll try to process row by row here
        # but the router can wrap this in a single commit if needed.
        
        for index, row in df.iterrows():
            try:
                med_name = str(row.get('medicine_name', '')).lower().strip()
                medicine = medicines.get(med_name)
                
                if not medicine:
                    raise ValueError(f"Medicine '{row.get('medicine_name')}' not found in master.")

                qty = int(row['quantity'])
                dispensed_date = pd.to_datetime(row['date']).date()
                patient_name = str(row['patient_name'])
                notes = str(row.get('notes', '')) if not pd.isna(row.get('notes')) else None

                # Pricing Logic integration
                pricing = DispensingService.get_medicine_price(db, medicine)
                
                # Use provided price if exists, otherwise calculated
                unit_price = float(row.get('unit_price', pricing['unit_price'])) if not pd.isna(row.get('unit_price')) else pricing['unit_price']
                gst_percent = float(row.get('gst_percent', pricing['gst_percent'])) if not pd.isna(row.get('gst_percent')) else pricing['gst_percent']

                disp_in = schemas.DispensingCreate(
                    dispensed_date=dispensed_date,
                    patient_name=patient_name,
                    medicine_id=medicine.id,
                    quantity=qty,
                    unit_price=unit_price,
                    gst_percent=gst_percent,
                    notes=notes
                )

                DispensingService.record_dispensing_event(db, disp_in, user_id)
                success_count += 1

            except Exception as e:
                db.rollback() # Rollback the specific failed record transaction if using sub-transactions, but here we likely want to catch and report
                error_info = row.to_dict()
                error_info['error_reason'] = str(e)
                errors.append(error_info)
                continue
        
        return {
            "success_count": success_count,
            "errors": errors
        }
