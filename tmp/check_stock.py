from app import models, database
from sqlalchemy.orm import Session

def check_stock_count():
    db = next(database.get_db())
    total_medicines = (
        db.query(models.MedicineStock)
        .filter(models.MedicineStock.quantity_on_hand > 0)
        .count()
    )
    print(f"Total Unique Medicines with Stock: {total_medicines}")
    
    # Check if there are any medicines at all
    total_catalog = db.query(models.Medicine).count()
    print(f"Total Medicines in Catalog: {total_catalog}")

if __name__ == "__main__":
    check_stock_count()
