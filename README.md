# Asson — clothing e-commerce platform

A full-stack storefront + operations panel for a clothing business delivering across **Nepal**.
Next.js 16 (App Router, server actions) · PostgreSQL · Prisma · Tailwind CSS v4.

> Brand: **Asson**. Name, currency (NPR), delivery zones and fees, COD limit,
> return window, support contacts and order-number prefix all live in **`src/lib/config.ts`**.

## Built for Nepal

- **Prices in Rs.** with lakh grouping (Rs. 1,00,000), stored as integer paisa; "Inclusive of 13% VAT" everywhere.
- **Addresses** use the 7 provinces / 77 districts: district → city/municipality → tole/street → landmark;
  province is derived from the district automatically; postal code optional. Mobile numbers validated as 98/97/96XXXXXXXX (+977).
- **Delivery zones** (fees are config): Inside Kathmandu Valley Rs. 100 (1–2 days) · Outside the Valley Rs. 150 (3–5 days) ·
  Remote districts Rs. 250 (5–10 days, e.g. Humla, Dolpa, Mustang) · Express same/next day Rs. 200, Valley only ·
  free standard delivery anywhere above Rs. 2,999. The fee is recalculated on the server from the delivery district.
- **Product pages** show delivery time and fee for the shopper's district (remembered on their device).
- **Payments**: Cash on Delivery works now (COD dominates in Nepal); eSewa / Khalti / Fonepay / cards plug into `src/lib/payments.ts`.
- **Couriers** in the ship dialog: own rider, Pathao Parcel, Nepal Can Move, Upaya, Aramex Nepal, Nepal Post.
- Dashboard dates and the daily revenue chart use **Asia/Kathmandu** time.

## Project docs

| Doc | Read it for |
|---|---|
| [docs/Memory.md](docs/Memory.md) | **Start here.** Current state, gotchas, next steps |
| [docs/PRD.md](docs/PRD.md) | What we're building, for whom, and why; requirements and status |
| [docs/Architecture.md](docs/Architecture.md) | Stack, structure, data model, flows, deployment, decisions |
| [docs/Rules.md](docs/Rules.md) | Engineering rules, error handling, security, libraries, definition of done |
| [docs/Phases.md](docs/Phases.md) | Delivery roadmap and exit criteria |
| [docs/Design.md](docs/Design.md) | Brand, colour, typography, components, photography |

## Quick start

```bash
npm install
cp .env.example .env          # set DATABASE_URL and AUTH_SECRET (openssl rand -hex 32)
npm run db:migrate            # create tables + search indexes
npm run db:seed               # demo catalogue, accounts, coupons, 160 historic orders
npm run dev                   # http://localhost:3000
```

Demo accounts (admin, staff, customer) are listed at the top of `prisma/seed.ts`.
**The seed wipes all data** and refuses to run when `NODE_ENV=production`.

## What's included

### Storefront
- **Home** — hero, service promises, category tiles, best-seller / new / sale rails, collections.
- **Mega-menu navigation** (desktop) and drill-down drawer (mobile).
- **Search** — instant suggestions (`/` shortcut, keyboard navigation, recent + popular searches).
  Postgres full-text + trigram fuzzy matching; understands colours (“olive hoodie”),
  audience (“men jeans”) and typos (“hodie”, “kurtha”).
- **Catalogue** (`/shop`, `/c/[category]`, `/collections/[slug]`) — URL-driven filters
  (size, colour, price, brand, sale, in-stock) with facet lists, sort, pagination, sticky
  mobile filter sheet. Every filtered view is a shareable link.
- **Product page** — colour-aware gallery + zoom, size picker with live per-size stock
  ("2 left"), fit summary from reviews, district delivery estimate, wishlist,
  sticky mobile add-to-bag, reviews with rating distribution, related products, JSON-LD.
- **Product cards** — hover second image, colour swatches, **quick-add by size**.
- **Bag** — slide-over drawer + full page, free-delivery progress bar, stock warnings.
- **Checkout** — guest or signed-in, saved addresses, district-based delivery fee,
  standard/express delivery, coupons (live server-side quote), COD.
- **Orders** — confirmation page, visual tracking timeline, cancel (before packing) and
  returns (within the return window), guest order tracking at `/track`.
- **Account** — overview, orders, wishlist, address book, profile, password change
  (signs out other devices).
- SEO: metadata, canonical URLs, `sitemap.xml`, `robots.txt`, product structured data.

### Admin / operations (`/admin`, staff & admin roles)
- **Dashboard** — 30-day revenue/orders/AOV vs previous period, today's sales,
  fulfilment queue (to confirm / pack / ship / returns), daily revenue chart, top sellers, low stock.
