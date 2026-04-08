import psycopg2
import os
from dotenv import load_dotenv

load_dotenv(dotenv_path="backend/.env", override=True)
DB_URL = os.getenv("DATABASE_URL")

def migrate():
    conn = None
    try:
        conn = psycopg2.connect(DB_URL)
        cur = conn.cursor()
        
        # Add column if not exists
        cur.execute("""
            ALTER TABLE stock_adjustments 
            ADD COLUMN IF NOT EXISTS dispensing_id INTEGER REFERENCES dispensing(id);
        """)
        
        conn.commit()
        print("Migration successful: Added dispensing_id to stock_adjustments.")
        cur.close()
    except Exception as e:
        print(f"Migration failed: {e}")
        if conn:
            conn.rollback()
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    migrate()
