import pytest
from app import models

# Note: We use the 'client' fixture from conftest.py which 
# already sets up a mock 'Admin' user and handles DB overrides.

@pytest.mark.integration
def test_soft_delete_supplier_type_by_default(client):
    """
    Verify that deleting a supplier type defaults to a soft delete (is_active=False).
    """
    # 1. Create a type
    res = client.post("/lookups/supplier-types/", json={"name": "Test Type Unique"})
    assert res.status_code == 200
    type_id = res.json()["id"]

    # 2. Delete it (default)
    del_res = client.delete(f"/lookups/supplier-types/{type_id}")
    assert del_res.status_code == 200
    assert "deactivated" in del_res.json()["message"]

    # 3. Verify it still exists but is inactive
    get_res = client.get("/lookups/supplier-types/?include_inactive=true")
    # Admin sees all (with the flag), so it should be there with is_active=False
    types = get_res.json()
    test_type = next((t for t in types if t["id"] == type_id), None)
    assert test_type is not None
    assert test_type["is_active"] is False

@pytest.mark.integration
def test_hard_delete_supplier_type_explicit(client):
    """
    Verify that passing hard=true correctly performs a destructive delete.
    """
    # 1. Create a type
    res = client.post("/lookups/supplier-types/", json={"name": "Hard Delete Type Unique"})
    assert res.status_code == 200
    type_id = res.json()["id"]

    # 2. Hard delete it
    del_res = client.delete(f"/lookups/supplier-types/{type_id}?hard=true")
    assert del_res.status_code == 200
    assert "permanently deleted" in del_res.json()["message"]

    # 3. Verify it is gone
    get_res = client.get("/lookups/supplier-types/")
    types = get_res.json()
    test_type = next((t for t in types if t["id"] == type_id), None)
    assert test_type is None

@pytest.mark.integration
def test_soft_delete_status_by_default(client):
    """
    Verify that deleting a status defaults to deactivation.
    """
    res = client.post("/lookups/status/", json={"name": "Test Status Unique"})
    assert res.status_code == 200
    status_id = res.json()["id"]

    del_res = client.delete(f"/lookups/status/{status_id}")
    assert del_res.status_code == 200
    
    get_res = client.get("/lookups/status/?include_inactive=true")
    statuses = get_res.json()
    test_status = next((s for s in statuses if s["id"] == status_id), None)
    assert test_status["is_active"] is False