- **Orders** — status tabs with counts, search by order #/email/phone/AWB, payment filter,
  **bulk confirm / pack / deliver**, order detail with enforced status workflow, courier + AWB on ship,
  internal notes, full activity log, **printable packing slip** (COD amount to collect, pick checklist).
- **Products** — list/search/filter, editor with **colour × size variant generator**, per-variant SKU
  and stock, colour-linked images, MRP/discount preview, collections, draft/active/archived.
- **Inventory** — all SKUs sorted by urgency, low/out filters, receive/remove stock with reasons.
- **Customers** — lifetime spend, order count, last order, role management (admin only).
- **Coupons** — percent / fixed / free shipping, minimum order, cap, usage limit, end date, pause.
- **Reviews** — moderation; ratings recalculate automatically.

## Reliability & correctness

| Concern | How it's handled |
|---|---|
| Overselling | Stock is reserved inside the order transaction with `UPDATE … WHERE stock >= qty`; two shoppers can never buy the last unit. |
| Price tampering | Totals, discounts and shipping are always recomputed on the server; the client only sends IDs. |
| Coupon limits | Usage counter incremented atomically with the limit in the `WHERE` clause. |
| Order workflow | Explicit state machine (`src/lib/order-status.ts`) + optimistic concurrency, so two staff can't move the same order in conflicting ways. Cancels/returns restock automatically. |
| Audit trail | `InventoryLog` for every stock movement (sale, restock, manual), `OrderEvent` for every order change with the actor. |
| History | Order items snapshot name/price/SKU/image — catalogue edits never rewrite past orders. |
| Money | Integer paise everywhere; no floating-point currency maths. |
| Auth | bcrypt (cost 12), signed httpOnly JWT cookie, per-user `tokenVersion` for instant revocation, role checks in every admin action (not just the UI), rate-limited login/sign-up/tracking/orders. |
| Guest data | Guest order pages use unguessable IDs; account orders are visible only to their owner and staff. |

## Performance & scale

- Catalogue reads (listings, facets, product pages, rails, suggestions) are cached with
  `unstable_cache` and invalidated by tag on admin edits; live stock is read fresh on the product page.
- Indexed for the hot paths: status+category, status+price, status+createdAt, soldCount, GIN full-text and trigram.
- Images are resized by the image CDN via a custom loader (`src/lib/image-loader.ts`), keeping app servers free.
- Stateless app servers (JWT sessions, DB-backed carts) — scale horizontally behind a load balancer.

### Before going live at high traffic
1. **Database**: managed Postgres (e.g. Neon, Supabase, RDS) with PgBouncer/connection pooling and a read replica.
2. **Rate limiting**: swap `src/lib/rate-limit.ts` for a Redis-backed limiter (same interface) when running more than one instance.
3. **Images**: upload product photos to a CDN (Cloudinary / ImageKit / S3 + CloudFront) and extend the image loader for it.
4. **Payments**: integrate eSewa and Khalti (and Fonepay / a bank card gateway) behind `src/lib/payments.ts`
   — create the payment, verify it server-side with the provider, then mark the order paid. COD works today.
5. **Notifications**: order SMS (e.g. Sparrow SMS / Aakash SMS), WhatsApp and email — hook into `transitionOrder`.
6. **Courier integration**: replace manual tracking-number entry with your courier's API (Pathao, NCM, Upaya…) and tune the remote-district list and fees to its rate card.
7. **Search at very large catalogues**: Postgres search is good to ~100k SKUs; beyond that, sync products to Meilisearch/Typesense/Algolia.
8. Monitoring (Sentry / OpenTelemetry), daily DB backups, and `npm run db:deploy` in CI for migrations.

## Project layout

```
prisma/              schema, migrations (incl. search indexes), seed
src/app/(shop)/      storefront routes
src/app/admin/       operations panel
src/app/api/         search suggestions
src/actions/         server actions (cart, checkout, account, auth, admin/*)
src/lib/             config, db, auth, catalog queries, pricing, order state machine
src/components/      ui primitives, site chrome, product, catalog, cart, account, admin
src/proxy.ts         optimistic auth gate for /account and /admin
```

## Scripts

`dev` · `build` · `start` · `lint` · `typecheck` · `test` (unit + integration, needs `createdb asson_test`) · `test:unit` · `test:int` · `test:e2e` (Playwright, needs `createdb asson_e2e`) · `db:migrate` · `db:deploy` · `db:seed` · `db:studio`
