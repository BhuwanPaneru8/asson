# Asson — Delivery Phases

The full system is built in phases. Each phase ships something usable, has clear exit criteria, and leaves the codebase clean (lint, typecheck and build passing). **Don't start a phase until the previous phase's exit criteria are met**, unless the phases are marked as parallel.

Status: ✅ done · 🟡 in progress · ⬜ not started

| # | Phase | Outcome | Status |
|---|---|---|---|
| 0 | Foundation | Project, database, data model, auth, seed | ✅ |
| 1 | Storefront and COD checkout | Customers can browse, search and order | ✅ |
| 2 | Operations admin | Team can fulfil orders and manage catalogue and stock | ✅ |
| 3 | Nepal localisation | NPR, districts, per-district delivery pricing, Nepal copy | ✅ |
| 4 | Online payments | eSewa and Khalti live, with reconciliation | ⏸ On hold (owner decision; backend kept) |
| 5 | Brand and launch readiness | Real Asson catalogue, quality gates, production deploy | 🟡 Tests + CI done |
| 6 | Delivery and notifications | NCM shipping, SMS and WhatsApp updates, COD control | 🟡 Built; gateways pending |
| 7 | Store POS and accountability | Barcode POS, roles, approvals, returns, daily closing | ✅ |
| 8 | Procurement and profit | Suppliers, POs, goods receipt, cost and profit | ✅ |
| 9 | Growth | Phone login, loyalty, marketing pixels, Nepali language | ⬜ |
| 10 | Scale | Multiple stores and warehouse, accounting, mobile app | ⬜ |
| 11 | Nationwide operations | A shop in every district, regional warehouses and fulfilment centres, run from one system | 🚧 |

---

## Phase 0: Foundation ✅

**Goal:** a solid base nothing else has to undo.

- Next.js 16, TypeScript strict, Tailwind v4 tokens, Prisma 6 and PostgreSQL
- Data model: users, addresses, categories, collections, products, variants, images, carts, orders, items, events, inventory log, coupons, reviews
- Session auth (JWT and bcrypt, revocable), roles CUSTOMER, STAFF and ADMIN
- Postgres full-text and trigram search indexes
- Development seed with demo catalogue, accounts and order history

**Exit criteria:** ✅ migrations apply on a fresh DB; seed runs; build passes.

## Phase 1: Storefront and COD checkout ✅

**Goal:** a customer can find exactly what they want and order it in under two minutes.

- Home, mega menu, mobile menu, instant typo-tolerant search
- Category, collection and search listing with filters, sort and pagination
- Product page: gallery, colour and size picker with live stock, fit summary, reviews, related items
- Bag drawer and page, free-delivery progress, guest and account checkout, coupons, COD
- Order confirmation, tracking, cancel, return request; account area; wishlist; reviews
- SEO: metadata, sitemap, robots, product JSON-LD

**Exit criteria:** ✅ test order placed end to end; stock reserved atomically; 0 horizontal overflow at 375 px.

## Phase 2: Operations admin ✅

**Goal:** the team runs daily operations from one panel.

- Dashboard: 30-day KPIs, fulfilment queue, revenue chart, top sellers, low stock
- Orders: status tabs, search, bulk actions, enforced workflow, tracking number on ship, notes, packing slip
- Product editor with colour × size generator; inventory adjustments with reasons; customers and roles; coupons; review moderation

**Exit criteria:** ✅ an order moved Placed → Confirmed → Packed → Shipped with a full audit trail.

## Phase 3: Nepal localisation ✅

**Goal:** feels made for Nepal.

- Rs. with lakh grouping, "Inclusive of 13% VAT", Asia/Kathmandu time
- 7 provinces and 77 districts; province derived from district; +977 mobile validation
- **Per-district delivery rates** (77 rows: fee, days, express, COD, serviceable), editable in Admin → Delivery rates with 90-day order demand per district; seeded Valley Rs. 100 · Outside Rs. 150 · Remote Rs. 250; express Rs. 200; free at or above Rs. 2,500
- Delivery estimator (district → exact fee and arrival date) on the product page and bag; checkout pre-fills the chosen district
- District delivery estimate on the product page; Nepal couriers in the admin; Dashain coupon; Nepali demo data
- Brand renamed to **Asson**; order numbers `AS000123`

