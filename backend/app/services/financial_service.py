"""
Financial Service module.
Handles business logic, complex data aggregation, and logging for financial reports.
"""
from datetime import date, timedelta
import pandas as pd
import io
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func, case, or_, and_
from app import models, schemas
from app.core.logging_config import logger


def export_period_summary_excel(db: Session, summary: Dict[str, Any]) -> io.BytesIO:
    """
    Generates an Excel spreadsheet for the period summary.
    Includes the high-level movement statement and a timestamp.
    """
    logger.info(f"Generating Excel export for period summary: {summary['start_date']} to {summary['end_date']}")
    
    data = [
        {"Description": "Opening Inventory Value", "Amount (₹)": summary["opening_valuation"]},
        {"Description": "Inventory Value Added (+)", "Amount (₹)": summary["inventory_added"]},
        {"Description": "Revenue from Goods Sold", "Amount (₹)": summary["revenue"]},
        {"Description": "Cost of Goods Sold (-)", "Amount (₹)": summary["cost_of_goods_sold"]},
        {"Description": "Gross Profit", "Amount (₹)": summary["gross_profit"]},
        {"Description": "Closing Inventory Value", "Amount (₹)": summary["closing_valuation"]}
    ]
    
    df = pd.DataFrame(data)
    
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Period Portfolio Summary')
        
    output.seek(0)
    return output

def get_inventory_valuation(db: Session) -> Dict[str, Any]:
    """Calculates the total financial value of all current stock, including both batches and batch-less adjustments."""
    logger.info("Calculating total inventory valuation (Comprehensive).")
    
    # 1. Valuation from identified batches
    batch_stats = db.query(
        func.sum(models.StockBatch.quantity_on_hand * models.StockBatch.purchase_price).label("cost_val"),
        func.sum(models.StockBatch.quantity_on_hand * models.StockBatch.mrp).label("mrp_val"),
        func.count(func.distinct(models.StockBatch.medicine_id)).label("med_count"),
        func.count(models.StockBatch.id).label("batch_count")
    ).filter(models.StockBatch.quantity_on_hand > 0).first()

    # 2. Valuation from "Batch-less" stock (Total Stock - Sum of Batch Stock)
    # This captures stock increased via Manual Adjustments that didn't target a batch.
    batch_sum_sub = db.query(
        models.StockBatch.medicine_id,
        func.sum(models.StockBatch.quantity_on_hand).label("sum_qty")
    ).group_by(models.StockBatch.medicine_id).subquery()

    batchless_stats = db.query(
        func.sum(
            case(
                (models.MedicineStock.quantity_on_hand > func.coalesce(batch_sum_sub.c.sum_qty, 0),
                 models.MedicineStock.quantity_on_hand - func.coalesce(batch_sum_sub.c.sum_qty, 0)),
                else_=0
            ) * func.coalesce(models.Medicine.unit_price, 0)
        )
    ).select_from(models.MedicineStock)\
     .join(models.Medicine, models.MedicineStock.medicine_id == models.Medicine.id)\
     .outerjoin(batch_sum_sub, models.MedicineStock.medicine_id == batch_sum_sub.c.medicine_id)\
     .scalar() or 0.0

    total_cost = float(batch_stats.cost_val or 0.0) + float(batchless_stats or 0.0)
    
    result = {
        "total_cost_value": round(total_cost, 2),
        "total_mrp_value": float(batch_stats.mrp_val or 0.0),
        "medicine_count": int(batch_stats.med_count or 0),
        "batch_count": int(batch_stats.batch_count or 0)
    }
    logger.debug(f"Comprehensive Inventory Valuation Result: {result}")
    return result


