-- Finance Management Master Data Seed Script
-- Generated on 2026-04-26

-- 1. Patient Identifiers
INSERT INTO patient_identifier (id_name, is_active) VALUES
('File No', true),
('Easy Clinic Reference', true),
('RCH ID', true),
('UHID', true)
ON CONFLICT (id_name) DO NOTHING;

-- 2. Patient Services
INSERT INTO patient_services (service_name, is_active) VALUES
('Consultation', true),
('Medicine', true),
('Scan', true),
('Investigation', true),
('Services', true)
ON CONFLICT (service_name) DO NOTHING;

-- 3. Payment Modes
INSERT INTO payment_mode (mode, is_active) VALUES
('Cash', true),
('UPI - (Gpay)', true),
('Credit Card', true),
('Bank Transfer', true)
ON CONFLICT (mode) DO NOTHING;

-- 4. Expense Types
INSERT INTO expense_types (name, is_active) VALUES
('Pharmacy', true),
('Rent', true),
('Consumables', true),
('Utilities', true),
('Salary', true),
('Subscription', true),
('Government', true),
('Tax', true),
('License', true),
('Maintenance', true),
('Petty Expense', true),
('Insurance', true),
('Transport', true),
('Printer', true),
('Diagnostics', true),
('Loan', true)
ON CONFLICT (name) DO NOTHING;
