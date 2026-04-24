"""
Pydantic schemas for the Pharmacy Inventory system.
Used for request validation (Create/Update) and response serialization (Schema).
"""
import datetime
from enum import Enum
from pydantic import BaseModel, EmailStr, Field, field_validator, ConfigDict
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
    model_config = ConfigDict(from_attributes=True)

class SupplierTypeBase(BaseModel):
    name: str

class SupplierTypeCreate(SupplierTypeBase):
    pass

class SupplierTypeSchema(SupplierTypeBase):
    """Response schema for supplier type lookups."""
    id: int
    is_active: bool
    model_config = ConfigDict(from_attributes=True)

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
    model_config = ConfigDict(from_attributes=True)

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
    model_config = ConfigDict(from_attributes=True)

class ContactDetailBase(BaseModel):
    """Shared contact and address fields for suppliers."""
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
    model_config = ConfigDict(from_attributes=True)

class SupplierBase(BaseModel):
    """Shared fields for supplier creation and updates."""
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
    model_config = ConfigDict(from_attributes=True)

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
    model_config = ConfigDict(from_attributes=True)

# --- Stock Batch Schemas ---
class StockBatchSchema(BaseModel):
    """Response schema for a specific batch of medicine stock."""
    id: int
    medicine_id: int
    batch_no: str
    expiry_date: datetime.date
    quantity_on_hand: int
    purchase_price: float
    mrp: float
    gst: float = 0.0
    received_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)

# --- Medicine Schemas ---
class MedicineBase(BaseModel):
    """Shared fields for medicine creation and updates."""
    product_name: str
    generic_name: Optional[str] = None
    manufacturer_id: Optional[int] = None
    hsn_code: Optional[str] = None
    category: Optional[str] = "GENERAL"
    uom: Optional[str] = "Units"
    storage_type: Optional[str] = "Ambient"
    description: Optional[str] = None
    unit_price: Optional[float] = 0.0
    selling_price_percent: Optional[float] = 0.0

    @field_validator('category', mode='before')
    @classmethod
    def normalize_category(cls, v: str) -> str:
        if not v:
            return "GENERAL"
        
        # Mapping from human-friendly frontend names to backend Enum keys
        mapping = {
            "Scheduled H": "SCHEDULE_H",
            "Scheduled H1": "SCHEDULE_H1",
            "Scheduled X": "SCHEDULE_X",
            "OTC": "OTC",
            "General": "GENERAL"
        }
        
        # Return mapped value or fallback to uppercase
        return mapping.get(v, v.upper())

class MedicineCreate(MedicineBase):
    pass

class MedicineSchema(MedicineBase):
    """Response schema for medicine master data."""
    id: int
    is_active: bool
    quantity_on_hand: int = 0
    manufacturer: Optional[ManufacturerSchema] = None
    batches: List[StockBatchSchema] = []
    model_config = ConfigDict(from_attributes=True)

# --- Invoice Schemas ---
class InvoiceLineItemBase(BaseModel):
    medicine_id: Optional[int] = None
    description: Optional[str] = None
    quantity: int
    free_quantity: Optional[int] = 0
    price: Optional[float] = 0.0
    discount: Optional[float] = 0.0
    batch_no: Optional[str] = None
    expiry_date: Optional[datetime.date] = None
    mrp: Optional[float] = 0.0
    gst: Optional[float] = 0.0
    remarks: Optional[str] = None

class InvoiceLineItemCreate(InvoiceLineItemBase):
    pass

class InvoiceLineItemSchema(InvoiceLineItemBase):
    """Response schema for invoice line items."""
    id: int
    medicine: Optional[MedicineSchema] = None
    model_config = ConfigDict(from_attributes=True)

class InvoiceBase(BaseModel):
    """Shared fields for invoice creation and updates."""
    supplier_id: int
    invoice_date: datetime.date
    reference_number: str
    total_value: Optional[float] = 0.0
    gst: Optional[float] = 0.0
    status: Optional[InvoiceStatus] = InvoiceStatus.Pending

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
    line_items: Optional[List[InvoiceLineItemCreate]] = None

