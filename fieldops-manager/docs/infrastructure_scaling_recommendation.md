# Infrastructure Scaling Recommendation

**Status:** Analysis only — no code changes were made to produce this document. Every item below is a recommendation for a future, separately-scoped change; none of them have been implemented, and none should be implemented without going through the same staging-validation discipline as the Pilot Blocker Fix Sprint.

---

## 1. Top 20 Endpoints by Database Usage (ranked by realistic daily volume × per-call cost)

Ranked using the per-endpoint costs from `database_usage_audit.md` combined with the call-frequency assumptions in `database_operation_summary.md`. "Volume rank" accounts for how often an endpoint is actually called across a realistic day, not just its per-call cost.

| Rank | Endpoint | Why it ranks here |
|---|---|---|
| 1 | `GET /notifications/unread-count` | 30s global poll, every role, every screen — by far the highest call-frequency endpoint in the system |
| 2 | `GET /skus` | Called from nearly every screen with a SKU dropdown (Productivity, Stock Request, Purchase Inward forms) |
| 3 | `GET /dashboard/widgets` | Polled-adjacent (via `ActivityTimeline`) and loaded on every dashboard page across all 5 roles |
| 4 | `requireOrg` (cross-cutting, not a single endpoint) | +1 read on **every** request across 16 of 20 route files — the single biggest structural multiplier in the whole system |
| 5 | `PATCH /productivity/:id/approve` | Highest per-call cost (4 reads, 8 writes for a typical 2-item log) and called frequently (Admin's primary daily task) |
| 6 | `GET /inventory/main` | Loaded by Store Manager and Admin dashboards plus the dedicated Inventory Report screens |
| 7 | `GET /inventory/engineer/:id` | Cheap per-call, but called **N times** (once per engineer) from two separate screens — see Finding A |
| 8 | `GET /audit-logs` | Every pagination click = 3 reads; Admin/Super_Admin audit review sessions can rack up dozens of calls |
| 9 | `PATCH /stock-requests/:id/approve` | High per-call cost (4R/5W), Store Manager's primary daily task |
| 10 | `PATCH /return-requests/:id/approve` | Same shape as #9 |
| 11 | `PATCH /revoke-requests/:id/approve` | Highest per-call write cost in the non-Productivity set (4R/6W) |
| 12 | `GET /productivity` (list/queue views) | Loaded by TL validation queue and Admin approval queue repeatedly through the day |
| 13 | `PATCH /purchase-inward/:id/approve` | Now also fires a notification (new this sprint) — slightly higher cost than before |
| 14 | `POST /productivity` (create log) | Every Engineer, every working day |
| 15 | `GET /attendance/summary` | Loaded on Admin Dashboard and dedicated Attendance Management screen |
| 16 | `POST /stock-requests` (create) | Every Engineer's stock-replenishment habit |
| 17 | `GET /monitoring` | ~9 reads per call, polled every 60s **while the page is open** — cheap in aggregate since usage is low-frequency (Super_Admin only) |
| 18 | `PATCH /staff-attendance/:id/approve` | Atomic ledger-write transaction, Admin daily task |
| 19 | `GET /claim-requests` / `GET /lp-requests` | Lower frequency but non-trivial per-call cost, used by TL/SM/Admin |
| 20 | `POST /return-requests` (create) | Lower frequency than stock requests but same cost shape |

## Top 20 Screens Generating the Most Reads

1. Any dashboard with `NotificationBell` + `ActivityTimeline` mounted (all 5 — the bell alone outweighs everything else)
2. Admin Dashboard (6 parallel API calls on load)
3. Team Leader Dashboard (5 parallel calls)
4. **Admin Inventory → Engineer Stock tab** (N+1, see Finding A — scales with engineer count)
5. **Admin Revoke Approvals** (same N+1 pattern, independently)
6. Engineer Van Stock / Productivity log form (SKU dropdown load on every visit)
7. Store Manager Purchase Inward form (same SKU dropdown pattern)
8. Admin Audit Logs (3 reads per pagination click, can be dozens per session)
9. Super Admin Monitoring (9 reads per load, 60s poll while open)
10. Admin Approval Center (productivity + attendance tab data both load on open)
11–20. Every list/queue screen (Stock Requests, Return Requests, Revoke Approvals, Purchase Approvals, LP Requests, Claims, SKU Registry, User Registry, Audit Logs, Attendance Management) — each is a flat 2–3 reads per load, ranked here by relative visit frequency rather than per-call cost.

## Top 20 Screens Generating the Most Writes

1. `PATCH /productivity/:id/approve` (Admin Approval Center / AdminApprovals) — highest per-call write cost in the app
2. Admin Revoke Approvals (approve action)
3. Store Manager Stock Requests (approve action)
4. Store Manager Return Requests (approve action)
5. Admin Staff Attendance approval (atomic ledger write)
6. Admin Purchase Approvals (approve/reject, now with notification writes)
7. Engineer Productivity log submission (create)
8. Engineer Stock Request submission (create)
9. Engineer Return Request submission (create)
10. Store Manager Purchase Inward creation
11. Store Manager SKU Registry (create — transaction of 2 writes + audit + conditional notification)
12. Team Leader Productivity validation/rejection
13. Admin LP/Claim approve/reject
14. Team Leader/Store Manager Staff Attendance submission
15. User Registry — create/edit/reassign actions (Admin/Super_Admin)
16. Organisation creation (Super_Admin) — 4 writes in one call, but low frequency
17. Notification mark-read / mark-all-read
18. Auth — login (token write) and refresh (2 writes)
19. Engineer/TL/SM/Admin resubmission actions across all workflows (status-reset writes)
20. SKU edit (Admin)

---

## 2. N+1 Patterns — Confirmed

Already detailed in `database_usage_audit.md` §3 Finding A. Restated here as the #1 fix priority:

**`AdminInventory.jsx` (Engineer Stock tab) and `AdminRevokeApprovals.jsx`** both independently fetch the engineer list, then issue one `GET /inventory/engineer/:id` call per engineer via `Promise.all`. For E engineers, that's `1 + E` HTTP round trips and `3×E` backend reads (requireOrg + IDOR check + findMany, per call), where a single batched backend endpoint could return the same data in 1 round trip and 2 reads total (1 requireOrg + 1 `findMany` with an `engineerId: { in: [...] }` filter).

## Duplicate Queries

`inventory-main` is queried independently by `AdminInventory.jsx`, `StoreDashboard.jsx`, and `StorePurchaseInward.jsx` with different `staleTime` values, meaning the same underlying data is re-fetched fresh by each page on navigation rather than shared across the session.

## Repeated Dashboard Queries

`dashboard-widgets` (pending counts + today's stats) is fetched independently by all 5 dashboard pages — this is appropriate (different roles see different widget data from the same endpoint, scoped server-side), but each page-visit re-fetches it even when `staleTime` (30s) hasn't expired and the user is simply navigating back and forth between, say, the dashboard and the approval queue.

## Unnecessary Refreshes

The `NotificationBell`'s 30-second global poll (see `database_usage_audit.md` §4) is the single clearest "unnecessary refresh" in the system — most users are not receiving a new notification every 30 seconds, so the overwhelming majority of these polls return "no change."

## Expensive Transactions

`PATCH /productivity/:id/approve` is the most expensive transaction in the codebase: for a log with N accessory items, it performs N pre-check reads outside the transaction plus a transaction containing 1 atomic status claim + N item-incentive updates + 1 attendance upsert + N atomic stock decrements (4 + 2N writes total). This is correctness-justified (the atomic guards were added deliberately in the Pilot Blocker Fix Sprint to prevent double-approval and stock-floor bugs) — it should not be simplified for performance at the cost of the safety it provides, but it is worth knowing this is the app's single heaviest write operation when sizing database capacity.

---

## 3. Low-Hanging Optimizations (no business logic changes)

1. **Batch the N+1 engineer-stock fetch** (Finding A). Add one backend endpoint — e.g. `GET /inventory/engineers?role=Engineer` — that returns every engineer's stock in a single `findMany` grouped by `engineerId`, and have both `AdminInventory.jsx` and `AdminRevokeApprovals.jsx` call it instead of their current `Promise.all` loops. This is the single highest-impact, lowest-risk fix identified in this audit.
2. **Lengthen the `NotificationBell` poll interval**, or switch unread-count polling from a fixed 30s timer to a longer interval (e.g. 60–120s) combined with an immediate invalidate-and-refetch whenever the user performs an action that the backend is known to generate a notification for (most mutations in this app already call `queryClient.invalidateQueries` on success — extend that pattern to also invalidate `notification-count` after relevant mutations, reducing reliance on the timer).
3. **Share `inventory-main` and `skus` query results across pages** within a session using React Query's existing cache (they already use the same `queryKey` in most places — confirm all call sites use the identical key so the cache is actually shared, rather than each page defining a slightly different key that defeats deduplication).
4. **Increase `staleTime` on genuinely slow-changing data** — the SKU catalog (`skus` query) changes rarely (new SKU registration is a low-frequency event) but is currently fetched fresh on every form-page visit; a longer `staleTime` (e.g. 5 minutes) would cut its read volume substantially with no visible staleness to users.

## 4. Dashboard Caching Opportunities

- The 5 dashboard "widgets" endpoints (`dashboard.controller.js`) recompute counts/aggregates from scratch on every call. None of these are currently cached server-side. A short-TTL (10–30s) in-memory or Redis cache keyed by `orgId` + role would absorb the bulk of the `NotificationBell`-adjacent and dashboard-revisit read load without changing any displayed data's freshness in any user-visible way (well within the 30-60s `staleTime` already configured on the frontend).
- `monitoring.controller.js`'s ~9-read aggregate query is a strong Redis-caching candidate — it's explicitly polled every 60 seconds and is Super_Admin-only, low-cardinality, easy to cache safely.

## 5. Redis Opportunities

`ioredis` is already an installed dependency and is **confirmed unused** (`backup-recovery.md` already notes this: "Redis is installed but not connected"). The lowest-risk first use of it, before reaching anywhere near the 500–1,000 user tier, would be:
- Cache the dashboard-widgets and monitoring aggregate results described in §4, with a short TTL and explicit invalidation on the relevant write actions (the app already has a single shared `writeAudit`/`writeNotification` choke point per action, making it straightforward to add a cache-invalidation call alongside them later, without restructuring business logic).
- Consider moving refresh-token storage to Redis only if connection-count pressure (see §6) becomes a real constraint — not before, since the current Postgres-backed `RefreshToken` table is working correctly and migrating it is unnecessary churn at pilot scale.

## 6. Query Optimization Opportunities

- No backend-side N+1 loops were found (`database_usage_audit.md` §3 Finding B) — the dashboard/report controllers already batch correctly. This is good existing practice, not a gap.
- The Productivity approval pre-check loop (`for (const item of log.items) { await prisma.engineerStock.findUnique(...) }`, added in the Pilot Blocker Fix Sprint) issues one `findUnique` per accessory item sequentially. For logs with many items this could be batched into a single `findMany({ where: { skuId: { in: [...] } } })` and matched in memory — a safe, business-logic-neutral optimization, since the pre-check is advisory (the real safety guarantee is the atomic `updateMany` inside the transaction either way).

## 7. Pagination Opportunities

- `GET /skus`, `GET /stock-requests`, `GET /return-requests`, `GET /revoke-requests`, and `GET /purchase-inward` all currently return their **full unpaginated result set** per organisation. At pilot scale (tens to low hundreds of rows per org) this is fine. It becomes a genuine concern well before the 1,000-user tier if any single organisation's transaction history grows into the thousands of rows — `GET /audit-logs` already paginates correctly and should be the template applied to the others if/when row counts justify it.

## 8. Indexes Worth Adding

A review of `schema.prisma`'s existing `@@index`/`@@unique` declarations shows the schema is **already reasonably well-indexed** — every org-scoped table has an `orgId` index, and the hottest filtered queries (status-scoped lists, date-ranged attendance/productivity queries) already have matching compound indexes (e.g. `@@index([orgId, status])`, `@@index([orgId, date])`). No glaring missing index was found for the query patterns exercised by the endpoints in this audit. The one candidate worth flagging: `RevokeRequest.skuId` has no index (it's a denormalized, non-FK column, per `migration_safety_review.md`) — it is not currently used as a filter in any query found in this audit, so this is a "worth knowing," not a "should fix," item.

## 9. Batch Query Opportunities

- The N+1 fix in §3.1 is the primary batch-query opportunity in the codebase.
- `writeNotification()`'s `createMany` is already correctly batched (one statement for N recipients) — no change needed there.

---

## 10. Connection Pooling — The Real Scaling Lever Beyond ~300 Concurrent Users

As noted in `render_vs_firebase_analysis.md` §3, the read/write **volume** figures in this sprint are not the limiting factor for scaling Render — **connection count** is. Recommendation, to be actioned only when actually approaching that scale (not now, not as part of this analysis-only sprint):
- Configure Prisma's connection pool limit explicitly (`connection_limit` in `DATABASE_URL`) rather than relying on the default, once concurrent user counts approach the low hundreds.
- Introduce PgBouncer (or Render's managed connection pooling, if available on the plan in use) before the 500-user pilot stage, sized against Render's PostgreSQL plan's documented max-connections ceiling for the tier in use.

---

## 11. Summary Recommendation

None of the optimizations above require a business-logic, workflow, or UI change — they are exactly the kind of "fix without touching what already works" changes appropriate to propose during a staging-validation phase. **Recommended priority order, if and when this work is approved as a separate sprint:**

1. Fix the N+1 engineer-stock pattern (two screens, one new batched endpoint) — highest impact, lowest risk.
2. Tune `NotificationBell` polling (longer interval + invalidate-on-mutation) — second highest impact, addresses the single largest volume source identified in this audit.
3. Add short-TTL dashboard/monitoring caching (Redis, already installed and unused) — defers the need for a Postgres plan upgrade as user count grows.
4. Plan connection pooling before the 500-user pilot stage specifically, independent of the read/write volume figures in this report.

No architecture change (Firebase or otherwise) is recommended at this time — see `render_vs_firebase_analysis.md` for the full reasoning.
