# Database Operation Summary — Daily & Monthly Estimates

**Status:** Analysis only — no code changes. This document builds on the code-grounded per-endpoint counts in `database_usage_audit.md` and layers explicitly-stated **usage-frequency assumptions** on top, since "how many times per day does an Engineer submit a log" cannot be read from the code — it must be assumed. Every assumption is called out; change them and the totals below scale linearly.

---

## 1. Assumptions (stated up front, all editable)

- **Working pattern:** 22 working days/month, 8-hour nominal shift.
- **Background "active session" hours per day** — time the app tab is actually open, driving `NotificationBell`'s 30s poll. Not the same as shift length; field roles don't keep a browser tab open for 8 continuous hours, desk roles more closely approach it.

| Role | Active session hrs/day | Fraction of that time on a dashboard page (drives `ActivityTimeline`'s 60s poll) |
|---|---|---|
| Engineer | 1.5 | 30% |
| Team Leader | 2.0 | 40% |
| Store Manager | 3.0 | 35% |
| Admin | 4.0 | 50% |
| Super Admin | 1.0 | 60% |

- **Daily discrete actions per role** (the "what they actually do" assumption):

| Role | Assumed daily actions |
|---|---|
| Engineer | 1 login, 1 dashboard load, 1 productivity log submitted, 1 stock request, 0.3 return requests (≈1 every 3 days), 2 ad-hoc history/status views |
| Team Leader | 1 login, 1 dashboard load, 5 productivity logs validated, 2 ad-hoc attendance/LP views |
| Store Manager | 1 login, 1 dashboard load, 4 stock requests approved, 2 return requests approved, 2 purchase inward entries created, 0.2 SKUs registered |
| Admin | 1 login, 1 dashboard load, 10 productivity logs approved (avg. 2 accessory items each), 5 staff attendance approved, 3 purchase inward approved, 1 revoke approved, 1 LP/claim processed, 3 audit log page views |
| Super Admin | 1 login, 1 dashboard+monitoring load, 0.1 organisations created, 0.5 user-management actions, 1 audit log view |

- **Role mix across a typical pilot organisation** (used for monthly scaling): **70% Engineer, 12% Team Leader, 10% Store Manager, 7% Admin, 1% Super Admin.** This mirrors a realistic field-ops org chart (many engineers, few admins) and matches the role ratios implied by the existing seed data shape.

---

## 2. Per-Role Daily Database Operations

Computed by combining the per-endpoint counts in `database_usage_audit.md` with the assumptions above. "Background" = `NotificationBell` + `ActivityTimeline` polling while the session is active. "Action-driven" = the discrete actions table above, each costed using its exact per-endpoint Reads/Writes from the audit.

| Role | Background reads/day | Action-driven reads/day | Action-driven writes/day | **Total reads/day** | **Total writes/day** |
|---|---|---|---|---|---|
| Engineer | ~207 | ~26 | ~8 | **~233** | **~8** |
| Team Leader | ~288 | ~27 | ~16 | **~315** | **~16** |
| Store Manager | ~423 | ~42 | ~36 | **~465** | **~36** |
| Admin | ~600 | ~93 | ~122 | **~693** | **~122** |
| Super Admin | ~156 | ~15 | ~2 | **~171** | **~2** |

**Observation:** background polling dominates total read volume for every role except Admin, where action-driven approval reads/writes (especially Productivity approval's N-item-dependent cost) start to approach the background load. Admin is also, unsurprisingly, the heaviest **write** role by a wide margin — every approval workflow funnels through Admin at least once.

---

## 3. Weighted Average Per User

Using the 70/12/10/7/1 role mix:

```
Avg reads/user/day  = 0.70×233 + 0.12×315 + 0.10×465 + 0.07×693 + 0.01×171
                    ≈ 163.1 + 37.8 + 46.5 + 48.5 + 1.7
                    ≈ 298 reads/user/day

Avg writes/user/day = 0.70×8 + 0.12×16 + 0.10×36 + 0.07×122 + 0.01×2
                    ≈ 5.6 + 1.9 + 3.6 + 8.5 + 0.0
                    ≈ 20 writes/user/day
```

**≈ 298 reads/user/day, ≈ 20 writes/user/day**, blended across a realistic role mix.

---

## 4. Monthly Estimation by User Count

22 working days/month assumed throughout.

| Users | Reads/day (all users) | Writes/day (all users) | **Reads/month** | **Writes/month** | **Total ops/month** |
|---|---|---|---|---|---|
| 10 | ~2,980 | ~200 | **~65,600** | **~4,400** | ~70,000 |
| 50 | ~14,900 | ~1,000 | **~327,800** | **~22,000** | ~350,000 |
| 100 | ~29,800 | ~2,000 | **~655,600** | **~44,000** | ~700,000 |
| 500 | ~149,000 | ~10,000 | **~3,278,000** | **~220,000** | ~3,500,000 |
| 1,000 | ~298,000 | ~20,000 | **~6,556,000** | **~440,000** | ~7,000,000 |

These are the figures carried forward into `firebase_cost_comparison.md` and `render_vs_firebase_analysis.md`.

---

## 5. Worst-Case Scenario (stress ceiling, not the expected case)

If **every** user kept a browser tab open continuously for a full 8-hour shift (rather than the realistic partial-session assumption in §1) and the NotificationBell's 30s poll ran uninterrupted the entire time:

```
Worst-case background reads/user/day = 8 hrs × 3600s/hr ÷ 30s × 1 read (count query)
                                      = 960 reads/day from the bell alone, per user
```

At 1,000 users, that alone is **960,000 reads/day** just from notification polling — roughly **3.2× the realistic total** modeled in §4. This is presented as a ceiling to size against, not an expectation; it is the scenario worth protecting against via the optimization in `infrastructure_scaling_recommendation.md` (lengthening the poll interval or replacing polling with push).

---

## 6. Final Summary Figures (as requested)

| Metric | Value |
|---|---|
| 1. Total estimated database reads/day (at 100-user pilot scale) | **~29,800** |
| 2. Total estimated database writes/day (at 100-user pilot scale) | **~2,000** |
| 3. Average reads per user/day | **~298** |
| 4. Average writes per user/day | **~20** |
| 5. Estimated monthly PostgreSQL operations (at 100 users) | **~700,000** (≈656K reads + ≈44K writes) |

(Items 6–8 — Firestore operations and cost comparison — are carried in `firebase_cost_comparison.md` and `render_vs_firebase_analysis.md` respectively, to avoid duplicating the same numbers across documents; the final consolidated answer to all 8 requested figures is repeated in full at the end of this sprint's closing summary message.)
