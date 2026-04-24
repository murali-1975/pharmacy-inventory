# Finance Management Module Implementation Plan

This document outlines the high-level strategy for implementing the new Finance Management module behind a feature toggle, incorporating the `patient_payment` data model and adhering strictly to the project's Operational Style.

> [!NOTE]
> **Future Phase Planning**: As requested, the implementation of daily aggregation of income and management of expenses is deferred and will be added in a future phase. The current scope focuses entirely on the core patient payment tracking.

## User Review Required

> [!IMPORTANT]
> The database schema generated from `patient_payment.sql` contains a few foreign key anomalies (e.g., `(patient, services) REFERENCES patient_payment(id, id)` and `ptnt_pymnt_x_ptnt_id.id` referencing `patient_identifier.id` directly instead of a dedicated foreign key column). 
> I plan to normalize these relationships when creating the SQLAlchemy models to ensure referential integrity while retaining the core structure you provided. Please confirm if it's acceptable for me to fix these minor schema inconsistencies during implementation.

## Proposed Changes

We will introduce a new feature flag: `FINANCE_MANAGEMENT`.

### Operational Approach (Test-Driven Development)

Per the `rules.md` operational style, we will follow a strict **Test-Driven Development (TDD)** approach:
1. **Write Unit Tests First**: We will write failing Pytest and Vitest test cases for models, endpoints, and UI components before writing the actual implementation.
2. **Robust Error Handling & Logging**: All API endpoints and database operations will implement comprehensive exception handling and logging.
3. **Documentation**: We will ensure proper code documentation (docstrings) for all new modules and update the main `README.md` to describe the new Finance Management feature.

### Backend: Database & Models

Based on `patient_payment.sql`, we will create the following SQLAlchemy models in `backend/app/models/finance.py` (using `snake_case`):

- **Master Data Tables (Admin Access Only)**:
  - `PatientIdentifier` (`patient_identifier`): Master list of identifier types (id, id_name, is_active).
  - `PatientService` (`patient_services`): Master list of services offered (id, service_name, is_active).
  - `PaymentMode` (`payment_mode`): Master list of payment methods (id, mode, is_active).

- **Transaction Tables**:
  - `PatientPayment` (`patient_payment`): Core record capturing the patient's visit and overall bill (patient_name, payment_date, total_amount, gst_amount, notes, free_flag, token_no). Includes audit fields mapping to the `users` table (`created_by`, `modified_by`).
  - `PatientPaymentIdentifier` (`ptnt_pymnt_x_ptnt_id`): Junction table mapping a specific `PatientPayment` to a `PatientIdentifier` (e.g., Aadhar Card: 12345).
  - `PatientPaymentService` (`ptnt_pmnt_x_ptnt_srvcs`): Junction table linking a `PatientPayment` to a `PatientService`. Includes an `amount` column for the cost of that service instance.
  - `PatientPaymentValue` (`ptnt_pmnt_value`): Details the exact payment breakdown for the entire transaction (aggregate), linking the `PatientPayment` directly to `PaymentMode` and specifying the `value` paid (e.g., split across Cash and UPI).

### Backend: API Endpoints

- Create `backend/app/api/endpoints/finance.py` with the following routes (incorporating logging and strict Pydantic validation):
  - **Admin Restricted Endpoints**:
    - `POST /finance/masters/{entity}`: Create new master identifier, service, or payment mode.
    - `PUT /finance/masters/{entity}/{id}`: Update an existing master record (name/type).
    - `PATCH /finance/masters/{entity}/{id}/toggle`: Enable/disable a master record (Soft delete pattern).
  - **General Endpoints**:
    - `GET /finance/masters`: Fetches master identifiers, services, and payment modes. Supports `include_inactive=true` for admin management.
    - `POST /finance/payments`: Creates a new patient payment record with nested services and payment breakdowns. Implements a 4-table atomic transaction.
    - `POST /finance/payments/bulk`: (Admin Only) Processes Excel-based bulk uploads of patient payments.
    - `GET /finance/payments/template`: (Admin Only) Downloads the Excel template for bulk uploads.
    - `GET /finance/payments`: Retrieves paginated payment history.
    - `GET /finance/analytics/dashboard`: Fetches aggregated revenue metrics, service distribution, and collection trends for the dashboard.
- Register the new router in `backend/app/main.py`.

### Frontend: UI & Feature Toggle

- **Environment**: Add `FINANCE_MANAGEMENT` to the `FEATURE_FLAGS` environment variable.
- **Routing & Navigation**:
  - Update `frontend/src/App.jsx` to include a new route for `/finance`.
  - Wrap the route and navigation links using the existing `<Feature name="FINANCE_MANAGEMENT">` component.

- **Views & Components (`frontend/src/views/Finance/`)**:
  - `MasterDataManagement.jsx` (Admin Only): A premium tabbed interface for managing master data.
  - `FinanceDashboard.jsx`: High-level analytics hub showing monthly/daily revenue, service-wise income distribution, and payment mode breakdowns.
  - `PatientPaymentForm.jsx`: A comprehensive multi-step form for recording patient visits, services, and aggregate payment methods. Supports recording costs per service and splitting the total bill across multiple payment modes. Handles `Free / Charity` visits by bypassing payment requirements.
  - `PaymentDetailsModal.jsx`: A detailed view component for reviewing full transaction breakdowns, including service costs and payment distributions.
  - `FinanceBulkUpload.jsx` (Admin Only): Tab for processing Excel files. Uses an aggregated grouping logic to reconcile services and payments from flat rows.
  - `PaymentHistoryTable.jsx`: View past transactions with advanced filtering and deep-dive detail views.

## Verification Plan

### Test-Driven Automated Tests
- **Backend Tests (Pytest)**: Implement tests for all finance endpoints *before* writing the API routes. Ensure tests cover data validation, foreign key constraint handling, transaction rollbacks on failure, and RBAC verifying that standard users cannot modify Master Data. Verify that proper logging occurs during simulated errors.
- **Frontend Tests (Vitest/React Testing Library)**: Write component tests for `PatientPaymentForm.jsx`, `FinanceDashboard.jsx`, and `MasterDataManagement.jsx` *before* building them. Verify that the Finance module is completely inaccessible in the UI when the feature flag is disabled.
- **Regression Testing**: Run the full regression suite (both frontend and backend) to guarantee that the addition of the new Finance Management models and endpoints does not disrupt or fail any existing inventory or pharmacy functionalities.

### Deployment & Source Control Constraint
> [!WARNING]
> After completing regression testing, **DO NOT check in the code or trigger a cloud build**. Await further instructions from the user before committing or deploying any changes.

### Manual Verification
1. **Toggle Verification**: Ensure the module is hidden when `FINANCE_MANAGEMENT` is not in `.env`.
2. **Data Entry Flow**: Navigate to the new payment form, select services and payment modes, submit, and verify all 7 tables update correctly in PostgreSQL.
3. **Role-Based Access**: Verify that only Admin users can modify the master data tables.
4. **Documentation**: Verify that the repository's `README.md` has been updated to include the Finance Management module instructions.
