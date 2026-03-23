"""
Pydantic schemas for the Pharmacy Inventory system.
Used for request validation (Create/Update) and response serialization (Schema).
"""
import datetime
from enum import Enum
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Union

class InvoiceStatus(str, Enum):
    """Possible statuses for a purchase invoice."""
    Paid = "Paid"
    Pending = "Pending"
    Hold = "Hold"
    Cancelled = "Cancelled"

class PaymentMode(str, Enum):
    """Accepted payment methods."""
    BankTransfer = "Bank Transfer"
    Cash = "Cash"
    UPI = "UPI"

# --- Shared Schemas ---
class Token(BaseModel):
    """JWT Token response."""
    access_token: str
    token_type: str

class TokenData(BaseModel):
    """Payload extracted from JWT token."""
    username: Optional[str] = None

# --- Lookup Schemas ---
class StatusBase(BaseModel):
    name: str

class StatusCreate(StatusBase):
    pass

class StatusSchema(StatusBase):
    """Response schema for status lookups."""
    id: int
    is_active: bool
    class Config:
        from_attributes = True

class SupplierTypeBase(BaseModel):
    name: str

class SupplierTypeCreate(SupplierTypeBase):
    pass

class SupplierTypeSchema(SupplierTypeBase):
    """Response schema for supplier type lookups."""
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
    """Request schema for creating a new user with password."""
    password: str

class UserUpdate(BaseModel):
    """Request schema for updating optional user fields."""
    email: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    status_id: Optional[int] = None
    password: Optional[str] = None

class UserSchema(UserBase):
    """Response schema for user data including linked status."""
    id: int
    is_active: bool
    status: Optional[StatusSchema] = None
    class Config:
        from_attributes = True

class UserPasswordUpdate(BaseModel):
    """Schema for users to update their own password."""
    old_password: str
    new_password: str

# --- Supplier Schemas ---
class BankAccountBase(BaseModel):
    account_number: str
    ifsc_code: str
    bank_name: str
    is_primary: bool = False

class BankAccountCreate(BankAccountBase):
    pass

class BankAccountSchema(BankAccountBase):
    """Response schema for supplier bank accounts."""
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
    """Response schema for supplier contact details."""
    id: int
    class Config:
        from_attributes = True

class SupplierBase(BaseModel):
    supplier_name: str
    type_id: Optional[int] = None
    status_id: Optional[int] = None

class SupplierCreate(SupplierBase):
    """Request schema for creating a supplier with nested details."""
    bank_details: List[BankAccountCreate] = []
    contact_details: Optional[ContactDetailCreate] = None

class SupplierSchema(SupplierBase):
    """Response schema for suppliers with fully expanded relationships."""
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
    """Response schema for drug manufacturers."""
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
    """Response schema for medicine master data."""
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
    """Response schema for invoice line items."""
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
    status: InvoiceStatus = InvoiceStatus.Pending

class InvoiceCreate(InvoiceBase):
    """Request schema for recording a new purchase invoice with items."""
    line_items: List[InvoiceLineItemCreate] = []

class InvoiceUpdate(BaseModel):
    """Request schema for modifying existing invoice fields."""
    supplier_id: Optional[int] = None
    invoice_date: Optional[datetime.date] = None
    reference_number: Optional[str] = None
    total_value: Optional[float] = None
    gst: Optional[float] = None
    status: Optional[InvoiceStatus] = None

class InvoiceSchema(InvoiceBase):
    """Full response schema for an invoice including items and payments."""
    id: int
    supplier: Optional[SupplierSchema] = None
    line_items: List[InvoiceLineItemSchema] = []
    payments: List['InvoicePaymentSchema'] = []
    class Config:
        from_attributes = True

class InvoicePaymentBase(BaseModel):
    invoice_id: int
    payment_mode: PaymentMode
    payment_date: datetime.date
    paid_amount: float
    payment_reference: Optional[str] = None
    remarks: Optional[str] = None

class InvoicePaymentCreate(InvoicePaymentBase):
    pass

class InvoicePaymentSchema(InvoicePaymentBase):
    """Response schema for recorded payments."""
    id: int
    created_at: datetime.datetime

    class Config:
        from_attributes = True

# Update forward references
InvoiceSchema.model_rebuild()

class PaginatedInvoices(BaseModel):
    """Envelope for paginated invoice responses."""
    total: int
    items: List[InvoiceSchema]
