from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Date, Enum, Boolean
from sqlalchemy.orm import relationship
from .database import Base
import datetime
import enum

class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    supplier_type = Column(String)  # e.g., Pharmacy, Printer
    status = Column(String, default="Active")
    is_deleted = Column(Boolean, default=False)
    deleted_at = Column(DateTime, nullable=True)

    bank_details = relationship("SupplierBankDetail", back_populates="supplier")
    invoices = relationship("Invoice", back_populates="supplier")

class SupplierBankDetail(Base):
    __tablename__ = "supplier_bank_details"

    id = Column(Integer, primary_key=True, index=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    account_name = Column(String)
    account_number = Column(String)
    ifsc_code = Column(String)
    bank_reference = Column(String)
    remarks = Column(String)
    status = Column(String, default="Active")

    supplier = relationship("Supplier", back_populates="bank_details")

class Medicine(Base):
    __tablename__ = "medicines"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    description = Column(String)
    
    line_items = relationship("InvoiceLineItem", back_populates="medicine")

class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    invoice_date = Column(Date, default=datetime.date.today)
    reference_number = Column(String, unique=True, index=True, nullable=False)
    total_value = Column(Float, nullable=False)
    gst = Column(Float, default=0.0)
    
    supplier = relationship("Supplier", back_populates="invoices")
    line_items = relationship("InvoiceLineItem", back_populates="invoice")

class InvoiceLineItem(Base):
    __tablename__ = "invoice_line_items"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False)
    medicine_id = Column(Integer, ForeignKey("medicines.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    price = Column(Float, nullable=False)
    discount = Column(Float, default=0.0)
    expiry_date = Column(Date, nullable=False)
    remarks = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    invoice = relationship("Invoice", back_populates="line_items")
    medicine = relationship("Medicine", back_populates="line_items")
