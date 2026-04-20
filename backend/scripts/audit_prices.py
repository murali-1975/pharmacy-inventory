import os
import sys
from sqlalchemy import create_engine, func
from sqlalchemy.orm import sessionmaker

# Add backend to path for imports
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import models

# Database URL for Docker
SQLALCHEMY_DATABASE_URL = "postgresql://postgres:admin@localhost:5432/pharmacy_inventory"

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def audit_pricing():
    db = SessionLocal()
    try:
        print("\n" + "="*60)
        print("PHARMACY PRICING AUDIT")
        print("="*60)

        # 1. Check for batches where Cost >= MRP
        print("\n1. Batches where Purchase Price >= MRP (Low/Negative Margin):")
        batches = db.query(
            models.Medicine.product_name,
            models.StockBatch.batch_no,
            models.StockBatch.purchase_price,
            models.StockBatch.mrp
        ).join(models.Medicine).filter(models.StockBatch.purchase_price >= models.StockBatch.mrp).all()

        if not batches:
            print("   ✅ No anomalies found in batch pricing.")
        else:
            print(f"{'Medicine':<30} | {'Batch':<15} | {'Cost':<10} | {'MRP':<10}")
            print("-" * 75)
            for b in batches:
                print(f"{b.product_name[:30]:<30} | {b.batch_no:<15} | {b.purchase_price:<10} | {b.mrp:<10}")

        # 2. Check for Master Medicines where Unit Price (Cost) > Selling Price estimation
        # Note: We don't have a direct 'selling_price' in the master, but we have unit_price.
        # If unit_price in Master is used for Opening Stock, it becomes the cost.
        print("\n2. Master Records with potentially inflated Unit Price:")
        medicines = db.query(models.Medicine).filter(models.Medicine.unit_price > 500).all() # Arbitrary high threshold for audit
        if medicines:
            print(f"{'Medicine':<30} | {'Master Unit Price':<20}")
            print("-" * 55)
            for m in medicines:
                print(f"{m.product_name[:30]:<30} | {m.unit_price:<20}")

        # 3. Check for Dispensing where Sold Price < Cost Price (Re-check historical losses)
        print("\n3. Historical Dispensing events with Negative Margin (Post-Patch):")
        losses = db.query(
            models.Dispensing.dispensed_date,
            models.Medicine.product_name,
            models.Dispensing.quantity,
            models.Dispensing.unit_price,
            models.StockBatch.purchase_price
        ).join(models.Medicine, models.Dispensing.medicine_id == models.Medicine.id)\
         .join(models.StockAdjustment, models.StockAdjustment.dispensing_id == models.Dispensing.id)\
         .join(models.StockBatch, models.StockAdjustment.batch_id == models.StockBatch.id)\
         .filter(models.Dispensing.unit_price < models.StockBatch.purchase_price).all()

        if not losses:
            print("   ✅ No negative margin dispensing events found (Post-Patch).")
        else:
            print(f"{'Date':<12} | {'Medicine':<30} | {'Sold':<8} | {'Cost':<8}")
            print("-" * 65)
            for l in losses:
                print(f"{str(l.dispensed_date):<12} | {l.product_name[:30]:<30} | {l.unit_price:<8} | {l.purchase_price:<8}")

        print("\nAudit Complete.")
        print("="*60 + "\n")

    finally:
        db.close()

if __name__ == "__main__":
    audit_pricing()
