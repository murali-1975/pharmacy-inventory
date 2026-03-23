"""
SQLAlchemy database models for the Pharmacy Inventory system.
Defines the relational schema for users, suppliers, medicines, and invoices.
"""
from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Date, Enum, Boolean
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
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    status = relationship("Status")

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
    SCHEDULE_H = "Scheduled H"
    SCHEDULE_H1 = "Scheduled H1"
    SCHEDULE_X = "Scheduled X"
    OTC = "OTC"
    GENERAL = "General"

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
    product_name = Column(String, index=True, nullable=False) # Brand name
    generic_name = Column(String, index=True) # Salt composition
    description = Column(String, nullable=True)
    unit_price = Column(Float, default=0.0)
    manufacturer_id = Column(Integer, ForeignKey("manufacturers.id"))
    hsn_code = Column(String(8))
    category = Column(Enum(MedicineCategory), default=MedicineCategory.GENERAL)
    uom = Column(String) # Unit of Measure: Strip, Bottle, Vial, Each
    storage_type = Column(String) # Ambient, Cold Chain (2-8°C), or Controlled
    is_active = Column(Boolean, default=True)
    
    manufacturer = relationship("Manufacturer", back_populates="medicines")
    line_items = relationship("InvoiceLineItem", back_populates="medicine")

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
    price = Column(Float, nullable=False)
    discount = Column(Float, default=0.0)
    expiry_date = Column(Date, nullable=True)
    remarks = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

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
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    invoice = relationship("Invoice", back_populates="payments")
