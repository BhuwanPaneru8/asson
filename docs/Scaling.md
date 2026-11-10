# Asson — Scaling to every district

*Measured 10 Nov 2026 (Phase 11 step 7a). Re-run the numbers after any big change: `npm run scale:load` then `npm run bench:scale`.*

## 1. What we measured

**Dataset** (`tests/scale/load.ts`, its own database `asson_scale`):
- a shop in each of the 77 districts and 5 warehouses
- 3,000 products and 36,000 sizes
- **1.16 million** location-stock rows
- **300,000** orders from about 60,000 customers over a year
- 600,000 sales lines

**Hot paths at that size** (median of three runs, Apple M4, `tests/scale/hot-paths.bench.test.ts`; budgets are enforced, so a regression fails the run):

| Path | Time | Budget |
|---|---|---|
| Catalogue, filters, product page, best-seller rail | 1–6 ms | 300 ms |
| Search ("linen shirt") | 18 ms | 300 ms |
| Checkout: take stock for 2 lines across 82 locations | 3 ms | 500 ms |
| Warehouse pick list, pick counts | < 5 ms | 1.5 s |
| Network dashboard (30 / 90 days) | 0.2 / 0.4 s | 5 s |
| Reorder plan | 0.5 s (**crashed before**) | 5 s |
| Customer insights | 1.4 s (**13.4 s before, and wrong past 200k orders**) | 5 s |
| Size/colour mix, month P&L, stock valuation | 0.2–0.6 s | 5 s |
| Replenishment plan, all shops | 3.5 s (5.1 s before) | 5 s |
| New-shop best-seller starter | 1.5 s | 5 s |
| Nightly stock audit | 0.25 s | 5 s |

**Shopper traffic** (`scripts/load-test.ts`, a production build on the same data, one Node process): visitors cycle through home, category, search, product and search suggestions.

| Simultaneous shoppers | Pages/second | p50 | p95 | Errors |
|---|---|---|---|---|
| 1 | 182 | 6 ms | 8 ms | 0 |
| 20 | 326 | 71 ms | 103 ms | 0 |
| 40 | 337 | 135 ms | 202 ms | 0 |
| 80 | 358 | 256 ms | 404 ms | 0 |

**Reading it:**
- Throughput flattens at about 350 pages/s while waiting time grows in step. The limit is **one Node process's CPU rendering pages**, not the database: search suggestions, which barely render, stay at 3–15 ms.
- A page costs about 3 ms of CPU on a fast core. Expect roughly 80–150 pages/s per core on a proper server, and much less on the shared Always Free AMD micro (1/8 OCPU) that staging runs on today.

## 2. How much traffic a national chain means

| | Page views/day | Busiest hour | Sale spike (10×) |
|---|---|---|---|
| Today | < 5,000 | < 1/s | < 5/s |
| 77 shops + strong online | ~150,000 | ~6/s | ~60/s |
| Market leader | ~1,000,000 | ~40/s | ~400/s |

Till sales barely touch the web server: a sale is one request.

## 3. The plan, in order (each step only when its trigger is met)

| # | Step | Trigger | Who | Cost |
|---|---|---|---|---|
| A | **Production on a real VM:** at least 2 dedicated vCPU / 8 GB, e.g. Oracle A1 (2 OCPU / 12 GB, free when capacity allows) or a paid 2–4 vCPU VM in India. Keep the micro for staging only. | Before public launch | Owner creates the VM; I run `deploy/server-setup.sh` | US$0–25/month |
| B | **Uptime and error alerts:** ✅ code done (7b): watchdog + incidents + owner SMS, `/api/health/deep`. Owner: UptimeRobot (free) on `/api/health` and `/api/health/deep?key=…` every 5 min, and `ALERT_PHONES`. Optional Sentry key. | Before public launch | Owner: account, alert contacts | Free |
| C | **Backups every hour** ✅ in `server-setup.sh` (production, 24 rotating copies on- and off-site; active once setup is re-run on the server). Monthly restore drill. | Before public launch | Me (re-run setup with owner) | Free |
| D | **Database on its own machine or managed Postgres** (Neon / Supabase Pro / a DB VM) with point-in-time restore. | Orders > ~2,000/day or DB CPU > 50% at peak | Owner: account; me: move | ~US$20–50/month |
| E0 | **Zero-downtime deploys** ✅ (7c): nginx + blue/green slots; a deploy never interrupts tills or shoppers, and a bad build never goes live. | Done in code; active after setup re-run | Me | Free |
| E | **Several app processes** (one per core) behind a local load balancer. Needs, in code: shared rate limits (Postgres), a shared Next.js cache handler so a price change clears every process, and one job worker. | Sustained > 50% CPU at peak, or sale spikes > ~100 pages/s | Me (code), then server config | Same VM |
| F | Read replica for HQ reports. | HQ reports slow down tills or checkout | Owner + me | ~US$20+/month |

## 4. What step 7a changed in the code

- **No unbounded id lists.** Postgres allows 32,767 values per query; `lib/batch.ts` `inChunks()` splits long lists. The reorder plan crashed without this at 36,000 sizes, and opening stock for a new shop would have too.
- **No `.find()` inside loops over big lists** (reorder plan, replenishment, new-shop planner); Maps instead.
- **Customer insights computed in the database:** totals, a recency grid, a cohort grid and the top 15 customers. Before, it loaded every order (capped at 200,000, oldest first, so the newest were silently missing).
- **Replenishment** groups 1M stock rows by location once, and works out each shop's supply order once instead of per need.
