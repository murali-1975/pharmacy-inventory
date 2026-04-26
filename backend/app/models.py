"""
SQLAlchemy database models for the Pharmacy Inventory system.

Defines the full relational schema, including:
  - User accounts with RBAC roles
  - Supplier entities with contact and bank details (V2 normalized schema)
  - Medicine master data with manufacturer linkage
  - Purchase invoices, line items, and payment settlement
  - Stock ledger (MedicineStock) and immutable audit trail (StockAdjustment)
  - Daily patient dispensing records
"""
from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Date, Enum, Boolean, UniqueConstraint, JSON, Numeric
from sqlalchemy.orm import relationship
from .database import Base
import datetime
import enum

class User(Base):
    """
    System users with role-based access control.
    Roles: Admin, Manager, Staff.
    """
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="Staff")
    is_active = Column(Boolean, default=True)
    status_id = Column(Integer, ForeignKey("status.id"), default=1)
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))

    status = relationship("Status")

    def __repr__(self) -> str:
        return f"<User id={self.id} username={self.username!r} role={self.role!r}>"

class Status(Base):
    """
    Lookup table for entity statuses (e.g., Active, Inactive).
    Used by Users, Suppliers, and Bank Accounts.
    """
    __tablename__ = "status"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    is_active = Column(Boolean, default=True)

class SupplierType(Base):
    """
    Lookup table for supplier categories (e.g., Wholesale, Manufacturer, Retail).
    """
    __tablename__ = "supplier_types"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    is_active = Column(Boolean, default=True)

class Supplier(Base):
    """
    Supplier entity tracking basic info and linking to contact/bank details.
    """
    __tablename__ = "suppliers"

    id = Column(Integer, primary_key=True, index=True)
    supplier_name = Column(String, nullable=False)
    type_id = Column(Integer, ForeignKey("supplier_types.id"))
    status_id = Column(Integer, ForeignKey("status.id"))
    is_deleted = Column(Boolean, default=False)
    deleted_at = Column(DateTime, nullable=True)

    type = relationship("SupplierType")
    status = relationship("Status")
    bank_details = relationship("SupplierBankAccount", back_populates="supplier", cascade="all, delete-orphan")
    contact_details = relationship("SupplierContactDetail", back_populates="supplier", uselist=False, cascade="all, delete-orphan")
    invoices = relationship("Invoice", back_populates="supplier")

