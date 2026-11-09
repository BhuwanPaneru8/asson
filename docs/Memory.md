# Asson — Project Memory

> **Read this first** if you are a new chat, a new AI or a new developer. It tells you, in about 3 minutes, what this project is, where it stands, and the traps to avoid. Then read the doc for your task: [PRD](PRD.md) · [Architecture](Architecture.md) · [Rules](Rules.md) · [Phases](Phases.md) · [Design](Design.md).
>
> **Keep it current:** at the end of every working session, update §3 (current state), §6 (open work) and §8 (log).

---

## 1. What this is (30 seconds)

**Asson** is a Nepali clothing brand: *classic clothing, quality fabric, fair prices*. It starts menswear-first with 8 core products. **Asson Commerce OS** (this repo) is the one system the whole company runs on: online storefront, operations admin, payments, and (later) the store POS, procurement and accounting hooks. It delivers to all 77 districts of Nepal and is COD-first, with eSewa and Khalti.

Founder priorities, in order: **accuracy → accountability → fast checkout → automatic inventory → payment reconciliation → profit visibility → simple staff operation → owner control.**

## 2. Run it

```bash
npm install
cp .env.example .env     # DATABASE_URL, AUTH_SECRET; eSewa UAT keys for local payments
npm run db:migrate       # schema + search indexes
npm run db:seed          # ⚠ WIPES the DB. Demo data + accounts (credentials at the top of prisma/seed.ts)
npm run dev              # http://localhost:3000 · admin at /admin
npm run typecheck && npm run lint && npm test && npm run test:e2e   # must all pass before merging
```

The local DB is named `threadline` (pre-rename name; harmless). Demo staff and customer accounts use `@asson.test` emails.

## 3. Current state (updated 9 Nov 2026)

| Area | State |
|---|---|
| Storefront, search, product page, bag, COD checkout, accounts, tracking, returns | ✅ Working, verified in the browser |
| Admin: dashboard, orders workflow, bulk actions, packing slip, products and variants, inventory ledger, customers and roles, coupons, reviews | ✅ Working |
| Nepal localisation: Rs., VAT copy, 77 districts, zone delivery fees, couriers, Asia/Kathmandu | ✅ Working |
| Brand renamed Threadline → **Asson**; order prefix `AS` | ✅ |
| Delivery pricing | ✅ Per-district `DeliveryRate` table (77 rows), admin editor at `/admin/delivery`, estimator on product page and bag, free at or above **Rs. 2,500** |
| Online payments (eSewa and Khalti) | ⏸ **On hold by owner decision.** Backend kept; hidden from checkout via `store.onlinePaymentsLive = false`. Checkout is COD-only |
| Roles and permissions | ✅ Owner (ADMIN) · Manager · Cashier · Staff via `lib/permissions.ts`; cashier sees POS only |
| Store POS + daily closing | ✅ `/admin/pos` (scan, PIN-approved discounts, split payments incl. store credit, receipts, shifts, **returns and exchanges**) and `/admin/closing` (reconcile, refunds, owner-only gross profit, lock day) |
| Purchasing + costing | ✅ `/admin/suppliers`, `/admin/purchasing` (POs, counted receipts, landed and weighted-average cost, reorder suggestions), barcode labels at `/admin/labels` |
| Finance (owner) | ✅ `/admin/finance` monthly P&L, product profitability, stock valuation, expenses; profit cards on the dashboard |
| Automated tests + CI | ✅ 44 unit + 37 integration (Vitest, real Postgres `asson_test`) + 9 E2E (Playwright, prod build, `asson_e2e`); GitHub Actions workflow |
| Growth (Phase 9, part 1) | ✅ Loyalty points and tiers (account card, checkout redemption, ledger `PointsEntry`), back-in-stock SMS alerts, "Complete the look", recently viewed, Google/Meta feed at `/feeds/products.xml` |
| Shipping + notifications | ✅ SMS outbox (Admin → Notifications), COD call queue ("To call" tab), shipping labels, COD remittance (`/admin/cod`). ⬜ SMS gateway and NCM API need accounts |
| Git | Initial commit only; recent work **uncommitted** |

## 4. Stack (short)

Next.js **16.4.5** (App Router, Server Actions, Turbopack) · React 19.3 · TypeScript strict · Tailwind v4 · Prisma **6.19** + PostgreSQL 15 · zod 4 · jose + bcryptjs · lucide-react · sonner. Fonts: Fraunces (display) and Inter (UI). Full detail in [Architecture](Architecture.md).

## 5. Things that will bite you