**Exit criteria:** ✅ Kathmandu and Humla test orders charged the correct fees; province stored correctly.

## Phase 4: Online payments ⏸ On hold

**Decision (9 Nov 2026):** launch with cash on delivery only. The backend below stays in the codebase, hidden behind `store.onlinePaymentsLive = false`; resume this phase when the owner decides.

**Goal:** customers can prepay with eSewa or Khalti, and money is never lost or double-counted.

| Task | Status |
|---|---|
| `Payment` attempts model, `paymentDueAt` | ✅ |
| eSewa client: signed form (verified against the UAT sandbox), callback signature check, status API | ✅ |
| Khalti client: initiate and lookup (verified-only) | ✅ |
| Idempotent settlement with an amount check; late-payment and duplicate-payment flags | ✅ |
| Return routes, `/pay/[orderId]` page, cron route for expiry and reconciliation | ✅ |
| Checkout: show eSewa and Khalti (enabled when configured); redirect to `/pay` after the order is placed; set `paymentDueAt` | ⬜ |
| Order page: paid, failed and pending banners; **Try again**; **Pay cash on delivery instead** | ⬜ |
| Admin order page: payment attempts list, status and references | ⬜ |
| `.env` / `.env.example` keys; schedule the cron every 5 min | ⬜ |
| Khalti sandbox merchant key from test-admin.khalti.com (**owner action**) | ⬜ |
| E2E: eSewa UAT success, cancel and tamper; Khalti sandbox success and cancel; expiry restocks | ⬜ |

**Exit criteria:** both providers pass success, cancel, tamper and closed-tab cases in sandbox; the cron restocks an abandoned order; no AMBIGUOUS payment is left without an alert.

## Phase 5: Brand and launch readiness 🟡

**Done (9 Nov 2026):** 38 unit tests (pricing, delivery, costing, refunds, barcodes, permissions, state machine, geography, validators), 29 integration tests running the real server actions against an isolated database (including races for the last unit and concurrent cancels and dispatch), 9 Playwright E2E tests on a production build with its own seeded database (guest checkout, ops confirm, till sale, cashier lock-out, no horizontal scroll on mobile), and a GitHub Actions CI pipeline. Fixes found by the tests: rapid barcode scans were dropped; bag drawer had no accessible name; sitemap needed a database at build time.

**Goal:** go live publicly with the real Asson.

- **Brand:** final logo and wordmark, favicon and OG image, domain (`asson.com.np` or `.com`), real support phone, WhatsApp and email
- **Catalogue:** replace demo data with the 8 core products (Shirt, T-shirt, Linen trousers, Jeans, Wind cheater, Jacket, Classic sweater, Winter trousers), real studio photos (see Design §8), fabric, care and fit notes, sizes and colours
- **Policies:** returns (7 days), delivery, privacy, terms, written and linked
- **Quality:** Vitest unit tests (pricing, order states, payment verification); Playwright smoke tests; accessibility audit; Lighthouse ≥ 90 on mobile
- **Production:** managed Postgres with backups and PITR, pooled connections, Redis rate limiting, image CDN, Sentry, uptime monitoring, CI pipeline
- **Data cleanup:** remove the seed from the production path; create real staff accounts; rotate `AUTH_SECRET`

**Exit criteria:** PRD §12 release definition met.

## Phase 6: Delivery and notifications 🟡 *(9 Nov 2026)*

**Done:** SMS outbox with templates for every customer-facing step (placed, confirmed, shipped with tracking and COD amount, out for delivery, delivered with review link, cancelled, return, refund), exactly-once dispatch with retries and backoff, Admin → Notifications; COD verification-call queue; 100 × 150 mm shipping labels with order barcode; COD remittance reconciliation per courier with shortfall flags and ageing.

**Waiting on accounts:** SMS gateway (Sparrow SMS or Aakash SMS) and Nepal Can Move API access. Each plugs into the existing provider interface; implement against the provider's official docs.

**Goal:** customers always know where their order is, and staff never retype addresses.

- Nepal Can Move API: create shipment on "Packed", label printing, tracking-status sync, COD remittance reconciliation
- SMS (e.g. Sparrow or Aakash) plus WhatsApp templates: placed, confirmed, shipped (with tracking), out for delivery, delivered, payment received
- COD controls: confirmation-call queue for high-value COD; flag repeat refusers; OTP on first COD order
- ✅ Exchange flow (size swap) separate from returns *(12 Nov 2026: customer self-service and care staff for phone customers, free replacement order, doorstep collection, Fulfilment → Exchanges, fit advice on product pages from swap data)*

