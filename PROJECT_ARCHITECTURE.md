# Pharmacy Inventory — Project Architecture

This document provides a technical overview of the system's design patterns, reliability features, and containerization strategy.

---

## Tech Stack Overview

### Frontend
- **Framework**: React 19 (Vite 8)
- **Styling**: Tailwind CSS v4 (modern utility-first design)
- **State Management**: Custom React Hooks (`useInvoices`, `useStock`, `useDispensing`, etc.)
- **Auth**: JWT stored in `localStorage`; auto-attached to requests via `api/index.js` interceptor

### Backend
- **Framework**: FastAPI (Python 3.12+)
- **Security**: OAuth2 Password Flow, signed JWTs (HS256), RBAC (Admin, Manager, Staff)
- **Error Handling**: Centralized `db_error_handler` context manager across all routers
- **CORS**: Wildcard (`*`) allowed — suitable for Docker-proxied environments

### Database
- **Engine**: PostgreSQL 15 (production) / SQLite (CI/local testing)
- **ORM**: SQLAlchemy 2.x (`declarative_base` from `sqlalchemy.orm`)
- **Policy**: Schema-first development; automatic cold-boot seeding on startup

---

## Backend Structure (`/backend/app`)

| File / Directory       | Responsibility                                                                                             |
|------------------------|------------------------------------------------------------------------------------------------------------|
| `main.py`              | App entrypoint; lifespan (startup/shutdown), global exception handlers, router mounting, CORS middleware   |
| `models.py`            | SQLAlchemy ORM definitions for all 12 tables                                                               |
| `schemas.py`           | Pydantic v2 request/response schemas (with `from_attributes = True`)                                       |
| `database.py`          | Engine and `SessionLocal` factory; `get_db()` FastAPI dependency                                           |
| `auth.py`              | PBKDF2-SHA256 password hashing, JWT creation/validation, `RoleChecker` dependency                         |
| `utils.py`             | `db_error_handler` context manager for unified error handling in all routers                               |
| `seed.py`              | Idempotent startup seeding (statuses, supplier types, default admin user)                                  |
| `core/config.py`       | `pydantic-settings` based configuration; `SECRET_KEY` is required at startup                               |
| `core/logging_config.py` | Structured logging setup and `LoggingMiddleware`                                                         |
| `routers/`             | One file per API domain (routes traffic to services)                                                       |
| `services/`            | Core business logic layer (Fat Service, Thin Router pattern)                                              |

### Router Modules

| Router file          | Prefix             | Roles Required (Write)       | Notes                                             |
|----------------------|--------------------|------------------------------|---------------------------------------------------|
| `auth.py`            | `/token`           | —                            | Returns JWT on valid credentials                  |
| `suppliers.py`       | `/suppliers`       | Admin, Manager               | V2 schema: nested contact + bank accounts         |
| `medicines.py`       | `/medicines`       | Admin, Manager               | Master drug data with manufacturer linkage        |
| `manufacturers.py`   | `/manufacturers`   | Admin, Manager               | Manufacturer master data                          |
| `invoices.py`        | `/invoices`        | Admin, Manager               | Paginated + searchable; calls `InvoiceService`    |
| `stock.py`           | `/stock`           | Admin only                   | Manual adjustments and stock audit trail          |
| `dispensing.py`      | `/dispensing`      | All authenticated            | Calls `DispensingService`; Atomic stock deduction |
| `analytics.py`       | `/analytics`       | All authenticated            | Dashboard card metrics and KPI tracking           |
| `financials.py`      | `/financials`      | Admin only                   | Advanced reporting: GST, Profit, Aging, Valuation |
| `lookups.py`         | `/lookups`         | Admin only                   | Statuses and Supplier Types with soft/hard delete |
| `users.py`           | `/users`           | Admin only                   | User CRUD; self-service password via `/me/password` |

---

## Data Model Overview

```
User ────────────────────────── role: Admin | Manager | Staff
Supplier ──┬── SupplierContactDetail  (1:1)
           └── SupplierBankAccount[]  (1:N)
Manufacturer ── Medicine[] ────┬── InvoiceLineItem[]
                               ├── MedicineStock          (1:1 — live qty_on_hand)
                               └── StockAdjustment[]      (immutable audit trail)
Invoice ────┬── InvoiceLineItem[]     (auto-updates MedicineStock on create)
            └── InvoicePayment[]      (auto-settles Invoice to "Paid" when sum >= total_value)
Dispensing  ─── (creates StockAdjustment type=DISPENSED + deducts MedicineStock)
```

---

## Key Design Patterns

### 1. Unified Database Error Handling (`utils.db_error_handler`)

Every router wraps its database operations in the `db_error_handler` context manager:

```python
with utils.db_error_handler("invoice creation", db):
    # ... queries, inserts, commits ...
```

Behaviour:
- **`IntegrityError`** (unique constraint, FK violation) → rolls back → HTTP **409 Conflict**
- **Other `SQLAlchemyError`** (connection, query failure) → rolls back → HTTP **500**
- **`HTTPException`** (404, 400, 403 raised by business logic) → re-raised unchanged
- **Any other `Exception`** → rolls back → HTTP **500** with `exc_info=True` logging