class InvoiceSchema(InvoiceBase):
    """Full response schema for an invoice including items and payments."""
    id: int
    supplier: Optional[SupplierSchema] = None
    line_items: List[InvoiceLineItemSchema] = []
    payments: List['InvoicePaymentSchema'] = []
    model_config = ConfigDict(from_attributes=True)

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
    created_date: datetime.datetime

    model_config = ConfigDict(from_attributes=True)

# Update forward references
InvoiceSchema.model_rebuild()

class PaginatedInvoices(BaseModel):
    """Envelope for paginated invoice responses."""
    total: int
    items: List[InvoiceSchema]

# --- Stock Management Schemas ---

class StockAdjustmentType(str, Enum):
    """Categorizes the origin of a stock change for audit clarity."""
    OPENING_BALANCE = "OPENING_BALANCE"
    INVOICE_RECEIPT = "INVOICE_RECEIPT"
    MANUAL_ADJUSTMENT = "MANUAL_ADJUSTMENT"
    WRITE_OFF = "WRITE_OFF"
    DISPENSED = "DISPENSED"

class MedicineStockBase(BaseModel):
    medicine_id: int
    quantity_on_hand: int = 0
    reorder_level: int = 0
    notes: Optional[str] = None

class MedicineStockSchema(MedicineStockBase):
    """Response schema for live medicine stock levels, including medicine details and batches."""
    id: int
    last_updated_at: Optional[datetime.datetime] = None
    unit_price: float = 0.0
    gst_percent: float = 0.0
    medicine: Optional[MedicineSchema] = None

    model_config = ConfigDict(from_attributes=True)

class PaginatedStockSchema(BaseModel):
    """Paginated list of medicine stock records."""
    total: int
    items: List[MedicineStockSchema]

class StockLedgerSchema(BaseModel):
    """Movement report entry for a medicine over a period."""
    medicine_id: int
    product_name: str
    generic_name: Optional[str] = None
    category: Optional[str] = None
    uom: Optional[str] = None
    opening_balance: Union[int, float]
    quantity_in: Union[int, float]
    quantity_out: Union[int, float]
    stock_in_hand: Union[int, float]

class PaginatedStockLedger(BaseModel):
    """Envelope for paginated stock ledger entries."""
    total: int
    items: List[StockLedgerSchema]

class StockAdjustmentCreate(BaseModel):
    """
    Request payload for an admin-initiated manual stock adjustment.
    Use positive quantity_change for stock-in, negative for stock-out/write-off.
    """
    medicine_id: int
    quantity_change: int = Field(..., description="Positive = stock in, Negative = stock out/write-off")
    adjustment_type: StockAdjustmentType
    reason: str = Field(..., min_length=3, description="Brief reason for the adjustment (min 3 chars)")

class StockAdjustmentSchema(BaseModel):
    """Response schema for a single stock adjustment audit record."""
    id: int
    medicine_id: int
    quantity_change: int
    adjustment_type: StockAdjustmentType
    reason: str
    invoice_line_item_id: Optional[int] = None
    batch_id: Optional[int] = None
    adjusted_by_user_id: int
    adjusted_at: datetime.datetime
    medicine: Optional[MedicineSchema] = None
    batch: Optional[StockBatchSchema] = None

    model_config = ConfigDict(from_attributes=True)


class StockInitializeRequest(BaseModel):
    """
    Request payload for initializing an opening stock balance.
    Used to seed existing medicine stock before the pharmacy was digitized.

    - medicine_id: The medicine to initialize.
    - quantity: The absolute opening quantity (must be >= 0).
    - initialized_date: The date this stock was physically present
      (can be a historical date, e.g. before go-live).
    - notes: Optional remarks (e.g. "Opening balance as of Jan 2024 physical count").
    """
    medicine_id: int
    quantity: int = Field(..., ge=0, description="Absolute opening stock quantity (>= 0)")
    purchase_price: Optional[float] = Field(None, description="Cost price per unit for this opening stock. If omitted, system defaults to 80% of master price.")
    initialized_date: datetime.date = Field(..., description="Date of the physical stock count / go-live date")
    notes: Optional[str] = Field(None, description="Optional remarks about this opening balance")


