# Pre-Pilot Deployment Checklist — LogiTask / FieldOps Manager

**Status:** Analysis only. No code modified, nothing committed, no migration executed to produce this document.
**Scope:** Everything required to safely take the current `main` branch — including the Pilot Blocker Fix Sprint (2 new migrations, `requireOrg` hardening, SKU/invoice fixes) — from "code complete" to "pilot running" on Render.
**Companion docs (not duplicated here, cross-referenced):** `docs/backup-recovery.md` (full incident-response runbook), `docs/go-live-checklist.md` (general production go-live baseline), `docs/migration_safety_review.md` (statement-by-statement audit of the two new migrations), `docs/pilot_testing_plan.md` / `pilot_execution_checklist.md` / `pre_launch_risk_assessment.md` / `pilot_blocker_fix_report.md` (workflow test plan and fix history).

---

## SECTION 1 — DATABASE

### 1.1 Database Backup Procedure

Full procedure lives in `docs/backup-recovery.md` §2. Pilot-specific minimum:

```bash
# 1. Get the Render PostgreSQL External Connection URL
#    Render Dashboard → PostgreSQL instance → Connect → External Connection URL

# 2. Take a compressed backup BEFORE touching anything
export DATABASE_URL="<external-connection-url>"
pg_dump --format=custom --compress=9 --no-owner --no-privileges \
  "$DATABASE_URL" \
  --file="fieldops_backup_$(date +%Y%m%d_%H%M%S).dump"

# 3. Confirm it's non-zero and listable
ls -lh fieldops_backup_*.dump
pg_restore --list fieldops_backup_*.dump | head -20

# 4. Store it off-Render (Google Drive / S3 / local) — Render's filesystem is ephemeral
```

**Pilot-specific addition — snapshot the exact rows the new migrations will touch**, so the row-count and value checks in `migration_safety_review.md` have something to diff against:

```sql
-- Run and save the output BEFORE migrating:
SELECT 'Sku' t, count(*) FROM "Sku"
UNION ALL SELECT 'MainInventory', count(*) FROM "MainInventory"
UNION ALL SELECT 'EngineerStock', count(*) FROM "EngineerStock"
UNION ALL SELECT 'ProductivityItem', count(*) FROM "ProductivityItem"
UNION ALL SELECT 'StockRequest', count(*) FROM "StockRequest"
UNION ALL SELECT 'ReturnRequest', count(*) FROM "ReturnRequest"
UNION ALL SELECT 'PurchaseInward', count(*) FROM "PurchaseInward"
UNION ALL SELECT 'RevokeRequest', count(*) FROM "RevokeRequest";

SELECT id, "orgId" FROM "Sku" ORDER BY id;   -- old (id, orgId) pairs, for the code-mapping diff
```

**Backup is mandatory before this deploy** — this is the first deploy carrying a destructive-shaped migration (column drops, PK swap) since the project's `20260616000001_add_org_and_nullable_orgid` migration. Do not skip §2.1.3 of `backup-recovery.md` for this one.

### 1.2 Migration Deployment Steps

The backend `start` script already runs migrations automatically on every boot:
```
npx prisma generate && npx prisma migrate deploy && node server.js
```
This means **migrations apply the moment the new Render deploy starts**, before the new code begins serving traffic. There is no separate manual migration step to remember to run — but there is a strict ordering requirement:

| Step | Action | Why |
|---|---|---|
| 1 | Confirm the backup from §1.1 is complete and verified non-zero | Last point of no return |
| 2 | Confirm `backend/prisma/migrations/20260624000001_sku_org_scoped_uniqueness/` and `20260624000002_purchase_inward_creator_and_invoice_guard/` are committed to the branch being deployed | These were generated but never committed in this session — see Go/No-Go §6 |
| 3 | Deploy backend (push to `main` or manual deploy in Render) — **migration and the new backend code ship in the same deploy, never separately** | The new `sku.controller.js` calls `create({ data: { code, ... } })`. If the migration runs against a database still being served by the *old* controller code (which calls `create({ data: { id: skuCode, ... } })`), SKU creation fails with a `NOT NULL` violation on `code` until the new code is live. Deploying both together eliminates the gap |
| 4 | Watch Render logs for the exact sequence: `Generated Prisma Client` → `Applying migration ...` (×2, one per new migration) → `FieldOps API running on port ...` | If the log stops between "Applying migration" and the server starting, the migration failed — see §1.4 Rollback |
| 5 | Run the validation queries (§1.3) against the live database immediately after the server reports healthy | Confirms the migration applied cleanly against real data, not just in theory |

