"""
Financial Service module.
Handles business logic, complex data aggregation, and logging for financial reports.
"""
from datetime import date
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func
from app import models, schemas
from app.core.logging_config import logger

def get_inventory_valuation(db: Session) -> Dict[str, Any]:
    """Calculates the total financial value of all current stock."""
    logger.info("Calculating total inventory valuation.")
    stats = db.query(
        func.sum(models.StockBatch.quantity_on_hand * models.StockBatch.purchase_price).label("cost_val"),
        func.sum(models.StockBatch.quantity_on_hand * models.StockBatch.mrp).label("mrp_val"),
        func.count(func.distinct(models.StockBatch.medicine_id)).label("med_count"),
        func.count(models.StockBatch.id).label("batch_count")
    ).filter(models.StockBatch.quantity_on_hand > 0).first()

    result = {
        "total_cost_value": float(stats.cost_val or 0.0),
        "total_mrp_value": float(stats.mrp_val or 0.0),
        "medicine_count": int(stats.med_count or 0),
        "batch_count": int(stats.batch_count or 0)
    }
    logger.debug(f"Inventory Valuation Result: {result}")
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