class PeriodSummaryReport(BaseModel):
    """
    Consolidated financial statement for a specific date range.
    Reconciles inventory movements and profitability.
    """
    opening_valuation: float = Field(..., description="Inventory value at the start of the period (at cost)")
    purchases_value: float = Field(..., description="Value of stock received via purchase invoices in range")
    initial_stock_value: float = Field(..., description="Value of stock initialized via Opening Balance adjustments")
    revenue: float = Field(..., description="Total sales amount in the period")
    cost_of_goods_sold: float = Field(..., description="Cost value of items sold in the period (FEFO cost)")
    adjustments_value: float = Field(..., description="Net value of system corrections (manual adjustments, cancellations)")
    write_offs_value: float = Field(..., description="Value of stock written off or expired")
    gross_profit: float = Field(..., description="Revenue - COGS")
    closing_valuation: float = Field(..., description="Inventory value at the end of the period (at cost)")
    start_date: datetime.date
    end_date: datetime.date


# --- Dispensing Schemas ---

class DispensingCreate(BaseModel):
    """
    Request payload to record a medicine dispensing event.

    - dispensed_date   : Date the medicine was given (can be today or a past date).
    - patient_name     : Free-text patient name/ID — no master required.
    - medicine_id      : ID of the medicine from the medicine master.
    - quantity         : Number of units dispensed (must be >= 1).
    - unit_price       : Price per unit in INR.
    - gst_percent      : GST percentage to apply (0-100), default 0.
    - notes            : Optional remarks (shelf location, prescription ref, etc.)
    """
    dispensed_date: datetime.date = Field(..., description="Date medicine was dispensed")
    patient_name: str = Field(..., min_length=1, description="Patient name or identifier")
    medicine_id: int
    quantity: int = Field(..., ge=1, description="Units dispensed (>= 1)")
    unit_price: float = Field(..., ge=0, description="Unit price in INR")
    gst_percent: float = Field(default=0.0, ge=0, le=100, description="GST % (0–100)")
    notes: Optional[str] = None


class DispensingSchema(BaseModel):
    """Response schema for a dispensing record, includes nested medicine info."""
    id: int
    dispensed_date: datetime.date
    patient_name: str
    medicine_id: int
    quantity: int
    unit_price: float
    gst_percent: float
    total_amount: float
    notes: Optional[str] = None
    recorded_by_user_id: int
    created_at: datetime.datetime
    medicine: Optional[MedicineSchema] = None

    model_config = ConfigDict(from_attributes=True)


class PaginatedDispensing(BaseModel):
    """Envelope for paginated dispensing responses."""
    total: int
    items: List[DispensingSchema]


class BulkDispensingResult(BaseModel):
    """Summary of a bulk dispensing upload operation."""
    success_count: int
    error_count: int
    error_csv_content: Optional[str] = None


class DashboardStats(BaseModel):
    """Real-time statistics for the dashboard cards."""
    total_medicines: int
    pending_invoices_amount: float
    monthly_procurement: float
    low_stock_alerts: int


# --- Financial Report Schemas ---

class InventoryValuationSchema(BaseModel):
    """Cumulative value of current stock at cost and MRP."""
    total_cost_value: float
    total_mrp_value: float
    medicine_count: int
    batch_count: int

class SupplierAgingSchema(BaseModel):
    """Outstanding balance per supplier."""
    supplier_id: int
    supplier_name: str
    total_invoiced: float
    total_paid: float
    balance_due: float

class GSTReconciliationSchema(BaseModel):
    """Input vs Output GST for a period."""
    start_date: datetime.date
    end_date: datetime.date
    input_gst: float
    output_gst: float
    net_gst_liability: float

class ProfitMarginSchema(BaseModel):
    """Gross profit breakdown per medicine."""
    medicine_id: int
    medicine_name: str
    quantity_sold: int
    revenue: float
    cost_of_goods_sold: float
    gross_profit: float
    margin_percent: float