### 1.3 Verification Queries

Full set with rationale is in `docs/migration_safety_review.md` ("Pre-Deployment Verification Checklist"). Minimum set to run immediately post-deploy:

```sql
-- Row counts must exactly match the §1.1 pre-migration snapshot
SELECT 'Sku' t, count(*) FROM "Sku"
UNION ALL SELECT 'MainInventory', count(*) FROM "MainInventory"
UNION ALL SELECT 'EngineerStock', count(*) FROM "EngineerStock"
UNION ALL SELECT 'ProductivityItem', count(*) FROM "ProductivityItem"
UNION ALL SELECT 'StockRequest', count(*) FROM "StockRequest"
UNION ALL SELECT 'ReturnRequest', count(*) FROM "ReturnRequest"
UNION ALL SELECT 'PurchaseInward', count(*) FROM "PurchaseInward"
UNION ALL SELECT 'RevokeRequest', count(*) FROM "RevokeRequest";

-- No orphaned skuId anywhere, including the one table with no DB-level FK:
SELECT 'RevokeRequest' t, count(*) FROM "RevokeRequest" rv
  WHERE NOT EXISTS (SELECT 1 FROM "Sku" s WHERE s.id = rv."skuId")
UNION ALL
SELECT 'StockRequest', count(*) FROM "StockRequest" r
  WHERE NOT EXISTS (SELECT 1 FROM "Sku" s WHERE s.id = r."skuId");
-- Expected: 0 for every row

-- No duplicate SKU codes within an org (the actual P0-1 deliverable):
SELECT code, "orgId", count(*) FROM "Sku" GROUP BY code, "orgId" HAVING count(*) > 1;
-- Expected: 0 rows

-- No duplicate (orgId, vendor, invoiceNo) remain (the P1-7 deliverable):
SELECT "orgId", vendor, "invoiceNo", count(*) FROM "PurchaseInward"
  WHERE "invoiceNo" IS NOT NULL GROUP BY 1,2,3 HAVING count(*) > 1;
-- Expected: 0 rows

-- All 10 migrations applied, none stuck mid-apply:
SELECT migration_name, finished_at FROM "_prisma_migrations"
  WHERE finished_at IS NULL;
-- Expected: 0 rows
```

### 1.4 Rollback Procedure

Prisma does not generate an automatic down-migration. If the deploy fails or the verification queries in §1.3 fail:

1. **If the migration failed mid-apply on Render** (server never reaches "running on port"): Postgres DDL is transactional — the migration that failed rolled itself back completely, the database is in its pre-migration state, but `_prisma_migrations` may show the failed migration as started/unfinished. Follow `backup-recovery.md` §5c ("Migration Failure Recovery") to clear the stuck record, then redeploy the **previous** Render deployment (§4a in that doc) so the app is back online on the old schema while the SQL is fixed offline.
2. **If the migration applied but application-level smoke tests (§5 below) fail**: this is the harder case, since the schema has already changed underneath. Do not attempt to hand-roll a reverse migration under time pressure during a live pilot. Restore the pre-migration backup from §1.1 to a **new** Render PostgreSQL instance, point a redeployed *previous* backend version at it (`backup-recovery.md` §3b + §4a), and investigate the failure offline against the original, untouched production data.
3. **If data corruption is suspected** (verification queries in §1.3 return non-zero): stop here, do not let pilot users continue operating. Follow `backup-recovery.md` §7 ("Database Corruption Recovery") in full before resuming.

### 1.5 Expected Downtime

| Scenario | Estimate | Notes |
|---|---|---|
| Normal deploy, migrations succeed | **0–2 minutes** | Render replaces the running instance; requests during the swap may briefly 502 until the new instance reports healthy. The migration itself runs in a single transaction and is fast — both new migrations together touch at most a few thousand rows across 8 tables at current pilot scale, this is sub-second to low-seconds of actual SQL execution time |
| Migration fails, rollback to previous deploy | **5–10 minutes** | Time to notice the failure in Render logs, trigger a redeploy of the previous build, and confirm `/health` is green again |
| Full database restore required | **15–60 minutes**, depending on database size | Per `backup-recovery.md` §3a; at current pilot scale (a handful of organisations) this is at the low end of that range |

