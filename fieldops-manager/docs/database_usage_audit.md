# Database Usage Audit — LogiTask / FieldOps Manager

**Status:** Analysis only. No code changes, no migrations, no commits. Every figure below is derived from a direct grep/read census of `backend/src/controllers/*.js`, `backend/src/middlewares/*.js`, `backend/src/utils/auditService.js`, `backend/src/utils/notificationService.js`, and the `useQuery`/`useMutation` call sites in `frontend/src/**`. Where a number depends on real-world usage frequency rather than code structure (e.g. "how many logs does an Engineer submit per day"), it is explicitly marked as an **assumption**, not a measurement.

---

## 1. Method and Scope

A full census of every Prisma operation in `backend/src/controllers/*.js` was taken with:
```
grep -oE "prisma\.[a-zA-Z]+\.(findUnique|findFirst|findMany|count|aggregate|groupBy|create|createMany|update|updateMany|delete|deleteMany|upsert)"
grep -oE "tx\.[a-zA-Z]+\.(...)"   # operations inside $transaction blocks
grep -n "\$queryRaw|\$executeRaw"
```
This captures every database-touching line in every controller, including transaction-internal (`tx.`) calls. Two cross-cutting facts apply to nearly every number in this report and are accounted for explicitly:

1. **`requireOrg` middleware adds exactly 1 SELECT to every request** on the 16 of 20 route files that use it (`attendance`, `attendanceLedger`, `auditLog`, `claimRequest`, `dashboard`, `inventory`, `lpRequest`, `productivity`, `purchaseInward`, `reports`, `returnRequest`, `revokeRequest`, `sku`, `staffAttendance`, `stockRequest`, `user`). This was added in the Pilot Blocker Fix Sprint to re-verify live org/user status on every call — it is a deliberate correctness trade-off, and it is now the single most universal read in the application.
2. **`writeAudit()` adds 1 INSERT** and **`writeNotification()` adds 1 INSERT (`createMany`, one row per recipient in a single statement) plus, when the recipient list isn't already known, 1 SELECT (`roleUserIds`)** to almost every state-changing action. These two shared helpers are called from nearly every create/approve/reject function in the codebase.

