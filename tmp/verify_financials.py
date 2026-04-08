import httpx
import os
from dotenv import load_dotenv

load_dotenv(dotenv_path="backend/.env", override=True)
BASE_URL = "http://localhost:8000"

def verify_financials():
    # 1. Login as Admin
    login_data = {"username": "admin", "password": "admin1234$"}
    res = httpx.post(f"{BASE_URL}/token", data=login_data)
    if res.status_code != 200:
        print("Login failed")
        return
    
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # 2. Check Valuation
    val_res = httpx.get(f"{BASE_URL}/financials/valuation", headers=headers)
    print(f"Valuation Status: {val_res.status_code}")
    if val_res.status_code == 200:
        print(f"Data: {val_res.json()}")
    
    # 3. Check Profit (Current Month)
    profit_res = httpx.get(f"{BASE_URL}/financials/profit", headers=headers)
    print(f"Profit Status: {profit_res.status_code}")
    if profit_res.status_code == 200:
        print(f"Profit Records Count: {len(profit_res.json())}")

if __name__ == "__main__":
    verify_financials()