class SupplierContactDetail(Base):
    """
    Detailed contact and address information for a supplier.
    One-to-one relationship with Supplier.
    """
    __tablename__ = "supplier_contact_details"

    id = Column(Integer, primary_key=True, index=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id", ondelete="CASCADE"), nullable=False)
    address_line_1 = Column(String)
    address_line_2 = Column(String)
    city = Column(String)
    state = Column(String)
    pin_code = Column(String)
    phone_number = Column(String)
    landline_number = Column(String)
    email_id = Column(String)
    contact_name = Column(String)
    gstn = Column(String)
    remarks = Column(String)

    supplier = relationship("Supplier", back_populates="contact_details")

class SupplierBankAccount(Base):
    """
    Bank account details for supplier payments.
    Multiple accounts can be linked to one supplier.
    """
    __tablename__ = "supplier_bank_accounts"

    id = Column(Integer, primary_key=True, index=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id", ondelete="CASCADE"), nullable=False)
    bank_name = Column(String)
    account_number = Column(String)
    ifsc_code = Column(String)
    is_primary = Column(Boolean, default=False)
    bank_reference_number = Column(String)
    remarks = Column(String)
    status_id = Column(Integer, ForeignKey("status.id"))

    supplier = relationship("Supplier", back_populates="bank_details")
    status = relationship("Status")

class Manufacturer(Base):
    """
    Drug manufacturing entities. Primary linked entity for Medicines.
    """
    __tablename__ = "manufacturers"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    address = Column(String)
    contact_person = Column(String)
    contact_email = Column(String)
    phone_number = Column(String)
    is_active = Column(Boolean, default=True)

    medicines = relationship("Medicine", back_populates="manufacturer")

class MedicineCategory(str, enum.Enum):
    """Regulatory categories for medicines in India."""
    SCHEDULE_H = "SCHEDULE_H"
    SCHEDULE_H1 = "SCHEDULE_H1"
    SCHEDULE_X = "SCHEDULE_X"
    OTC = "OTC"
    GENERAL = "GENERAL"

class InvoiceStatus(str, enum.Enum):
    Paid = "Paid"
    Pending = "Pending"
    Hold = "Hold"
    Cancelled = "Cancelled"

class PaymentMode(str, enum.Enum):
    BankTransfer = "Bank Transfer"
    Cash = "Cash"
    UPI = "UPI"

class Medicine(Base):
    """
    Medicine master data. Tracks brand name, salt composition, and manufacturer.
    """
    __tablename__ = "medicines"

    id = Column(Integer, primary_key=True, index=True)
    product_name = Column(String, index=True, nullable=False)  # Brand name
    generic_name = Column(String, index=True)                  # Salt composition
    description = Column(String, nullable=True)
    unit_price = Column(Float, default=0.0)
    selling_price_percent = Column(Float, default=0.0)
    manufacturer_id = Column(Integer, ForeignKey("manufacturers.id"))
    hsn_code = Column(String(8))
    category = Column(Enum(MedicineCategory), default=MedicineCategory.GENERAL)
    uom = Column(String)          # Unit of Measure: Strip, Bottle, Vial, Each
    storage_type = Column(String) # Ambient, Cold Chain (2-8°C), or Controlled
    is_active = Column(Boolean, default=True)

    manufacturer = relationship("Manufacturer", back_populates="medicines")
    line_items = relationship("InvoiceLineItem", back_populates="medicine")
    stock = relationship("MedicineStock", back_populates="medicine", uselist=False)
    batches = relationship("StockBatch", back_populates="medicine", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Medicine id={self.id} product_name={self.product_name!r}>"

class Invoice(Base):
    """
    Purchase Invoices received from suppliers.
    Tracks total value, GST, and settlement status.
    """
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    invoice_date = Column(Date, default=datetime.date.today)
    reference_number = Column(String, unique=True, index=True, nullable=False)
    total_value = Column(Float, nullable=False)
    gst = Column(Float, default=0.0)
    status = Column(Enum(InvoiceStatus), default=InvoiceStatus.Pending)
    
    created_by = Column(Integer, ForeignKey("users.id"))
    created_date = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    modified_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    modified_date = Column(DateTime, onupdate=lambda: datetime.datetime.now(datetime.timezone.utc), nullable=True)

    supplier = relationship("Supplier", back_populates="invoices")
    line_items = relationship("InvoiceLineItem", back_populates="invoice")
    payments = relationship("InvoicePayment", back_populates="invoice")

class InvoiceLineItem(Base):
    """
    Individual items within a purchase invoice.
    Links quantities and prices to specific medicines.
    """
    __tablename__ = "invoice_line_items"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False)
    medicine_id = Column(Integer, ForeignKey("medicines.id"), nullable=True)
    description = Column(String, nullable=True)
    quantity = Column(Integer, nullable=False)
    free_quantity = Column(Integer, default=0)
    price = Column(Float, nullable=False)
    discount = Column(Float, default=0.0)
    batch_no = Column(String, nullable=True)
    expiry_date = Column(Date, nullable=True)
    mrp = Column(Float, default=0.0)
    gst = Column(Float, default=0.0)
    remarks = Column(String)
    
    created_by = Column(Integer, ForeignKey("users.id"))
    created_date = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    modified_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    modified_date = Column(DateTime, onupdate=lambda: datetime.datetime.now(datetime.timezone.utc), nullable=True)

    invoice = relationship("Invoice", back_populates="line_items")
    medicine = relationship("Medicine", back_populates="line_items")

class InvoicePayment(Base):
    """
    Payments recorded against a purchase invoice.
    Tracks settlement progress.
    """
    __tablename__ = "invoice_payments"
    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False)
    payment_mode = Column(Enum(PaymentMode), nullable=False)
    payment_date = Column(Date, nullable=False)
    paid_amount = Column(Float, nullable=False)
    payment_reference = Column(String)
    remarks = Column(String)
    
    created_by = Column(Integer, ForeignKey("users.id"))
    created_date = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    modified_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    modified_date = Column(DateTime, onupdate=lambda: datetime.datetime.now(datetime.timezone.utc), nullable=True)

    invoice = relationship("Invoice", back_populates="payments")


class StockAdjustmentType(str, enum.Enum):
    """Categorizes the origin of a stock change for audit clarity."""
    OPENING_BALANCE = "OPENING_BALANCE"
    INVOICE_RECEIPT = "INVOICE_RECEIPT"
    MANUAL_ADJUSTMENT = "MANUAL_ADJUSTMENT"
    WRITE_OFF = "WRITE_OFF"
    DISPENSED = "DISPENSED"


class MedicineStock(Base):
    """
    Tracks the current on-hand stock quantity for each medicine.
    This is the single source of truth for live inventory levels.
    One record per medicine (enforced by unique constraint).
    """
    __tablename__ = "medicine_stock"
    __table_args__ = (UniqueConstraint("medicine_id", name="uq_medicine_stock_medicine_id"),)

    id = Column(Integer, primary_key=True, index=True)
    medicine_id = Column(Integer, ForeignKey("medicines.id"), nullable=False)
    quantity_on_hand = Column(Integer, default=0, nullable=False)
    reorder_level = Column(Integer, default=0, nullable=False)
    notes = Column(String, nullable=True)
    last_updated_at = Column(
        DateTime,
        default=lambda: datetime.datetime.now(datetime.timezone.utc),
        onupdate=lambda: datetime.datetime.now(datetime.timezone.utc)
    )

    medicine = relationship("Medicine", back_populates="stock")

    def __repr__(self) -> str:
        return f"<MedicineStock medicine_id={self.medicine_id} qty={self.quantity_on_hand}>"


class StockBatch(Base):
    """
    Tracks inventory for a specific medicine batch.
    Includes expiry dates and purchase price for cost-basis logic.
    """
    __tablename__ = "stock_batches"
    __table_args__ = (UniqueConstraint("medicine_id", "batch_no", name="uq_stock_batch_medicine_batch"),)

    id = Column(Integer, primary_key=True, index=True)
    medicine_id = Column(Integer, ForeignKey("medicines.id"), nullable=False)
    batch_no = Column(String, index=True, nullable=False)
    expiry_date = Column(Date, nullable=False)
    quantity_on_hand = Column(Integer, default=0, nullable=False)
    purchase_price = Column(Float, nullable=False)  # Base cost for this batch
    mrp = Column(Float, default=0.0)
    gst = Column(Float, default=0.0)
    received_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))

    medicine = relationship("Medicine", back_populates="batches")


