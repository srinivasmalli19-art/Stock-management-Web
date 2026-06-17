# FieldOps Manager — Go-Live Checklist

**Application:** LogiTask / FieldOps Manager  
**Production URL:** https://logitask.in  
**Checklist version:** 2026-06-17  
**Reviewer:** _______________________ Date: _______________

Mark each item: ✅ Pass · ❌ Fail · ⚠️ Warning · N/A Not Applicable

---

## Section 1 — Security

### 1.1 HTTPS & Transport

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 1.1.1 | Production URL `https://logitask.in` loads over HTTPS | | |
| 1.1.2 | HTTP redirects to HTTPS (no mixed content) | | Render enforces this automatically |
| 1.1.3 | HSTS header present (`Strict-Transport-Security`) | | Set by Helmet |
| 1.1.4 | API URL used by frontend is HTTPS only | | Check `VITE_API_URL` or vite.config.js proxy |
| 1.1.5 | No API keys or secrets visible in browser network tab | | Inspect XHR requests |

**Verification:**
```bash
# Check HTTPS and security headers
curl -I https://logitask.in
curl -I https://your-api.onrender.com/health
# Look for: Strict-Transport-Security, X-Content-Type-Options, X-Frame-Options
```

---

### 1.2 JWT & Authentication Secrets

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 1.2.1 | `JWT_ACCESS_SECRET` is set in Render env vars | | Must NOT be a dev placeholder |
| 1.2.2 | `JWT_REFRESH_SECRET` is set in Render env vars | | Must NOT match ACCESS_SECRET |
| 1.2.3 | Both secrets are at least 32 characters long | | Use a random generator |
| 1.2.4 | Neither secret matches `dev_access_secret_local` | | Default from .env.example |
| 1.2.5 | `JWT_ACCESS_EXPIRES` is set to `15m` | | Short-lived access tokens |
| 1.2.6 | `JWT_REFRESH_EXPIRES` is set to `7d` | | Long-lived refresh tokens |
| 1.2.7 | Refresh tokens stored in `RefreshToken` table (not Redis) | | Confirmed: Redis not connected |
| 1.2.8 | Logout revokes the refresh token in the database | | Check auth.controller.js logout |

**Generate strong secrets:**
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
# Run twice — one for ACCESS, one for REFRESH
```

---

### 1.3 Environment Variables

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 1.3.1 | `NODE_ENV=production` set in Render env | | Controls logging, error detail |
| 1.3.2 | `DATABASE_URL` points to Render PostgreSQL (not localhost) | | |
| 1.3.3 | `FRONTEND_URL` set to `https://logitask.in,https://www.logitask.in` | | CORS allowlist |
| 1.3.4 | No `.env` file committed to Git | | `git log -- .env` should return nothing |
| 1.3.5 | `.gitignore` includes `.env` | | |
| 1.3.6 | All env vars set in Render Dashboard, not hardcoded in code | | |

**Verify no secrets in git history:**
```bash
git log --all --full-history -- "*.env"
git log --all --full-history -- ".env"
git grep -r "password" -- "*.env" 2>/dev/null || echo "Clean"
```

---

### 1.4 Password Policy

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 1.4.1 | Minimum password length is 8 characters (Joi + frontend) | | Enforced in user.routes.js |
| 1.4.2 | No default "password" fallback in user creation | | `|| "password"` removed |
| 1.4.3 | Passwords are bcrypt-hashed (cost factor 10+) | | Check passwordUtils.js |
| 1.4.4 | Password is never returned in API responses | | `safeUser()` excludes passwordHash |
| 1.4.5 | Password reset requires Admin action (no self-service reset) | | By design |
| 1.4.6 | Rate limit on `/api/auth/login`: 10 requests / 15 min | | express-rate-limit installed |
| 1.4.7 | Seed users' default passwords changed before go-live | | Default: `password` — must change |

> **Action required before go-live:** Log in as each seeded user and change their password to something strong, or delete seed users and create fresh accounts.

---

