# Pharmacy Inventory System

A modern pharmacy inventory management application built with FastAPI and React, designed for high reliability and transaction safety.

## Project Structure

```
pharmacy-inventory/
├── backend/                    # FastAPI application
│   ├── app/
│   │   ├── core/              # Config and logging setup
│   │   ├── routers/           # API route handlers (9 modules)
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
2. **Medicine Dispensing Module** — High-performance interface for daily patient-wise medicine distribution with atomic stock deduction and full audit trail.
3. **Supplier Management (V2)** — Granular normalized schema: address, contact details, and multiple bank accounts per supplier.
4. **Invoice Workflow** — Digital procurement workflow: create invoices → add line items → auto-increment stock → record payments → auto-settle.
5. **Stock Tracking** — Intelligent stock ledger with audit trail for every change (invoice receipts, manual adjustments, dispensing, write-offs, opening balance).
6. **Lookup Management** — Soft-delete policy for system statuses and supplier types; Admin-controlled.
7. **RBAC** — Role-based access: Admin, Manager, Staff with endpoint-level guards.
8. **Logging & Observability** — Automated request/response logging middleware with timed file rotation and unified database error handling (auto-rollback & clean HTTP mapping).

---

## API Endpoints Summary

| Module         | Prefix            | Key Endpoints                                                              |
|----------------|-------------------|----------------------------------------------------------------------------|
| Auth           | `/token`          | POST (login, get JWT)                                                      |
| Suppliers      | `/suppliers`      | GET, POST, PUT, DELETE                                                     |
| Medicines      | `/medicines`      | GET, POST, PUT, DELETE                                                     |
| Manufacturers  | `/manufacturers`  | GET, POST, PUT, DELETE                                                     |
| Invoices       | `/invoices`       | GET (paginated, searchable), POST, PUT, DELETE; `/payments` sub-resource   |
| Stock          | `/stock`          | GET (all/filtered), GET `/{id}`, GET `/{id}/adjustments`, POST `/adjust`, POST `/initialize`, GET `/adjustments` |
| Dispensing     | `/dispensing`     | GET (paginated, filterable), POST, GET `/{id}`, DELETE (Admin cancel)      |
| Lookups        | `/lookups`        | `/status`, `/supplier-types` with full CRUD + soft/hard delete             |
| Users          | `/users`          | GET, POST, PUT, DELETE (Admin only); PUT `/me/password` (self-service)     |

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

### 🌐 End-to-End — Playwright
```bash
cd frontend
npx playwright test
```

---

## Technical Stack

| Layer      | Technology                                                   |
|------------|--------------------------------------------------------------|
| Frontend   | React 18, Vite, Vanilla CSS, Lucide React                   |
| Backend    | FastAPI, SQLAlchemy 2.x, Pydantic v2                        |
| Database   | PostgreSQL (Primary), SQLite (CI/Testing)                   |
| Auth       | JWT (python-jose), PBKDF2-SHA256 password hashing           |
| Testing    | pytest, FastAPI TestClient, Playwright                      |
| Container  | Docker, Docker Compose, Nginx (frontend reverse proxy)      |

**Key Architecture Patterns:** Lifespan-based startup events, Unified DB error handling with rollback, Immutable stock audit trail, Atomic dispensing transactions, Automated request observability middleware.
