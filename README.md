# Multi-Tenant POS Backend

A production-ready Multi-Tenant Point of Sale (POS) Sales & Inventory backend system built with **NestJS**, **TypeScript**, **PostgreSQL**, **Prisma ORM**, and **Redis**.

---

## Key Features

- **Multi-Tenant Isolation**: Strict merchant-level data segregation across stores, products, inventory, and sales.
- **Transactional Sales & Idempotency**: Atomic PostgreSQL transactions (`$transaction`) with database-backed idempotency (`Idempotency-Key` header).
- **Concurrency Protection**: Row-level locking (`SELECT ... FOR UPDATE`) prevents overselling.
- **Payment Abstraction**: Modular payment provider interface (`DummyPaymentProvider`).
- **Redis Caching**: Cached store inventory reads with instant invalidation on stock mutations.
- **Global API Prefix**: All endpoints served under `/api`.

---

## Sale Transaction Flow Diagram

```text
Client POST /api/stores/:storeId/sales + Idempotency-Key
                        │
                        ▼
            Validate Auth & Store Access
                        │
                        ▼
            Check DB Idempotency Key
           ┌────────────┴────────────┐
           │ Exists                  │ New
           ▼                         ▼
   Return Saved Response    Create Key Record (PROCESSING)
                                     │
                                     ▼
                        Begin Prisma Transaction ($transaction)
                                     │
                                     ▼
                        Lock Inventory Rows (FOR UPDATE)
                                     │
                                     ▼
                       Check Stock & Server Prices
                                     │
                                     ▼
                        Process Payment Provider
                       ┌─────────────┴─────────────┐
                       │ FAILED                    │ SUCCESS
                       ▼                           ▼
                 Rollback Tx              Create Sale, SaleItems,
               (Stock Intact)            Update Stock, Save Payment
                                                   │
                                                   ▼
                                               Commit Tx
                                                   │
                                                   ▼
                                   Update Idempotency Record (COMPLETED)
                                   Invalidate Redis Inventory Cache
```

---

## Tech Stack

- **Framework**: NestJS (TypeScript)
- **Database & ORM**: PostgreSQL 16 & Prisma ORM v5
- **Cache**: Redis 7 (`ioredis`)
- **Auth**: JWT & `bcrypt`
- **Testing**: Jest & Supertest

---

## Quick Start

### 1. Start Services via Docker
```bash
docker compose up -d
```

### 2. Environment Setup & Install
```bash
cp .env.example .env
npm install
```

### 3. Database Migration & Seed
```bash
npx prisma migrate dev
npm run prisma:seed
```

### 4. Run Application
```bash
npm run start:dev
```
API runs locally at: **`http://localhost:3000/api`**

---

## Useful Scripts

| Command | Action |
|---|---|
| `npm run start:dev` | Start NestJS development server |
| `npm test` | Run 5 core E2E integration test cases |
| `npm run prisma:seed` | Seed default test data |
| `npm run prisma:reset` | Reset DB schema & re-seed |
| `npm run prisma:studio` | Launch Prisma Studio web GUI (`http://localhost:5555`) |

---

## API Endpoints (`/api`)

- **Auth**:
  - `POST /api/auth/login`
- **Stores**:
  - `GET /api/stores`
  - `GET /api/stores/:id`
- **Products**:
  - `POST /api/products`
  - `GET /api/products` *(Paginated & Searchable: `?page=1&limit=10&search=...`)*
  - `GET /api/products/:id`
  - `PATCH /api/products/:id`
  - `DELETE /api/products/:id`
- **Inventory**:
  - `POST /api/stores/:storeId/inventory`
  - `GET /api/stores/:storeId/inventory`
  - `GET /api/stores/:storeId/inventory/:productId`
  - `PATCH /api/stores/:storeId/inventory/:productId`
- **Sales**:
  - `POST /api/stores/:storeId/sales` *(Headers: `Idempotency-Key`)*
  - `GET /api/stores/:storeId/sales` *(Paginated & Searchable: `?page=1&limit=10&search=...&status=COMPLETED`)*
  - `GET /api/stores/:storeId/sales/:saleId`

---

## Default Seed Credentials

All accounts use password: `password@123`

- **Merchant A (Raj Electronics)**:
  - Admin: `raj.admin@yopmail.com`
  - Manager: `raj.manager@yopmail.com`
  - Cashier: `akash.cashier@yopmail.com`
- **Merchant B (King Electronics)**:
  - Admin: `king.admin@yopmail.com`
  - Manager: `king.manager@yopmail.com`
  - Cashier: `king.cashier@yopmail.com`

---

## Testing & Postman

- **Run E2E Tests**:
  ```bash
  npm test
  ```
- **Postman**: Import `Pos App APIs.postman_collection.json` and set environment variable `baseUrl` to `http://localhost:3000/api`.
