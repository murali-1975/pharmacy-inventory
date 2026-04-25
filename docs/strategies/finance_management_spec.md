# Finance Management Module Implementation Plan

This document outlines the high-level strategy and architectural specification for the Finance Management module, incorporating the `patient_payment` data model and adhering strictly to the project's Operational Style.

> [!NOTE]
> **Refactor Update (Phase 4)**: The module has been hardened for security and refactored for maintainability. It now features a modular frontend component library, standardized backend exception handling, and advanced date-range filtering.

## User Review Required

> [!IMPORTANT]
> The database schema uses a **Soft Delete** pattern for all payment records. Admin users can delete records, which triggers a background recalculation of the `DailyFinanceSummary`. All reports and analytics automatically filter out deleted records.

## Proposed Changes

We utilize the feature flag: `FINANCE_MANAGEMENT`.

### Operational Approach (Refactored TDD)

Following the project's operational style, we have implemented:
1. **Hardened Security (OWASP Top 10)**:
   - **A01: Broken Access Control**: Enforced strict RBAC and `is_deleted` filters at the service layer.
   - **A04: Insecure Design**: Implemented balance-checking logic for bulk uploads and structured row-validators.
   - **A09: Security Logging & Monitoring**: Integrated structured logging for all financial transactions and failures.
2. **Standardized Error Handling**:
   - Introduced a rich exception hierarchy in `backend/app/utils.py` (e.g., `AppError`, `ValidationError`).
   - Centralized database transaction management with automatic rollbacks via `db_error_handler`.
3. **Modular Frontend**:
   - Extracted UI logic into `FinanceFormComponents.jsx` to ensure consistency and reusability.

### Backend: Database & Models

 SQLAlchemy models in `backend/app/models/finance.py`:

- **Master Data Tables (Admin Access Only)**:
  - `PatientIdentifier`: Master list of identifier types.
  - `PatientService`: Master list of services offered.
  - `PaymentMode`: Master list of payment methods.

- **Transaction Tables**:
  - `PatientPayment`: Core record capturing the overall bill. Includes `is_deleted` and audit fields.
  - `PatientPaymentIdentifier`: Junction table mapping payments to identifiers.
  - `PatientPaymentService`: Junction table linking payments to services with specific amounts.
  - `PatientPaymentValue`: Aggregate payment breakdown linking payments to modes and values.

### Backend: API Endpoints

- Endpoints in `backend/app/api/endpoints/finance.py`:
  - **General Endpoints**:
    - `POST /finance/payments`: Atomic 4-table transaction for recording payments.
    - `GET /finance/payments`: Paginated history. **Enhanced with `from_date` and `to_date` range filtering.**
    - `POST /finance/payments/bulk`: (Admin Only) Columnar bulk upload with balance validation.
    - `DELETE /finance/payments/{id}`: (Admin Only) Soft Delete with summary recalculation.
  - **Analytics & Reports**:
    - `GET /finance/reports/summary`: Aggregated daily reports with columnar breakdowns.
    - `GET /finance/analytics/dashboard`: Revenue metrics and trends.

### Frontend: UI & Component Architecture

- **Component Library (`views/Finance/components/`)**:
  - `FinanceFormComponents.jsx`: Atomic components for Section Headers, Form Groups, and Entry Rows.
- **Views**:
  - `PatientPaymentForm.jsx`: Refactored to use modular components; handles service-level costs and split-payments.
  - `PaymentHistoryTable.jsx`: **Enhanced with Advanced Date Filters** (Specific Date, From/To range) and "Today" quick-action.
  - `DailySummaryReport.jsx`: Columnar financial dashboard with automated GST tracking.

## Verification Plan

### Automated Regression
- **Backend Tests (Pytest)**: Full suite of 171+ tests covering RBAC, soft-delete, and date-range filtering logic.
- **Frontend Tests (Vitest)**: Comprehensive suite of 150+ tests covering component rendering, form validation, and placeholder interactions.

### Security Verification
1. **Negative Amount Prevention**: Verified that services and payments cannot have negative values.
2. **Balance Integrity**: Verified that aggregate payment totals must match the sum of service costs.
3. **Soft Delete Integrity**: Verified that deleted records do not appear in reports or analytics.

### Manual Verification
1. **Range Filtering**: Verify the "From/To" date pickers correctly isolate transaction records.
2. **Modular Form**: Verify that the refactored form correctly persists all nested service and payment data.
3. **Audit Trail**: Verify that `created_by` and `modified_by` are correctly recorded in the database.