def get_supplier_aging(db: Session) -> List[Dict[str, Any]]:
    """Calculates outstanding debt per supplier by reconciling invoices and payments."""
    logger.info("Calculating supplier aging report.")
    
    # 1. Total Invoiced per Supplier
    invoices = db.query(
        models.Supplier.id.label("sup_id"),
        models.Supplier.supplier_name.label("sup_name"),
        func.sum(models.Invoice.total_value).label("total_inv")
    ).join(models.Invoice).filter(
        (models.Invoice.status != models.InvoiceStatus.Cancelled) | (models.Invoice.status == None)
    ).group_by(models.Supplier.id, models.Supplier.supplier_name).all()

    # 2. Total Paid per Supplier
    payments = db.query(
        models.Invoice.supplier_id.label("sup_id"),
        func.sum(models.InvoicePayment.paid_amount).label("total_paid")
    ).join(models.InvoicePayment, models.Invoice.id == models.InvoicePayment.invoice_id)\
     .filter(
        (models.Invoice.status != models.InvoiceStatus.Cancelled) | (models.Invoice.status == None)
     ).group_by(models.Invoice.supplier_id).all()

    pay_map = {p.sup_id: float(p.total_paid or 0.0) for p in payments}
    
    result = []
    for inv in invoices:
        paid = pay_map.get(inv.sup_id, 0.0)
        total_inv = float(inv.total_inv or 0.0)
        balance = total_inv - paid
        result.append({
            "supplier_id": inv.sup_id,
            "supplier_name": inv.sup_name,
            "total_invoiced": total_inv,
            "total_paid": paid,
            "balance_due": balance
        })
    
    sorted_result = sorted(result, key=lambda x: x["balance_due"], reverse=True)
    logger.info(f"Supplier aging calculated for {len(sorted_result)} suppliers.")
    return sorted_result


def get_gst_reconciliation(db: Session, start_date: date, end_date: date) -> Dict[str, Any]:
    """Calculates Input GST (from purchases) vs Output GST (from sales)."""
    if start_date > end_date:
        logger.error(f"Invalid date range for GST reconciliation: {start_date} to {end_date}")
        raise ValueError("start_date cannot be after end_date")
        
    logger.info(f"Calculating GST reconciliation from {start_date} to {end_date}.")
    
    # Input GST (from Invoice Line Items)
    input_gst = db.query(func.sum(models.InvoiceLineItem.gst)).join(models.Invoice)\
        .filter(models.Invoice.invoice_date >= start_date, models.Invoice.invoice_date <= end_date, 
                models.Invoice.status != models.InvoiceStatus.Cancelled).scalar() or 0.0
    
    # Output GST (from Dispensing records)
    output_gst = db.query(func.sum(models.Dispensing.quantity * models.Dispensing.unit_price * (models.Dispensing.gst_percent/100)))\
        .filter(models.Dispensing.dispensed_date >= start_date, models.Dispensing.dispensed_date <= end_date).scalar() or 0.0

    result = {
        "start_date": start_date,
        "end_date": end_date,
        "input_gst": float(input_gst),
        "output_gst": float(output_gst),
        "net_gst_liability": float(output_gst - input_gst)
    }
    logger.debug(f"GST Reconciliation Result: {result}")
    return result


