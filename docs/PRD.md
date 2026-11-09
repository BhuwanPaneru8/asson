# Asson — Product Requirements Document

| | |
|---|---|
| **Product** | Asson Commerce OS: online store, store POS, and operations platform |
| **Company** | Asson, a clothing brand operating across Nepal |
| **Owner** | Founder / CEO |
| **Status** | Living document. v1.0, 9 Nov 2026 |
| **Related** | [Architecture](Architecture.md) · [Rules](Rules.md) · [Phases](Phases.md) · [Design](Design.md) · [Memory](Memory.md) |

---

## 1. Summary

Asson sells classic, well-made clothing at fair prices to customers all over Nepal. It sells through a website, a physical store, and social channels (Instagram, TikTok, Facebook).

**Asson Commerce OS** is the single system the whole company runs on. Customers use it to find and buy clothes in a few taps. Staff use it to sell, pack, ship, receive stock and close the day. The owner uses it to see the truth about sales, stock, cash and profit in 30 seconds, without relying on any one person.

> **One sale → one controlled transaction → automatic stock movement → traceable payment → accurate profit → clear accountability.**

## 2. The problem

1. **Good clothes are hard to find in Nepal, even for people willing to pay.** Quality, classic pieces are not easily accessible, especially outside Kathmandu Valley.
2. **Most shops sell clothes as a commodity, not as a service.** Shopkeepers rarely understand customer preference in fit, colour or, above all, fabric. Many still sell the traditional way.
3. **Cheap fabric is everywhere.** Customers can't tell quality from the photo, so they get burned and stop trusting online shopping.
4. **Small clothing businesses run on WhatsApp, notebooks and memory.** Stock counts drift, discounts go untracked, cash doesn't balance, and nobody knows the real profit.

## 3. Vision, mission and brand promise

**Vision:** Become the brand Nepal trusts for clothes that look right, feel right and last, available in all 77 districts.

**Mission:** Research the best classic designs worldwide, make or source them in high-quality fabric, and sell them at an affordable price, so nobody has to worry about their clothing sense again.

**Brand promise ("Why Asson?")**

| Promise | What it means in the product |
|---|---|
| **Limited designs, made to last** | A small, curated catalogue. No endless scrolling. Every item earns its place. |
| **No cheap fabric, ever** | Fabric and composition shown on every product, plus care instructions and honest fit notes. |
| **Comfortable to wear** | Fit guidance, size guide, and fit feedback from reviews ("most customers say true to size"). |
| **Classic and aesthetic** | Clean, minimal, harmonious design throughout the store and the brand. |
| **Well finished, perfectionist** | Zero broken flows, consistent quality, fast pages, accurate stock. |
| **We take care of your clothing sense** | Curated collections, "complete the look", styling content. |

## 4. Goals and success metrics

### 4.1 Business goals (first 12 months after launch)

| Goal | Metric | Target |
|---|---|---|
| Nationwide reach | Districts with at least one delivered order | ≥ 50 of 77 |
| Repeat customers | Customers with 2+ orders within 6 months | ≥ 30% |
| Healthy margins | Gross margin (actual cost basis) | ≥ 45% |
| Low returns | Return rate by units | ≤ 8% |
| Reliable delivery | Orders delivered within the promised window | ≥ 95% |
| Clean COD | Cash-on-delivery orders refused at the door | ≤ 5% |

### 4.2 Product goals

| Area | Metric | Target |
|---|---|---|
| Speed | Largest Contentful Paint on 4G mid-range Android | < 2.5 s (p75) |
| Conversion | Visit → order | ≥ 2.0% |
| Checkout | Checkout start → order placed | ≥ 60% |
| Search | Searches returning ≥ 1 result | ≥ 95% |
| Accuracy | System stock vs physical count | ≥ 99.5% |
| Accountability | Day closings with a cash difference | ≤ 2% of days, each explained |
| Reliability | Uptime | 99.9% monthly |
| Overselling | Orders that fail for "out of stock" after payment | 0 |

## 5. Users

### 5.1 Customers

