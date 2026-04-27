import sqlite3
import os

db_path = 'backend/pharmacy_inventory.db'
if not os.path.exists(db_path):
    print(f"Error: {db_path} not found")
    exit(1)

conn = sqlite3.connect(db_path)
c = conn.cursor()

columns_to_add = [
    ('patient_payment', 'is_deleted', 'BOOLEAN DEFAULT 0'),
    ('patient_payment', 'deleted_by', 'INTEGER'),
    ('patient_payment', 'deleted_at', 'DATETIME'),
    ('expenses', 'is_deleted', 'BOOLEAN DEFAULT 0'),
    ('expenses', 'deleted_by', 'INTEGER'),
    ('expenses', 'deleted_at', 'DATETIME')
]

for table, col, dtype in columns_to_add:
    try:
        print(f"Adding {col} to {table}...", end=" ")
        c.execute(f"ALTER TABLE {table} ADD COLUMN {col} {dtype}")
        print("Success.")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e):
            print("Already exists.")
        else:
            print(f"Failed: {e}")

conn.commit()
conn.close()
print("Migration check complete.")