1. **Next 16 is different.** Middleware is `src/proxy.ts`; `params` are Promises; `revalidateTag` needs two args; `refresh()` exists for server actions. Read `node_modules/next/dist/docs/` before using unfamiliar APIs.
2. **`cacheComponents` is OFF** on purpose. Use `unstable_cache` with tags `products` and `catalog`. Don't add `"use cache"`.
3. **Prisma drops indexes it doesn't know.** A migration once silently dropped the trigram search index. Read every generated `migration.sql`. The full-text index is an expression index in the `search_indexes` raw migration (function `product_search_doc`); the trigram index is declared in the schema.
4. **Money is integer paisa.** `formatPrice()` gives "Rs. 2,399". Discounts round down to whole rupees.
5. **Province is derived from district** (`withProvince`); never ask for both. The delivery fee comes from the **`DeliveryRate` row for the district** (`getDeliveryRates()` → `rateFor()` → `deliveryFee()`), never from hard-coded zones. After adding a Prisma model, **restart the dev server**: the cached Prisma client won't know the new table.
6. **Stock changes only via conditional update plus `InventoryLog`.** Order status only via `transitionOrder()` (state machine in `lib/order-status.ts`).
7. **Client components can't import server-only modules** (`lib/orders.ts`, `lib/catalog.ts`, …). Shared labels live in `lib/order-status.ts`, `lib/config.ts` and `lib/utils.ts`.
8. **React Compiler lint rules:** no `setState` in effect bodies, no components defined inside components, no `Date.now()` in render (use `now()`).
9. **eSewa docs' example signatures are wrong.** Our standard HMAC-SHA256 base64 over `total_amount=…,transaction_uuid=…,product_code=…` **is accepted by the UAT sandbox** (tested; tampered signatures are rejected with ES104). eSewa appends `?data=` to the success URL, so our return URLs carry the reference in the **path**.
10. **Khalti:** sandbox base `https://dev.khalti.com/api/v2`, header `Authorization: Key <secret>`, amount in paisa (min Rs. 10). Only lookup status `Completed` = paid; `Pending` and unknown statuses are held for review, never auto-cancelled. The sandbox key needs a merchant signup at test-admin.khalti.com.
11. Cookie names are still `tl_session` and `tl_cart` (legacy prefix). Renaming them logs everyone out; do it only before launch.
12. **POS sales are Orders** (`channel: STORE`, `paymentMethod: IN_STORE`, status DELIVERED) with `Tender` rows; they share stock and the order ledger with online orders. `createPosSale` is idempotent via `clientRef`. Demo PINs: owner 1357, manager 2580 (dev seed only).
13. **Money and stock rules for returns and purchasing:** refunds are per-unit `unitPrice × (subtotal − discount) / subtotal` (never more than was paid). Cancelling or returning an order through the admin restocks only units not already returned at the till. Goods receipts add only counted good units; cost = weighted average of on-hand stock and the landed unit cost. Purchase cost and profit are visible to the owner only (`finance` permission); never send `costPrice` to the till or the storefront.
14. **`prisma migrate dev` refuses to run non-interactively** when it wants confirmation (e.g. a new unique column). Generate SQL with `prisma migrate diff --from-schema-datasource … --to-schema-datamodel … --script` into a new migration folder, review it, then `prisma migrate deploy`.
15. **Testing:** `npm test` (unit + integration on `asson_test`, created with `createdb asson_test`) and `npm run test:e2e` (builds into `.next-e2e`, seeds `asson_e2e`, starts on :3100, clears `.next-e2e/cache` first). Integration tests mock `next/headers`, `next/cache`, `next/navigation`, `next/server` and `@/lib/auth` (`actAs(user)`). Prisma refuses `migrate reset` when run by an AI agent without the owner's explicit consent; use `migrate deploy` plus the seed instead.
16. **Next's data cache lives on disk** (`<distDir>/cache`) and survives restarts. If the database is replaced (re-seed), cached product pages keep old IDs. Clear the cache whenever the DB is swapped out. In a debugging session I mistook this for a Prisma connection stall, so check the database log (`log_statement`) before blaming drivers.
17. **Never disable the only submit button of a form that takes barcode input:** browsers ignore Enter then, dropping fast scans.
18. **The seed wipes everything.** Never point it at a shared or production DB (it refuses when `NODE_ENV=production`).
19. **Loyalty bookkeeping lives in `lib/loyalty.ts`** and is called from `transitionOrder` (DELIVERED earns, CANCELLED refunds spent points, RETURNED takes back earned points), `processReturn` and `createPosSale`. Spending is a conditional decrement on `User.points` inside the order transaction; `PointsEntry` is the audit ledger. Points come off **after** the coupon, and the free-delivery threshold is judged **before** points. Refunds and P&L treat `Order.pointsDiscount` as a discount.
20. **Anything that adds stock must call `queueBackInStock(tx, variantIds)`** in the same transaction (receiving, adjustments, cancel/return restock, store returns), then dispatch with `after()`.
21. **A browser pane in the background delays React hydration** until the first interaction. Effects (recently viewed, checkout quote) look "broken" in that state; click or scroll first before concluding.