| Persona | Who | Needs | Frustrations today |
|---|---|---|---|
| **Aarav, the Valley professional** | 22–35, Kathmandu or Lalitpur, office job, shops on his phone in the evening | Look sharp without effort; trusted quality; fast delivery | Fast fashion falls apart; malls are expensive; hard to judge online quality |
| **Sabina, the outside-Valley shopper** | 18–35, lives in Mahendranagar, Butwal, Dharan or Pokhara | Access to good clothes that local shops don't stock; cash on delivery | Limited choice locally; unreliable online sellers; unclear delivery fees |
| **The gift buyer** | Buying for a partner, sibling or parent around Dashain or Tihar | Sizes they can trust; easy exchange | Fear of wrong size; difficult returns |
| **The social shopper** | Discovers Asson on TikTok or Instagram | Go from a reel to checkout in seconds | Sellers asking "DM for price"; no stock or size visibility |

### 5.2 Internal users

| Role | Responsibilities | System role |
|---|---|---|
| **Owner** | Prices, costs, approvals, profit, permissions, day locks | `ADMIN` (owner rights) |
| **Manager** | Approve discounts, returns and stock adjustments; review daily sales; close the day | `MANAGER` |
| **Cashier** | Sell in store, accept payment, print receipts | `CASHIER` |
| **Fulfilment staff** | Confirm, pick, pack, ship and track online orders | `STAFF` |
| **Content and marketing** | Product content, collections, campaigns, reviews | `STAFF` with catalogue scope (planned) |

**Principle: simple for staff, strict underneath.** Staff never calculate profit, edit stock directly or edit payments; the system does that.

## 6. Scope

### 6.1 Channels

1. **Website (mobile-first):** primary online channel.
2. **Physical store:** ground floor is the shop; upper floor holds samples, office, e-commerce management and the photo studio. The store sells through the POS.
3. **Social commerce:** Instagram, TikTok and Facebook drive traffic to product pages. Orders taken in DMs are entered in the system, never kept only in chat.

**All channels share one inventory and one order ledger.**

### 6.2 Launch assortment (menswear first)

| ID | Product | Notes from planning |
|---|---|---|
| P01 | Shirt | Off-white and White · L, XL, XXL · Rs. 899 · first stock arriving |
| P02 | T-shirt | High priority |
| P03 | Linen trousers | High priority |
| P04 | Jeans | Rs. 999 · high priority |
| P05 | Wind cheater | Seasonal |
| P06 | Jacket | Seasonal |
| P07 | Classic sweater | Winter |
| P08 | Winter trousers | Winter |

Sourcing: Kathmandu wholesalers (New Road, Mahaboudha/Bhotahity, New Baneshwor) first; India (Tank Road and Gandhi Nagar in Delhi, Surat) and China (Guangzhou Baima, Shaoxing fabric market) next; own garment production later. The system must support all three supply routes (Phase 8).

### 6.3 Non-goals for now

- A marketplace for third-party sellers.
- Print-on-demand or dropshipping.
- International shipping and multi-currency.
- A native mobile app. The responsive web app comes first; an app follows in Phase 10.
- Building our own accounting software. We integrate with an accounting system instead.

## 7. Functional requirements

Priority: **P0** must have for launch · **P1** soon after launch · **P2** later.
Status: ✅ built · 🟡 partial or in progress · ⬜ planned.

### 7.1 Storefront and discovery

| ID | Requirement | Priority | Status |
|---|---|---|---|
| SF-1 | Home page with hero, categories, best sellers, new arrivals, collections, sale | P0 | ✅ |
| SF-2 | Mega menu (desktop) and drill-down menu (mobile) | P0 | ✅ |
| SF-3 | Instant search: typo-tolerant, understands colours ("olive hoodie") and audience ("men jeans"), keyboard shortcuts, recent and popular searches | P0 | ✅ |
| SF-4 | Category and collection pages with size, colour, price, brand, sale and in-stock filters; sorting; shareable URLs | P0 | ✅ |
| SF-5 | Product page: gallery and zoom, colour swatches, per-size live stock, fit summary, fabric and care, district delivery estimate, reviews, related items | P0 | ✅ |
| SF-6 | Quick-add a size from product cards | P1 | ✅ |
| SF-7 | Wishlist | P1 | ✅ |
| SF-8 | "Complete the look" outfit pairing chosen by the team | P1 | ⬜ |
| SF-9 | Nepali-language interface (नेपाली) | P2 | ⬜ |
| SF-10 | Recently viewed items; back-in-stock alerts | P2 | ⬜ |

