# C1 Fix Verification Report — `requireOrg` Async Error Handling

**Scope:** Fixes only the single Critical issue (C1) identified in `docs/final_pre_commit_audit.md`. No other audit item was addressed. No frontend code was touched. No business logic, authorization logic, org-validation logic, role logic, or response payloads were changed.

---

## Root Cause

`backend/src/middlewares/requireOrg.js` was converted to an `async` function during the Pilot Blocker Fix Sprint so it could re-verify live user/org state on every request (two `prisma.user.findUnique()` calls). It was registered directly as Express middleware (`router.use(requireOrg)`) across 16 route files without being wrapped in the project's existing `asyncHandler` utility — the one pattern every other async function in this codebase uses to route promise rejections to Express's error handler.

Because Express does not automatically await or catch rejections from middleware functions, any rejection inside `requireOrg` (a dropped DB connection, pool exhaustion, or any other transient error) was unhandled. Node.js's default behavior (applicable here per `package.json`'s `"engines": { "node": ">=18.0.0" }`) is to terminate the process on an unhandled promise rejection — meaning a single ordinary database hiccup on this one middleware could crash the entire backend for every user, not just fail the one request.

## Exact Fix Applied

Two changes to `backend/src/middlewares/requireOrg.js`, both purely structural — no line of business logic, condition, status code, or message was altered:

1. Added one import: `const asyncHandler = require("../utils/asyncHandler");`
2. Wrapped the existing function body in `asyncHandler(...)` at the point of declaration, changing:
   ```js
   const requireOrg = async (req, res, next) => { ... };
   ```
   to:
   ```js
   const requireOrg = asyncHandler(async (req, res, next) => { ... });
   ```

`module.exports = requireOrg;` is unchanged — the exported value is still a single function with the same `(req, res, next)` signature Express middleware expects, so every route file's `const requireOrg = require("../middlewares/requireOrg"); router.use(requireOrg);` continues to work with zero modification.

### Why this fully closes the gap

`asyncHandler` is defined as:
```js
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
```
Calling the wrapped `requireOrg(req, res, next)` now:
1. Invokes the original async function body.
2. Any exception thrown inside it — synchronous or from an awaited rejection (`prisma.user.findUnique()` failing, a DB connection error, or any other unexpected exception) — becomes a rejected promise, because that is how `async` functions behave by definition.
3. `.catch(next)` catches that rejection and calls Express's `next(err)`.
4. Express routes a `next(err)` call straight to the error-handling middleware — `errorHandler.js`, registered via `app.use(errorHandler)` at the end of `server.js` — instead of hanging the request or propagating an unhandled rejection.

This is the exact same pattern already used by every controller in `backend/src/controllers/*.js` (each one is `asyncHandler(async (req, res) => {...})`), so `requireOrg` is now consistent with the rest of the codebase rather than being the one exception.

## Files Changed

| File | Change |
|---|---|
| `backend/src/middlewares/requireOrg.js` | Added `asyncHandler` import; wrapped the existing function body in `asyncHandler(...)`. No other line changed. |

No route file, controller, or frontend file was modified — confirmed by re-reading `attendance.routes.js` and `sku.routes.js` after the fix: both still `require("../middlewares/requireOrg")` and `router.use(requireOrg)` unchanged, and both continue to function because the exported function's call signature is identical.

## Validation Results

```
node --check on every modified backend file (requireOrg.js + the 9 controllers and
4 route files already touched by the prior sprint, re-checked for regressions):
  OK: src/middlewares/requireOrg.js
  OK: src/controllers/auth.controller.js
  OK: src/controllers/dashboard.controller.js
  OK: src/controllers/inventory.controller.js
  OK: src/controllers/productivity.controller.js
  OK: src/controllers/purchaseInward.controller.js
  OK: src/controllers/returnRequest.controller.js
  OK: src/controllers/revokeRequest.controller.js
  OK: src/controllers/sku.controller.js
  OK: src/controllers/stockRequest.controller.js
  OK: src/routes/productivity.routes.js
  OK: src/routes/sku.routes.js
  OK: src/routes/staffAttendance.routes.js
  OK: src/routes/stockRequest.routes.js
→ All 14 files pass.

npx prisma validate
→ "The schema at prisma\schema.prisma is valid"

npx prisma generate
→ "✔ Generated Prisma Client (v5.22.0) to .\node_modules\@prisma\client"

npm run build (frontend, Vite v5.4.21)
→ ✓ 2745 modules transformed
→ 0 errors, 0 warnings
→ built in 12.48s
```

All four requested validations pass cleanly. The frontend build was re-run as requested even though no frontend file was touched, to confirm the fix introduced no cross-cutting regression — none found, as expected for a backend-only, single-file change.

## Remaining Risks

- **None specific to C1.** The fix is minimal, structural, and uses an already-proven pattern from elsewhere in this exact codebase — there is no remaining code path in `requireOrg.js` where an exception (from `prisma.user.findUnique()`, a connection failure, or any other unexpected error) can produce an unhandled promise rejection. Every `throw`/rejection inside the wrapped function now resolves to `next(err)`.
- **Out of scope, unchanged by this fix, already documented separately:** H1 (the two new migration folders are still untracked in git — `final_pre_commit_audit.md` still applies to that item), H2 (reject-path race-condition consistency), and all Medium/Low items from the original audit. None of these were touched, per the explicit instruction to fix only C1.
- **Behavioral note for awareness, not a defect:** with this fix, a database failure inside `requireOrg` now correctly produces a `500`-class error response via `errorHandler.js` instead of crashing the process — this is the intended and correct outcome, but it does mean that under a genuine sustained database outage, every request through any of the 16 affected route files will now return a clean error response rather than hanging or crashing. This is strictly better than the prior behavior in every respect, but is worth knowing as the expected new behavior during a real DB outage (one degraded request at a time, not a full crash).

---

## SAFE TO COMMIT = YES

C1 (the sole blocking item from `final_pre_commit_audit.md`) is resolved with a minimal, verified, business-logic-neutral fix. The other items raised in that audit — H1 (uncommitted migration folders), H2 (reject-path race consistency), and the Medium/Low items — remain open exactly as documented there and were intentionally not addressed in this fix, per scope. Committing now is safe with respect to C1 specifically; H1 still means the migration folders must be included in the same commit as `schema.prisma` for the repository to remain internally consistent, as already noted in the prior audit.