def get_profit_summary(db: Session, start_date: date, end_date: date) -> List[Dict[str, Any]]:
    """Calculates Gross Profit per medicine for a given period."""
    if start_date > end_date:
        logger.error(f"Invalid date range for profit summary: {start_date} to {end_date}")
        raise ValueError("start_date cannot be after end_date")

    logger.info(f"Calculating profit summary from {start_date} to {end_date}.")
    
    query = db.query(
        models.Medicine.id.label("med_id"),
        models.Medicine.product_name.label("med_name"),
        func.sum(models.Dispensing.quantity).label("total_qty"),
        func.sum(models.Dispensing.total_amount).label("total_revenue"),
        func.sum(
            func.abs(models.StockAdjustment.quantity_change) * models.StockBatch.purchase_price
        ).label("cogs")
    ).join(models.Dispensing, models.Medicine.id == models.Dispensing.medicine_id)\
     .outerjoin(models.StockAdjustment, models.Dispensing.id == models.StockAdjustment.dispensing_id)\
     .outerjoin(models.StockBatch, models.StockAdjustment.batch_id == models.StockBatch.id)\
     .filter(models.Dispensing.dispensed_date >= start_date, models.Dispensing.dispensed_date <= end_date)\
     .group_by(models.Medicine.id, models.Medicine.product_name).all()

    result = []
    for row in query:
        revenue = float(row.total_revenue or 0.0)
        cogs = float(row.cogs or 0.0)
        
        if row.total_qty > 0 and cogs == 0:
            logger.warning(f"Medicine '{row.med_name}' (ID: {row.med_id}) has sales but 0 COGS. Attempting estimation fallback.")
            avg_cost = db.query(func.avg(models.StockBatch.purchase_price))\
                .filter(models.StockBatch.medicine_id == row.med_id).scalar() or 0.0
            cogs = float(row.total_qty) * float(avg_cost)

        profit = revenue - cogs
        result.append({
            "medicine_id": row.med_id,
            "medicine_name": row.med_name,
            "quantity_sold": int(row.total_qty or 0),
            "revenue": revenue,
            "cost_of_goods_sold": cogs,
            "gross_profit": profit,
            "margin_percent": (profit / revenue * 100) if revenue > 0 else 0.0
        })
        
    sorted_result = sorted(result, key=lambda x: x["gross_profit"], reverse=True)
    logger.info(f"Profit summary calculated for {len(sorted_result)} medicines.")
    return sorted_result


