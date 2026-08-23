# Restaurant ERP - System Administration & Control Portal

This folder provides administrative controls, deployment configurations, and system orchestration tools for the Enterprise Restaurant Management ERP System.

## Architecture
- **Client Web Application**: Located in `../client` (React + TypeScript + Bootstrap 5)
- **Server API & Real-time Daemon**: Located in `../server` (Node.js + Express + TypeScript + Socket.IO)
- **Database Migrations & Seeds**: Located in `../database` (PostgreSQL / Embedded SQL schema & seeders)

## Quick Start
From the root directory:
```bash
# Install dependencies
npm install --prefix server
npm install --prefix client

# Run seed data
npm run seed --prefix server

# Start development servers
npm run dev:server
npm run dev:client
```

## Admin Capabilities
1. **Role & Permission Management**: Hierarchical role definitions and per-user permission overrides (`ALLOW`, `DENY`, `INHERIT`).
2. **System Control & Maintenance**: Real-time switchboard for `ONLINE`, `MAINTENANCE`, `READ_ONLY`, and `EMERGENCY_LOCKDOWN`.
3. **Audit Trails**: Full immutable logging for all system mutations and financial transactions.
4. **Master Data & Settings**: Global configuration for taxes, printers, and store profiles.
