-- ==============================================================================
-- Finance Management Master Data
-- Source: Development Database
-- Date: 2026-04-25
-- Description: Idempotent script to seed master data for identifiers, services, 
--              and payment modes with sequence synchronization.
-- ==============================================================================

-- 1. Patient Identifiers (patient_identifier)
INSERT INTO patient_identifier (id, id_name, is_active) VALUES
(1, 'File No', true),
(2, 'Easy Clinic Reference', true),
(3, 'RCH ID', true),
(4, 'UHID', true)
ON CONFLICT (id) DO UPDATE SET 
    id_name = EXCLUDED.id_name, 
    is_active = EXCLUDED.is_active;

-- 2. Patient Services (patient_services)
INSERT INTO patient_services (id, service_name, is_active) VALUES
(1, 'Consultation', true),
(2, 'Medicine', true),
(3, 'Scan', true),
(4, 'Investigation', true),
(5, 'Services', true)
ON CONFLICT (id) DO UPDATE SET 
    service_name = EXCLUDED.service_name, 
    is_active = EXCLUDED.is_active;

-- 3. Payment Modes (payment_mode)
INSERT INTO payment_mode (id, mode, is_active) VALUES
(1, 'Cash', true),
(2, 'UPI - (Gpay)', true),
(3, 'Credit Card', true)
ON CONFLICT (id) DO UPDATE SET 
    mode = EXCLUDED.mode, 
    is_active = EXCLUDED.is_active;

-- ==============================================================================
-- Reset Sequences to prevent ID collisions on future manual entries
-- ==============================================================================
SELECT setval('patient_identifier_id_seq', (SELECT COALESCE(max(id), 1) FROM patient_identifier));
SELECT setval('patient_services_id_seq', (SELECT COALESCE(max(id), 1) FROM patient_services));
SELECT setval('payment_mode_id_seq', (SELECT COALESCE(max(id), 1) FROM payment_mode));