def get_period_summary(db: Session, start_date: date, end_date: date) -> Dict[str, Any]:
    """
    Calculates the detailed movement statement for a given period.
    Logic:
    - Opening/Closing Valuation: Reconstructs batch state at T using audit trail.
    - Purchases Value: Sum of INVOICE_RECEIPT adjustments.
    - Initial Stock Value: Sum of OPENING_BALANCE adjustments.
    - Revenue: Sum of total_amount from Dispensing records.
    - COGS: Sum of DISPENSED adjustments at cost.
    - Adjustments: Sum of MANUAL_ADJUSTMENT.
    - Write-offs: Sum of WRITE_OFF.
    """
    if start_date > end_date:
        logger.error(f"Invalid date range for period summary: {start_date} to {end_date}")
        raise ValueError("start_date cannot be after end_date")

    logger.info(f"Generating Period Portfolio Summary from {start_date} to {end_date}.")

    # 1. Opening/Closing Valuation
    opening_val = _get_valuation_at_date(db, start_date)
    closing_val = _get_valuation_at_date(db, end_date + timedelta(days=1))

    # Helper for summed valuation of specific adjustment types
    def get_adj_sum(types: list):
        return db.query(
            func.sum(models.StockAdjustment.quantity_change * func.coalesce(models.StockBatch.purchase_price, models.Medicine.unit_price, 0))
        ).select_from(models.Medicine)\
         .join(models.StockAdjustment, models.StockAdjustment.medicine_id == models.Medicine.id)\
         .outerjoin(models.StockBatch, models.StockAdjustment.batch_id == models.StockBatch.id)\
         .filter(
             models.StockAdjustment.adjustment_type.in_(types),
             func.date(models.StockAdjustment.adjusted_at) >= start_date,
             func.date(models.StockAdjustment.adjusted_at) <= end_date
         ).scalar() or 0.0

    # 2. Movement Breakdowns
    purchases_val = get_adj_sum([models.StockAdjustmentType.INVOICE_RECEIPT])
    initial_stock_val = get_adj_sum([models.StockAdjustmentType.OPENING_BALANCE])
    # For general adjustments, exclude sale reversals (which are handled in COGS)
    adjustments_val = db.query(
        func.sum(models.StockAdjustment.quantity_change * func.coalesce(models.StockBatch.purchase_price, models.Medicine.unit_price, 0))
    ).select_from(models.Medicine)\
     .join(models.StockAdjustment, models.StockAdjustment.medicine_id == models.Medicine.id)\
     .outerjoin(models.StockBatch, models.StockAdjustment.batch_id == models.StockBatch.id)\
     .filter(
         models.StockAdjustment.adjustment_type == models.StockAdjustmentType.MANUAL_ADJUSTMENT,
         ~models.StockAdjustment.reason.ilike("Reversal of cancelled dispensing%"),
         func.date(models.StockAdjustment.adjusted_at) >= start_date,
         func.date(models.StockAdjustment.adjusted_at) <= end_date
     ).scalar() or 0.0
    
    write_offs_val = get_adj_sum([models.StockAdjustmentType.WRITE_OFF])

    # 3. Revenue & COGS
    revenue = db.query(
        func.sum(models.Dispensing.total_amount)
    ).filter(
        models.Dispensing.dispensed_date >= start_date,
        models.Dispensing.dispensed_date <= end_date
    ).scalar() or 0.0

    cogs_val = db.query(
        func.sum(-models.StockAdjustment.quantity_change * func.coalesce(models.StockBatch.purchase_price, models.Medicine.unit_price, 0))
    ).select_from(models.Medicine)\
     .join(models.StockAdjustment, models.StockAdjustment.medicine_id == models.Medicine.id)\
     .outerjoin(models.StockBatch, models.StockAdjustment.batch_id == models.StockBatch.id)\
     .filter(
         and_(
            or_(
                models.StockAdjustment.adjustment_type == models.StockAdjustmentType.DISPENSED,
                and_(
                    models.StockAdjustment.adjustment_type == models.StockAdjustmentType.MANUAL_ADJUSTMENT,
                    models.StockAdjustment.reason.ilike("Reversal of cancelled dispensing%")
                )
            ),
            func.date(models.StockAdjustment.adjusted_at) >= start_date,
            func.date(models.StockAdjustment.adjusted_at) <= end_date
         )
     ).scalar() or 0.0

    return {
        "opening_valuation": float(opening_val),
        "purchases_value": float(purchases_val),
        "initial_stock_value": float(initial_stock_val),
        "revenue": float(revenue),
        "cost_of_goods_sold": float(cogs_val),
        "adjustments_value": float(adjustments_val),
        "write_offs_value": float(write_offs_val),
        "gross_profit": float(revenue) - float(cogs_val),
        "closing_valuation": float(closing_val),
        "start_date": start_date,
        "end_date": end_date
    }


def _get_valuation_at_date(db: Session, target_date: date) -> float:
    """
    Internal helper to reconstruct stock valuation as of T (start of day).
    Algorithm: Valuation at T = (Total Current Valuation) - (Net Value change from adjustments after T)
    This is mathematically robust for batches, manual adjustments, and initializations.
    """
    # 1. Total CURRENT valuation (at cost)
    # Includes all batches + any batch-less stock quantity at master unit price
    current_val = get_inventory_valuation(db)["total_cost_value"]

    # 2. Total Value of all adjustments that happened from target_date to NOW
    # Each adjustment's value is (qty_change * purchase_price_at_time)
    future_value_change = db.query(
        func.sum(
            models.StockAdjustment.quantity_change * 
            func.coalesce(models.StockBatch.purchase_price, models.Medicine.unit_price, 0)
        )
    ).select_from(models.StockAdjustment)\
     .outerjoin(models.StockBatch, models.StockAdjustment.batch_id == models.StockBatch.id)\
     .join(models.Medicine, models.StockAdjustment.medicine_id == models.Medicine.id)\
     .filter(func.date(models.StockAdjustment.adjusted_at) >= target_date)\
     .scalar() or 0.0

    # Valuation then = Valuation now - Change since then
    return float(current_val - future_value_change)