class StockAdjustment(Base):
    """
    Immutable audit trail for every stock change in the system.
    Records who changed stock, by how much, why, and how (type).
    Linked to an InvoiceLineItem if the change was triggered by a receipt.
    """
    __tablename__ = "stock_adjustments"

    id = Column(Integer, primary_key=True, index=True)
    medicine_id = Column(Integer, ForeignKey("medicines.id"), nullable=False)
    quantity_change = Column(Integer, nullable=False)  # Positive = stock in, Negative = stock out
    adjustment_type = Column(Enum(StockAdjustmentType), nullable=False)
    reason = Column(String, nullable=False)
    invoice_line_item_id = Column(Integer, ForeignKey("invoice_line_items.id"), nullable=True)
    dispensing_id = Column(Integer, ForeignKey("dispensing.id"), nullable=True)
    batch_id = Column(Integer, ForeignKey("stock_batches.id"), nullable=True)
    adjusted_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    adjusted_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))

    medicine = relationship("Medicine")
    batch = relationship("StockBatch")
    adjusted_by = relationship("User")
    invoice_line_item = relationship("InvoiceLineItem")


class Dispensing(Base):
    """
    Records each daily medicine dispensing event for a patient.
    When a Dispensing record is saved, stock is automatically deducted and
    a StockAdjustment audit record (type=DISPENSED) is written.

    Fields:
        dispensed_date   : Date on which the medicine was given.
        patient_name     : Free-text patient identifier (no master needed).
        medicine_id      : FK to medicines table.
        quantity         : Number of units dispensed.
        unit_price       : Price per unit (₹).
        gst_percent      : GST percentage applied (0-100, default 0).
        total_amount     : Computed and stored at write time (qty × price × (1 + gst/100)).
        notes            : Optional remarks for this event.
        recorded_by_user_id : FK to the user who entered the record.
        created_at       : System timestamp when the record was persisted.
    """
    __tablename__ = "dispensing"

    id = Column(Integer, primary_key=True, index=True)
    dispensed_date = Column(Date, nullable=False, index=True)
    patient_name = Column(String, nullable=False, index=True)
    medicine_id = Column(Integer, ForeignKey("medicines.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Float, nullable=False, default=0.0)
    gst_percent = Column(Float, nullable=False, default=0.0)
    total_amount = Column(Float, nullable=False, default=0.0)
    notes = Column(String, nullable=True)
    recorded_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))

    medicine = relationship("Medicine")
    recorded_by = relationship("User")

    def __repr__(self) -> str:
        return f"<Dispensing id={self.id} patient={self.patient_name!r} medicine_id={self.medicine_id}>"