### 7.2 Cart, checkout and payments

| ID | Requirement | Priority | Status |
|---|---|---|---|
| CO-1 | Persistent bag for guests and accounts; merged on sign-in | P0 | ✅ |
| CO-2 | Guest checkout and saved addresses | P0 | ✅ |
| CO-3 | Nepal address form: district (77), city or municipality, tole, landmark, optional postal code; province derived automatically | P0 | ✅ |
| CO-4 | **Delivery priced per district.** Each of the 77 districts has its own fee, delivery time, express, COD and serviceable settings, edited by the owner in Admin → Delivery rates. Customers see the exact cost and arrival date for their district on the product page, in the bag and at checkout. Free standard delivery at or above Rs. 2,500 | P0 | ✅ |
| CO-5 | Coupons validated on the server (percent, fixed, free delivery, minimums, caps, limits, expiry) | P0 | ✅ |
| CO-6 | Cash on delivery (cash, or eSewa/Khalti QR paid to the rider) up to a configurable limit; can be switched off per district | P0 | ✅ |
| CO-7 | eSewa payment (signed form, verified response, status reconciliation) | P1 | ⏸ On hold by owner decision; backend built, hidden from checkout (`onlinePaymentsLive: false`) |
| CO-8 | Khalti payment (initiate, verify by lookup only) | P1 | ⏸ On hold, same as CO-7 |
| CO-9 | Unpaid online orders release stock automatically after the payment window | P1 | ⏸ On hold, same as CO-7 |
| CO-10 | "Pay cash on delivery instead" and "Try again" for failed online payments | P1 | ⏸ On hold, same as CO-7 |
| CO-11 | Fonepay QR and card gateway | P2 | ⬜ |

**Business rules**

- Prices include 13% VAT. Money is integer paisa.
- Stock is reserved atomically at order placement. The last unit can never be sold twice.
- An order is "paid" only when the provider confirms it server-to-server, for the exact order total.

### 7.3 Orders, fulfilment and delivery

| ID | Requirement | Priority | Status |
|---|---|---|---|
| OF-1 | Order state machine: Placed → Confirmed → Packed → Shipped → Out for delivery → Delivered; plus Cancelled, Return requested and Returned | P0 | ✅ |
| OF-2 | Bulk confirm, pack and deliver; tracking number required to ship | P0 | ✅ |
| OF-3 | Printable packing slip with COD amount to collect | P0 | ✅ |
| OF-4 | Full order timeline: who did what, and when | P0 | ✅ |
| OF-5 | Customer tracking page; cancel before packing; return within 7 days | P0 | ✅ |
| OF-6 | Courier operations: printable 100 × 150 mm shipping label (district, COD amount, order barcode) and COD remittance reconciliation per courier ✅; Nepal Can Move API (create shipment, tracking sync) ⬜ needs NCM API access | P1 | 🟡 |
| OF-7 | SMS at each customer-facing status change via an outbox (queued in the same transaction, retried with backoff, sent exactly once, visible in Admin → Notifications) | P1 | 🟡 Built; needs an SMS gateway account (Sparrow / Aakash) to go live |
| OF-8 | COD confirmation call queue ("To call" tab; confirmed → order confirmed, fake → cancelled and restocked, unanswered attempts counted) | P1 | ✅ |
| OF-9 | Exchange (size swap) as its own flow, not a return plus a new order | P1 | ⬜ |

### 7.4 Store POS (physical shop)

