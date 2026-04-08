import csv
import json
import requests
import sys
from datetime import datetime

# --- Configuration ---
API_BASE_URL = "http://localhost:8000"  # Update if your backend runs on a different port
# You need to generate a token or directly use an admin token to perform this bulk action
# We can authenticate the script using standard admin credentials
USERNAME = "admin"
PASSWORD = "admin1234$"

def get_auth_token():
    """Authenticate and get JWT token from the API."""
    print("Authenticating...")
    data = {"username": USERNAME, "password": PASSWORD}
    try:
        response = requests.post(f"{API_BASE_URL}/token", data=data)
        response.raise_for_status()
        return response.json()["access_token"]
    except requests.exceptions.RequestException as e:
        print(f"Authentication failed: {e}")
        sys.exit(1)

def bulk_import_dispensing(csv_filepath, token):
    """Read CSV and POST each dispensing record to the API."""
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    success_count = 0
    failure_count = 0
    failures = []

    print(f"\nStarting import from {csv_filepath}...\n")
    
    with open(csv_filepath, mode='r', encoding='utf-8-sig') as file:
        reader = csv.DictReader(file)
        
        # Expected CSV columns:
        # dispensed_date, patient_name, medicine_id, quantity, unit_price, gst_percent, notes
        
        for row_num, raw_row in enumerate(reader, start=2): # Start at 2 because row 1 is header
            try:
                # Clean up headers (remove trailing spaces like "notes ")
                row = {k.strip() if k else k: v.strip() if v else '' for k, v in raw_row.items()}
                
                # Skip empty lines (where all essential fields are missing)
                if not row.get("medicine_id") and not row.get("dispensed_date"):
                    continue

                # Basic validation & type casting
                payload = {
                    "dispensed_date": row["dispensed_date"],  # Format: "YYYY-MM-DD"
                    "patient_name": row["patient_name"],
                    "medicine_id": int(row["medicine_id"]),
                    "quantity": int(row["quantity"]),
                    "unit_price": float(row["unit_price"]) if row.get("unit_price") else 0.0,
                    "gst_percent": float(row["gst_percent"]) if row.get("gst_percent") else 0.0,
                    "notes": row.get("notes") or None
                }
                
                # Make the API call
                response = requests.post(
                    f"{API_BASE_URL}/dispensing/", 
                    headers=headers, 
                    json=payload
                )
                
                if response.status_code == 201:
                    print(f"[Row {row_num}] SUCCESS: Dispensed to {payload['patient_name']}")
                    success_count += 1
                else:
                    error_msg = response.json().get('detail', response.text)
                    print(f"[Row {row_num}] FAILED: {error_msg}")
                    failure_count += 1
                    failures.append({"row": row_num, "data": row, "error": error_msg})
                    
            except ValueError as ve:
                print(f"[Row {row_num}] FAILED CASTING DATA: {ve}. Please check numbers/dates format.")
                failure_count += 1
                failures.append({"row": row_num, "data": row, "error": str(ve)})
            except KeyError as ke:
                print(f"[Row {row_num}] MISSING COLUMN: The CSV is missing standard column: {ke}")
                sys.exit(1)
            except Exception as e:
                print(f"[Row {row_num}] UNEXPECTED ERROR: {e}")
                failure_count += 1
                failures.append({"row": row_num, "data": row, "error": str(e)})

    # Summary
    print("\n" + "="*40)
    print("IMPORT COMPLETE")
    print(f"Successfully imported: {success_count}")
    print(f"Failed to import   : {failure_count}")
    print("="*40)
    
    # Save a report for failed rows if any
    if failures:
        report_file = f"failed_imports_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_file, 'w', encoding='utf-8') as rf:
            json.dump(failures, rf, indent=4)
        print(f"See {report_file} for detailed failure messages.")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python import_from_csv.py <path_to_csv_file>")
        print("Example: python import_from_csv.py legacy_dispensed_data.csv")
        sys.exit(1)
        
    csv_file = sys.argv[1]
    token = get_auth_token()
    bulk_import_dispensing(csv_file, token)
