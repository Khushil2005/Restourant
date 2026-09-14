# Royal Heritage Restaurant Management ERP System

A production-grade, enterprise-ready full-stack Restaurant Management ERP System unified into a single comprehensive portal alongside the backend API:

```
RESTOURANT/
├── server/     → Node.js + Express + TypeScript + MongoDB + Socket.IO REST Server (Port 5000)
├── admin/      → React + TypeScript + Bootstrap 5 Unified ERP & Governance Portal (Port 3000)
├── start.bat   → Windows One-Click Full-Stack Launcher (Server + Portal)
└── start.ps1   → PowerShell Full-Stack Launcher
```

---

## 🌟 Application Architecture

### 1. `server/` (Backend Core API & Real-Time Engine - Port 5000)
- **Node.js & Express with TypeScript**: Strict type safety and unified REST routing under `/api`.
- **Zero-Config MongoDB Engine**: Seamlessly connects to local MongoDB or automatically launches a high-performance in-memory instance (`MongoMemoryServer`) when no external daemon is found.
- **264+ Fine-Grained Permissions**: RBAC & PBAC engine supporting 11 role templates and per-user `ALLOW` / `DENY` overrides.
- **Real-Time Socket.IO Server**: Broadcasts POS orders, KOT status transitions, ready-to-serve alerts, low stock warnings, and queue token calls.
- **Automated Cross-Module Pipelines**:
  - Recipe-based raw inventory reduction upon payment settlement.
  - Double-entry balanced journal posting upon bill payment and payroll disbursement.
  - Immutable audit logging on all database mutations.

### 2. `admin/` (Unified Restaurant Operations & Governance Portal - Port 3000)
All ERP and Admin modules are accessible through a single unified portal on `http://localhost:3000`:
- **High-Speed Touch POS Terminal (`/pos`)**: Fast dish ordering, category filtering, chef instructions, running KOTs, Hold/Resume, and Request Bill.
- **Kitchen Display System (`/kitchen`)**: Real-time KDS board with state transitions (`New` → `Accepted` → `Preparing` → `Ready` → `Served`), timers, urgency highlights, and audio bells.
- **Public Queue TV Display (`/display/tokens`)**: Lounge TV display with real-time calling animations.
- **Table Floor Plan (`/tables`)**: Visual floor map with live occupancy, table transfers, and splits.
- **19 ERP Operations Modules**: Bookings CRM, Billing, Payments, Discounts, Inventory stock-take & adjustments, Recipe BOM formulations, Purchase orders (PO/GRN), Accounts (Chart of Accounts, Journals, Day Closing), Operating Expenses, HR staff directory, Attendance punches, Leave approvals, Payroll processing with payslips, and Central Reports.
- **Super Admin Governance Suite**:
  - Executive Telemetry & Health Gauges (`/admin`)
  - User Governance & Overrides (`/admin/users`)
  - 264+ Permission Matrix Configurator (`/admin/roles`)
  - System Diagnostics & Latency Probes (`/admin/diagnostics`)
  - Database & Migration Snapshot Tools (`/admin/database`)
  - Security Audit Trails with State Diff Inspector (`/admin/audit-trail`)
  - Emergency Switchboard & Maintenance Modes (`/admin/emergency`)
  - Branch & Franchise Profile (`/admin/settings`)

---

## 👥 Default Demo Credentials

| Persona | Username | Password | Access |
|---|---|---|---|
| **Super Admin** | `superadmin` | `Admin@12345` | Full ERP + Governance Console |
| **Store Manager** | `manager` | `Manager@12345` | Store Operations, Reports & Approvals |
| **Head Cashier** | `cashier` | `Cashier@12345` | POS, Billing & Payments |
| **Captain / Waiter** | `waiter` | `Waiter@12345` | POS Orders & Tables |
| **Kitchen Chef** | `chef` | `Chef@12345` | Kitchen Display System (KDS) |
| **Accountant** | `accountant` | `Accountant@12345` | Ledger, Journals, Day Close |
| **Inventory Manager**| `inventory` | `Inventory@12345` | Stock, Recipes & Procurement |
| **HR Manager** | `hr` | `Hr@12345` | Staff, Attendance & Payroll |
| **Receptionist** | `receptionist`| `Reception@12345`| Bookings & Queue Tokens |

---

## 🚀 Running the Full Stack (Single URL Architecture)

### Option 1: One-Click Startup (Windows)
Double-click **`start.bat`** or run in PowerShell:
```powershell
.\start.ps1
```

### Option 2: Manual Terminal Execution

```bash
# Terminal 1: Backend Server (Port 5000)
cd server
npm run dev

# Terminal 2: Unified ERP Portal (Port 3000)
cd admin
npm run dev
```

---

## 🌐 Live Application URL Directory
- **Live Production Portal (Vercel)**: [https://restourant-ten.vercel.app/](https://restourant-ten.vercel.app/)
- **Touch POS Terminal**: [https://restourant-ten.vercel.app/pos](https://restourant-ten.vercel.app/pos)
- **Kitchen Display System (KDS)**: [https://restourant-ten.vercel.app/kitchen](https://restourant-ten.vercel.app/kitchen)
- **Public Queue TV Display**: [https://restourant-ten.vercel.app/display/tokens](https://restourant-ten.vercel.app/display/tokens)
- **Super Admin Governance**: [https://restourant-ten.vercel.app/admin](https://restourant-ten.vercel.app/admin)
- **Live Backend REST API**: [https://restourant-eoj3.onrender.com/api](https://restourant-eoj3.onrender.com/api)