| ID | Requirement | Priority | Status |
|---|---|---|---|
| POS-1 | Scan → scan → scan → pay. Barcode per variant (SKU), unlimited items per sale; search by name as fallback | P1 | ✅ |
| POS-2 | Payments: cash (with change), eSewa / Khalti / Fonepay QR, card, bank; split payment; transaction reference | P1 | ✅ |
| POS-3 | Thermal receipt printing (80 mm layout); reprint from the order | P1 | ✅ |
| POS-4 | Discount limits: up to 5% cashier; 5–15% manager approval; over 15% owner approval (approver types their PIN on the till). Each discount records employee, amount, reason and approver | P1 | ✅ |
| POS-5 | Returns ask about the original order, item, reason and condition. Resellable items go back to stock; damaged items go to quarantine. Outcome is refund (cash, eSewa, Khalti, bank) or store credit; exchanges are store credit plus a new sale paid with the credit. Always manager-approved (PIN for cashiers); refunds are capped at what was paid per unit | P1 | ✅ |
| POS-6 | Shift open and close with opening cash float; expected vs counted cash; a note is required for any difference | P1 | ✅ |

### 7.5 Inventory, procurement and costing

| ID | Requirement | Priority | Status |
|---|---|---|---|
| IN-1 | Products with variants (colour × size), each with its own SKU and stock | P0 | ✅ |
| IN-2 | Stock changes only through ledger entries with a reason and the person who made them. Never overwrite stock | P0 | ✅ (sale, cancel, return, receive, adjust) |
| IN-3 | Standard adjustment reasons: Damaged, Lost, Theft, Counting error, Supplier return, Customer return, Wrong receiving, Opening balance, Other (note required) | P1 | 🟡 Received / count correction / damaged / return restock today |
| IN-4 | Adjustments above a threshold need manager approval | P1 | ⬜ |
| IN-5 | Suppliers directory with scorecard (units received, spend, damage rate) | P1 | ✅ |
| IN-6 | Purchase orders → goods received (count and verify, record shortfalls and damage) → supplier bill → supplier payment | P1 | ✅ PO and goods receipt, reorder suggestions; supplier bills and payments ⬜ |
| IN-7 | Purchase cost per variant; landed cost (freight spread by value); weighted-average cost; cost snapshot on every sale line; gross profit on actual cost | P1 | ✅ |
| IN-8 | Barcode label printing (Code 128, 50 × 30 mm) per product or per received PO | P1 | ✅ |
| IN-9 | Cycle counts and variance reports | P2 | ⬜ |

### 7.6 Accountability, finance and reporting

| ID | Requirement | Priority | Status |
|---|---|---|---|
| AC-1 | Roles: Owner, Manager, Cashier, Staff, with segregation of duties (single permission map in `lib/permissions.ts`) | P0 | ✅ |
| AC-2 | Transactions are never deleted, only voided, refunded or corrected, with full audit | P0 | ✅ For orders and stock |
| AC-3 | Daily closing: sales, refunds, discounts, payment reconciliation (cash, eSewa, Khalti, bank, card, COD), cash count and difference, inventory exceptions, staff on shift; then **lock the day** | P1 | ✅ (COD remittance reconciliation comes with NCM) |
| AC-4 | Owner dashboard: today's sales, transactions, units, gross profit, payments by method, cash expected vs counted, low and out of stock, stock value, alerts for refunds, adjustments and discounts over 15% | P0 | ✅ Dashboard + Daily closing + Finance |
| AC-5 | Expenses (rent, staff, bills, marketing; never deleted, corrected by negative entries) and monthly profit and loss with product profitability | P2 | ✅ |
| AC-6 | Export to accounting software | P2 | ⬜ |

### 7.7 Customers and growth

| ID | Requirement | Priority | Status |
|---|---|---|---|
| CR-1 | Accounts, order history, addresses, wishlist, password change | P0 | ✅ |
| CR-2 | Customer list with lifetime spend, order count and last order | P0 | ✅ |
| CR-3 | Reviews with verified-buyer badge and fit feedback; moderation | P0 | ✅ |
| CR-4 | Sign-in by phone with OTP; in Nepal the phone number is the customer's identity | P1 | ⬜ |
| CR-5 | Loyalty: points or tiers, birthday offer | P2 | ⬜ |
| CR-6 | Meta pixel and conversions API, TikTok pixel, product catalogue feed for Instagram Shopping | P1 | ⬜ |
| CR-7 | Newsletter and SMS marketing with consent | P2 | ⬜ |

## 8. Non-functional requirements

