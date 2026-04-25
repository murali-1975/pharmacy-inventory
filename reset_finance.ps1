# Reusable PowerShell script to reset finance data via Docker
docker compose exec -T db psql -U postgres -d pharmacy_inventory -c "TRUNCATE TABLE patient_payment, ptnt_pmnt_x_ptnt_srvcs, ptnt_pmnt_value, ptnt_pymnt_x_ptnt_id, daily_finance_summary RESTART IDENTITY CASCADE;"
