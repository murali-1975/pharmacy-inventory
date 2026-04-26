-- Reset Finance Module Transaction Data
-- This script clears all patient payments and their associated junction table records,
-- resets the ID sequences, and clears the daily financial summaries.

BEGIN;

TRUNCATE TABLE 
    patient_payment, 
    ptnt_pmnt_x_ptnt_srvcs, 
    ptnt_pmnt_value, 
    ptnt_pymnt_x_ptnt_id, 
    daily_finance_summary 
RESTART IDENTITY CASCADE;

COMMIT;