**Confirmed finding: the application performs effectively zero hard deletes.** The only `delete`-family call anywhere in the codebase is one `engineerStock.deleteMany` (clearing van stock when a user's role is changed to Engineer in `user.controller.js`). Every other "removal" in the system is a soft state change (`isActive = false`, status transitions). This matters directly for the Firebase comparison later — Firestore delete-operation billing is a non-factor for this app.

---

## 2. Per-Endpoint Read/Write Table

"Reads" and "Writes" below count **Prisma statements per successful request**, including the `requireOrg` read and the shared audit/notification helper calls. `findMany`/`count`/`groupBy` each count as **1 read** regardless of how many rows they return (this distinction matters a great deal for the Firestore comparison in `firebase_cost_comparison.md`).

### Authentication (no `requireOrg` — these routes run before org context exists)

| Endpoint | Reads | Writes | Notes |
|---|---|---|---|
| `POST /auth/login` | 1 | 1 | SELECT user; INSERT refreshToken |
| `POST /auth/refresh` | 2 | 2 | SELECT refreshToken, SELECT user; UPDATE (revoke old), INSERT (new) |
| `POST /auth/logout` | 0 | 1 | `updateMany` revoke |
| `PATCH /auth/change-password` | 1 | 3 | SELECT user; UPDATE user, audit INSERT, notification INSERT |

### Organisation (Super_Admin only, no `requireOrg`)

| Endpoint | Reads | Writes | Notes |
|---|---|---|---|
| `POST /organisations` (create) | 2 | 4 | SELECT siteCode dup, SELECT email dup; transaction[create org, create admin user] + audit×2 |
| `PATCH /organisations/:id` (edit/deactivate) | 1 | 1 | **No audit log written** — confirmed gap, pre-existing, not part of this sprint's scope |
| `GET /organisations` (list) | 2 | 0 | count + findMany |

### User Registry (`requireOrg` applies, +1R baseline on every row below)

| Endpoint | Reads | Writes | Notes |
|---|---|---|---|
| `GET /users` | 2 | 0 | +1 requireOrg, +1 findMany |
| `POST /users` (create) | 3 | 3 | +1 requireOrg, SELECT email dup; INSERT user, deleteMany engineerStock (if role=Engineer), audit + notification |
| `PUT /users/:id` (edit) | 2 | 2 | +1 requireOrg, SELECT existing; UPDATE, audit |
| `PATCH /users/:id/status` | 2 | 2 | Same shape as edit |
| `PATCH /users/:id/organisation` (reassign) | 3 | 3 | +1 requireOrg, SELECT user, SELECT target org; UPDATE, audit, notification |
| *(Hard delete)* | — | — | **Not implemented.** No `user.delete` exists anywhere — deactivation (`isActive`) is the only removal mechanism |

### Attendance — read-only, auto-tracked from Productivity approval (`requireOrg` applies)

| Endpoint | Reads | Writes | Notes |
|---|---|---|---|
| `GET /attendance` (register) | 3 | 0 | +1 requireOrg, findMany attendance, findMany active engineers (for summary calc) |
| `GET /attendance/summary` | 3 | 0 | Same shape |
| `GET /attendance/csv` | 3 | 0 | Same shape, no write |
| *(Writes)* | — | — | All writes to `Attendance` happen only inside Productivity's `approveLog` transaction — counted there, not here |

### Staff Attendance (TL/SM submit, Admin approves — `requireOrg` applies)

| Endpoint | Reads | Writes | Notes |
|---|---|---|---|
| `POST /staff-attendance` (submit) | 3 | 3 | +1 requireOrg, SELECT dup-date check; INSERT, audit, notification (roleUserIds + createMany) |
| `PATCH /:id/approve` | 2 | 4 | +1 requireOrg, SELECT record; `$transaction([update, ledger create])` = 2W, + audit + notification |
| `PATCH /:id/reject` | 2 | 3 | +1 requireOrg, SELECT record; UPDATE, audit, notification |
| `PATCH /:id/resubmit` | 3 | 3 | +1 requireOrg, SELECT record; UPDATE, audit, notification (roleUserIds + createMany) |
| `GET /attendance-ledger` | 2 | 0 | +1 requireOrg, findMany |

### Productivity (the single most write-heavy workflow in the app)

| Endpoint | Reads | Writes | Notes |
|---|---|---|---|
| `GET /productivity` (list) | 2 | 0 | +1 requireOrg, findMany |
| `POST /productivity` (create log) | 3 | 3 | +1 requireOrg, SELECT dup-date check; INSERT log+items, audit, notification |
| `PATCH /:id/resubmit` | 3 | 4 | +1 requireOrg, SELECT log; transaction[deleteMany items, update+recreate items] = 2W, + audit, notification |
| `PATCH /:id/validate` (TL) | 2 | 3 | +1 requireOrg, SELECT log; UPDATE, audit, notification |
| `PATCH /:id/reject-tl` | 2 | 3 | Same shape |
| **`PATCH /:id/approve` (Admin)** | **2 + N** | **4 + 2N** | +1 requireOrg, SELECT log+items; **N pre-check SELECTs** (one `engineerStock.findUnique` per accessory item, N = item count, typically 0–3); transaction[atomic status claim (1W), N item-incentive updates (NW), attendance upsert (1W), N atomic stock decrements (NW)]; + audit + notification. **For a typical N=2-item log: 4 reads, 8 writes — the most expensive single endpoint in the application.** |
| `PATCH /:id/reject-admin` | 2 | 3 | Same shape as validate/reject-tl |

### Stock Requests (Engineer → Store Manager)

| Endpoint | Reads | Writes | Notes |
|---|---|---|---|
| `GET /stock-requests` (list) | 2 | 0 | +1 requireOrg, findMany |
| `POST /stock-requests` (create) | 2 | 3 | +1 requireOrg, SELECT sku; INSERT, audit, notification |
| `PATCH /:id/approve` | 4 | 5 | +1 requireOrg, SELECT request+sku, SELECT mainInventory; transaction[update inventory (1W), find/create engineerStock (1R+1W), update request (1W)]; + audit, notification |
| `PATCH /:id/reject` | 2 | 3 | +1 requireOrg, SELECT; UPDATE, audit, notification |
| `POST /:id/revoke` (submit) | 3 | 4 | +1 requireOrg, SELECT; transaction[create revokeRequest, update stockRequest]=2W; + audit, notification (roleUserIds + createMany) |
| `PATCH /:id/resubmit` | 4 | 3 | +1 requireOrg, SELECT request, [SELECT sku if changed]; UPDATE, audit, notification |

### Return Requests (Engineer → Store Manager)

| Endpoint | Reads | Writes | Notes |
|---|---|---|---|
| `GET /return-requests` (list) | 2 | 0 | +1 requireOrg, findMany |
| `POST /return-requests` (create) | 2 | 3 | +1 requireOrg, SELECT engineerStock; INSERT, audit, notification |
| `PATCH /:id/approve` | 4 | 5 | +1 requireOrg, SELECT request, SELECT stockCheck; transaction[atomic status claim, atomic stock decrement, find/create mainInventory]; + audit, notification |
| `PATCH /:id/reject` | 2 | 3 | Same shape as Stock Requests |
| `PATCH /:id/resubmit` | 4 | 3 | +1 requireOrg, SELECT request, SELECT stock recheck; UPDATE, audit, notification |

### Revoke Requests (Admin-only)

| Endpoint | Reads | Writes | Notes |
|---|---|---|---|
| `GET /revoke-requests` (list) | 2 | 0 | +1 requireOrg, findMany (nested include) |
| `PATCH /:id/approve` | 4 | 6 | +1 requireOrg, SELECT revoke, SELECT engineerStockCheck; transaction[atomic claim, atomic decrement, find/create mainInventory, update stockRequest]; + audit, notification |
| `PATCH /:id/reject` | 2 | 4 | +1 requireOrg, SELECT; transaction[update revoke, update stockRequest]=2W; + audit, notification |

### Purchase Inward (Store Manager creates, Admin approves)

| Endpoint | Reads | Writes | Notes |
|---|---|---|---|
| `GET /purchase-inward` (list) | 2 | 0 | +1 requireOrg, findMany |
| `POST /purchase-inward` (create) | 3 | 2 | +1 requireOrg, SELECT sku, [SELECT dup-invoice check]; INSERT, audit *(no notification on create)* |
| `PATCH /:id/approve` | 3 | 4 | +1 requireOrg, SELECT entry+sku; transaction[atomic claim, find/create mainInventory]; + audit, notification (new this sprint) |
| `PATCH /:id/reject` | 2 | 3 | +1 requireOrg, SELECT; atomic update; + audit, notification (new this sprint) |

### SKU Registry

| Endpoint | Reads | Writes | Notes |
|---|---|---|---|
| `GET /skus` (list) | 2 | 0 | +1 requireOrg, findMany — **called by nearly every screen with a SKU dropdown** (Productivity form, Stock Request form, Purchase Inward form), making this one of the highest-frequency reads in the app despite its low per-call cost |
| `POST /skus` (create) | 2 | up to 4 | +1 requireOrg, SELECT dup code+org; transaction[create sku, create mainInventory]=2W; + audit, [+notification if Store_Manager created it] |
| `PUT /skus/:id` (update) | 2 | 2 | +1 requireOrg, SELECT; UPDATE, audit |

### Inventory (read-only endpoints)

| Endpoint | Reads | Writes | Notes |
|---|---|---|---|
| `GET /inventory/main` | 2 | 0 | +1 requireOrg, findMany |
| `GET /inventory/engineer/:id` | 3 | 0 | +1 requireOrg, SELECT user (IDOR check), findMany |
| `GET /inventory/my-stock` | 2 | 0 | +1 requireOrg, findMany |
| `GET /inventory/main/csv` | 2 | 0 | Same as main, no write |

### LP Requests / Claims

| Endpoint | Reads | Writes | Notes |
|---|---|---|---|
| `GET /lp-requests` | 2 | 0 | +1 requireOrg, findMany |
| `POST /lp-requests` (create) | 1 | 3 | +1 requireOrg; INSERT, audit, notification |
| `PATCH /:id` (approve/reject) | 2 | 3 | +1 requireOrg, SELECT; UPDATE, audit, notification |
| `GET /claim-requests` | 2 | 0 | +1 requireOrg, findMany |
| `POST /claim-requests` (create) | 2 | 3 | +1 requireOrg, SELECT lpRequest; INSERT, audit, notification |
| `PATCH /:id/validate` (SM) | 2 | 3 | +1 requireOrg, SELECT; UPDATE, audit, notification |
| `PATCH /:id/approve` (Admin) | 2 | 3 | Same shape |

### Audit Logs / Monitoring

| Endpoint | Reads | Writes | Notes |
|---|---|---|---|
| `GET /audit-logs` (paginated) | 3 | 0 | +1 requireOrg, count, findMany — **every page navigation = 3 reads** |
| `GET /monitoring` (Super_Admin, no requireOrg) | ~9 | 0 | 2 org counts, 1 user count, 1 auditLog count, 2 groupBy, 1 findMany, 1 `$queryRaw` health check |

### Notifications (`requireOrg` applies)

| Endpoint | Reads | Writes | Notes |
|---|---|---|---|
| `GET /notifications/unread-count` | 2 | 0 | +1 requireOrg, count — **polled every 30 seconds by every logged-in user, on every screen, regardless of activity. See §4.** |
| `GET /notifications` (list/preview) | 2 | 0 | +1 requireOrg, findMany — only fires when the bell dropdown is opened or the Notifications page is visited |
| `PATCH /:id/read` | 1 | 1 | +1 requireOrg, UPDATE |
| `PATCH /read-all` | 1 | 1 | +1 requireOrg, `updateMany` |

### Dashboards (`requireOrg` applies; each dashboard *page* fires multiple of these endpoints)

The 7 functions in `dashboard.controller.js` collectively contain ~40 read operations (counts, groupBy, findMany — no writes anywhere in this controller). A single dashboard **page load** calls several of these endpoints in parallel (confirmed via each dashboard page's `useQuery` call count):

| Dashboard page | Distinct API calls on load (confirmed from `useQuery` count) | Approx. total reads (incl. requireOrg per call) |
|---|---|---|
| Engineer Dashboard | 4 (`eng-dashboard`, `my-stock`, `stock-requests`, `dashboard-widgets`) | ~12–15 |
| Team Leader Dashboard | 5 | ~14–17 |
| Store Manager Dashboard | 4 | ~12–14 |
| Admin Dashboard | 6 (`admin-dashboard`, `lp-requests`, `claim-requests`, `inventory-main`, `attendance-summary`, `dashboard-widgets`) | ~17–20 |
| Super Admin Dashboard | 3 + Monitoring page separately (~9 reads on its own) | ~10–12 (dashboard) / ~10 (monitoring, if visited) |

---

## 3. N+1 / Duplicate Query Findings

### Finding A — Confirmed N+1 pattern, duplicated across two screens

**Files:** `frontend/src/pages/admin/AdminInventory.jsx` (Engineer Stock tab) and `frontend/src/pages/admin/AdminRevokeApprovals.jsx`

Both screens independently implement the identical pattern:
```js
const users = await api.get("/users", { params: { role: "Engineer" } });
const stocks = await Promise.all(
  users.data.data.map((e) => api.get(`/inventory/engineer/${e.id}`))
);
```
For an organisation with **E** engineers, loading either of these two screens issues **1 + E** separate HTTP round trips to the backend, each of which independently pays the full `requireOrg` (+1R) and IDOR-check (+1R) overhead on top of its own `findMany` (+1R) — i.e. **3 reads per engineer**, not amortized across a single batched call. For a 20-engineer organisation, opening either screen costs **~61 backend reads** for what is conceptually one piece of data ("everyone's van stock"). This is the single clearest, most fixable optimization opportunity found in this audit (see `infrastructure_scaling_recommendation.md`).

### Finding B — No genuine backend-side N+1 (loop-wrapped Prisma calls) found

Every multi-row dashboard/report controller function (`dashboard.controller.js`, `reports.controller.js`) already uses batched `findMany`/`groupBy` queries with in-memory lookup maps, not per-row queries inside a loop. This is good practice already in place — confirmed by direct read of every dashboard function, not assumed.

### Finding C — Repeated, overlapping dashboard queries across pages

`AdminDashboard.jsx` and `StoreDashboard.jsx` both independently query `inventory-main`; `AdminDashboard.jsx`'s `attendance-summary` query and the standalone Attendance Management screen query overlapping data with different `staleTime` values (60s vs uncached on navigation). This isn't a bug, but it means the same underlying data is fetched fresh by each page rather than being shared across a session — see caching opportunities in `infrastructure_scaling_recommendation.md`.

### Finding D — Unnecessary refresh: global notification polling

See §4 below — this is the single largest *volume* contributor in the entire system, even though each individual call is cheap.

---

## 4. Polling / Background Refresh Inventory

Confirmed via `grep -rn "refetchInterval"` across the entire frontend:

| Component | Interval | Where mounted | Scope |
|---|---|---|---|
| `NotificationBell.jsx` (unread count) | **30 seconds** | `Topbar.jsx` → present in `AppShell` for **every authenticated page, every role** | Global — fires continuously as long as any tab is open, regardless of which screen the user is viewing |
| `ActivityTimeline.jsx` | 60 seconds | All 5 dashboard pages | Active only while a dashboard page is mounted |
| `StoreReturnRequests.jsx` | 30 seconds | Store Manager Return Requests screen only | Active only while that specific screen is open |
| `SuperAdminMonitoring.jsx` | 60 seconds | Super Admin Monitoring page only | Active only while that specific screen is open |

`frontend/src/main.jsx` sets `refetchOnWindowFocus: false` globally, so outside of the four `refetchInterval`s above, queries only refetch on component remount or when `staleTime` has elapsed and the component is re-rendered — there is no hidden background refetch-on-focus storm beyond what's listed above.

**The NotificationBell's 30-second global poll is the single highest-volume read source in the entire application** — see the daily/monthly modeling in `database_operation_summary.md`, where it is shown to account for roughly 60–70% of all background (non-action-driven) reads across every role.