### 1.5 CORS & API Security

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 1.5.1 | CORS `origin` is NOT `"*"` in production | | Check server.js PRODUCTION_ORIGINS |
| 1.5.2 | Only `logitask.in` and `www.logitask.in` in production origins | | |
| 1.5.3 | `credentials: true` set in CORS config | | For httpOnly cookie support |
| 1.5.4 | Helmet security headers enabled | | `app.use(helmet())` in server.js |
| 1.5.5 | All API routes require authentication (no open routes except /health and /api/auth/*) | | |

---

## Section 2 — Database

### 2.1 Backup Verification

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 2.1.1 | Render PostgreSQL plan is Starter or above (not Free) | | Free tier = no backups |
| 2.1.2 | Automated daily backups confirmed enabled in Render Dashboard | | PostgreSQL → Backups tab |
| 2.1.3 | A manual `pg_dump` backup taken today | | Store off-server |
| 2.1.4 | Backup file size is non-zero and reasonable | | |
| 2.1.5 | Backup stored outside Render (Google Drive, S3, or local) | | |
| 2.1.6 | Backup naming convention used: `fieldops_backup_YYYYMMDD_HHMMSS.dump` | | |

---

### 2.2 Restore Verification

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 2.2.1 | A restore has been tested against a staging or dev database | | |
| 2.2.2 | `pg_restore --list backup_file.dump` completes without errors | | |
| 2.2.3 | After restore, row counts in major tables match expected values | | |
| 2.2.4 | Application connects to restored database successfully | | |
| 2.2.5 | Recovery time for a full restore estimated and documented | | |

**Quick restore test (non-production):**
```bash
# Create a test database to restore into
createdb fieldops_restore_test

# Restore the backup
pg_restore \
  --clean --if-exists --no-owner \
  --dbname="postgresql://postgres:postgres@localhost:5432/fieldops_restore_test" \
  fieldops_backup_YYYYMMDD.dump

# Verify table counts
psql -d fieldops_restore_test -c "
  SELECT table_name, 
    (SELECT COUNT(*) FROM information_schema.columns 
     WHERE table_name = t.table_name) AS col_count
  FROM information_schema.tables t
  WHERE table_schema = 'public' 
  ORDER BY table_name;"

# Cleanup
dropdb fieldops_restore_test
```

---

### 2.3 Migration Verification

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 2.3.1 | All 8 migrations applied successfully | | Check `_prisma_migrations` table |
| 2.3.2 | No migration has `finished_at IS NULL` | | Incomplete migrations |
| 2.3.3 | `AuditLog` table exists with all 13 columns | | Latest migration |
| 2.3.4 | All 6 indexes exist on `AuditLog` | | Run `\d "AuditLog"` in psql |
| 2.3.5 | `StaffAttendance` and `AttendanceLedger` tables exist | | Migration 000003 |
| 2.3.6 | `Organisation` table exists with active orgs | | Multi-tenancy migration |

**Verify via SQL:**
```sql
-- Check all migrations applied
SELECT migration_name, finished_at, applied_steps_count
FROM "_prisma_migrations"
ORDER BY started_at;
-- Expected: 8 rows, all with finished_at NOT NULL

-- Verify AuditLog table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'AuditLog'
ORDER BY ordinal_position;

-- Verify indexes on AuditLog
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'AuditLog';
-- Expected: 6 indexes
```

---

## Section 3 — Application Testing

### 3.1 Authentication Flow

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 3.1.1 | Admin login redirects to `/admin/approvals` | | |
| 3.1.2 | Store Manager login redirects to `/store/dashboard` | | |
| 3.1.3 | Team Leader login redirects to `/tl/approvals` | | |
| 3.1.4 | Engineer login redirects to `/engineer/dashboard` | | |
| 3.1.5 | Super Admin login redirects to `/superadmin/dashboard` | | |
| 3.1.6 | Invalid credentials show error message | | |
| 3.1.7 | Logout clears session and redirects to `/login` | | |
| 3.1.8 | Token auto-refresh works (wait 15min, try an API call) | | Access token expires in 15m |
| 3.1.9 | Unauthenticated API request returns 401 | | |

---

### 3.2 Role Access Control

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 3.2.1 | Engineer cannot access `/admin/*` routes via API | | API returns 403 |
| 3.2.2 | Engineer cannot access `/tl/*` or `/store/*` routes via API | | |
| 3.2.3 | Team Leader cannot approve stock requests | | |
| 3.2.4 | Store Manager cannot access Admin Approval Queue | | |
| 3.2.5 | Admin cannot access Super Admin routes via API | | |
| 3.2.6 | Admin sees only own org's data | | Verify with multiple orgs |
| 3.2.7 | Super Admin can view all organisations | | |
| 3.2.8 | Audit log API enforces org scoping for Admin | | Verify org filter is ignored for Admin |

**Quick API role test:**
```bash
# Get an Engineer token
ENG_TOKEN=$(curl -s -X POST https://your-api.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"eng01@...","password":"..."}' | jq -r '.data.accessToken')

# Engineer should NOT be able to approve a stock request
curl -X PATCH https://your-api.onrender.com/api/stock-requests/any-id/approve \
  -H "Authorization: Bearer $ENG_TOKEN"
# Expected: 403 Insufficient permissions
```

---

### 3.3 Inventory Workflow

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 3.3.1 | Purchase Inward creation succeeds (Store Manager) | | |
| 3.3.2 | Purchase Inward approval increments warehouse qty (Admin) | | |
| 3.3.3 | Stock Request creation succeeds (Engineer) | | |
| 3.3.4 | Stock Request approval fails when qty insufficient | | Should return 400 |
| 3.3.5 | Stock Request approval deducts from warehouse and adds to van | | Atomic transaction |
| 3.3.6 | Revoke flow: SM requests → Admin approves → stock returned | | |
| 3.3.7 | Inventory report shows correct quantities | | |

---

### 3.4 LP & Claim Workflow

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 3.4.1 | TL can submit LP request | | |
| 3.4.2 | Admin can approve/reject LP request | | |
| 3.4.3 | TL can raise claim only after LP is approved | | Not before |
| 3.4.4 | Claim amount cannot exceed LP total cost | | Returns 400 |
| 3.4.5 | Claim amount must be positive | | Joi validation |
| 3.4.6 | Store Manager can validate claim | | |
| 3.4.7 | Admin can approve/reject claim after SM validation | | |
| 3.4.8 | LP CSV export includes Description and Admin Remarks | | |
| 3.4.9 | Claims CSV export includes all 3 remarks columns | | |

---

### 3.5 Attendance Workflow

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 3.5.1 | Team Leader can submit attendance | | |
| 3.5.2 | Store Manager can submit own attendance | | |
| 3.5.3 | Duplicate date submission is rejected (409) | | |
| 3.5.4 | Admin can approve attendance — creates ledger entry atomically | | |
| 3.5.5 | Admin can reject attendance | | |
| 3.5.6 | Attendance Ledger shows approved records | | |
| 3.5.7 | Attendance Ledger CSV export works | | |

---

### 3.6 Audit Log

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 3.6.1 | Performing a user action creates a row in `AuditLog` | | |
| 3.6.2 | Admin Audit Logs page loads at `/admin/audit-logs` | | |
| 3.6.3 | Super Admin Global Audit Logs page loads | | |
| 3.6.4 | Filters narrow results correctly | | Test action + date filters |
| 3.6.5 | Pagination works (Next/Prev, page counter) | | |
| 3.6.6 | Clicking a row opens details modal | | |
| 3.6.7 | Details modal shows oldValue, newValue, IP, user agent | | |
| 3.6.8 | CSV export downloads the current filtered page | | |
| 3.6.9 | Admin cannot see other org's audit logs | | Verify via API |
| 3.6.10 | Audit failure does NOT break the business transaction | | Kill DB mid-request to test |

---

## Section 4 — Deployment & Operations

### 4.1 Rollback Plan

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 4.1.1 | Previous deployment exists in Render Events tab | | Can redeploy it |
| 4.1.2 | Last known good git commit hash is noted below | | |
| 4.1.3 | Manual database backup taken immediately before deploy | | |
| 4.1.4 | Rollback procedure has been tested at least once | | See backup-recovery.md §4 |
| 4.1.5 | Team knows how to trigger a rollback without developer assistance | | |

**Last known good commit:** `_______________________________`  
**Backup filename for this deploy:** `fieldops_backup_______________.dump`

---

### 4.2 Smoke Test Checklist (Run After Every Deploy)

Run these tests within 5 minutes of every production deployment:

```
[ ] 1. Health endpoint: GET /health → {"status":"ok"}
[ ] 2. Login page loads at https://logitask.in
[ ] 3. Admin login succeeds
[ ] 4. Admin dashboard loads with data
[ ] 5. Approval Queue loads (no 500 errors in browser console)
[ ] 6. Audit Logs page loads (confirms AuditLog table migration ran)
[ ] ] 7. Logout works
[ ] 8. Check Render logs for errors in first 2 minutes after start
```

**Health check command:**
```bash
curl -s https://your-api.onrender.com/health | jq .
# Expected: {"status":"ok","timestamp":"...","env":"production"}
```

---

### 4.3 Monitoring Checklist

| # | Check | Current State | Recommended Action |
|---|-------|--------------|-------------------|
| 4.3.1 | Uptime monitoring configured | ❌ Not configured | Set up UptimeRobot (free) to ping /health every 5 min |
| 4.3.2 | Downtime alerts via email/SMS | ❌ Not configured | Configure UptimeRobot email alert |
| 4.3.3 | Render CPU/Memory alerts | ⚠️ Manual check only | Render Metrics tab — check weekly |
| 4.3.4 | Database storage monitoring | ⚠️ Manual check only | Set calendar reminder to check monthly |
| 4.3.5 | Error rate monitoring | ⚠️ Winston logs only | Logs are ephemeral on Render free tier |
| 4.3.6 | Slow query detection | ❌ Not configured | Enable Prisma query logging in dev/staging |
| 4.3.7 | AuditLog table size tracking | ❌ Not configured | Run monthly size check query |

**Recommended immediate action — free uptime monitoring:**
1. Go to https://uptimerobot.com (free tier: 50 monitors)
2. Create monitor: HTTP(S), URL: `https://your-api.onrender.com/health`
3. Check interval: 5 minutes
4. Alert to: srinivasmalli19@gmail.com

**Monthly database size check:**
```sql
SELECT
  relname AS table_name,
  pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
  pg_size_pretty(pg_relation_size(relid)) AS data_size,
  pg_size_pretty(pg_total_relation_size(relid) - pg_relation_size(relid)) AS index_size
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC;
```

---

## Section 5 — Pre-Go-Live Final Checklist

Complete this section on go-live day, in order:

```
[ ] 1.  Take manual pg_dump backup of current database
[ ] 2.  Confirm backup file is non-zero and readable
[ ] 3.  Store backup outside Render (Google Drive / local)
[ ] 4.  Note the backup filename and the git commit being deployed
[ ] 5.  Verify all Render env vars are set (DATABASE_URL, JWT_*, NODE_ENV, FRONTEND_URL)
[ ] 6.  Deploy backend to Render (push to main or manual deploy)
[ ] 7.  Wait for Render logs to show "FieldOps API running on port XXXX"
[ ] 8.  Run smoke test checklist (Section 4.2)
[ ] 9.  Verify /health returns {"env":"production"}
[ ] 10. Login as Admin — confirm audit logs page loads
[ ] 11. Perform one real action (e.g. view audit logs) — confirm AuditLog has a new entry
[ ] 12. Change all seed user passwords or delete seed accounts
[ ] 13. Set up UptimeRobot monitor if not already configured
[ ] 14. Sign below

Signed off by: _______________________ Date: _______________
```

---

## Appendix: Quick Reference — Render Environment Variables

Open: Render Dashboard → fieldops-backend Web Service → Environment

| Variable | Example Value | Required |
|----------|--------------|----------|
| `NODE_ENV` | `production` | Yes |
| `DATABASE_URL` | `postgresql://user:pass@host:5432/dbname` | Yes |
| `JWT_ACCESS_SECRET` | 64-char random hex | Yes |
| `JWT_REFRESH_SECRET` | 64-char random hex (different from ACCESS) | Yes |
| `JWT_ACCESS_EXPIRES` | `15m` | Yes |
| `JWT_REFRESH_EXPIRES` | `7d` | Yes |
| `FRONTEND_URL` | `https://logitask.in,https://www.logitask.in` | Yes |
| `PORT` | _(set automatically by Render — do not set)_ | No |

## Appendix: Quick Reference — Key URLs

| Resource | URL |
|----------|-----|
| Production App | https://logitask.in |
| Backend Health | https://your-api.onrender.com/health |
| Render Dashboard | https://dashboard.render.com |
| Render Status | https://status.render.com |
| GitHub Repository | https://github.com/srinivasmalli19-art/Stock-management-Web |