# ==============================================================================
# FINANCE MANAGEMENT MODULE
# ==============================================================================

class PatientIdentifier(Base):
    """Master list of patient identifier types."""
    __tablename__ = "patient_identifier"
    id = Column(Integer, primary_key=True, index=True)
    id_name = Column(String, nullable=False, unique=True)
    is_active = Column(Boolean, default=True)

class PatientService(Base):
    """Master list of patient services."""
    __tablename__ = "patient_services"
    id = Column(Integer, primary_key=True, index=True)
    service_name = Column(String, nullable=False, unique=True)
    is_active = Column(Boolean, default=True)

class PaymentModeMaster(Base):
    """Master list of payment modes for Finance Module."""
    __tablename__ = "payment_mode"
    id = Column(Integer, primary_key=True, index=True)
    mode = Column(String, nullable=False, unique=True)
    is_active = Column(Boolean, default=True)

class PatientPayment(Base):
    """Core transaction record capturing the patient's visit and overall bill."""
    __tablename__ = "patient_payment"
    id = Column(Integer, primary_key=True, index=True)
    patient_name = Column(String, nullable=False)
    payment_date = Column(Date, nullable=False)
    total_amount = Column(Float, nullable=False, default=0.0)
    gst_amount = Column(Float, default=0.0)
    notes = Column(String, nullable=True)
    free_flag = Column(Boolean, nullable=False, default=False)
    token_no = Column(Integer, nullable=True)
    payment_status = Column(String, nullable=False, default="PAID") # PAID, PARTIAL, DUE
    
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_date = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc), nullable=False)
    modified_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    modified_date = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc), onupdate=lambda: datetime.datetime.now(datetime.timezone.utc), nullable=False)
    
    # Soft Delete Fields
    is_deleted = Column(Boolean, default=False, index=True)
    deleted_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    deleted_at = Column(DateTime, nullable=True)

    creator = relationship("User", foreign_keys=[created_by])
    modifier = relationship("User", foreign_keys=[modified_by])
    identifiers = relationship("PatientPaymentIdentifier", back_populates="patient_payment", cascade="all, delete-orphan")
    services = relationship("PatientPaymentService", back_populates="patient_payment", cascade="all, delete-orphan")
    payments = relationship("PatientPaymentValue", back_populates="patient_payment", cascade="all, delete-orphan")

class ExpenseType(Base):
    """Master list of expense categories."""
    __tablename__ = "expense_types"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
    is_active = Column(Boolean, default=True)

class Expense(Base):
    """Clinic/Pharmacy operational expenses."""
    __tablename__ = "expenses"
    id = Column(Integer, primary_key=True, index=True)
    expense_date = Column(Date, nullable=False)
    expense_type_id = Column(Integer, ForeignKey("expense_types.id"), nullable=False)
    details = Column(String, nullable=False)
    reference_number = Column(String, nullable=True)
    
    amount = Column(Numeric(10, 2), nullable=False)
    gst_amount = Column(Numeric(10, 2), default=0.0)
    total_amount = Column(Numeric(10, 2), nullable=False)
    notes = Column(String, nullable=True)
    
    # Audit Fields
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_date = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc), nullable=False)
    modified_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    modified_date = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc), onupdate=lambda: datetime.datetime.now(datetime.timezone.utc), nullable=False)
    
    # Soft Delete
    is_deleted = Column(Boolean, default=False, index=True)
    deleted_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    deleted_at = Column(DateTime, nullable=True)

    expense_type = relationship("ExpenseType")
    creator = relationship("User", foreign_keys=[created_by])
    modifier = relationship("User", foreign_keys=[modified_by])
    payments = relationship("ExpensePayment", back_populates="expense", cascade="all, delete-orphan")