## 6. Open work: next steps, in order

**Next (in order):** (1) Owner to confirm the loyalty rules (earn rate, tiers, 20% cap, welcome points; all in `store.loyalty`). (2) Supplier bills and payments (accounts payable) and stock counts (Phase 8 remainder). (3) When the owner has accounts: SMS gateway, Nepal Can Move API, eSewa/Khalti (all have ready interfaces). Before launch: production infrastructure from Phase 5.

**Phase 4 (online payments) is on hold.** When it resumes: wire checkout to `startPayment` / `/pay/[id]`, set `paymentDueAt`, add Try-again and switch-to-COD on the order page, list payment attempts in the admin, add env keys, schedule `/api/cron/payments`, and run the sandbox E2E tests. Then flip `onlinePaymentsLive`.

Then: Phase 5 (real catalogue, photos, tests, production infrastructure). See [Phases](Phases.md).

## 7. Key decisions (why things are the way they are)

- **Nepal-first, COD-only at launch** (owner decision, 9 Nov 2026). **Delivery is priced per district** and editable by the owner; seeded at Valley Rs. 100 · Outside Rs. 150 · Remote Rs. 250; express Rs. 200; **free at or above Rs. 2,500** (owner confirmed). Returns within 7 days and COD up to Rs. 30,000 are still unconfirmed defaults in `src/lib/config.ts`.
- **One source of truth:** this system holds orders, stock and payments. Notion is for SOPs, planning and content only.
- **Never delete transactions; every stock change has a reason; discounts need approvers** (from the owner's operating notes).
- **Modular monolith, no microservices** until a measured need appears.
- **Prisma 6, not 7 or 8**, for stability (Prisma 7+ changes config and drivers).

## 8. Session log

| Date | What changed |
|---|---|
| 2026-11-09 | Built the full storefront and admin from scratch (Next 16, Prisma, Postgres); seeded the demo catalogue; verified checkout and fulfilment in the browser. |
| 2026-11-09 | Localised for Nepal (NPR, districts, zones, couriers, timezone); added district to `Address`; restored the trigram index Prisma had dropped. |
| 2026-11-09 | Started eSewa and Khalti: `Payment` model, provider clients, settlement and reconciliation, return routes, cron. eSewa signature verified against the UAT sandbox. |
| 2026-11-09 | Tests and CI (67 Vitest + 9 Playwright, GitHub Actions); fixes found by them (dropped rapid scans, unlabeled bag drawer, sitemap needing a DB at build, toasts covering CTAs earlier); `loading.tsx` skeletons on all dynamic routes (prefetch storm); configurable DB pool. Phase 6: SMS outbox + Admin → Notifications, COD call queue, shipping labels, COD remittance. |
| 2026-11-09 | Phase 9 part 1: loyalty points and tiers (earn on delivery and at the till, redeem at checkout atomically, cancel/return reversals, account card with history), back-in-stock SMS alerts with a demand list, "Complete the look" pairing + rail, recently viewed, Google/Meta product feed. 80 Vitest + 9 E2E green. |
| 2026-11-09 | Phase 7 finished and Phase 8 built: store returns and exchanges (manager approval, condition → restock or quarantine, store-credit vouchers usable at the till and online), Code 128 labels (verified bit-for-bit against JsBarcode), suppliers, POs, counted goods receipts, landed + weighted-average costing, cost snapshot on sales, reorder suggestions, Finance P&L and expenses, profit on dashboard and closing. Toasts moved to top-centre (they covered CTAs on phones). |
| 2026-11-09 | Phase 7 core: roles and permissions, POS (scan, PIN-approved discounts, split tenders, receipts, idempotent sales), shifts, daily closing with locked snapshot, approval PIN page, admin sign-out. SKUs now `AS-…`. Verified a full cashier → manager day in the browser. |
| 2026-11-09 | Per-district delivery pricing (DeliveryRate table, admin editor with demand stats, estimator, checkout pre-fill); free delivery at Rs. 2,500; online payments put on hold (COD-only checkout). Next: Phase 7 (roles, POS, daily closing). |
| 2026-11-09 | Renamed the brand to **Asson** (order prefix AS); wrote PRD, Architecture, Rules, Phases, Design and Memory docs; darkened `warn` to `#8f5a0f` for AA contrast. |
