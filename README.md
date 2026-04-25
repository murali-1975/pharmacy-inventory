# Pharmacy Inventory System

A modern pharmacy inventory management application built with FastAPI and React, designed for high reliability and transaction safety.

## Project Structure

```
pharmacy-inventory/
├── backend/                    # FastAPI application
│   ├── app/
│   │   ├── core/              # Config and logging setup
│   │   ├── routers/           # API route handlers
│   │   ├── services/          # Core business logic layer
│   │   ├── main.py            # App entrypoint, middleware, lifespan
│   │   ├── models.py          # SQLAlchemy ORM models
│   │   ├── schemas.py         # Pydantic request/response schemas
│   │   ├── database.py        # DB engine and session factory
│   │   ├── auth.py            # JWT auth and RBAC
│   │   ├── seed.py            # Startup data seeding
│   │   └── utils.py           # Shared error handling utilities
│   └── tests/                 # pytest integration test suite
├── frontend/                   # React (Vite) application
├── docker-compose.yml          # Full-stack orchestration
└── PROJECT_ARCHITECTURE.md     # Detailed technical architecture
```

## Getting Started

### 1. Docker Setup (Recommended)
The easiest way to run the entire stack is using Docker. This will spin up the PostgreSQL database, the backend API, and the frontend dashboard automatically.

```bash
# Run the complete stack
docker-compose up --build
```

**Access Points:**
| Service     | URL                            |
|-------------|-------------------------------|
| Frontend    | http://localhost:80            |
| Backend API | http://localhost:8000          |
| API Docs    | http://localhost:8000/docs     |
| pgAdmin     | http://localhost:8080          |

### Default Credentials
| Account        | Username | Password    |
|----------------|----------|-------------|
| Admin (App)    | `admin`  | `admin1234$` |
| pgAdmin (DB)   | `admin@pharmacy.com` | `admin` |

---

### 2. Manual Local Setup
If you prefer to run services manually:

#### Backend Setup
```bash
cd backend
python -m venv venv
.\venv\Scripts\activate          # Windows
# source venv/bin/activate       # Unix/macOS
pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

#### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

---

## Environment Variables

Create a `.env` file in the `backend/` directory based on `.env.example`:

| Variable                    | Required | Description                                           |
|-----------------------------|----------|-------------------------------------------------------|
| `SECRET_KEY`                | ✅ Yes   | Random string for JWT signing (min. 32 chars)        |
| `DATABASE_URL`              | ✅ Yes   | PostgreSQL connection string                         |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No     | JWT lifetime in minutes (default: 30)                |
| `APP_NAME`                  | No       | Displayed in Swagger UI title                        |

---

## Core Features

1. **Medicine Inventory Management** — Comprehensive tracking of medicines, brands, categories, and manufacturers.
2. **Medicine Dispensing Module** — High-performance interface for daily patient-wise medicine distribution with **FEFO** (First Expiring, First Out) logic and price fallbacks.
3. **Financial Reporting** — Asset valuation, GST reconciliation (Input vs Output), Supplier aging, and medicine-wise profit margin tracking.
4. **Dashboard Analytics** — Real-time KPIs for low stock alerts, monthly procurement totals, and revenue trends.
5. **Supplier Management (V2)** — Granular normalized schema: address, contact details, and multiple bank accounts per supplier.
6. **Invoice Workflow** — Digital procurement workflow: create invoices → add line items → auto-increment stock → record payments → auto-settle.
7. **Stock Tracking** — Intelligent stock ledger with audit trail for every change (invoice receipts, manual adjustments, dispensing, write-offs, opening balance).
8. **RBAC** — Role-based access: Admin, Manager, Staff with endpoint-level guards.
9. **Unified Error Handling** — Automated database error handlers with auto-rollback and structured HTTP error mapping.
10. **Finance Management (Feature Toggled)** — Patient payment tracking including patient identifiers, multiple services rendered, and multi-mode payment breakdown. Supports **Admin-only Soft Delete** with automated audit trails and summary recalculation. Currently scoped behind the `FINANCE_MANAGEMENT` flag.
11. **Daily Finance Reporting** — Automated daily aggregation of patient counts, revenue breakdowns (per service/payment mode), and precise GST liability tracking (calculated at 5% for Medicine/Pharmacy services).

---

## API Endpoints Summary

| Module         | Prefix            | Key Endpoints                                                              |
|----------------|-------------------|----------------------------------------------------------------------------|
| Auth           | `/token`          | POST (login, get JWT)                                                      |
| Suppliers      | `/suppliers`      | GET, POST, PUT, DELETE                                                     |
| Medicines      | `/medicines`      | GET, POST, PUT, DELETE                                                     |
| Manufacturers  | `/manufacturers`  | GET, POST, PUT, DELETE                                                     |
| Invoices       | `/invoices`       | GET, POST, PUT, DELETE; `/payments` sub-resource                           |
| Stock          | `/stock`          | GET, POST `/adjust`, POST `/initialize`, GET `/adjustments`                |
| Dispensing     | `/dispensing`     | GET (paginated), POST, DELETE (Admin cancel)                               |
| Financials     | `/financials`      | GET `/valuation`, `/aging`, `/gst`, `/profit` (Admin Only)                 |
| Analytics      | `/analytics`       | GET `/stats` (Dashboard KPIs)                                              |
| Lookups        | `/lookups`        | `/status`, `/supplier-types` full CRUD                                     |
| Users          | `/users`          | GET, POST, PUT, DELETE; PUT `/me/password`                                 |
| Finance        | `/finance`        | GET, POST for `/payments`; `/masters` (Identifiers, Services, Modes); GET `/reports/summary` |

---

## Testing and Quality

### 🧪 Backend — pytest Integration Suite (~100+ tests)

Run inside the Docker container:
```bash
docker exec -it pharmacy_backend pytest tests/ -v
```

Or locally in the backend virtual environment:
```bash
cd backend
# All tests
pytest tests/ -v

# Unit tests only (pure logic, no DB)
pytest -m unit

# Integration tests (API + DB flows)
pytest -m integration

# With coverage report
pytest --cov=app tests/

# Specific module
pytest tests/test_invoices.py -v
pytest tests/test_stock.py -v
pytest tests/test_dispensing.py -v
```

### 🌐 Frontend — Vitest & Playwright
```bash
cd frontend
# Unit tests with Vitest (coverage targeted at 60%)
npm test

# E2E tests with Playwright
npx playwright test
```

---

## Technical Stack

| Layer      | Technology                                                   |
|------------|--------------------------------------------------------------|
| Frontend   | React 19, Vite 8, Tailwind CSS v4, Lucide React              |
| Backend    | FastAPI, SQLAlchemy 2.0, Pydantic v2                        |
| Database   | PostgreSQL (Primary), SQLite (CI/Testing)                   |
| Auth       | JWT (python-jose), PBKDF2-SHA256 password hashing           |
| Testing    | Vitest (Frontend), Playwright (E2E), pytest (Backend)       |
| Container  | Docker, Docker Compose, Nginx (frontend reverse proxy)      |

**Key Architecture Patterns:** Lifespan-based startup events, Unified DB error handling with rollback, Immutable stock audit trail, Atomic dispensing transactions, Automated request observability middleware.
---
 
 ## Development Utilities
 
 ### Finance Data Reset
 To clear all patient payment transaction data and daily summaries during development:
 - **Windows (PowerShell)**: `./reset_finance.ps1`
 - **Linux/macOS**: `bash reset_finance.sh`
 
 This will truncate all payment tables and reset ID sequences while preserving master data.
