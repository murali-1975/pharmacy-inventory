import pytest
import datetime
from app import models

@pytest.mark.ledger
class TestInventoryLedger:
    """
    Permanent test suite for the Inventory Ledger feature.
    Verifies movements, opening balances, and reporting logic.
    """

    def test_ledger_complete_movement(self, client, db):
        # 1. Setup Medicine
        med = models.Medicine(
            product_name="Ledger Sync Test", 
            generic_name="Sync Generic", 
            category="GENERAL", 
            uom="Tablets"
        )
        db.add(med)
        db.commit()
        db.refresh(med)

        # 2. Historical (May) - Opening Balance of 1000
        db.add(models.StockAdjustment(
            medicine_id=med.id,
            quantity_change=1000,
            adjustment_type=models.StockAdjustmentType.OPENING_BALANCE,
            reason="FY Start",
            adjusted_by_user_id=1,
            adjusted_at=datetime.datetime(2024, 5, 1)
        ))

        # 3. June Movements
        # Add 500 (Invoice)
        db.add(models.StockAdjustment(
            medicine_id=med.id,
            quantity_change=500,
            adjustment_type=models.StockAdjustmentType.INVOICE_RECEIPT,
            reason="Purchase #123",
            adjusted_by_user_id=1,
            adjusted_at=datetime.datetime(2024, 6, 10)
        ))
        # Subtract 200 (Dispensing)
        db.add(models.StockAdjustment(
            medicine_id=med.id,
            quantity_change=-200,
            adjustment_type=models.StockAdjustmentType.DISPENSED,
            reason="Daily Sales",
            adjusted_by_user_id=1,
            adjusted_at=datetime.datetime(2024, 6, 20)
        ))
        db.commit()

        # 4. Request Ledger for June (with large limit to avoid pagination issues)
        res = client.get("/stock/ledger", params={
            "from_date": "2024-06-01", 
            "to_date": "2024-06-30",
            "limit": 1000
        })
        assert res.status_code == 200
        data = res.json()

        # Find our medicine
        item = next(i for i in data["items"] if i["medicine_id"] == med.id)
        assert item["opening_balance"] == 1000
        assert item["quantity_in"] == 500
        assert item["quantity_out"] == 200
        assert item["stock_in_hand"] == 1300

    def test_ledger_zero_activity(self, client, db):
        # Medicine with NO movements in the period
        med = models.Medicine(product_name="Static Med", category="GENERAL", uom="Tablets")
        db.add(med)
        db.commit()
        db.refresh(med)
        
        # Opening adjustment in May
        db.add(models.StockAdjustment(
            medicine_id=med.id, 
            quantity_change=50, 
            adjustment_type=models.StockAdjustmentType.OPENING_BALANCE,
            reason="Baseline",
            adjusted_by_user_id=1,
            adjusted_at=datetime.datetime(2024, 5, 1)
        ))
        db.commit()

        # Check June (No changes) - Use large limit to ensure medicine is found
        res = client.get("/stock/ledger", params={
            "from_date": "2024-06-01", 
            "to_date": "2024-06-30",
            "limit": 1000
        })
        data = res.json()
        item = next(i for i in data["items"] if i["medicine_id"] == med.id)
        
        assert item["opening_balance"] == 50
        assert item["quantity_in"] == 0
        assert item["quantity_out"] == 0
        assert item["stock_in_hand"] == 50
