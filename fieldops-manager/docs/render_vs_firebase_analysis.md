# Render + PostgreSQL vs. Firebase — Architecture Analysis

**Status:** Analysis only — no code changes. This document compares the two architectures on cost, fit, and risk, using the figures already computed in `database_operation_summary.md` and `firebase_cost_comparison.md`.

---

## 1. Cost Comparison

### Render + PostgreSQL — flat, tiered, capacity-based pricing

Render bills by **provisioned instance size**, not by operation count. The figures in `database_usage_audit.md`/`database_operation_summary.md` do not change Render's bill directly — a quiet day and a busy day cost the same on a given plan. Published Render pricing tiers (verify current pricing before budgeting):

| Component | Starter | Standard |
|---|---|---|
| Web Service | ~$7/mo | ~$25/mo |
| PostgreSQL | ~$7/mo (1 GB, no PITR) | ~$20/mo (4 GB, daily backups + PITR) |

| Users | Likely required tier | **Estimated monthly Render cost** |
|---|---|---|
| 10 | Starter + Starter | **~$14/mo** |
| 50 | Starter + Starter (still comfortable) | **~$14/mo** |
| 100 | Starter Web + Standard Postgres (backups become important at this scale per `go-live-checklist.md`) | **~$27–32/mo** |
| 500 | Standard + Standard (connection count and concurrent query load, not raw read/write volume, force the upgrade — see §3) | **~$45/mo** |
| 1,000 | Standard Web (possibly 2 instances) + Standard/Pro Postgres | **~$65–120/mo** |

### Firebase — metered, near-zero at this app's measured usage

From `firebase_cost_comparison.md` §4:

| Users | **Estimated monthly Firebase cost** |
|---|---|
| 10 | **~$0.00** |
| 50 | **~$0.52** |
| 100 | **~$1.70** |
| 500 | **~$11.14** |
| 1,000 | **~$23.19** |

### Side-by-side

| Users | Render (flat) | Firebase (metered) | Cheaper option |
|---|---|---|---|
| 10 | ~$14/mo | ~$0.00 | **Firebase**, by a wide margin in raw dollars |
| 50 | ~$14/mo | ~$0.52 | **Firebase** |
| 100 | ~$27–32/mo | ~$1.70 | **Firebase** |
| 500 | ~$45/mo | ~$11.14 | **Firebase** |
| 1,000 | ~$65–120/mo | ~$23.19 | **Firebase** |

**On pure metered-cost-per-operation, Firebase wins at every tier modeled in this sprint.** This is an honest finding — pretending otherwise to justify staying on Render would misrepresent the data. The reason this report does not recommend switching anyway is covered in §2.

---

## 2. Why Cost Alone Is the Wrong Axis for This App

### 2a. This app is relational and transaction-heavy by design, not by accident

The Pilot Blocker Fix Sprint (commit `e2591b7`) specifically added:
- **Atomic `updateMany`-based race protection** on every approval workflow (Productivity, Revoke, Return, Purchase Inward) — relies on Postgres's row-level conditional updates and transaction rollback semantics.
- **Multi-table atomic transactions** (e.g. Productivity approval: update log status + update N item incentives + upsert attendance + decrement N stock rows, all-or-nothing).
- **Cross-table foreign-key-enforced referential integrity** (confirmed in `migration_safety_review.md` — 6 of 7 SKU-referencing tables have a DB-level FK constraint that makes an orphaned reference structurally impossible, not just application-level-checked).

None of this has a direct, equally-safe equivalent in Firestore's document model. Firestore transactions exist, but they operate on documents, not relational rows with foreign keys — replicating the exact guarantees this app's schema already provides for free (e.g., "you cannot delete a SKU that has inventory records pointing at it" via `ON DELETE RESTRICT`) would require hand-rolling application-level integrity checks that Postgres currently gives for free and enforces unconditionally, even against a bug in application code.

### 2b. A migration is a full re-architecture, not a hosting swap

Every number in this sprint's three companion documents assumes the current relational schema (`backend/prisma/schema.prisma`, 18 models, dozens of foreign keys and compound unique constraints). Moving to Firestore would mean redesigning the entire data model around denormalized documents and collections, rewriting all 17 controllers' query logic, and re-deriving every multi-tenant isolation guarantee that currently comes from `orgId`-scoped relational queries (and, as of this sprint, from the org-scoped `Sku` uniqueness fix) into Firestore security rules and document structure. This is a multi-month project with real regression risk to a system that has just gone through an extensive pilot-readiness hardening sprint — not a configuration change.

### 2c. Render's cost is predictable; Firebase's is not, at the margins

Render's flat pricing means the bill is known in advance regardless of how pilot usage actually unfolds. Firebase's metered model means an unexpected usage spike (a bug that causes a polling loop to run too often, a feature that fans out reads more than expected) shows up as a real-time bill increase, not a planning conversation. Given this app's own audit findings — a global 30-second poll already running on every screen for every user (`database_usage_audit.md` §4) — this is not a hypothetical risk. The worst-case model in `database_operation_summary.md` §5 shows background polling alone could be **3.2× the realistic estimate** if session-duration assumptions are wrong in practice. On Render, that mistake costs nothing extra. On Firebase, it would show up as a real, immediate cost increase, and at sufficiently high scale could erode the cost advantage shown in §1.

### 2d. The absolute dollar amounts are small either way at pilot scale

At every tier modeled in this sprint (10 through 1,000 users), the *difference* between the two architectures is at most ~$100/month. This is not a difference large enough to justify a risky, multi-month re-architecture of a relational, transaction-dependent system that has just been hardened for a multi-organisation pilot.

---

## 3. The Real Scaling Constraint Render Faces (Not Captured by Read/Write Counts)

The read/write-count model in this sprint measures **query volume**, but the actual bottleneck for a Node.js + Prisma + Postgres app at higher concurrency is typically **connection count**, not query throughput. Each Prisma Client instance holds a connection pool; Render's Postgres plans cap maximum concurrent connections per tier. At 500–1,000 concurrent users, this — not the operation-count totals in `database_operation_summary.md` — is what would force a plan upgrade or require connection pooling (PgBouncer, or tuning Prisma's own connection limit). This is flagged here because it doesn't show up anywhere in the read/write tables, but it is the more likely practical constraint in the 500–1,000 user range. See `infrastructure_scaling_recommendation.md` for the specific recommendation.

---

## 4. Recommendation

**Stay on Render + PostgreSQL.** Specifically:

1. The relational/transactional fixes delivered in the Pilot Blocker Fix Sprint are exactly the kind of correctness guarantee that gets harder, not easier, to replicate in a document database — abandoning them now to chase a sub-$100/month cost difference would be a poor trade.
2. Firebase's cost advantage is real but small in absolute terms at every modeled tier, and it is the *more* unpredictable of the two options given this app's existing polling-heavy patterns.
3. The actual near-term engineering investment should go toward the optimizations in `infrastructure_scaling_recommendation.md` (reducing the notification-poll frequency, fixing the two confirmed N+1 screens, adding targeted caching) — these reduce both architectures' theoretical cost and load, and are far cheaper to implement than a Firestore migration would be.
4. Revisit this analysis only if/when the pilot reaches a scale (well beyond the 1,000-user tier modeled here) where Render's flat-tier pricing genuinely outpaces Firebase's metered cost by an amount that justifies the migration risk — nothing in this sprint's data suggests that threshold is anywhere near the current 5-stage pilot rollout plan (5 → 20 → 50 → 100 users).
