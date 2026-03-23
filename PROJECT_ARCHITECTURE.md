# Pharmacy Inventory Project Architecture

This document provides a high-level overview of the technical architecture of the Pharmacy Inventory system.

## Tech Stack Overview

### Frontend
- **Framework**: React.js (Vite)
- **Styling**: Vanilla CSS (Modern design patterns)
- **State Management**: React Hooks (Custom hooks for API interaction)
- **Auth**: JWT-based authentication stored in LocalStorage

### Backend
- **Framework**: FastAPI (Python 3.10+)
- **Security**: OAuth2 with Password Flow, JWT Tokens, role-based access (Admin, Manager, Staff)
- **CORS**: Configured in `main.py` for frontend interaction

### Database
- **Engine**: PostgreSQL
- **ORM**: SQLAlchemy
- **Models**: Defined in `backend/app/models.py`
- **Schemas**: Pydantic models in `backend/app/schemas.py` for data validation and serialization

## Core Components

### 1. Backend Structure (`/backend`)
- `app/main.py`: Entry point, global exception handlers, and router integration.
- `app/database.py`: PostgreSQL connection management and Session dependency.
- `app/auth.py`: JWT generation, password hashing, and role verification logic.
- `app/models.py`: SQLAlchemy database models (Invoices, Suppliers, Medicines, etc.).
- `app/schemas.py`: Pydantic schemas for API request and response validation.
- `app/routers/`: Feature-specific API endpoints.

### 2. Frontend Structure (`/frontend`)
- `src/api/index.js`: Centralized Axios-based API client.
- `src/hooks/`: Custom stateful hooks (`useInvoices`, `useSuppliers`, etc.) for business logic.
- `src/components/`: Reusable UI components.
- `src/views/`: Main page-level components.

## Data Flow
1. **Request**: Frontend (React) sends an HTTP request with a JWT token (if authenticated).
2. **Auth**: Backend `auth.py` interceptor verifies the token and user role.
3. **Endpoint**: Router receives the request, validates input via Pydantic `schemas.py`.
4. **Logic**: Router interacts with the database via `database.py` and SQLAlchemy `models.py`.
5. **Response**: Backend returns a JSON response, which the frontend hook processes and reflects in the UI.

## Logging and Troubleshooting
- **Backend Logs**: Persistent daily logs are kept at `backend/logs/app.log`.
- **Error Handling**: Global handlers in `main.py` catch `SQLAlchemyError` and `RequestValidationError` to return structured JSON errors.
