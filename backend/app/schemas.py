from pydantic import BaseModel
from typing import List, Optional
import datetime

# --- Shared Schemas ---
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

# --- Lookup Schemas ---
class StatusBase(BaseModel):
    name: str

class StatusCreate(StatusBase):
    pass

class StatusSchema(StatusBase):
    id: int
    is_active: bool
    class Config:
        from_attributes = True

class SupplierTypeBase(BaseModel):
    name: str

class SupplierTypeCreate(SupplierTypeBase):
    pass

class SupplierTypeSchema(SupplierTypeBase):
    id: int
    is_active: bool
    class Config:
        from_attributes = True

# --- User Schemas ---
class UserBase(BaseModel):
    username: str
    email: str
    role: str = "Staff"
    status_id: int = 1

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    email: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    status_id: Optional[int] = None
    password: Optional[str] = None

class UserSchema(UserBase):
    id: int
    is_active: bool
    status: Optional[StatusSchema] = None
    class Config:
        from_attributes = True

# --- Supplier Schemas ---
class BankAccountBase(BaseModel):
    account_number: str
    ifsc_code: str
    bank_name: str
    is_primary: bool = False

class BankAccountCreate(BankAccountBase):
    pass

class BankAccountSchema(BankAccountBase):
    id: int
    class Config:
        from_attributes = True

class ContactDetailBase(BaseModel):
    address_line_1: Optional[str] = None
    address_line_2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pin_code: Optional[str] = None
    phone_number: Optional[str] = None
    landline_number: Optional[str] = None
    email_id: Optional[str] = None
    contact_name: Optional[str] = None
    gstn: Optional[str] = None
    remarks: Optional[str] = None

class ContactDetailCreate(ContactDetailBase):
    pass

class ContactDetailSchema(ContactDetailBase):
    id: int
    class Config:
        from_attributes = True

class SupplierBase(BaseModel):
    supplier_name: str
    type_id: Optional[int] = None
    status_id: Optional[int] = None

class SupplierCreate(SupplierBase):
    bank_details: List[BankAccountCreate] = []
    contact_details: Optional[ContactDetailCreate] = None

class SupplierSchema(SupplierBase):
    id: int
    type: Optional[SupplierTypeSchema] = None
    status: Optional[StatusSchema] = None
    bank_details: List[BankAccountSchema] = []
    contact_details: Optional[ContactDetailSchema] = None
    class Config:
        from_attributes = True

# --- Manufacturer Schemas ---
class ManufacturerBase(BaseModel):
    name: str
    address: Optional[str] = None
    contact_person: Optional[str] = None
    phone_number: Optional[str] = None
    contact_email: Optional[str] = None

class ManufacturerCreate(ManufacturerBase):
    pass

class ManufacturerSchema(ManufacturerBase):
    id: int
    is_active: bool
    class Config:
        from_attributes = True

# --- Medicine Schemas ---
class MedicineBase(BaseModel):
    product_name: str
    generic_name: Optional[str] = None
    manufacturer_id: Optional[int] = None
    hsn_code: Optional[str] = None
    category: str = "General"
    uom: Optional[str] = None
    storage_type: Optional[str] = "Ambient"
    description: Optional[str] = None
    unit_price: float = 0.0

class MedicineCreate(MedicineBase):
    pass

class MedicineSchema(MedicineBase):
    id: int
    is_active: bool
    manufacturer: Optional[ManufacturerSchema] = None
    class Config:
        from_attributes = True

# --- Invoice Schemas ---
class InvoiceLineItemBase(BaseModel):
    medicine_id: Optional[int] = None
    description: Optional[str] = None
    quantity: int
    price: float
    discount: Optional[float] = 0.0
    expiry_date: Optional[datetime.date] = None
    remarks: Optional[str] = None

class InvoiceLineItemCreate(InvoiceLineItemBase):
    pass

class InvoiceLineItemSchema(InvoiceLineItemBase):
    id: int
    medicine: Optional[MedicineSchema] = None
    class Config:
        from_attributes = True

class InvoiceBase(BaseModel):
    supplier_id: int
    invoice_date: datetime.date
    reference_number: str
    total_value: float
    gst: Optional[float] = 0.0

class InvoiceCreate(InvoiceBase):
    line_items: List[InvoiceLineItemCreate] = []

class InvoiceUpdate(BaseModel):
    supplier_id: Optional[int] = None
    invoice_date: Optional[datetime.date] = None
    reference_number: Optional[str] = None
    total_value: Optional[float] = None
    gst: Optional[float] = None

class InvoiceSchema(InvoiceBase):
    id: int
    supplier: Optional[SupplierSchema] = None
    line_items: List[InvoiceLineItemSchema] = []
    class Config:
        from_attributes = True

class PaginatedInvoices(BaseModel):
    total: int
    items: List[InvoiceSchema]