### 2. Atomic Dispensing & FEFO Logic (`services/dispensing_service.py`)

The dispensing workflow is abstracted into a service to ensure atomicity and consistency:

1. **Price Fallback Precedence**:
   - Primary: `StockBatch.mrp` (from earliest expiring batch).
   - Fallback: `Medicine.unit_price` (Master price) if batch MRP is 0 or missing.
   - Defaults: GST defaults to 5% if master price is used.
2. **FEFO Deduction**: Stock is deducted from the earliest expiring batches first (**First Expiring, First Out**).
3. **Check/Deduct**: Verifies `quantity_on_hand` >= requested.
4. **Write Audit**: Creates a `StockAdjustment` record linked to the dispensing event.
5. **Commit**: All operations (deduction, audit, dispensing record) occur in a single transaction.

**Cancel (DELETE)** reverses these steps: restores specific batch stock, writes a reversal audit, and drops the record.

### 3. Invoice → Stock Auto-Update (`routers/invoices.py`)

When a purchase invoice is created with medicine line items:
1. A `MedicineStock` record is created if one doesn't already exist
2. `quantity_on_hand` is incremented by the line item quantity
3. A `StockAdjustment` audit record (`type=INVOICE_RECEIPT`) is written immediately

Non-pharmacy line items (those with only a `description`, no `medicine_id`) are skipped — stock is only updated for pharmacy items.

### 4. Invoice Auto-Settlement

When a payment is recorded against an invoice:
- The system sums all recorded payments for that invoice
- If `total_paid >= invoice.total_value`, the invoice status is automatically set to **"Paid"**

### 5. Soft-Delete Policy for Lookups

Deleting a `Status` or `SupplierType` defaults to **soft delete** (`is_active=False`):
- Preserves referential integrity — referenced records are unaffected
- Admin can pass `?hard=true` to permanently delete, but only if no entities reference the record (→ 409 if referenced)

### 6. Application Lifecycle (`main.py` — Lifespan)

The app uses FastAPI's `lifespan` context manager (not the deprecated `@on_event`):
```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    seed.seed_database(db)  # Idempotent — safe to call on every startup
    yield
    # shutdown cleanup (if needed)
```

This ensures:
- Database tables are created via `metadata.create_all()`
- Lookup data and the default admin account are seeded on first boot
- No data is corrupted on subsequent restarts (idempotent seeding)

---

## Stock Adjustment Type Reference

| `adjustment_type`    | Trigger                                               | `quantity_change` |
|----------------------|-------------------------------------------------------|-------------------|
| `Opening Balance`    | `POST /stock/initialize` (Admin, go-live seeding)    | Positive (set)    |
| `Invoice Receipt`    | `POST /invoices/` (auto, medicine line items only)   | Positive (+N)     |
| `Manual Adjustment`  | `POST /stock/adjust` (Admin only)                    | Positive or Negative |
| `Write-Off`          | `POST /stock/adjust` (Admin only, damaged/expired)   | Negative (-N)     |
| `Dispensed`          | `POST /dispensing/` (all authenticated users)        | Negative (-N)     |

---

## Containerization Strategy

```
docker-compose.yml
├── db        PostgreSQL 15-alpine, persistent volume, port 5432
├── backend   FastAPI + Uvicorn, waits for db health, port 8000
├── frontend  React (Nginx), reverse-proxies /api/ to backend, port 80
└── pgadmin   pgAdmin 4 for database management, port 8080
```

Network: all services share a Docker bridge network (`pharmacy_net`).

---

## Testing Strategy

### Backend (`pytest`)

| Marker        | What it covers                                         | File examples                        |
|---------------|--------------------------------------------------------|--------------------------------------|
| `integration` | API endpoints + database (SQLite in-memory per test)  | `test_invoices.py`, `test_stock.py`  |
| `unit`        | Pure logic and services                                | `test_unit.py`                       |

Test isolation: each test function gets a freshly created + fully dropped SQLite database via the `db` fixture in `conftest.py`.

### Frontend (`Vitest` + `Playwright`)

- **Component Testing (Vitest)**: Unit tests for React components (`@testing-library/react`) in `frontend/src/tests/`.
- **E2E Testing (Playwright)**: Full browser flows: login, invoice creation, and dispensing.
- **Coverage Goal**: Target **60%+** cumulative coverage for frontend views and business logic.

---

## Performance and Quality

- **Test coverage**: ~90 integration tests across all API domains
- **Code quality**: Timezone-aware datetime throughout (`datetime.now(timezone.utc)`), `Optional[T]` type hints (Python 3.9 compatible), consistent docstrings on all public functions
- **Database**: Connection pool tuned for PostgreSQL (`pool_size=20`, `max_overflow=40`, `pool_pre_ping=True`)
- **Responsiveness**: Mobile-first UI suitable for pharmacy floor tablets and office desktops
