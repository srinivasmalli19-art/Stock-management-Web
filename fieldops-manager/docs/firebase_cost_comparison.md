# Firebase / Firestore Cost Comparison

**Status:** Analysis only — no code changes. Estimates only; this is not a quote. Firebase pricing is taken from publicly published Blaze plan rates at the time of writing and may have changed — verify current pricing at firebase.google.com/pricing before using these figures for a budget commitment.

---

## 1. Why a Naive 1:1 Translation Would Be Wrong

A PostgreSQL `findMany` query that returns 20 rows is **1 database operation** in the Postgres model used throughout `database_usage_audit.md`. Firestore bills **per document read**, not per query — the equivalent Firestore query returning 20 documents is **20 billable reads**, not 1. Any comparison that doesn't account for this fans-out incorrectly in Firestore's favor.

**Assumption applied:** based on the actual list/dashboard endpoints in this app (SKU catalogs, pending-request queues, audit log pages — all small, single-organisation, typically-paginated result sets), the average row count returned per `findMany`/list-style query is assumed to be **~6 rows**. Single-row lookups (`findUnique`, `findFirst`) remain 1:1. Aggregate operations (`count`, `groupBy`) have no native Firestore equivalent at this granularity — Firestore's `count()` aggregation query (billed at a fraction of a normal read) is the closest analog, but `groupBy` would typically require reading every matching document. To stay conservative rather than favor either side, this report applies a single blended multiplier:

**1 Postgres read operation ≈ 6 Firestore document reads (blended average).**

Writes are closer to 1:1 at the per-row level, but this app's `writeNotification()` helper inserts **N rows in one Postgres statement** (`createMany`) where N = recipient count — in Firestore, each recipient's notification would be a separate document write even inside a batch (Firestore batches reduce round trips, not per-document billing). Applying a modest fan-out correction:

**1 Postgres write operation ≈ 1.3 Firestore document writes (blended average).**

**Deletes:** confirmed in `database_usage_audit.md` that this application performs effectively zero hard deletes (one `deleteMany` call in the entire codebase, on a low-frequency admin action). Firestore delete billing is treated as **negligible/zero** in this comparison.

---

## 2. Estimated Firestore Operations by User Count

Using the Postgres monthly figures from `database_operation_summary.md` §4:

| Users | Postgres reads/mo | Postgres writes/mo | **Firestore reads/mo (×6)** | **Firestore writes/mo (×1.3)** |
|---|---|---|---|---|
| 10 | ~65,600 | ~4,400 | **~393,600** | **~5,720** |
| 50 | ~327,800 | ~22,000 | **~1,966,800** | **~28,600** |
| 100 | ~655,600 | ~44,000 | **~3,933,600** | **~57,200** |
| 500 | ~3,278,000 | ~220,000 | **~19,668,000** | **~286,000** |
| 1,000 | ~6,556,000 | ~440,000 | **~39,336,000** | **~572,000** |

---

## 3. Firebase Blaze Plan Free Tier

Firestore's free tier resets **daily**, not monthly — this matters because this report's usage is fairly evenly spread across a working month, but a real free-tier check happens per-day, not pooled. Published free tier (subject to change, verify current values):

- **50,000 document reads/day** free
- **20,000 document writes/day** free
- **20,000 document deletes/day** free (not a factor here — see §1)

Beyond the free tier, published Blaze rates (per 100,000 operations, verify current pricing):
- Reads: **$0.06** per 100,000
- Writes: **$0.18** per 100,000
- Deletes: **$0.02** per 100,000 (not a factor here)

---

## 4. Estimated Monthly Cost by User Count

Computed per-day against the daily free tier, then summed across 22 working days/month (the same working-day assumption used throughout this sprint — Firestore's free tier resets every calendar day including non-working days, which makes this estimate slightly conservative/favorable to Firestore in practice, since unused free-tier allowance on non-working days doesn't roll over but also isn't needed).

| Users | Firestore reads/day | Firestore writes/day | Billable reads/day (over 50K) | Billable writes/day (over 20K) | Daily cost | **Monthly cost (×22)** |
|---|---|---|---|---|---|---|
| 10 | ~17,880 | ~260 | 0 (under free tier) | 0 | $0.00 | **$0.00** |
| 50 | ~89,400 | ~1,300 | ~39,400 | 0 | ~$0.024 | **~$0.52** |
| 100 | ~178,800 | ~2,600 | ~128,800 | 0 | ~$0.077 | **~$1.70** |
| 500 | ~894,000 | ~13,000 | ~844,000 | 0 | ~$0.506 | **~$11.14** |
| 1,000 | ~1,788,000 | ~26,000 | ~1,738,000 | ~6,000 | ~$1.054 | **~$23.19** |

**Headline finding: Firestore's metered cost for this application's actual usage pattern is remarkably low at every pilot tier — under $25/month even at 1,000 users.** This is a genuinely useful data point, but it is *not* the whole story — see `render_vs_firebase_analysis.md` for why metered-operation cost is the wrong axis to make this decision on for an app shaped like this one.

---

## 5. An Important Caveat: Polling vs. Listeners

Every Firestore figure above assumes a **naive lift-and-shift** — i.e., porting the exact same interval-based polling pattern found in this codebase (`NotificationBell`'s 30s `refetchInterval`, etc.) directly onto Firestore via repeated `get()` calls. This is the worst way to use Firestore. Firestore's native strength is **real-time listeners** (`onSnapshot`), which only bill for an actual document read when the underlying data *changes* — not on a fixed timer regardless of change. If a Firebase migration were ever undertaken, the notification-bell and dashboard-polling patterns identified in `database_usage_audit.md` §4 would very likely become **cheaper** under Firestore's listener model than under the naive polling estimate in §4 above. This caveat cuts in Firestore's favor and is disclosed for completeness, even though it doesn't change this sprint's architecture recommendation (see `render_vs_firebase_analysis.md`).