| Area | Requirement |
|---|---|
| **Performance** | LCP < 2.5 s, INP < 200 ms, CLS < 0.1 at p75 on mobile 4G. Catalogue reads served from cache. Images resized by a CDN. |
| **Scale** | Hundreds of thousands of customers; 10,000+ variants; peak of 50 orders/minute during campaigns. Stateless app servers scale horizontally. |
| **Reliability** | 99.9% uptime. No lost orders. Payments idempotent. Stock and money operations atomic. Daily backups with point-in-time recovery. |
| **Security** | bcrypt passwords; httpOnly signed sessions; instant session revocation; role checks inside every server action; rate limits; secrets only in environment variables; OWASP Top 10 reviewed before launch. |
| **Privacy** | Collect only what's needed to deliver. No personal data in URLs. Staff see customer data on a need-to-know basis. Comply with Nepal's Privacy Act 2075. |
| **Accessibility** | WCAG 2.1 AA: keyboard navigable, labelled inputs, contrast ≥ 4.5:1 for text. |
| **Localisation** | Rs. with lakh grouping, Asia/Kathmandu time, Nepali phone and address formats; Nepali language in Phase 9. |
| **Auditability** | Every change to money, stock or order status records actor, time, reason and before/after. |
| **Maintainability** | TypeScript strict; lint, typecheck and build stay clean; documented decisions (see [Architecture](Architecture.md)). |

## 9. Operating rules the system enforces

1. **If it affects money or inventory, it is recorded in Asson OS.** Not WhatsApp, Excel, a notebook or memory.
2. **One source of truth per thing.** Orders, stock and payments live only here. Notion is for SOPs and planning and is never a second ledger.
3. **Never delete a transaction.** Void, refund or correct it, and keep the original visible.
4. **Every stock change has who, what, when and why.**
5. **Discounts need accountability:** employee, amount, reason and approver.
6. **Count received stock.** Inventory increases by what was counted, not by what the invoice says.
7. **Close and lock every day.**

## 10. Assumptions and open questions

| # | Question | Why it matters | Default until answered |
|---|---|---|---|
| 1 | Expected SKUs or variants in year 1? | Search and indexing choices, admin UX | ≤ 2,000 variants |
| 2 | Average orders per day (online and store)? | Infrastructure sizing, staffing | 20–100/day, campaign peaks ×10 |
| 3 | Number of cashiers and fulfilment staff? | Roles, shift design | 2–4 |
| 4 | eSewa and Khalti merchant accounts ready? | Go-live for prepaid | **Decided:** launch COD-only; online payments later |
| 5 | NCM account and API access? | Shipping automation | Manual tracking numbers |
| 6 | Final delivery fees per district? | Checkout pricing | **Decided:** per-district rates (seeded Rs. 100 / 150 / 250), editable in admin; express Rs. 200; free at or above Rs. 2,500 |
| 7 | Return window: 7 days or 15? | Policy and cash flow | 7 days |
| 8 | VAT registration status? | Invoices, tax lines | Prices shown VAT-inclusive |
| 9 | Domain: `asson.com.np` or `.com`? | Email, SEO, payment callbacks | — |

## 11. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| COD refusals and fake orders | Lost delivery cost, stuck stock | OTP phone check, confirmation call queue for high-value COD, block repeat refusers |
| Inaccurate stock between shop and online | Overselling, angry customers | One inventory ledger; POS writes to the same stock; daily exceptions report |
| Payment callbacks lost (customer closes the tab) | Paid but "unpaid" order | Server-side reconciliation job; never trust the browser |
| Supplier quality drift | Breaks the brand promise | Quality check at goods receipt; supplier scorecard |
| Founder dependency | Can't scale | Roles, SOPs, approvals and dashboards so the business runs without one person |
| Low-quality product photos | Low conversion | Studio on the upper floor; photo standards in [Design](Design.md) |

## 12. Release definition (v1 public launch)

v1 is ready when all of the following are true:

- All **P0** requirements are ✅.
- The real Asson catalogue is live: at least the 8 core products, with real photos, fabric details and costs.
- Cash-on-delivery flow rehearsed end to end, including refused deliveries. Online payments follow later.
- Ten end-to-end test orders have been placed across Valley, outside-Valley and remote districts.
- Backups, monitoring and the reconciliation job are running.
- Staff have been trained on the SOPs.
