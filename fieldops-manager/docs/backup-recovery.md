# FieldOps Manager — Backup & Recovery Guide

**Application:** LogiTask / FieldOps Manager  
**Stack:** Node.js + Express + Prisma + PostgreSQL (Render Oregon)  
**Last reviewed:** 2026-06-17  
**Owner:** srinivasmalli19@gmail.com

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [PostgreSQL Backup Procedure](#2-postgresql-backup-procedure)
3. [PostgreSQL Restore Procedure](#3-postgresql-restore-procedure)
4. [Render Rollback Procedure](#4-render-rollback-procedure)
5. [Prisma Migration Rollback Procedure](#5-prisma-migration-rollback-procedure)
6. [Production Incident Response Checklist](#6-production-incident-response-checklist)
7. [Database Corruption Recovery](#7-database-corruption-recovery)
8. [Accidental Deletion Recovery](#8-accidental-deletion-recovery)
9. [Service Outage Recovery](#9-service-outage-recovery)
10. [AuditLog Retention Strategy](#10-auditlog-retention-strategy)
11. [Recovery Contacts & Resources](#11-recovery-contacts--resources)

---

## 1. Architecture Overview

```
┌─────────────────────────┐     ┌──────────────────────────┐
│  Render Static Site      │     │  Render Web Service       │
│  (Frontend - Vite build) │────▶│  (Backend - Node.js)      │
│  logitask.in             │     │  npx prisma generate      │
└─────────────────────────┘     │  npx prisma migrate deploy│
                                 │  node server.js           │
                                 └──────────┬───────────────┘
                                            │
                                 ┌──────────▼───────────────┐
                                 │  Render PostgreSQL        │
                                 │  Region: Oregon (US West) │
                                 │  DATABASE_URL env var     │
                                 └──────────────────────────┘
```

**Key facts for recovery planning:**
- Backend start command runs `prisma migrate deploy` on every restart — failed migrations block startup
- Log files (`logs/error.log`, `logs/combined.log`) are **ephemeral** — wiped on every deploy/restart on Render
- Redis is installed (`ioredis` package) but **not connected** — all refresh tokens are in PostgreSQL
- No Docker, no Kubernetes — pure Render managed services
- All migrations tracked in `_prisma_migrations` PostgreSQL table
- Code source of truth: GitHub `main` branch

---

## 2. PostgreSQL Backup Procedure

### 2a. Render Automated Backups (Check Your Plan)

| Render PostgreSQL Plan | Automated Backups | Retention | PITR |
|------------------------|-------------------|-----------|------|
| Free                   | None              | N/A       | No   |
| Starter ($7/mo)        | Daily             | 7 days    | No   |
| Standard ($20/mo)      | Daily             | 30 days   | Yes  |
| Pro ($97/mo)           | Daily + hourly    | 90 days   | Yes  |

**Check your current plan:**
1. Render Dashboard → Your PostgreSQL instance → Info tab
2. Note the plan name and backup retention period

> **Critical:** If on Free plan, you have zero automated backups. A database failure or accidental data loss has no recovery path without a manual backup. **Upgrade to Starter minimum for production.**

### 2b. Manual Backup via pg_dump

Run this whenever deploying major changes or weekly as minimum:

```bash
# 1. Get your connection string from Render Dashboard
#    PostgreSQL → Connect → External Connection URL
#    Format: postgresql://user:password@host:port/dbname

# 2. Set it as a shell variable (do NOT commit this to git)
export DATABASE_URL="postgresql://fieldops_user:xxxxx@oregon-postgres.render.com:5432/fieldops_prod"

# 3. Create a compressed backup
pg_dump \
  --format=custom \
  --compress=9 \
  --no-owner \
  --no-privileges \
  "$DATABASE_URL" \
  --file="fieldops_backup_$(date +%Y%m%d_%H%M%S).dump"

# 4. Verify the backup file was created and is non-zero
ls -lh fieldops_backup_*.dump
```

**Backup naming convention:** `fieldops_backup_YYYYMMDD_HHMMSS.dump`

**Backup frequency recommended:**
- Before every production deployment: manual backup
- Weekly minimum: scheduled manual backup  
- Before any schema migration: mandatory backup

### 2c. Schema-Only Backup (for structure recovery)

```bash
pg_dump \
  --schema-only \
  --no-owner \
  "$DATABASE_URL" \
  --file="fieldops_schema_$(date +%Y%m%d).sql"
```

### 2d. Store Backups Off-Server

Render's filesystem is ephemeral. Store backups externally:

```bash
# Option A: Google Drive (manual upload)
# Download the .dump file and upload to Google Drive folder "FieldOps Backups"

# Option B: AWS S3 (if AWS access available)
aws s3 cp fieldops_backup_20260617_120000.dump \
  s3://your-backup-bucket/fieldops/database/

# Option C: Email to yourself (for small databases < 25MB)
# Compress further and email as attachment
```

**Recommended minimum:** Store last 3 manual backups in Google Drive.

---

## 3. PostgreSQL Restore Procedure

> **WARNING:** Restore overwrites all existing data. Never restore to production without confirming the backup file is valid and you have a current backup of the target database.

### 3a. Full Database Restore

```bash
# 1. Confirm backup file exists and size is reasonable
ls -lh fieldops_backup_YYYYMMDD_HHMMSS.dump
# A backup with data should be at least several KB. A 0-byte file is corrupt.

# 2. Test the backup is readable (dry run)
pg_restore --list fieldops_backup_YYYYMMDD_HHMMSS.dump | head -30

# 3. Restore to target database
#    --clean: drops existing objects before recreating
#    --if-exists: prevents errors if objects don't exist
pg_restore \
  --format=custom \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --dbname="$DATABASE_URL" \
  fieldops_backup_YYYYMMDD_HHMMSS.dump

# 4. Verify row counts after restore
psql "$DATABASE_URL" -c "
  SELECT schemaname, tablename, n_live_tup
  FROM pg_stat_user_tables
  ORDER BY n_live_tup DESC;
"
```

### 3b. Restore to a New Render PostgreSQL Instance

1. Create a new PostgreSQL instance in Render Dashboard
2. Wait for it to be available (2–5 minutes)
3. Get the new External Connection URL
4. Run `pg_restore` pointing to the new database URL
5. Update the `DATABASE_URL` environment variable on the backend Web Service
6. Trigger a manual deploy to reconnect

### 3c. Point-in-Time Recovery (Standard Plan Only)

If on Standard plan or above:
1. Render Dashboard → Your PostgreSQL → Backups tab
2. Select the backup point before the incident
3. Click "Restore to new instance"
4. Update backend `DATABASE_URL` env var
5. Redeploy backend

---

## 4. Render Rollback Procedure

### 4a. Roll Back a Backend Deployment

1. Render Dashboard → Your Web Service → Events tab
2. Find the previous successful deployment
3. Click "..." → "Redeploy this deploy"
4. Wait for deploy to complete
5. Verify `/health` endpoint returns `{"status":"ok"}`

Alternatively, via GitHub:
```bash
# Find the commit hash of the last known good deployment
git log --oneline -10

# Create a revert commit (safer than hard reset)
git revert HEAD --no-edit
git push origin main
# Render auto-deploys on push to main
```

### 4b. Roll Back a Frontend Deployment

Render Static Sites keep previous builds:
1. Render Dashboard → Static Site → Events
2. Click "..." → "Redeploy" on the previous deploy
3. No environment variable changes needed — frontend is stateless

### 4c. Emergency Hard Rollback (Last Resort)

```bash
# ONLY use if revert commit is not feasible
# Creates detached state — requires force push — confirm with team first

git reset --hard <last-known-good-commit-hash>
git push --force origin main
```

> **Warning:** Force push to main rewrites history. All team members must `git pull --rebase` after.

---

## 5. Prisma Migration Rollback Procedure

Prisma does **not** support automatic down-migrations with `migrate deploy`. Rollback requires manual SQL.

### 5a. Migration History

| Migration | Date Applied | Description | Tables Affected |
|-----------|-------------|-------------|-----------------|
| `20240101000000_init` | 2024-01-01 | Initial schema | All core tables |
| `20240614000000_add_lp_request` | 2024-06-14 | LP request table | LpRequest |
| `20240615000000_add_lp_engineer_email` | 2024-06-15 | Add tlEmail to LP | LpRequest |
| `20260615000001_lp_workflow_redesign` | 2026-06-15 | LP workflow status changes | LpRequest, ClaimRequest |
| `20260616000001_add_org_and_nullable_orgid` | 2026-06-16 | Multi-tenancy: Organisation table | Organisation, all tables |
| `20260616000002_make_orgid_required` | 2026-06-16 | Enforce orgId NOT NULL | All tables |
| `20260616000003_add_staff_attendance_ledger` | 2026-06-16 | Staff attendance workflow | StaffAttendance, AttendanceLedger |
| `20260617000004_add_audit_log` | 2026-06-17 | Centralized audit trail | AuditLog |

### 5b. Rolling Back the AuditLog Migration (20260617000004)

If the AuditLog table needs to be removed:

```sql
-- Run via psql connected to the production database
-- Step 1: Drop indexes first
DROP INDEX IF EXISTS "AuditLog_organisationId_idx";
DROP INDEX IF EXISTS "AuditLog_userId_idx";
DROP INDEX IF EXISTS "AuditLog_action_idx";
DROP INDEX IF EXISTS "AuditLog_entityType_idx";
DROP INDEX IF EXISTS "AuditLog_createdAt_idx";
DROP INDEX IF EXISTS "AuditLog_organisationId_createdAt_idx";

-- Step 2: Drop the table
DROP TABLE IF EXISTS "AuditLog";

-- Step 3: Remove the migration record so Prisma doesn't think it's applied
DELETE FROM "_prisma_migrations"
WHERE migration_name = '20260617000004_add_audit_log';
```

Then in the codebase:
1. Remove the `AuditLog` model from `schema.prisma`
2. Remove `auditService.js`, `auditLog.controller.js`, `auditLog.routes.js`
3. Remove all `writeAudit` calls from controllers
4. Remove `app.use("/api/audit-logs", auditLogRoutes)` from `server.js`

### 5c. Migration Failure Recovery

If `prisma migrate deploy` fails during startup:

```bash
# 1. Check what failed
psql "$DATABASE_URL" -c "
  SELECT migration_name, started_at, finished_at, applied_steps_count, logs
  FROM _prisma_migrations
  WHERE applied_steps_count IS NULL OR finished_at IS NULL
  ORDER BY started_at DESC LIMIT 5;
"

# 2. If a migration is stuck in "applying" state, resolve the SQL manually
# 3. After manual fix, mark the migration as applied
psql "$DATABASE_URL" -c "
  UPDATE _prisma_migrations
  SET finished_at = NOW(), applied_steps_count = 1
  WHERE migration_name = '20260617000004_add_audit_log'
  AND finished_at IS NULL;
"

# 4. Redeploy the service
```

> **Prevention:** Always take a manual `pg_dump` backup before deploying a new migration. The `start` script runs migrations automatically — a bad migration blocks every restart.

---

## 6. Production Incident Response Checklist

Use this checklist for any production incident.

### Severity Classification

| Severity | Definition | Response Time |
|----------|-----------|---------------|
| P1 — Critical | Application completely down or data loss | Immediate |
| P2 — High | Major feature broken, affects all users | Within 1 hour |
| P3 — Medium | Feature degraded, workaround exists | Within 4 hours |
| P4 — Low | Minor bug, cosmetic issue | Next business day |

### P1/P2 Response Steps

```
[ ] 1. DETECT
      - Check /health endpoint: https://your-api.onrender.com/health
      - Check Render Dashboard → Web Service → Events/Logs
      - Check Render Dashboard → PostgreSQL → Metrics

[ ] 2. COMMUNICATE
      - Note incident start time
      - Identify affected users/organisations

[ ] 3. DIAGNOSE (5 minutes max before escalating)
      - Render Logs: is the process running?
      - PostgreSQL: is the database accepting connections?
      - Last deployment: did this coincide with the incident?
      - Check: did a migration fail on startup?

[ ] 4. CONTAIN
      - If caused by last deployment: roll back (Section 4a)
      - If database issue: check Render PostgreSQL status page
      - If migration failed: apply manual fix (Section 5c)

[ ] 5. RECOVER
      - Restore from backup if data loss confirmed (Section 3)
      - Redeploy service after fix

[ ] 6. VERIFY
      - /health endpoint returns {"status":"ok"}
      - Login with admin@... works
      - Core workflow (submit log → validate → approve) works
      - AuditLog table has recent entries

[ ] 7. POST-INCIDENT
      - Document root cause
      - Update this runbook with new steps if needed
      - Take a fresh manual database backup
```

---

## 7. Database Corruption Recovery

Symptoms: Foreign key violations, duplicate key errors, rows referencing non-existent parents, unexpected NULL in NOT NULL columns.

### Detection Queries

```sql
-- Check for orphaned records (users referencing non-existent orgs)
SELECT u.id, u.email, u."orgId"
FROM "User" u
WHERE u."orgId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "Organisation" o WHERE o.id = u."orgId");

-- Check for orphaned StockRequests
SELECT sr.id, sr."engineerId", sr."skuId"
FROM "StockRequest" sr
WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = sr."engineerId")
   OR NOT EXISTS (SELECT 1 FROM "Sku" s WHERE s.id = sr."skuId");

-- Check for inventory quantity anomalies
SELECT id, "skuId", qty FROM "MainInventory" WHERE qty < 0;
SELECT id, "engineerId", "skuId", qty FROM "EngineerStock" WHERE qty < 0;

-- Verify _prisma_migrations integrity
SELECT migration_name, applied_steps_count, finished_at
FROM "_prisma_migrations"
WHERE finished_at IS NULL OR applied_steps_count = 0;
```

### Recovery Steps

1. **Take an immediate backup** of the corrupted database before touching anything
2. **Identify scope:** Run detection queries above to list affected records
3. **If corruption is isolated** (< 10 rows): fix manually with targeted UPDATE/DELETE statements
4. **If corruption is widespread**: restore from last known good backup (Section 3)
5. After manual fixes, re-run detection queries to confirm clean state
6. Check AuditLog for the user action that caused corruption
7. Document what happened in the incident log

---

## 8. Accidental Deletion Recovery

### Scenario A: Row(s) deleted by mistake (Admin action)

No soft-delete exists in this schema. Deleted rows cannot be recovered from the application.

Recovery path:
1. Take an immediate backup of current database (to preserve current state)
2. Restore backup to a **temporary** Render PostgreSQL instance (do NOT overwrite production)
3. Extract the deleted row(s) from the temporary instance:
   ```sql
   -- On temporary restored instance, run:
   SELECT * FROM "User" WHERE id = 'deleted-user-id';
   ```
4. Re-insert the row(s) into production using the extracted data
5. Terminate the temporary instance

### Scenario B: Entire table truncated or dropped

This is a P1 incident. Full restore required (Section 3a).

Recovery path:
1. Immediately suspend the backend service (Render → Suspend) to prevent further writes
2. Restore from last good backup to a temporary instance
3. If backup is recent enough (< 1 hour old): restore directly to production
4. If backup is old: restore to temp instance, identify and re-insert missing rows, then restore production
5. Resume backend service

### Scenario C: Wrong data written at scale (bad migration, bulk update bug)

1. Check AuditLog for the mass-update action and approximate timestamp
2. Restore to the backup taken just before the deployment/action
3. If backup pre-dates the issue: contact Render support for PITR (Standard plan only)

### Audit Log as Recovery Aid

The AuditLog table captures `oldValue` for updates. For USER_UPDATED, PASSWORD_RESET, USER_ENABLED/DISABLED actions the old state is preserved. Query it to reconstruct what a record looked like before modification:

```sql
SELECT "oldValue", "newValue", "createdAt", "userName"
FROM "AuditLog"
WHERE "entityType" = 'User'
  AND "entityId" = 'the-user-id'
ORDER BY "createdAt" DESC
LIMIT 10;
```

---

## 9. Service Outage Recovery

### Backend Web Service Down

Symptoms: API returns 502/503, `/health` unreachable

```
[ ] 1. Render Dashboard → Web Service → Logs
         Look for: OOM kill, port binding failure, uncaught exception, migration failure

[ ] 2. Most common causes:
         a) Migration failure on startup → fix SQL, redeploy (Section 5c)
         b) DATABASE_URL env var missing or wrong → re-add in Render env vars
         c) Out of memory (free tier 512MB) → check memory usage in Metrics tab
         d) Cold start timeout (Render free tier sleeps after 15min inactivity)

[ ] 3. Quick fix attempt:
         Render → Web Service → Manual Deploy (redeploys current code)

[ ] 4. If manual deploy fails:
         Check environment variables are all set (Section 11)
         Roll back to previous deployment (Section 4a)

[ ] 5. If database unreachable:
         Render → PostgreSQL → check status
         Verify DATABASE_URL matches current Render connection string
```

### Frontend Static Site Down

Symptoms: logitask.in shows 404 or blank page

```
[ ] 1. Render Dashboard → Static Site → Logs
         Look for: build failure (npm run build error)

[ ] 2. If build failure:
         Check vite.config.js and package.json for syntax errors
         Roll back to previous static site deploy

[ ] 3. If 404 on all routes:
         Verify Render Static Site "Rewrite Rules" are set:
         Source: /* → Destination: /index.html → Action: Rewrite
         (This is required for React Router to work)
```

### Database Unavailable

```
[ ] 1. Render Status Page: https://status.render.com
         Check if there is a platform-wide incident

[ ] 2. Render Dashboard → PostgreSQL → check status indicators

[ ] 3. If Render infrastructure issue: wait for Render to resolve
         (No action possible on your end for Render-managed outages)

[ ] 4. If your own database was accidentally deleted or suspended:
         Render → PostgreSQL → Resume (if suspended)
         If deleted: restore from most recent backup (Section 3b)

[ ] 5. After database recovery, trigger backend manual deploy to reconnect
```

---

## 10. AuditLog Retention Strategy

### Growth Projections

The `AuditLog` table captures 21 action types across 6 controllers. Row size estimate: ~500 bytes data + ~700 bytes index overhead = **~1.2 KB per row**.

#### Conservative (single organisation, moderate activity)

| Period | Events/Day | Total Rows | Table Size |
|--------|-----------|------------|------------|
| 1 month | 15 | ~450 | ~0.5 MB |
| 6 months | 15 | ~2,700 | ~3 MB |
| 1 year | 15 | ~5,475 | ~6 MB |

#### Moderate (5 organisations, active usage)

| Period | Events/Day | Total Rows | Table Size |
|--------|-----------|------------|------------|
| 1 month | 75 | ~2,250 | ~2.7 MB |
| 6 months | 75 | ~13,500 | ~16 MB |
| 1 year | 75 | ~27,375 | ~33 MB |

#### Scale (20 organisations, high usage)

| Period | Events/Day | Total Rows | Table Size |
|--------|-----------|------------|------------|
| 1 month | 300 | ~9,000 | ~11 MB |
| 6 months | 300 | ~54,000 | ~65 MB |
| 1 year | 300 | ~109,500 | ~131 MB |

At current scale (single organisation), the `AuditLog` table will not cause any performance or storage issues for at least 3 years.

### Retention Recommendation: **Archive after 2 years**

| Option | Recommendation | Reasoning |
|--------|---------------|-----------|
| Keep forever | Not recommended | Unbounded growth; GDPR/privacy compliance risk |
| Archive after 1 year | Acceptable | Reasonable if compliance requires 1yr minimum |
| **Archive after 2 years** | **Recommended** | Covers most compliance windows; table stays small |
| Delete after 2 years | Not recommended | Loses forensic audit trail permanently |

### Archival Procedure (when needed)

```sql
-- Step 1: Export old logs to JSON file (run monthly or quarterly)
-- Via psql \copy or pg_dump table-specific export:

pg_dump \
  --table="AuditLog" \
  --format=plain \
  "$DATABASE_URL" \
  | grep -v "^--" \
  > auditlog_archive_$(date +%Y%m%d).sql

-- Step 2: Delete archived rows (only after confirming export is safe)
DELETE FROM "AuditLog"
WHERE "createdAt" < NOW() - INTERVAL '2 years';

-- Step 3: VACUUM to reclaim space
VACUUM ANALYZE "AuditLog";
```

Store archived files in Google Drive: `FieldOps Backups / AuditLog Archives / YYYY-MM.sql`

---

## 11. Recovery Contacts & Resources

| Resource | URL / Contact |
|----------|--------------|
| Render Dashboard | https://dashboard.render.com |
| Render Status Page | https://status.render.com |
| Render Support | https://render.com/support |
| GitHub Repository | https://github.com/srinivasmalli19-art/Stock-management-Web |
| Application Owner | srinivasmalli19@gmail.com |
| Production URL | https://logitask.in |

### Key Environment Variables (Names Only — Never Commit Values)

```
DATABASE_URL          PostgreSQL connection string (Render managed)
JWT_ACCESS_SECRET     Access token signing secret (min 32 chars)
JWT_REFRESH_SECRET    Refresh token signing secret (min 32 chars)
JWT_ACCESS_EXPIRES    Access token TTL (currently: 15m)
JWT_REFRESH_EXPIRES   Refresh token TTL (currently: 7d)
NODE_ENV              Must be "production" on Render
FRONTEND_URL          Comma-separated list of allowed CORS origins
PORT                  Set automatically by Render (do not override)
```

All values are set in: Render Dashboard → Web Service → Environment tab.