**Exit criteria:** 95% of orders ship without manual address entry; every status change sends a notification.

## Phase 7: Store POS and accountability 🟡 *(core done 9 Nov 2026)*

**Done:** roles Owner / Manager / Cashier / Staff with one permission map; POS at `/admin/pos` (scan SKU or search, merged scans, live stock check); discounts with PIN approval (≤ 5% cashier, ≤ 15% manager, > 15% owner) recorded with reason and approver; split payments (cash with change, eSewa / Khalti / Fonepay QR, card, bank); idempotent sale (double-tap safe); 80 mm receipt; shifts with opening float and counted cash (note required on difference); Daily closing at `/admin/closing` with alerts and a frozen, locked snapshot; approval PIN page.

**Also done:** store returns and exchanges (condition check, damaged → quarantine, refund or store credit voucher, exchange via voucher tender, manager PIN), refunds in cash expectations and closing, Code 128 barcode labels.

**Remaining (hardware/ops):** receipt printer, label printer and cash-drawer setup at the shop; cashier-level sales reports.

**Goal:** the physical shop sells from the same inventory, with full accountability.

- Roles **Owner, Manager, Cashier** with segregation of duties (see PRD §5.2)
- POS screen: **scan → scan → scan → pay**; barcode per SKU; label printing; split payments (cash, eSewa or Khalti QR, card); thermal receipts
- Discount approvals (≤ 5% cashier · 5–15% manager · > 15% owner), each recording employee, amount, reason and approver
- Returns with condition check: resellable goes to stock, damaged goes to quarantine; refund, exchange or store credit
- Shifts with opening float; **daily closing**: sales, refunds, discounts, payment reconciliation, cash count and difference, inventory exceptions, staff; **lock the day**
- Owner dashboard "today" view with alerts (adjustments, refunds, discounts > 15%, cash difference)

**Exit criteria:** a full shop day is run on the POS and closes balanced; the shop and online stock match a physical count at ≥ 99.5%.

## Phase 8: Procurement and profit ✅ *(9 Nov 2026)*

