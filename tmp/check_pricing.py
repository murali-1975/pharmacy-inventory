from app import models, database, schemas
from app.services.dispensing_service import DispensingService
from sqlalchemy.orm import Session

def check_stock_pricing():
    db = next(database.get_db())
    # Query stock
    items = db.query(models.MedicineStock).all()
    print(f"Checking {len(items)} stock items...")
    
    for item in items:
        if item.medicine:
            pricing = DispensingService.get_medicine_price(db, item.medicine)
            print(f"Medicine: {item.medicine.product_name}")
            print(f"  Calculated Price: {pricing['unit_price']}")
            print(f"  GST %: {pricing['gst_percent']}")
            
            # Simulate what the router does
            item_schema = schemas.MedicineStockSchema.model_validate(item)
            # The router manually populates these fields
            item_schema.unit_price = pricing["unit_price"]
            item_schema.gst_percent = pricing["gst_percent"]
            
            print(f"  Schema Price: {item_schema.unit_price}")
            print(f"  Schema GST: {item_schema.gst_percent}")
            print("-" * 20)

if __name__ == "__main__":
    check_stock_pricing()
