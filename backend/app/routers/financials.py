"""
Financials Router (Admin Only).
Provides advanced business analytics including asset valuation, tax reconciliation, 
and profit margin calculations across the pharmacy's entire dataset.
"""
from datetime import date
from typing import List
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from app import models, schemas, database, auth, utils
from app.services import financial_service
from app.core.logging_config import logger

router = APIRouter(
    prefix="/financials",
    tags=["Financials"],
    dependencies=[Depends(auth.get_current_user)],
)

# Access restricted to Admin only
admin_required = auth.RoleChecker(["Admin"])

@router.get("/valuation", response_model=schemas.InventoryValuationSchema)
def get_inventory_valuation(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(admin_required)
):
    """Returns the total financial value of all current stock."""
    with utils.db_error_handler("fetching inventory valuation"):
        try:
            return financial_service.get_inventory_valuation(db)
        except Exception as e:
            logger.error(f"Unexpected error in get_inventory_valuation: {str(e)}", exc_info=True)
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to calculate inventory valuation.")


@router.get("/aging", response_model=List[schemas.SupplierAgingSchema])
def get_supplier_aging(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(admin_required)
):
    """Calculates outstanding debt per supplier by reconciling invoices and payments."""
    with utils.db_error_handler("fetching supplier aging"):
        try:
            return financial_service.get_supplier_aging(db)
        except Exception as e:
            logger.error(f"Unexpected error in get_supplier_aging: {str(e)}", exc_info=True)
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to calculate supplier aging.")


@router.get("/gst", response_model=schemas.GSTReconciliationSchema)
def get_gst_reconciliation(
    start_date: date = Query(default=None),
    end_date: date = Query(default=None),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(admin_required)
):
    """Calculates Input GST vs Output GST. Defaults to current month."""
    if not start_date or not end_date:
        today = date.today()
        start_date = today.replace(day=1)
        end_date = today

    with utils.db_error_handler("fetching GST reconciliation"):
        try:
            return financial_service.get_gst_reconciliation(db, start_date, end_date)
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
        except Exception as e:
            logger.error(f"Unexpected error in get_gst_reconciliation: {str(e)}", exc_info=True)
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to calculate GST reconciliation.")


@router.get("/profit", response_model=List[schemas.ProfitMarginSchema])
def get_profit_summary(
    start_date: date = Query(default=None),
    end_date: date = Query(default=None),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(admin_required)
):
    """Calculates Gross Profit per medicine for a given period."""
    if not start_date or not end_date:
        today = date.today()
        start_date = today.replace(day=1)
        end_date = today

    with utils.db_error_handler("fetching profit summary"):
        try:
            return financial_service.get_profit_summary(db, start_date, end_date)
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
        except Exception as e:
            logger.error(f"Unexpected error in get_profit_summary: {str(e)}", exc_info=True)
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to calculate profit summary.")


@router.get("/period-summary", response_model=schemas.PeriodSummaryReport)
def get_period_summary(
    start_date: date = Query(...),
    end_date: date = Query(...),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(admin_required)
):
    """Generates a high-level movement statement for a specific period."""
    with utils.db_error_handler("fetching period summary"):
        try:
            return financial_service.get_period_summary(db, start_date, end_date)
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
        except Exception as e:
            logger.error(f"Unexpected error in get_period_summary: {str(e)}", exc_info=True)
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error calculating summary.")


@router.get("/period-summary/export")
def export_period_summary(
    start_date: date = Query(...),
    end_date: date = Query(...),
    format: str = Query(..., regex="^(excel|pdf)$"),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(admin_required)
):
    """Exports the period summary report as Excel. (PDF handled on frontend)."""
    with utils.db_error_handler(f"exporting period summary ({format})"):
        try:
            summary = financial_service.get_period_summary(db, start_date, end_date)
            
            if format == "excel":
                output = financial_service.export_period_summary_excel(db, summary)
                filename = f"Portfolio_Summary_{start_date}_{end_date}.xlsx"
                return Response(
                    content=output.getvalue(),
                    media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    headers={"Content-Disposition": f"attachment; filename={filename}"}
                )
            else:
                # PDF should be generated on frontend as per updated plan
                raise HTTPException(status_code=400, detail="PDF export should be handled via frontend reporting service.")
                
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            logger.error(f"Export error: {str(e)}")
            raise HTTPException(status_code=500, detail="Failed to generate export file.")

