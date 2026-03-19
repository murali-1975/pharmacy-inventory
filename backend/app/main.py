from fastapi import FastAPI, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import date
import datetime

from . import models, database

# Create tables (for initial development without Alembic running)
from fastapi.middleware.cors import CORSMiddleware

models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="Pharmacy Inventory API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Pydantic Schemas ---

class BankDetailBase(BaseModel):
    account_name: Optional[str] = None
    account_number: Optional[str] = None
    ifsc_code: Optional[str] = None
    bank_reference: Optional[str] = None
    remarks: Optional[str] = None
    status: str = "Active"

class BankDetailCreate(BankDetailBase):
    pass

class BankDetail(BankDetailBase):
    id: int
    supplier_id: int

    class Config:
        from_attributes = True

class SupplierBase(BaseModel):
    name: str
    supplier_type: Optional[str] = None
    status: str = "Active"

class SupplierCreate(SupplierBase):
    bank_details: List[BankDetailCreate] = []

class SupplierUpdate(BaseModel):
    name: Optional[str] = None
    supplier_type: Optional[str] = None
    status: Optional[str] = None

class Supplier(SupplierBase):
    id: int
    is_deleted: bool
    deleted_at: Optional[datetime.datetime] = None
    bank_details: List[BankDetail] = []

    class Config:
        from_attributes = True

class LineItem(BaseModel):
    medicine_name: str
    quantity: int
    price: float
    discount: float = 0.0
    expiry_date: date
    remarks: str = ""

class InvoiceUpload(BaseModel):
    supplier_id: int
    invoice_date: date
    reference_number: str
    total_value: float
    gst: float = 0.0
    line_items: List[LineItem]

# --- Endpoints ---

@app.get("/")
def read_root():
    return {"message": "Welcome to Pharmacy Inventory API"}

# --- Supplier Endpoints ---

@app.post("/suppliers", response_model=Supplier, status_code=status.HTTP_201_CREATED)
def create_supplier(supplier: SupplierCreate, db: Session = Depends(database.get_db)):
    db_supplier = models.Supplier(
        name=supplier.name,
        supplier_type=supplier.supplier_type,
        status=supplier.status
    )
    db.add(db_supplier)
    db.commit()
    db.refresh(db_supplier)
    
    for bank_data in supplier.bank_details:
        db_bank = models.SupplierBankDetail(**bank_data.model_dump(), supplier_id=db_supplier.id)
        db.add(db_bank)
    
    db.commit()
    db.refresh(db_supplier)
    return db_supplier

@app.get("/suppliers", response_model=List[Supplier])
def list_suppliers(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db), include_deleted: bool = False):
    query = db.query(models.Supplier)
    if not include_deleted:
        query = query.filter(models.Supplier.is_deleted == False)
    return query.offset(skip).limit(limit).all()

@app.get("/suppliers/{supplier_id}", response_model=Supplier)
def get_supplier(supplier_id: int, db: Session = Depends(database.get_db)):
    db_supplier = db.query(models.Supplier).filter(models.Supplier.id == supplier_id, models.Supplier.is_deleted == False).first()
    if not db_supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return db_supplier

@app.put("/suppliers/{supplier_id}", response_model=Supplier)
def update_supplier(supplier_id: int, supplier_update: SupplierUpdate, db: Session = Depends(database.get_db)):
    db_supplier = db.query(models.Supplier).filter(models.Supplier.id == supplier_id).first()
    if not db_supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    update_data = supplier_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_supplier, key, value)
    
    db.commit()
    db.refresh(db_supplier)
    return db_supplier

@app.delete("/suppliers/{supplier_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_supplier(supplier_id: int, db: Session = Depends(database.get_db)):
    try:
        db_supplier = db.query(models.Supplier).filter(models.Supplier.id == supplier_id, models.Supplier.is_deleted == False).first()
        if not db_supplier:
            raise HTTPException(status_code=404, detail="Supplier not found")
        
        # Soft Delete instead of DB delete
        db_supplier.is_deleted = True
        db_supplier.deleted_at = datetime.datetime.now()
        
        db.commit()
        return None
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"SOFT DELETE ERROR: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- Bank Account Endpoints ---

@app.post("/suppliers/{supplier_id}/bank-details", response_model=BankDetail, status_code=status.HTTP_201_CREATED)
def create_bank_detail(supplier_id: int, bank_detail: BankDetailCreate, db: Session = Depends(database.get_db)):
    db_supplier = db.query(models.Supplier).filter(models.Supplier.id == supplier_id).first()
    if not db_supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    db_bank = models.SupplierBankDetail(**bank_detail.model_dump(), supplier_id=supplier_id)
    db.add(db_bank)
    db.commit()
    db.refresh(db_bank)
    return db_bank

@app.delete("/bank-details/{bank_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_bank_detail(bank_id: int, db: Session = Depends(database.get_db)):
    db_bank = db.query(models.SupplierBankDetail).filter(models.SupplierBankDetail.id == bank_id).first()
    if not db_bank:
        raise HTTPException(status_code=404, detail="Bank detail not found")
    db.delete(db_bank)
    db.commit()
    return None

# --- Invoice Endpoints ---

@app.post("/upload-invoice", status_code=status.HTTP_201_CREATED)
async def upload_invoice(invoice: InvoiceUpload, db: Session = Depends(database.get_db)):
    """
    Skeleton endpoint for uploading an invoice.
    Accepts line items and validates against total value.
    """
    # Domain Logic: Reconciliation (Rule 3.18)
    calculated_total = sum(item.quantity * item.price for item in invoice.line_items)
    
    if abs(calculated_total - invoice.total_value) > 0.1: 
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invoice total mismatch. Calculated: {calculated_total}, Provided: {invoice.total_value}"
        )

    # TODO: Implement database commit logic for invoice and line items
    return {"message": "Invoice received and validated", "reference_number": invoice.reference_number}