**Done:** suppliers (seeded from the owner's sourcing notes) with scorecards; purchase orders (draft → ordered → partial → received, cancel); counted goods receipts with damage and shortfalls; landed cost; weighted-average cost; cost snapshot on every sale; reorder suggestions (45-day cover, minus units already on order); owner-only costs in the product editor with margin preview; Finance page (monthly P&L, product profitability, stock valuation, expenses); profit on the dashboard and closing.

**Done 11 Nov 2026:** supplier bills and payments (Payables), stock counts with variance approval. Accounting export (VAT summary and registers) ✅.

**Goal:** know the true profit of every product and every day.

- Suppliers directory (Kathmandu, India, China) with scorecards
- Purchase orders → goods receipt (count and verify, record shortfalls, quality check) → supplier bill → payment
- Cost per variant with weighted-average costing; landed cost (freight, customs)
- Gross profit and margin on actual cost in the dashboard; stock value; expenses; monthly profit and loss
- Cycle counts and variance reports; reorder suggestions from sales velocity

**Exit criteria:** monthly profit and loss produced from the system matches the books within 1%.

## Phase 9: Growth 🟡 *(first half 9 Nov 2026)*

- ✅ Loyalty points and tiers: 1 pt per Rs. 100 of goods on delivery (Classic 1× · Silver 1.25× from Rs. 25,000 a year · Gold 1.5× from Rs. 75,000), 100 welcome points, redeem 100+ points at checkout for up to 20% of the bag, refunded on cancel, taken back on returns; store sales earn when the customer's phone is linked
- ✅ Back-in-stock alerts (SMS via the outbox when stock arrives from any source) + "Customers waiting" demand list on Purchasing
- ✅ "Complete the look" (staff pair products in the editor) and recently viewed (product page and home)
- ✅ Product catalogue feed for Google Merchant Center and Meta: `/feeds/products.xml`
- ⬜ Phone number and OTP sign-in (needs the SMS gateway)
- ⬜ Meta pixel and conversions API, TikTok pixel (need the ad accounts)
- ✅ Birthday points and refer-a-friend codes (first-order discount for the friend, points for the referrer on delivery)
- Nepali language (नेपाली) interface
- ✅ Top search terms and zero-result searches; reorder by sales speed, dead stock, size/colour sell-through and margin (Admin → Insights)
- ✅ Analytics: shop funnel (views → bag → checkout → order), customer cohorts, repeat rate, RFM segments (Admin → Insights)

## Phase 10: Scale ⬜

- ✅ Multiple stores and a warehouse: stock per location, transfers, pick lists, per-shop till and closing
- ✅ Click-and-collect: pickup at a shop, pay at the counter, hand-over at the till
- ✅ Accounting export (CSV registers + VAT summary); ⬜ direct sync to accounting software
- Search engine (Meilisearch or Typesense) when the catalogue exceeds about 100k variants
- Native mobile app on the same domain logic
- Own garment production: tech packs, fabric inventory, production orders

## Phase 11: Nationwide operations 🚧

Goal (owner, Nov 2026): at least one shop in every one of the 77 districts, warehouses and fulfilment centres across the country, all run from this system. Built in this order; each step is a PR with tests:

1. ✅ **Location-scoped staff access.** Staff are assigned to locations; tills, closing, stock moves, transfers, counts, picking and receiving only at their own locations. Owner and HQ staff see everything. Security first: a chain can't let every cashier act at every shop.
2. ✅ **Geography-aware fulfilment.** Locations get a district/province (and a fulfilment-centre kind); online orders are filled from the same district, then province, then the nearest centre, before falling back to priority. Faster, cheaper delivery.
3. ✅ **Store replenishment engine.** Per-location min/max from each shop's own sales speed; transfer drafts from the serving warehouse generated by a background job; rebalancing slow stock between shops.
4. ✅ **HQ network dashboard.** Sales, margin, stock cover and staff productivity by shop, district and province; league tables and alerts.
5. ✅ **New-store rollout.** Open a shop from a template: location, staff, opening stock transfer, till, pickup point.
6. ✅ **Nepali-language storefront** (नेपाली) with an English switch: every shopper page, server messages, Nepali product/category/collection names with Devanagari search, order SMS templates (switch `store.smsInNepali`, off for SMS cost). Before production: native-speaker review of `src/lib/i18n/ne.ts`.
7. 🚧 **Infrastructure for national traffic.** ✅ 7a: national-scale dataset, budgeted benchmark, load tester, the slow and crashing reports fixed; measured capacity and the step-by-step plan in [Scaling](Scaling.md). ✅ 7b: health checks, watchdog with incidents and owner SMS alerts, deep health URL, hourly backups. ✅ 7c: zero-downtime blue/green deploys (active after server setup is re-run). Next: production VM and UptimeRobot (owner accounts); several processes serving at once needs a shared Next.js cache handler (when traffic needs it). (Original scope: larger server or managed Postgres with replicas, CDN for media, uptime monitoring and error alerts, load tests.)
8. ✅ **Own production.** Fabric and trims stock at locations with weighted-average cost (supplier bills on receipt), bills of materials and stitching charge per product, production orders to workshops (issue all materials with a cutting allowance, count deliveries with rejects, close short or cancel), finished pieces into stock at real cost, workshop bills into Payables automatically. Later: tech-pack files (spec sheets, photos), per-size fabric use, piece-rate tracking by worker.
9. ✅ **People.** ✅ 12a: attendance (clock in/out per location, forgotten clock-outs, corrections), leave (Labour Act balances, scoped approvals), monthly timesheet. ✅ 12b: payroll (pay terms, SSF 11%/20%, TDS from confirmed bands per fiscal year, monthly runs with approve/paid, cost into the P&L, CSV register, payslips). ✅ 12c: sales commission (rules per shop, from till sales excl. VAT net of refunds, into payroll; staff see their own). ✅ 16a: rosters (weekly planner per location, Labour Act and minimum-staff checks, publish to staff, public-holiday calendar, roster vs clock-ins). ✅ 16b: shift swaps (give away or trade a shift, colleague accepts, manager approves with a full re-check). Later: absences from no-shows into payroll, year-end tax settlement.
10. ✅ **Shop operations.** ✅ 13a: HQ announcements with read receipts, daily checklists per location with a compliance grid, Today page for staff. ✅ 13b: issue reports from locations to HQ (photos, priority with due times, assignee, status timeline, overdue escalation, repair cost, per-location stats). ✅ 13c: customer care queue (website form and case page in English/Nepali, staff-logged phone/WhatsApp/shop cases, SMS on reply, internal notes, triage, reply deadlines, stats). ✅ 13d: visual-merchandising briefs (reference photos, shots per shop, 0–2 scoring, redo rounds, leaderboard). ✅ 13e: store visit audits (scored walk-throughs, fixes with deadlines, acknowledgement, verification). ✅ 13f: shop scorecard (every shop on one page with an explainable operations score and flags). ✅ Customer satisfaction rating after a resolved care case. 
11. ✅ **Finance per location.** ✅ 14a: profit by shop (expenses per location, payroll by person's location, monthly costs, P&L per location reconciling to the company P&L, after HQ share). ✅ 14b: budgets per location (sales, margin, costs; filled from last year), plan vs actual with pace and forecast, shop target on Today. ✅ 14c: cash per location (append-only cash book, tills post automatically, safe counts, bank deposits checked against the statement, petty cash, network position). ✅ 14d: bank statement import with automatic matching of shop deposits and courier COD remittances, explain-the-rest queue, COD in the cash view. ✅ 14e: bank debits matched to supplier payments and expenses, month-end close with a checklist and a database lock on closed months. ✅ 14f: VAT returns per Nepali month (PAN-backed input VAT, carry-forward, filed in order, period locked, payment matched from the bank). ✅ 14g: payroll TDS and SSF deposits with due dates and bank matching, annual salary TDS by employee for e-TDS. ✅ 14h: fiscal-year close with a blocking checklist and the auditor's pack.
12. ✅ **Warehouse and fulfilment.** ✅ 15a: bins (home bin per size, scan and import, pick lists and count sheets in walking order, putaway). ✅ 15b: waves with slots (express first) and a packing station that checks every item by scan. ✅ 15c: courier hand-over manifests (scan parcels with tracking numbers, rider's count must match, every order ships at once, printable with the COD total). ✅ 15d: failed deliveries and returns to origin (attempts with a customer SMS, parcels brought back and received at any location, damaged quarantined, lost claimed, return rate by courier and district), with a COD risk rating on the confirmation-call queue from the customer's record and the district's return rate.
13. ✅ **Pricing.** ✅ 18a: markdowns and price events (plan a sale with dates and products, margin floor with owner approval, starts and ends by itself, prices put back safely, results, slow-stock suggestions, sale price tags). ✅ 18b: price-drop alerts (shoppers ask on the product page, one SMS when a sale or price cut brings it lower; watchers shown when planning a sale).
14. ✅ **Stock quality.** ✅ 19a: damaged stock register (every damaged unit counted per location from returns, exchanges, couriers and staff; repaired, written off or back to the supplier with the credit tracked). ✅ 19b: supplier credit notes in Payables (settle bills or stay as credit, give back input VAT, damaged-goods credits off the cost of goods).
15. ✅ **Selling across the network.** ✅ 20a: a shop orders a size it doesn't have from another location for the customer, to collect there later or delivered, paid now or later. ✅ 20b: changing an order before packing (size swap, fewer items, new address) with stock and money following exactly. ✅ 20c: customers make those changes themselves on their order page, and buy a past order again.

---

## Launch checklist (applies before any public release)

- [ ] All P0 PRD requirements ✅
- [ ] Payments: success, cancel, tamper and closed-tab tested; refunds rehearsed
- [ ] Backups verified by restore; monitoring and alerts firing to a real phone
- [ ] Rate limits on Redis; secrets rotated; demo accounts removed
- [ ] Lighthouse mobile ≥ 90 (not run yet); 🟡 accessibility: basics automated on every shop page and 48 staff pages (`tests/e2e/a11y.spec.ts`: lang, one h1, one main, alt text, named controls, labelled fields, unique ids) and the palette meets AA contrast (12 Nov 2026); a screen-reader and keyboard walk-through by a person is still to do
- [ ] Staff trained on SOPs (opening, closing, packing, returns, cash handling): 🟡 the tool is ready (Admin → Training: 8 starter procedures, sign-off per version, who-signed-what per shop, 12 Nov 2026); the owner to edit them and staff to sign
- [ ] [Memory](Memory.md) updated with the release state
