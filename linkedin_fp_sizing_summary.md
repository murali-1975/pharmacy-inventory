# 📊 Project Sizing Report: Pharmacy Inventory System

### 1. Functional Size (AFP)
| Component Category | Element Count | Functionality / Examples | Function Points (UFP) |
| :--- | :--- | :--- | :---: |
| **Internal Data (ILF)** | 15 Logical Files | Medicines, Invoices, Stock Batches, Users | 120 |
| **User Transactions (EI)** | 13 Transactions | Purchase Entry, Bulk CSV Upload, Stock Sync | 42 |
| **Advanced Reports (EO)** | 7 Formats | PDF Price List, GST Reconciliation, Ledger Export | 26 |
| **Inquiries (EQ)** | 8 Views | Dashboard, Stock Search, Adjustment Audit | 12 |
| **TOTAL SIZE** | | | **200 AFPs** |

---

### 🚀 High-Complexity Feature Highlights
*   **Bulk Procurement Engine (High FP)**: Handles multi-row grouping from Excel/CSV, performing atomic cross-reference lookups for Suppliers & Medicines with automated stock incrementing.
*   **Audit-Ready Stock Ledger (High FP)**: A complex reconciliation engine that calculates real-time Closing Balances by joining Opening Balance, Movements, and Audit logs.
*   **Financial Intelligence Suite (High FP)**: Automated generation of GST Reconciliations and Asset Valuations using real-time FEFO cost-basis from multiple stock batches.
*   **Batch-Level FEFO Management (Avg FP)**: Granular tracking of expiry dates and batch-specific pricing, ensuring regulatory compliance and profit accuracy.

---

### ⚡ Effort & Benchmarking
| Productivity Factor | Total Effort | Team (2 Devs) | Team (3 Devs) |
| :--- | :---: | :---: | :---: |
| **8 hrs/FP** (High) | 1,600 hrs | 5.0 Months | 3.3 Months |
| **9 hrs/FP** (Med) | 1,800 hrs | 5.6 Months | 3.7 Months |
| **10 hrs/FP** (Std) | 2,000 hrs | 6.2 Months | 4.1 Months |

---

### 🛠️ Technical Profile
- **Backend**: FastAPI (Python 3.10+) + SQLAlchemy (ORM)
- **Frontend**: React (Context API + Vite)
- **Database**: PostgreSQL (Production) / SQLite (Dev)
- **Audit**: Immutable Stock Transaction Ledger

*Calculated based on standard IFPUG Weights.*
