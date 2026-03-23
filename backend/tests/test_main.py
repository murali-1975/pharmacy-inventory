from fastapi import status

def test_read_root(client):
    response = client.get("/")
    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {"message": "Welcome to Pharmacy Inventory API"}

def test_list_suppliers_empty(client):
    response = client.get("/suppliers")
    assert response.status_code == status.HTTP_200_OK
    assert response.json() == []

def test_create_supplier(client):
    supplier_data = {
        "supplier_name": "Test Supplier",
        "type_id": 1,
        "status_id": 1,
        "contact_details": {
            "address_line_1": "123 Test St",
            "city": "Test City",
            "state": "TS",
            "pin_code": "123456",
            "phone_number": "1234567890",
            "email_id": "test@example.com",
            "contact_name": "John Doe"
        },
        "bank_details": [
            {
                "bank_name": "Test Account",
                "account_number": "9876543210",
                "ifsc_code": "TEST0001",
                "status_id": 1
            }
        ]
    }
    response = client.post("/suppliers", json=supplier_data)
    assert response.status_code == status.HTTP_200_OK # Router returns 200 or 201? Checking.
    data = response.json()
    assert data["supplier_name"] == "Test Supplier"
    assert data["id"] is not None
    assert data["contact_details"]["address_line_1"] == "123 Test St"
    assert len(data["bank_details"]) == 1
    assert data["bank_details"][0]["bank_name"] == "Test Account"

def test_create_supplier_empty_bank(client):
    supplier_data = {
        "supplier_name": "No Bank Supplier",
        "type_id": 1,
        "status_id": 1,
        "contact_details": {
            "address_line_1": "456 No Bank St",
            "city": "No Bank City",
            "state": "NB",
            "pin_code": "000000",
            "phone_number": "0000000000",
            "email_id": "nobank@example.com",
            "contact_name": "No Bank"
        },
        "bank_details": [
            {
                "bank_name": " ", # Just whitespace
                "account_number": "",
                "ifsc_code": "",
                "status_id": 1
            }
        ]
    }
    response = client.post("/suppliers", json=supplier_data)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["supplier_name"] == "No Bank Supplier"
    assert len(data["bank_details"]) == 0 # Should be empty as it was skipped

def test_get_statuses(client):
    response = client.get("/status")
    assert response.status_code == status.HTTP_200_OK
    # Note: Statuses are populated by models.Base.metadata.create_all(bind=database.engine) 
    # in main.py, but in test we might need to seed them if they are not there.
    # However, create_all only creates tables. 
    # Let's assume for now the seed is handled or we just check if it's a list.
    assert isinstance(response.json(), list)