class FinancialSummarySchema(BaseModel):
    """Combined financial KPIs for the dashboard."""
    valuation: InventoryValuationSchema
    total_receivable_gst: float
    total_payable_debt: float
    monthly_profit: float

# --- Finance Management Schemas ---

class PatientIdentifierBase(BaseModel):
    id_name: str
    is_active: bool = True

class PatientIdentifierCreate(PatientIdentifierBase):
    pass

class PatientIdentifierUpdate(PatientIdentifierBase):
    """Schema for updating a patient identifier."""
    pass

class PatientIdentifierSchema(PatientIdentifierBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

class PatientServiceBase(BaseModel):
    service_name: str
    is_active: bool = True

class PatientServiceCreate(PatientServiceBase):
    pass

class PatientServiceUpdate(PatientServiceBase):
    """Schema for updating a patient service."""
    pass

class PatientServiceSchema(PatientServiceBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

class PaymentModeMasterBase(BaseModel):
    mode: str
    is_active: bool = True

class PaymentModeMasterCreate(PaymentModeMasterBase):
    pass

class PaymentModeMasterUpdate(PaymentModeMasterBase):
    """Schema for updating a payment mode."""
    pass

class PaymentModeMasterSchema(PaymentModeMasterBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

class PatientPaymentValueBase(BaseModel):
    payment_mode_id: int
    value: float
    notes: Optional[str] = None

class PatientPaymentValueCreate(PatientPaymentValueBase):
    pass

class PatientPaymentValueSchema(PatientPaymentValueBase):
    id: int
    modified_date: datetime.datetime
    model_config = ConfigDict(from_attributes=True)

class PatientPaymentServiceBase(BaseModel):
    service_id: int
    amount: float

class PatientPaymentServiceCreate(PatientPaymentServiceBase):
    pass

class PatientPaymentServiceSchema(PatientPaymentServiceBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

class PatientPaymentIdentifierBase(BaseModel):
    identifier_id: int
    id_value: str

class PatientPaymentIdentifierCreate(PatientPaymentIdentifierBase):
    pass

class PatientPaymentIdentifierSchema(PatientPaymentIdentifierBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

class PatientPaymentBase(BaseModel):
    patient_name: str
    payment_date: datetime.date
    total_amount: float
    gst_amount: float = 0.0
    notes: Optional[str] = None
    free_flag: bool = False
    token_no: Optional[int] = None

class PatientPaymentCreate(PatientPaymentBase):
    identifiers: List[PatientPaymentIdentifierCreate] = []
    services: List[PatientPaymentServiceCreate] = []
    payments: List[PatientPaymentValueCreate] = []

class PatientPaymentUpdate(PatientPaymentBase):
    """Schema for updating a patient payment record."""
    pass

class PatientPaymentSchema(PatientPaymentBase):
    id: int
    created_date: Optional[datetime.datetime] = None
    identifiers: List[PatientPaymentIdentifierSchema] = []
    services: List[PatientPaymentServiceSchema] = []
    payments: List[PatientPaymentValueSchema] = []
    model_config = ConfigDict(from_attributes=True)

class PaginatedPatientPayment(BaseModel):
    total: int
    items: List[PatientPaymentSchema]

class FinanceMastersSchema(BaseModel):
    identifiers: List[PatientIdentifierSchema]
    services: List[PatientServiceSchema]
    payment_modes: List[PaymentModeMasterSchema]

class BulkPaymentResult(BaseModel):
    success_count: int
    error_count: int
    error_csv_content: Optional[str] = None


# =============================================================================
# Finance Dashboard Schemas
# =============================================================================

class ServiceIncome(BaseModel):
    service_name: str
    total_amount: float
    count: int

class PaymentModeIncome(BaseModel):
    mode_name: str
    total_value: float
    count: int

class DailyTrend(BaseModel):
    date: str
    amount: float

class FinanceDashboardStats(BaseModel):
    total_income_today: float
    total_income_month: float
    patient_count_today: int
    avg_ticket_size: float
    service_distribution: List[ServiceIncome]
    payment_mode_distribution: List[PaymentModeIncome]
    recent_trends: List[DailyTrend]
