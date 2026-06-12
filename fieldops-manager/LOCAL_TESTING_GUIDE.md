# FieldOps Manager — Local Testing Guide

Complete setup, startup, and verification reference for local development.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Environment Setup](#2-environment-setup)
3. [Database Setup](#3-database-setup)
4. [Startup Order](#4-startup-order)
5. [Test Users](#5-test-users)
6. [Authentication Verification](#6-authentication-verification)
7. [Admin Module Checklist](#7-admin-module-checklist)
8. [Store Manager Module Checklist](#8-store-manager-module-checklist)
9. [Team Leader Module Checklist](#9-team-leader-module-checklist)
10. [Engineer Module Checklist](#10-engineer-module-checklist)
11. [End-to-End Workflow Test](#11-end-to-end-workflow-test)
12. [Database Verification Queries](#12-database-verification-queries)
13. [API Quick-Test (curl)](#13-api-quick-test-curl)
14. [Known Constraints](#14-known-constraints)

---

## 1. Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 18+ | https://nodejs.org |
| npm | 8+ | bundled with Node |
| PostgreSQL | 15 | https://www.postgresql.org/download |
| Git | any | already installed |

> **Redis is NOT required.** The `src/config/redis.js` file is defined but never imported by any controller or server. All tokens are stored in PostgreSQL. You may see Redis connection-error log lines — ignore them, the app functions fully without Redis.

---

## 2. Environment Setup

### Backend `.env`

Create `fieldops-manager/backend/.env`:

```env
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:3000

DATABASE_URL=postgresql://postgres:postgres@localhost:5432/fieldops

JWT_ACCESS_SECRET=dev_access_secret_local
JWT_REFRESH_SECRET=dev_refresh_secret_local
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d
```

> The `JWT_*` secrets and `REDIS_URL` all have safe code-level defaults in `src/config/env.js` so you only **must** set `DATABASE_URL`.

### Frontend `.env`

For local development the Vite dev proxy automatically routes `/api/*` to `http://localhost:5000`. No frontend `.env` file is needed. If you want to be explicit:

```env
VITE_API_URL=http://localhost:5000
```

---

## 3. Database Setup

### Step 1 — Create the database

```powershell
# Connect as the postgres superuser
psql -U postgres

# Inside psql prompt:
CREATE DATABASE fieldops;
\q
```

If your local postgres user or password differs, update `DATABASE_URL` in `backend/.env` accordingly.

### Step 2 — Install backend dependencies

```powershell
cd fieldops-manager/backend
npm install
```

### Step 3 — Generate Prisma client

```powershell
npx prisma generate
```

This writes the TypeScript client types into `node_modules/@prisma/client`. Required before the first run.

### Step 4 — Apply migrations (creates all 12 tables)

```powershell
npx prisma migrate deploy
```

Expected output:
```
Applying migration `20240101000000_init`
The following migration have been applied: 1 migration
```

### Step 5 — Seed the database

```powershell
npx prisma db seed
```

Expected output:
```
🌱 Seeding database...
✅ Database seeded successfully!
```

### Step 6 — Verify tables and seed data

```powershell
psql -U postgres -d fieldops -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;"
```

Expected — 13 rows (12 app tables + 1 Prisma migration table):
```
_prisma_migrations
Attendance
EngineerStock
MainInventory
ProductivityItem
ProductivityLog
PurchaseInward
RefreshToken
RevokeRequest
Sku
StockRequest
User
```

---

## 4. Startup Order

Start services in this exact order. Use separate terminal windows.

### Terminal 1 — Backend

```powershell
cd fieldops-manager/backend
npm run dev
```

Expected:
```
FieldOps API running on port 5000
Prisma connected
```

Verify health endpoint:
```powershell
curl http://localhost:5000/health
# {"status":"ok","timestamp":"..."}
```

### Terminal 2 — Frontend

```powershell
cd fieldops-manager/frontend
npm install      # first time only
npm run dev
```

Expected:
```
  VITE v5.x.x  ready in xxx ms
  ➜  Local:   http://localhost:3000/
```

Open browser: **http://localhost:3000**

---

## 5. Test Users

All accounts use password: **`password`**

| Role | Email | Name | Seed Data |
|------|-------|------|-----------|
| Admin | admin@fieldops.com | Raj Kumar | Full access |
| Store Manager | store@fieldops.com | Priya Sharma | Full access |
| Team Leader | leader@fieldops.com | Anand Mehta | Full access |
| Engineer 01 | eng01@fieldops.com | Rahul Singh | 3 logs, approved stock request |
| Engineer 02 | eng02@fieldops.com | Deepa Nair | 2 logs, pending stock request |
| Engineer 03 | eng03@fieldops.com | Suresh Reddy | 1 log, pending stock request |
| Engineer 04 | eng04@fieldops.com | Kavita Iyer | 1 log |
| Engineer 05 | eng05@fieldops.com | Arun Patel | No logs |

### Seed Data Summary

**Productivity Logs (all dated June 2025):**

| Engineer | Date | Status | Items |
|----------|------|--------|-------|
| Rahul Singh (eng01) | 2025-06-01 | Approved | SKU-001 x2, SKU-003 x1 |
| Rahul Singh (eng01) | 2025-06-02 | Approved | SKU-004 x1 |
| Rahul Singh (eng01) | 2025-06-03 | **Validated** | SKU-005 x1 ← Admin can approve |
| Deepa Nair (eng02) | 2025-06-01 | Approved | SKU-001 x1 |
| Deepa Nair (eng02) | 2025-06-03 | Pending | SKU-002 x2 ← TL can validate |
| Suresh Reddy (eng03) | 2025-06-02 | Pending | (no items) |
| Kavita Iyer (eng04) | 2025-06-03 | Pending | SKU-001 x3 |

**Stock Requests:**

| ID | Engineer | SKU | Qty | Status |
|----|----------|-----|-----|--------|
| sr-seed-001 | Rahul Singh | SKU-001 | 10 | Approved |
| sr-seed-002 | Deepa Nair | SKU-005 | 5 | **Pending** ← Store Manager can approve |
| sr-seed-003 | Suresh Reddy | SKU-004 | 8 | **Pending** ← Store Manager can approve |

**Purchase Inwards:**

| ID | SKU | Qty | Vendor | Status |
|----|-----|-----|--------|--------|
| pi-seed-001 | SKU-001 | 100 | ABC Traders | Approved |
| pi-seed-002 | SKU-005 | 20 | Cool Gas Pvt Ltd | Approved |

> **Note on Dashboard Metrics:** Dashboard controllers filter by current calendar month. Since seed data is from June 2025, dashboards will show 0 calls/revenue for current month (June 2026). Use the P&L Report month selector (select `Jun 2025`) to see historical data, or create new logs dated today to test live dashboard metrics.

---

## 6. Authentication Verification

### ✅ Admin Login
1. Go to http://localhost:3000
2. Enter: `admin@fieldops.com` / `password`
3. Click **Login**
4. **Expected:** Redirected to `/admin/approvals` (Approval Queue page)
5. **Expected:** Left sidebar shows: Approval Queue, Purchase Approvals, Revoke Approvals, Attendance Register, Store Inventory, P&L Report, SKU Registry, User Registry
6. **DB affected:** `RefreshToken` table — one new row created

### ✅ Store Manager Login
1. Logout (click avatar / Logout in topbar)
2. Enter: `store@fieldops.com` / `password`
3. **Expected:** Redirected to `/store/dashboard`
4. **Expected:** Sidebar shows: Store Dashboard, Purchase Inward, Stock Requests, Inventory Report

### ✅ Team Leader Login
1. Enter: `leader@fieldops.com` / `password`
2. **Expected:** Redirected to `/tl/dashboard`
3. **Expected:** Sidebar shows: Team Dashboard, Validation Queue

### ✅ Engineer Login
1. Enter: `eng01@fieldops.com` / `password`
2. **Expected:** Redirected to `/engineer/dashboard`
3. **Expected:** Sidebar shows: My Dashboard, Log Productivity, Approval Status, My Van Stock

### ✅ Quick-Login Buttons (Login Page)
- The login page shows 4 role buttons in a 2×2 grid
- Clicking a role button pre-fills the email field only (password NOT pre-filled)
- You must type `password` yourself — this is intentional

---

## 7. Admin Module Checklist

Login as: `admin@fieldops.com`

### 7.1 Approval Queue `/admin/approvals`

**What to verify:**

1. Page loads — shows productivity logs with status = `Validated`
2. Expected to see: **eng01 / 2025-06-03** log with 1 item (Gas Refill Kit R32, qty 1)

**Test: Approve a log**
1. Click the **Approve** button on the eng01 2025-06-03 log
2. Enter an incentive value in the input field (e.g. `50`)
3. See the **Running Total** update live
4. Click **Approve**
5. **Expected toast:** "Approved! ₹50 incentive saved. Attendance marked Present."
6. **Expected:** Log disappears from the queue
7. **DB affected (transaction):**
   - `ProductivityLog.status` → `Approved`
   - `ProductivityItem.adminIncentive` → 50
   - `Attendance` → upsert row for eng01 / 2025-06-03 / Present
   - `EngineerStock` → qty for eng01 / SKU-005 reduced by 1

**Test: Reject a log (create a new one first)**
- To test rejection: engineer must submit a new Pending log → TL validates it → Admin rejects it
- See [Section 11 End-to-End Workflow](#11-end-to-end-workflow-test)

---

### 7.2 Purchase Approvals `/admin/purchase-approvals`

**What to verify:**

1. Page loads — shows all `PurchaseInward` entries
2. The 2 seeded entries (ABC Traders, Cool Gas Pvt Ltd) show status `Approved`

**Test: Approve a new entry**
1. First create a purchase inward as Store Manager (Section 8.2)
2. Return to Admin → Purchase Approvals
3. New entry shows with status `Pending`
4. Click **Approve**
5. **Expected toast:** "Approved! +X units of [SKU name] added to warehouse."
6. **DB affected (transaction):**
   - `PurchaseInward.status` → `Approved`
   - `MainInventory.qty` → incremented by entry qty
   - `MainInventory.unitPrice` → updated to entry unitPrice

---

### 7.3 Revoke Approvals `/admin/revoke-approvals`

**What to verify:**

1. Page loads — shows `RevokeRequest` records with status `Revoke_Pending`
2. Seeded data has no pending revoke requests — page should show empty state

**Test: Full revoke flow**
1. Store Manager: Approve a pending stock request → sr-seed-002 or sr-seed-003 (Section 8.3)
2. Store Manager: Click **Revoke** on that same approved request
3. Admin → Revoke Approvals: new entry appears with status `Revoke_Pending`
4. Click **Approve Revoke**
5. **Expected:** Entry moves to `Revoked`
6. **DB affected:**
   - `RevokeRequest.status` → `Revoked`
   - `StockRequest.status` → `Revoked`
   - `EngineerStock.qty` → decremented (stock returned)
   - `MainInventory.qty` → incremented (stock returned to warehouse)

---

### 7.4 Attendance Register `/admin/attendance`

**What to verify:**

1. Page loads with attendance grid — engineers as rows, days as columns
2. Select month `2025-06` (June 2025)
3. Expected attendance marks:
   - Rahul Singh: ✓ on Jun 1, ✓ on Jun 2 (two approved logs → auto-marked Present)
   - Deepa Nair: ✓ on Jun 1
4. Dots (·) indicate future/unmarked days; — indicates absent

**Test: Download CSV**
1. Click **Download CSV** button
2. File `attendance_YYYY-MM.csv` downloads
3. **DB affected:** None (read-only)

---

### 7.5 Store Inventory `/admin/inventory`

**What to verify:**

1. Table loads with 8 SKUs and their warehouse quantities
2. SKU-004 (Remote Control Universal) qty = 95 with alert 30 → status **OK**
3. Any SKU where qty ≤ lowStockAlert shows status **Low** (red badge)

**Test: Download CSV**
1. Click **Export CSV** button
2. `inventory.csv` downloads with all SKU rows
3. **DB affected:** None (read-only — `MainInventory` JOIN `Sku`)

---

### 7.6 P&L Report `/admin/pl-report`

**What to verify:**

1. Page loads with month toggle buttons (current month + 2 prior months)
2. Click the button labeled **Jun 2025** (or select 2025-06 manually)
3. Expected data for Jun 2025:
   - Rahul Singh: Revenue = ₹2,280 (900+380+650), Incentive = ₹135 (60+25+50), Accessories Cost = (2×450 + 1×380 + 1×650) = ₹1,930, P&L = 2280−135−1930 = **₹215**
   - Deepa Nair: Revenue = ₹450, Incentive = ₹30, Accessories Cost = 1×450 = ₹450, P&L = 450−30−450 = **−₹30**
4. 4 metric cards at top: Total Revenue, Total Incentive, Total Cost, Net P&L

**Test: Download CSV**
1. Click **Export CSV**
2. `pl_report_2025-06.csv` downloads
3. **DB affected:** None (read-only — `ProductivityLog` + `ProductivityItem` + `MainInventory`)

> **P&L Formula:** `Revenue − Incentive − Accessories Cost`
> `Accessories Cost = qty × MainInventory.unitPrice` (current warehouse unit price)

---

### 7.7 SKU Registry `/admin/skus`

**What to verify:**

1. Table shows 8 seeded SKUs with ID, name, alert qty, warehouse qty, Low/OK status
2. SKU-008 (Stabilizer 5kVA) qty = 28 with alert = 10 → OK

**Test: Register new SKU**
1. Enter SKU ID: `SKU-009` (must match pattern SKU-NNN)
2. Enter name: `Copper Elbow 3/4"`
3. Enter Low Stock Alert: `25`
4. Click **Register SKU**
5. **Expected:** New row appears in table
6. **DB affected:** `Sku` table — new row; no `MainInventory` row yet (created when first purchase inward is approved)

**Test: Edit existing SKU**
1. Click edit icon on SKU-001
2. Change name or alert qty
3. Click **Save Changes**
4. **DB affected:** `Sku` table updated

---

### 7.8 User Registry `/admin/users`

**What to verify:**

1. Engineers table shows 5 engineers
2. Staff card shows 1 Team Leader (Anand Mehta) and 1 Store Manager (Priya Sharma)

**Test: Add new user**
1. Fill: Name=`Test Engineer`, Email=`test@fieldops.com`, Role=`Engineer`, Password=`password`
2. Click the **↻ refresh** button to generate a random password if desired
3. Click **Add User**
4. **Expected:** User appears in engineers table
5. **DB affected:** `User` table — new row with bcrypt-hashed password

**Test: Edit user**
1. Click edit icon on any user
2. Change name or role
3. Optionally set new password (leave blank to keep existing)
4. Click **Save Changes**
5. **DB affected:** `User` table updated; optionally `passwordHash` updated

---

## 8. Store Manager Module Checklist

Login as: `store@fieldops.com`

### 8.1 Store Dashboard `/store/dashboard`

**What to verify:**

1. 4 metric cards: Pending Requests (=2), Pending Inwards (=0), Low Stock count, Total Inventory Value
2. Low Stock SKUs list (any SKU where `qty ≤ lowStockAlert`)
3. Recent Purchase table shows last 6 purchase inward entries

**DB read:** `StockRequest`, `PurchaseInward`, `MainInventory`, `Sku`

---

### 8.2 Purchase Inward `/store/inward`

**What to verify:**

1. Table shows all purchase inward records
2. The 2 seeded entries show status `Approved`

**Test: Create new purchase entry**
1. Click **New Entry** or fill form
2. Select SKU: `SKU-003` (Capacitor 25MFD)
3. Qty: `50`, Unit Price: `400`, Vendor: `Kapoor Electricals`, Invoice No: `INV-0001`, Date: today
4. Click **Submit**
5. **Expected toast:** "Purchase entry submitted for Admin approval"
6. **Expected:** New row appears with status `Pending`
7. **DB affected:** `PurchaseInward` — new row with status Pending

**Next step:** Admin must approve this entry to update warehouse stock (Section 7.2).

---

### 8.3 Stock Requests `/store/requests`

**What to verify:**

1. Table shows 3 seeded stock requests
2. sr-seed-002 (Deepa Nair / SKU-005 / qty 5) — status `Pending`
3. sr-seed-003 (Suresh Reddy / SKU-004 / qty 8) — status `Pending`

**Test: Approve a stock request**
1. Click **Approve** on sr-seed-002
2. **Expected toast:** "Approved! 5 units allocated to engineer."
3. **DB affected (transaction):**
   - `StockRequest.status` → Approved
   - `MainInventory.qty` for SKU-005 → decremented by 5 (60 → 55)
   - `EngineerStock` for eng02 / SKU-005 → incremented by 5

**Test: Reject a stock request**
1. Click **Reject** on sr-seed-003
2. **Expected:** Status changes to `Rejected`
3. **DB affected:** `StockRequest.status` → Rejected

**Test: Submit Revoke (on an Approved request)**
1. After approving sr-seed-002, click **Revoke** on it
2. **Expected:** sr-seed-002 status changes to `Revoke_Pending`
3. **DB affected:**
   - `RevokeRequest` — new row with status Revoke_Pending
   - `StockRequest.status` → Revoke_Pending

---

### 8.4 Inventory Report `/store/inventory`

**What to verify:**

1. Table shows all 8 SKUs with warehouse quantities, unit prices, total values
2. Per-engineer stock breakdown available via filter/tab
3. Low stock visual indicator on applicable SKUs

**Test: Download CSV**
1. Click **Export CSV**
2. `inventory.csv` downloads
3. **DB affected:** None

---

## 9. Team Leader Module Checklist

Login as: `leader@fieldops.com`

### 9.1 Team Dashboard `/tl/dashboard`

**What to verify:**

1. Table shows all 5 engineers with their current-month stats
2. Since seed data is June 2025, current month (June 2026) shows 0 for all metrics
3. Columns: Name, Days Present, Calls Closed, Revenue, Incentive

**DB read:** `User` (role=Engineer) + `ProductivityLog` + `Attendance` filtered by current month

---

### 9.2 Validation Queue `/tl/approvals`

**What to verify:**

1. Table shows logs with status = `Pending`
2. Expected: Deepa Nair 2025-06-03, Suresh Reddy 2025-06-02, Kavita Iyer 2025-06-03

**Test: Validate a log**
1. Click **Validate** on Deepa Nair's 2025-06-03 log
2. Optionally enter a note: "Good work, 7 calls"
3. Click **Validate**
4. **Expected toast:** "Log validated"
5. **Expected:** Log disappears from Pending queue
6. **DB affected:** `ProductivityLog.status` → Validated, `tlNote` saved

**Test: Reject a log**
1. Click **Reject** on another Pending log (e.g. Suresh Reddy 2025-06-02)
2. Enter reason: "Missing items data"
3. Click **Reject**
4. **Expected:** `ProductivityLog.status` → Rejected
5. **DB affected:** `ProductivityLog.status` → Rejected, `tlNote` saved

---

## 10. Engineer Module Checklist

Login as: `eng01@fieldops.com` (Rahul Singh)

### 10.1 My Dashboard `/engineer/dashboard`

**What to verify:**

1. 4 metric cards: Calls Closed, Revenue, Incentive, Days Present (all filtered to current month)
2. Current month (Jun 2026) shows 0 — this is correct since seed data is from Jun 2025
3. Recent logs table appears below metrics

**To see live data:** Submit a new log (Section 10.2) and have Admin approve it.

---

### 10.2 Log Productivity `/engineer/productivity`

**What to verify:**

1. Form with date picker, calls closed counter, and line items

**Test: Submit a new productivity log**
1. Date: today's date (e.g. 2026-06-12)
2. Calls Closed: `4`
3. Add item: SKU-001 / qty 2 / sale value 900
4. Add item: SKU-003 / qty 1 / sale value 380
5. Click **Submit**
6. **Expected toast:** "Productivity log submitted for validation"
7. **DB affected:**
   - `ProductivityLog` — new row, status=Pending
   - `ProductivityItem` — 2 new rows linked to the log

**Test: Duplicate date prevention**
1. Try to submit another log for the same date (today)
2. **Expected error:** "A productivity log for this date already exists" (409)
3. **DB affected:** None

---

### 10.3 Approval Status `/engineer/status`

**What to verify:**

1. Shows all this engineer's logs with their current status and colored badges
2. eng01 sees: 2 Approved (Jun 1-2), 1 Validated (Jun 3), + any you just submitted (Pending)
3. Status badges: Pending=amber, Validated=cyan, Approved=green, Rejected=red

**DB read:** `ProductivityLog` + `ProductivityItem` filtered to this engineer

---

### 10.4 My Van Stock `/engineer/stock`

**What to verify:**

1. Table shows eng01's current van stock
2. Seeded quantities for eng01:
   - SKU-001 (AC Filter 1 Ton): 12 units
   - SKU-002 (AC Filter 1.5 Ton): 8 units
   - SKU-003 (Capacitor 25MFD): 15 units
   - SKU-004 (Remote Control): 5 units
   - SKU-005 (Gas Refill Kit R32): 3 units

**Test: Stock request**
1. Click **Request Stock** on SKU-001
2. Enter qty: `5`
3. Submit
4. **Expected:** New entry appears in `StockRequest` table for Store Manager to approve
5. **DB affected:** `StockRequest` — new row, status=Pending

---

## 11. End-to-End Workflow Test

This traces the complete productivity log lifecycle through all 4 roles.

```
Engineer → [Pending] → Team Leader → [Validated] → Admin → [Approved]
                                                              ↓
                                                    Attendance = Present
                                                    Stock deducted from van
```

### Step 1 — Engineer: Submit a log

Login: `eng05@fieldops.com` (Arun Patel — no prior logs, clean state)

1. Go to **Log Productivity**
2. Date: today (2026-06-12)
3. Calls Closed: `3`
4. Add line item: SKU-003 / qty 2 / sale value 760
5. Click **Submit**
6. ✅ Toast: "Productivity log submitted for validation"

**Verify:** `ProductivityLog` status = `Pending`

---

### Step 2 — Team Leader: Validate the log

Login: `leader@fieldops.com`

1. Go to **Validation Queue** (`/tl/approvals`)
2. Find Arun Patel's log for today
3. Add TL note: "Verified on site"
4. Click **Validate**
5. ✅ Toast: "Log validated"

**Verify:** `ProductivityLog.status` = `Validated`, `tlNote` = "Verified on site"

---

### Step 3 — Admin: Approve the log

Login: `admin@fieldops.com`

1. Go to **Approval Queue** (`/admin/approvals`)
2. Find Arun Patel's log (today's date, status Validated)
3. Enter incentive for SKU-003 item: `40`
4. Running total shows ₹40
5. Click **Approve**
6. ✅ Toast: "Approved! ₹40 incentive saved. Attendance marked Present."

**Verify these 4 DB changes atomically (single transaction):**

```sql
-- 1. Log status
SELECT status, "adminNote" FROM "ProductivityLog"
WHERE "engineerId" = (SELECT id FROM "User" WHERE email='eng05@fieldops.com')
AND date = CURRENT_DATE;
-- Expected: status = 'Approved'

-- 2. Incentive saved
SELECT "adminIncentive" FROM "ProductivityItem"
WHERE "productivityLogId" = (
  SELECT id FROM "ProductivityLog"
  WHERE "engineerId" = (SELECT id FROM "User" WHERE email='eng05@fieldops.com')
  AND date = CURRENT_DATE
);
-- Expected: 40

-- 3. Attendance auto-marked
SELECT status FROM "Attendance"
WHERE "engineerId" = (SELECT id FROM "User" WHERE email='eng05@fieldops.com')
AND date = CURRENT_DATE;
-- Expected: 'Present'

-- 4. Van stock deducted
SELECT qty FROM "EngineerStock"
WHERE "engineerId" = (SELECT id FROM "User" WHERE email='eng05@fieldops.com')
AND "skuId" = 'SKU-003';
-- Expected: 20 - 2 = 18
```

---

### Step 4 — Engineer: Verify dashboard updated

Login: `eng05@fieldops.com`

1. Go to **My Dashboard**
2. Current month metrics should now show: Calls Closed = 3, Revenue = ₹760, Incentive = ₹40, Days Present = 1
3. Go to **Approval Status** → log shows green `Approved` badge
4. Go to **My Van Stock** → SKU-003 qty shows 18

---

## 12. Database Verification Queries

Connect: `psql -U postgres -d fieldops`

### Check all tables exist

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

Expected: 12 tables + `_prisma_migrations`

### Verify migration history

```sql
SELECT migration_name, finished_at, applied_steps_count
FROM "_prisma_migrations"
ORDER BY finished_at;
```

Expected: 1 row — `20240101000000_init`

### Verify all 8 seed users

```sql
SELECT name, email, role, "isActive"
FROM "User"
ORDER BY role, name;
```

### Verify main inventory (8 SKUs, all stocked)

```sql
SELECT s.id, s.name, s."lowStockAlert", m.qty, m."unitPrice",
       CASE WHEN m.qty <= s."lowStockAlert" THEN 'LOW' ELSE 'OK' END AS stock_status
FROM "Sku" s
JOIN "MainInventory" m ON m."skuId" = s.id
ORDER BY s.id;
```

### Verify engineer van stocks

```sql
SELECT u.name AS engineer, es."skuId", s.name AS sku, es.qty
FROM "EngineerStock" es
JOIN "User" u ON u.id = es."engineerId"
JOIN "Sku" s ON s.id = es."skuId"
ORDER BY u.name, es."skuId";
```

### Verify productivity logs and their statuses

```sql
SELECT u.name AS engineer, pl.date, pl.status, pl."callsClosed",
       COUNT(pi.id) AS item_count,
       SUM(pi."saleValue") AS total_revenue
FROM "ProductivityLog" pl
JOIN "User" u ON u.id = pl."engineerId"
LEFT JOIN "ProductivityItem" pi ON pi."productivityLogId" = pl.id
GROUP BY u.name, pl.date, pl.status, pl."callsClosed"
ORDER BY pl.date, u.name;
```

### Verify attendance records

```sql
SELECT u.name AS engineer, a.date, a.status
FROM "Attendance" a
JOIN "User" u ON u.id = a."engineerId"
ORDER BY a.date, u.name;
```

### Verify P&L calculation for June 2025

```sql
SELECT
  u.name,
  SUM(pi."saleValue") AS revenue,
  SUM(COALESCE(pi."adminIncentive", 0)) AS incentive,
  SUM(pi.qty * m."unitPrice") AS accessories_cost,
  SUM(pi."saleValue") - SUM(COALESCE(pi."adminIncentive", 0)) - SUM(pi.qty * m."unitPrice") AS pl
FROM "ProductivityLog" pl_log
JOIN "User" u ON u.id = pl_log."engineerId"
JOIN "ProductivityItem" pi ON pi."productivityLogId" = pl_log.id
JOIN "MainInventory" m ON m."skuId" = pi."skuId"
WHERE pl_log.status = 'Approved'
  AND pl_log.date >= '2025-06-01'
  AND pl_log.date < '2025-07-01'
GROUP BY u.name
ORDER BY u.name;
```

### Check refresh tokens (active sessions)

```sql
SELECT u.email, rt."createdAt", rt."expiresAt", rt."isRevoked"
FROM "RefreshToken" rt
JOIN "User" u ON u.id = rt."userId"
WHERE rt."isRevoked" = false
ORDER BY rt."createdAt" DESC;
```

---

## 13. API Quick-Test (curl)

Test the API directly without the frontend.

### Health check

```powershell
curl http://localhost:5000/health
```

### Login and capture token

```powershell
$response = curl -s -X POST http://localhost:5000/api/auth/login `
  -H "Content-Type: application/json" `
  -d '{"email":"admin@fieldops.com","password":"password"}' | ConvertFrom-Json

$TOKEN = $response.data.accessToken
echo "Token: $TOKEN"
```

### Get all SKUs (any logged-in user)

```powershell
curl -H "Authorization: Bearer $TOKEN" http://localhost:5000/api/skus
```

### Get all users (Admin only)

```powershell
curl -H "Authorization: Bearer $TOKEN" http://localhost:5000/api/users
```

### Get Validated productivity logs (Admin)

```powershell
curl -H "Authorization: Bearer $TOKEN" "http://localhost:5000/api/productivity?status=Validated"
```

### Get P&L report for June 2025 (Admin)

```powershell
curl -H "Authorization: Bearer $TOKEN" "http://localhost:5000/api/reports/pl?month=2025-06"
```

### Submit a productivity log as Engineer

```powershell
$ENG_RESPONSE = curl -s -X POST http://localhost:5000/api/auth/login `
  -H "Content-Type: application/json" `
  -d '{"email":"eng05@fieldops.com","password":"password"}' | ConvertFrom-Json

$ENG_TOKEN = $ENG_RESPONSE.data.accessToken

curl -X POST http://localhost:5000/api/productivity `
  -H "Authorization: Bearer $ENG_TOKEN" `
  -H "Content-Type: application/json" `
  -d '{"date":"2026-06-15","callsClosed":3,"items":[{"skuId":"SKU-003","qty":1,"saleValue":380}]}'
```

---

## 14. Known Constraints

| Constraint | Detail |
|------------|--------|
| **SKU ID format** | Must match `SKU-NNN` pattern (e.g. SKU-009, SKU-010). Enforced by Joi validation in `sku.routes.js:13`. |
| **Duplicate log prevention** | Only one productivity log per engineer per date. Second attempt returns HTTP 409. |
| **Approval order** | Admin can only approve `Validated` logs (not `Pending`). TL must validate first. |
| **Rate limiting** | Login route: 10 requests per 15 minutes per IP. If you hit this, wait or restart the backend. |
| **JWT expiry** | Access token expires in 15 minutes. The Axios interceptor auto-refreshes. If you see 401 in network tab, it's the refresh happening — not a bug. |
| **Seed data dates** | All seeded productivity logs are from June 2025. Current-month dashboards will show 0 until you create today-dated logs. |
| **P&L month selector** | Shows current month and 2 prior months. To see June 2025 seed data, click the button labeled **Jun 2025** on the P&L Report page. |
| **Stock deduction clamp** | `Math.max(0, existing.qty - item.qty)` — van stock never goes negative. If engineer sells more than they have, it clamps to 0. |
| **Purchase inward unitPrice** | Approving a purchase inward updates `MainInventory.unitPrice`. This affects P&L cost calculation for all future reports. |
| **Revoke pre-conditions** | Only `Approved` stock requests can be revoked. Only one revoke per request (`@@unique` on stockRequestId). |