**Recommendation:** deploy during a window with no pilot users actively mid-workflow (e.g. outside business hours for all pilot orgs), even though the expected downtime is short — a Stock Request or Productivity approval interrupted mid-click during the ~1–2 minute swap is a confusing experience to debug, not a data-integrity risk (the atomic `updateMany` guards added in this sprint mean a half-sent request simply fails cleanly and can be retried).

---

## SECTION 2 — RENDER

### 2.1 Environment Variables

Verified against `backend/src/config/env.js` (the actual source of truth for what the app reads) and `.env.example`:

| Variable | Required | Current Local/Example Value | Pilot Requirement |
|---|---|---|---|
| `NODE_ENV` | Yes | `development` | **Must be `production`** on Render — controls error verbosity (`errorHandler.js` hides stack traces only when `production`) and cookie `secure`/`sameSite` flags (`auth.controller.js` `COOKIE_OPTIONS`) |
| `PORT` | No | `5000` | Set automatically by Render — do not override |
| `DATABASE_URL` | Yes | local Postgres | Render-managed PostgreSQL connection string. **Confirm this points at the pilot database, not a dev/staging one**, before the migration runs |
| `FRONTEND_URL` | Yes | `http://localhost:3000` | Comma-separated list of *additional* allowed CORS origins. Production origins `https://logitask.in` and `https://www.logitask.in` are hardcoded in `server.js` (`PRODUCTION_ORIGINS`) and are always allowed regardless of this var — see §3.5 |
| `JWT_ACCESS_SECRET` | Yes (has an insecure fallback) | falls back to `"dev_access_secret_change_in_production"` if unset | **Must be set to a strong random value on Render.** `env.js` only *warns* via a silent fallback, it does not hard-fail if unset — this is a real risk, see §6 Go/No-Go |
| `JWT_REFRESH_SECRET` | Yes (has an insecure fallback) | falls back to `"dev_refresh_secret_change_in_production"` | Same as above — **must differ from `JWT_ACCESS_SECRET`** |
| `JWT_ACCESS_EXPIRES` | No (has default) | `15m` | Keep at `15m` — short-lived access tokens are part of why the `requireOrg` live-check added this sprint is effective (a deactivated user's stale access token expires quickly even before the live DB check would catch it) |
| `JWT_REFRESH_EXPIRES` | No (has default) | `7d` | Keep at `7d` |
| `REDIS_URL` | No | `redis://localhost:6379` | **Not actually used** — `ioredis` is installed but never connected anywhere in the codebase (confirmed: no `new Redis(...)` call exists). Safe to leave unset on Render |

**Frontend (Render Static Site or wherever it's hosted):**

| Variable | Required | Notes |
|---|---|---|
| `VITE_API_URL` | Yes | Read in `frontend/src/services/api.js` (`baseURL: ${VITE_API_URL}/api`). Must point at the deployed backend's public URL (e.g. `https://fieldops-backend.onrender.com`), not `localhost` |

### 2.2 Build Command

- **Backend:** no separate build step — `npm install` only (Express, no compilation step). Confirm Render's "Build Command" field is either empty or `npm install`.
- **Frontend:** `npm run build` (runs `vite build`, confirmed working — produces `dist/`). Confirm Render's Static Site build command matches and the publish directory is set to `dist`.

### 2.3 Start Command

Backend (`package.json` → `scripts.start`):
```
npx prisma generate && npx prisma migrate deploy && node server.js
```
Confirm this exact command is what Render's "Start Command" field is set to — **this is also where Prisma Generate and Prisma Migrate requirements are satisfied automatically**, see §2.4/§2.5. Do not split this into separate manual steps; the ordering (generate → migrate → start server) is load-bearing.

### 2.4 Prisma Generate Requirements

- Already covered by the `start` script (`npx prisma generate` runs first, every boot).
- Verified in this review: `npx prisma generate` succeeds against the current `schema.prisma` (run locally with a placeholder `DATABASE_URL`, since generate only needs the schema file, not a live connection) — see `migration_safety_review.md`. No action needed beyond confirming Render's Node version satisfies `package.json`'s `"engines": { "node": ">=18.0.0" }`.

### 2.5 Prisma Migrate Requirements

- Already covered by the `start` script (`npx prisma migrate deploy` runs second, every boot, **before** `node server.js`).
- **Critical operational fact, confirmed in `backup-recovery.md`:** "Backend start command runs `prisma migrate deploy` on every restart — failed migrations block startup." This means if either new migration fails, **the entire backend goes down**, not just the new feature — every pilot user loses access until the migration is fixed or the deploy is rolled back. This is why §1.1's backup and §1.3's verification queries are not optional steps.
- Confirm the two new migration folders are present under `backend/prisma/migrations/` in the commit being deployed (they exist in the working tree from this sprint but **have not yet been committed** — see Go/No-Go §6).

### 2.6 Health Check Endpoint

Confirmed in `server.js`:
```js
app.get("/health", (req, res) =>
  res.json({ status: "ok", timestamp: ..., env: process.env.NODE_ENV, corsOrigins: [...] })
);
```
- Set this exact path (`/health`) as Render's Web Service health check path, if not already configured, so Render's own deploy-success detection and any uptime monitor (per `go-live-checklist.md` §4.3, currently **not configured** — flagged there as an open item) point at it.
- Verify after deploy: `curl -s https://<backend>.onrender.com/health | jq .` → expect `{"status":"ok", "env":"production", ...}`. **If `env` shows anything other than `"production"`, `NODE_ENV` was not set correctly on Render** — go back to §2.1.

---

## SECTION 3 — SECURITY

### 3.1 JWT

- Access tokens signed with `JWT_ACCESS_SECRET`, 15-minute expiry; refresh tokens signed with a **separate** `JWT_REFRESH_SECRET`, 7-day expiry, persisted in the `RefreshToken` table (not Redis — confirmed unused) and revocable individually (`isRevoked` flag, set on logout and on every refresh-token rotation).
- **Risk confirmed in this review:** `env.js` falls back to hardcoded dev secrets (`dev_access_secret_change_in_production` / `dev_refresh_secret_change_in_production`) if the env vars are unset, rather than throwing. `go-live-checklist.md` §1.2 already flags this as a required manual check. **This must be verified on Render before pilot start** — confirm via Render Dashboard → Environment tab that both secrets are present and are not the literal default strings, since the application will start successfully either way and give no runtime warning.
- Token payload (`{ id, email, role, name, orgId }`) carries `orgId` as a claim, but as of this sprint's `requireOrg` change, that claim is **no longer trusted on its own** for any request after login — every protected request re-reads the live `orgId`/`isActive`/org-`isActive` state from the database (see §3.2). This closes the "stale JWT after reassignment" gap identified in the Pilot Blocker Fix Sprint.

### 3.2 `requireOrg` Middleware

Confirmed current implementation (`backend/src/middlewares/requireOrg.js`, upgraded in the Pilot Blocker Fix Sprint):
- Applied on **17 of 20** route files (all except `auth.routes.js`, `organisation.routes.js`, and `monitoring.routes.js` — the latter two are Super_Admin-only and don't need org-membership checks).
- For `Super_Admin`: re-checks the user's own `isActive` flag live from the database on every request (previously unchecked after login).
- For every other role: re-checks `isActive`, re-checks that the JWT's `orgId` claim still matches the database's current `orgId` for that user (catches a Super_Admin reassignment mid-session), and re-checks that the user's organisation is still `isActive`.
- **Verify after deploy:** deactivate a test user via the Admin/Super_Admin UI while that user has an active session open in another browser/tab, then have that session attempt any API call — expect an immediate `401` with "Account is no longer active," not a delayed effect on next login.

### 3.3 Role Authorization

Confirmed via direct route-file reads (not assumed): every state-changing endpoint across all 20 route files is gated by `authorize(...)` listing the exact allowed roles (e.g. `authorize("Admin", "Super_Admin")`, `authorize("Store_Manager")`). `authorize.js` itself is a simple, correct allowlist check (`roles.includes(req.user.role)` → `403` otherwise). No route was found relying on the controller to enforce role checks that the route layer doesn't already enforce — this matches the finding already recorded in `pre_launch_risk_assessment.md` §E.

**Verify after deploy** (per `go-live-checklist.md` §3.2's existing API role test pattern):
```bash
ENG_TOKEN=$(curl -s -X POST https://<backend>/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"<pilot-engineer-email>","password":"<password>"}' | jq -r '.data.accessToken')
curl -X PATCH https://<backend>/api/stock-requests/any-id/approve -H "Authorization: Bearer $ENG_TOKEN"
# Expected: 403 Insufficient permissions
```

### 3.4 Multi-Tenant Isolation

- Every multi-tenant read/write path reviewed in this sprint and prior audits consistently scopes by `req.user.orgId` for non-Super_Admin roles (`pre_launch_risk_assessment.md` §E confirms this was independently checked, not assumed).
- **The one confirmed historical gap — SKU codes being globally unique instead of per-organisation — was fixed this sprint** (`Sku.code` + `@@unique([code, orgId])`, see `migration_safety_review.md`). This is the single most important multi-tenant fix to verify actually landed before running a multi-organisation pilot.
- **Verify after deploy, specifically if more than one pilot organisation will be active:** create a SKU with an identical code (e.g. `SKU-001`) in two different organisations and confirm both succeed — this is the literal regression test for the fix described above.
- IDOR protection confirmed present on the one endpoint that takes a foreign user ID as a path param (`getEngineerStock` in `inventory.controller.js`) — it explicitly checks the target engineer's `orgId` before returning data, rather than only relying on the route-level role check.

### 3.5 CORS Configuration

Confirmed in `server.js`:
- `origin` is **never** `"*"` — it's a callback that checks against an explicit allowlist (`PRODUCTION_ORIGINS` hardcoded to `https://logitask.in` and `https://www.logitask.in`, plus `localhost` dev origins, plus anything in `FRONTEND_URL`).
- `credentials: true` is set, required for the httpOnly refresh-token cookie to work cross-origin.
- Requests with no `Origin` header (e.g. server-to-server, curl, Postman) are allowed through (`if (!origin) return callback(null, true)`) — this is normal and expected (browsers always send `Origin` for cross-site fetches; this branch exists for non-browser clients and same-origin requests, not a CORS bypass for browser-based attacks).
- **Verify on Render:** confirm `FRONTEND_URL` env var does not need to include the production domains (they're hardcoded and always allowed) — it only needs to list *additional* origins if the pilot is served from a domain other than `logitask.in`/`www.logitask.in` (e.g. a staging subdomain).
- `curl -I https://<backend>/health` after deploy and confirm `helmet()`-set security headers are present (`X-Content-Type-Options`, etc.) per `go-live-checklist.md` §1.1.

---

## SECTION 4 — PILOT DATA

**No test accounts can be created by this review** — account creation requires either running the application against a live database (no `DATABASE_URL` is available in this environment) or running `prisma/seed.js`, which this review confirms is **pre-existing broken dev tooling** (it predates the multi-tenant `orgId`-required migration and will fail with a `NOT NULL` constraint violation on `Sku.orgId`/`User.orgId` if run against the current schema — this is not something introduced by this sprint, and fixing it is out of scope for an analysis-only task).

The only working path to create pilot accounts is through the application itself, in this order (no direct SQL — this also exercises the exact code paths pilot users will rely on, which is a useful side benefit):

| Step | Action | Role Required | Produces |
|---|---|---|---|
| 1 | Super_Admin logs in, creates the pilot Organisation via `POST /organisations` (Organisation Management screen) | Super_Admin | New org + its first Admin user, created together in one transaction (`organisation.controller.js`) |
| 2 | The new Admin logs in, creates Team_Leader, Store_Manager, and Engineer accounts via User Registry (`POST /users`) | Admin | One user per role needed for the pilot |
| 3 | Distribute credentials to pilot testers **out-of-band** (Slack/email/in person) — there is no self-service signup or "forgot password" flow; this is by design (`go-live-checklist.md` §1.4.5) | — | — |

**Recommended minimum roster for a single-organisation pilot** (expand per the actual pilot plan in `pilot_execution_checklist.md`):

| Role | Suggested count | Notes |
|---|---|---|
| Admin | 1 | Created automatically with the organisation in step 1 |
| Team Leader | 1–2 | Needed to validate Productivity Logs and submit Staff Attendance |
| Store Manager | 1–2 | Needed to approve Stock/Return Requests, Purchase Inward, register SKUs |
| Engineer | 2–3 | Needed to generate realistic daily Productivity/Stock/Return volume |

**Before distributing credentials:** confirm `go-live-checklist.md` §1.4.7's action item — "Seed users' default passwords changed before go-live: Default: `password` — must change" — does **not** apply if seed.js is not run (per the broken-seed finding above), but if any pre-existing seeded accounts already exist in the target database from prior testing, their passwords must be reset before pilot users receive access.

---

## SECTION 5 — SMOKE TEST

Run every test below within the first 15 minutes after deploy, using one real account per role created in Section 4. Each test names the exact UI action and the exact expected result — not just "check it works."

### Login
1. Navigate to the production frontend URL → login page loads.
2. Log in as the Admin account → redirected to `/admin/approval-center` (confirmed current root route in `App.jsx`'s `ROOT_ROUTES`, not the older `/admin/approvals` referenced in `go-live-checklist.md` — that doc predates the Approval Center merge).
3. Log in as Engineer → redirected to `/engineer/dashboard`. As Team_Leader → `/tl/approvals`. As Store_Manager → `/store/dashboard`. As Super_Admin → `/superadmin/dashboard`.
4. Attempt login with a wrong password → clear error message, no token issued.
5. Log out → redirected to `/login`; confirm a subsequent API call with the old token still works until it naturally expires (access tokens are stateless) but a refresh attempt fails (refresh token revoked server-side on logout).

### Attendance
1. As Team_Leader or Store_Manager, submit today's attendance (`Present`) → success toast, entry appears with status `Pending`.
2. Attempt to submit attendance for the same date a second time → rejected (unique constraint on `(userId, date)`).
3. Attempt to submit attendance for a future date → rejected with a validation error (`Joi.date().max("now")`, added this sprint — confirm it's actually live post-deploy).
4. As Admin, open Approval Center → Attendance tab, approve the submission → status changes to `Approved`, and an `AttendanceLedger` entry is created (verify via Admin Attendance Management → Ledger tab).

### Productivity
1. As Engineer, submit a productivity log for today with at least one accessory item → success, status `Pending`.
2. Attempt a second log for the same date → rejected (`409`, unique constraint).
3. As Team_Leader, validate the log → status `Validated`, Engineer notified.
4. As Admin, approve the validated log with an incentive amount per item → status `Approved`; confirm the Engineer's Van Stock for the logged accessory SKU decreased by exactly the logged quantity, and Attendance for that date now shows `Present`.

### Purchase Inward
1. As Store Manager, register a new SKU via SKU Registry — note the code shown.
2. Create a Purchase Inward entry for that SKU with a vendor and an invoice number → success, status `Pending`.
3. Attempt to create a second entry with the **same vendor and invoice number** → rejected with a clear duplicate-invoice message (`409`, new this sprint — this is the literal regression test for P1-7).
4. As Admin, approve the entry → Main Inventory quantity for that SKU increases by the entered amount; **confirm the Store Manager receives an approval notification** (new this sprint, P1-8 — previously this workflow sent no notification at all).

### Return Stock
1. Ensure the test Engineer has van stock for at least one SKU (via an approved Stock Request, if not already present from earlier tests).
2. As Engineer, submit a Return Stock request for a quantity at or below current van stock → success, status `Pending`.
3. Attempt a return request for more than the Engineer's current van stock → rejected with a clear "insufficient stock" message.
4. As Store Manager, approve the return → Engineer's van stock decreases by the returned quantity, Main Inventory increases by the same amount; confirm via Inventory Report that the numbers reconcile (no silent flooring at zero — this sprint's P0-2 fix).

### Approval Center
1. As Admin, open `/admin/approval-center` → confirm both tabs (Productivity Approvals, Attendance Approvals) render, and the header badge shows the correct total pending count across both queues.
2. Approve one item from each tab from within this merged screen → confirm behavior matches the equivalent standalone action (no regression introduced by the earlier UI merge).

### Dashboards
1. Engineer Dashboard: confirm MTD calls/revenue/incentive match the sum of that Engineer's `Approved` logs for the current month.
2. Team Leader Dashboard: confirm team totals match the sum across that TL's engineers.
3. Store Manager Dashboard: confirm pending-action counts match the actual open queues (Stock Requests, Purchase Inward, Claims).
4. Admin Dashboard: confirm the "Productivity Approvals" and "Staff Attendance" quick-link tiles route to `/admin/approval-center` (fixed this sprint — they previously pointed at stale redirect routes).
5. Super Admin Dashboard: confirm org/user totals match Organisation and User Registry screens.

### Notifications
1. As Engineer, submit a Stock Request → confirm the relevant Store Managers see a new unread notification (bell icon badge increments).
2. As Store Manager, approve it → confirm the Engineer receives an "approved" notification.
3. As Store Manager, submit a Purchase Inward entry, then have Admin reject it → confirm the Store Manager now receives a **rejection** notification (this path previously sent nothing at all — verify the P1-8 fix is live).
4. Mark a notification as read → confirm the unread badge count decrements and the change persists across a page reload.

---

## SECTION 6 — GO / NO-GO CHECKLIST

Every item below must be green before pilot users receive credentials. This consolidates the explicit conditions raised in `migration_safety_review.md` and `pilot_blocker_fix_report.md` with the standard baseline from `go-live-checklist.md`.

```
DATABASE
[ ] 1.  Manual pg_dump backup taken and verified non-zero/listable (§1.1)
[ ] 2.  Pre-migration row-count and Sku (id, orgId) snapshot saved (§1.1)
[ ] 3.  Both new migration folders are committed to the branch being deployed
        — confirmed NOT yet committed as of this review; this is a hard blocker
[ ] 4.  Backup is stored off-Render (Google Drive / S3 / local)

RENDER / ENVIRONMENT
[ ] 5.  NODE_ENV=production set on the backend Web Service
[ ] 6.  JWT_ACCESS_SECRET and JWT_REFRESH_SECRET are both set to strong,
        distinct values — NOT the dev_*_change_in_production fallbacks
        (the app will start successfully even if this is wrong — verify by
        reading the actual Render env var values, do not assume)
[ ] 7.  DATABASE_URL points at the intended pilot Render PostgreSQL instance
[ ] 8.  FRONTEND_URL includes any non-logitask.in origin actually serving
        the pilot frontend (production domains are hardcoded and need no entry)
[ ] 9.  Backend Start Command is exactly:
        npx prisma generate && npx prisma migrate deploy && node server.js
[ ] 10. VITE_API_URL on the frontend points at the deployed backend's public URL
[ ] 11. Render health check path is set to /health

DEPLOYMENT SEQUENCE
[ ] 12. Migration deploy and the corresponding backend code deploy happen
        together, in a single Render deploy — not staged separately
[ ] 13. Post-deploy verification queries from §1.3 all return expected
        (zero-row / matching-count) results
[ ] 14. /health returns {"status":"ok","env":"production"}

SECURITY
[ ] 15. requireOrg live-deactivation check verified with a real test
        (deactivate a test user mid-session, confirm immediate 401)
[ ] 16. Cross-org SKU code collision test passed (same code, two orgs, both succeed)
        — required before any multi-organisation pilot, skip only for a
        confirmed single-org pilot
[ ] 17. Engineer-role API call to an Admin-only endpoint returns 403

PILOT DATA
[ ] 18. Pilot Organisation created; Admin/TL/SM/Engineer accounts created
        through the application (not via direct SQL or the broken seed script)
[ ] 19. Credentials distributed to pilot testers out-of-band

SMOKE TEST
[ ] 20. All eight Section 5 smoke tests completed with the stated expected
        results, specifically including the four behaviors that are NEW
        this sprint: future-date rejection, duplicate-invoice rejection,
        Purchase Inward approve/reject notifications, and the
        insufficient-stock rejection (not silent flooring) on Return/Revoke

SIGN-OFF
[ ] 21. All items above checked by a human, not assumed — sign and date below
```

**Signed off by:** _______________________ **Date:** _______________
**Backup filename for this deploy:** `fieldops_backup_______________.dump`
**Git commit deployed:** `_______________________________`

### The one item already known to be red right now

Item 3 above — **the two new migration folders from this sprint exist only in the local working tree and have not been committed.** Every other item in this checklist assumes they will be committed before deploy; this document does not commit them (analysis-only scope), so it is the first action required once review is complete and someone is ready to proceed.
