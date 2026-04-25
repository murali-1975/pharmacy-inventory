#!/bin/bash
# Reusable script to reset finance data via Docker
docker compose exec -T db psql -U postgres -d pharmacy_inventory -f "/app/sql scripts/reset_finance_data.sql"
