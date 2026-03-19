# Pharmacy Inventory System

A modern pharmacy inventory management application built with FastAPI and React.

## Project Structure

- `/backend`: FastAPI application, SQLAlchemy models, and database configuration.
- `/frontend`: React (Vite) application with Tailwind CSS 4.0 and Lucide icons.
- `.antigravity/rules.md`: Global technical and domain rules for the project.

## Getting Started

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   .\venv\Scripts\activate  # Windows
   # source venv/bin/activate # Unix/macOS
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the server:
   ```bash
   python -m uvicorn app.main:app --reload
   ```
   The API will be available at `http://127.0.0.1:8000` with Swagger docs at `/docs`.

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
   The dashboard will be available at `http://localhost:5173`.

## Technical Stack

- **Frontend:** React, Tailwind CSS 4.0, Vite, Lucide React, TanStack React Query.
- **Backend:** FastAPI, SQLAlchemy, Pydantic.
- **Database:** SQLite (Default for development), PostgreSQL (Supported).