class ExpensePayment(Base):
    """Individual payment entries for an expense (supports split payments)."""
    __tablename__ = "expense_payments"
    id = Column(Integer, primary_key=True, index=True)
    expense_id = Column(Integer, ForeignKey("expenses.id"), nullable=False)
    payment_mode_id = Column(Integer, ForeignKey("payment_mode.id"), nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    notes = Column(String, nullable=True)
    modified_date = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc), onupdate=lambda: datetime.datetime.now(datetime.timezone.utc), nullable=False)

    expense = relationship("Expense", back_populates="payments")
    payment_mode = relationship("PaymentModeMaster")

class PatientPaymentIdentifier(Base):
    """Junction mapping PatientPayment to PatientIdentifier."""
    __tablename__ = "ptnt_pymnt_x_ptnt_id"
    id = Column(Integer, primary_key=True, index=True)
    patient_payment_id = Column(Integer, ForeignKey("patient_payment.id", ondelete="CASCADE"), nullable=False)
    identifier_id = Column(Integer, ForeignKey("patient_identifier.id", ondelete="RESTRICT"), nullable=False)
    id_value = Column(String, nullable=False)

    patient_payment = relationship("PatientPayment", back_populates="identifiers")
    identifier = relationship("PatientIdentifier")

class PatientPaymentService(Base):
    """Junction mapping PatientPayment to PatientService."""
    __tablename__ = "ptnt_pmnt_x_ptnt_srvcs"
    id = Column(Integer, primary_key=True, index=True)
    patient_payment_id = Column(Integer, ForeignKey("patient_payment.id", ondelete="CASCADE"), nullable=False)
    service_id = Column(Integer, ForeignKey("patient_services.id", ondelete="RESTRICT"), nullable=False)
    amount = Column(Float, nullable=False, default=0.0)

    patient_payment = relationship("PatientPayment", back_populates="services")
    service = relationship("PatientService")

class PatientPaymentValue(Base):
    """Details the exact payment breakdown for the entire transaction (aggregate)."""
    __tablename__ = "ptnt_pmnt_value"
    id = Column(Integer, primary_key=True, index=True)
    patient_payment_id = Column(Integer, ForeignKey("patient_payment.id", ondelete="CASCADE"), nullable=False)
    payment_mode_id = Column(Integer, ForeignKey("payment_mode.id", ondelete="RESTRICT"), nullable=False)
    value = Column(Float, nullable=False, default=0.0)
    notes = Column(String, nullable=True)
    modified_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    modified_date = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc), onupdate=lambda: datetime.datetime.now(datetime.timezone.utc), nullable=False)

    patient_payment = relationship("PatientPayment", back_populates="payments")
    payment_mode = relationship("PaymentModeMaster")
    modifier = relationship("User", foreign_keys=[modified_by])

class DailyFinanceSummary(Base):
    """Aggregated daily financial summary for reporting."""
    __tablename__ = "daily_finance_summary"
    id = Column(Integer, primary_key=True, index=True)
    summary_date = Column(Date, nullable=False, unique=True, index=True)
    patient_count = Column(Integer, default=0)
    total_revenue = Column(Float, default=0.0)
    total_collected = Column(Float, default=0.0)
    total_gst = Column(Float, default=0.0)
    
    # Expense Aggregation
    total_expenses = Column(Float, default=0.0)
    total_expense_gst = Column(Float, default=0.0)
    
    # JSON breakdowns for flexibility
    service_breakdown = Column(JSON, default=dict) # {service_name: total_amount}
    payment_breakdown = Column(JSON, default=dict) # {mode_name: total_value}
    expense_breakdown = Column(JSON, default=dict) # {expense_type: total_amount}
    
    last_updated = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
