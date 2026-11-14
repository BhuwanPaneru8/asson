import type { HandbookPage, RolePath } from "../types";

// One page per job: purpose, responsibilities, what good looks like, a day, the first 30 days, and the skills a
// manager signs off by watching. ROLE_PATHS is each job's reading order on the Handbook home page.

const FIRST = ["welcome", "how-we-run", "using-the-handbook", "roles-and-access"];
const BASICS = ["sys-my-time", "sop-time-leave", "sys-today", "operating-rhythm"];
const END = ["sop-security", "conduct", "sys-issues", "sop-issues", "shop-app", "glossary"];

export const ROLE_PATHS: RolePath[] = [
  {
    job: "cashier",
    purpose: "Every customer in the shop leaves well served, with a correct sale and correct cash.",
    read: [...FIRST, "job-cashier", ...BASICS, "sys-pos", "sop-open-shop", "sop-till", "sop-close-day", "sop-store-returns", "sop-pickups",
      "shop-policies", "sys-customers-loyalty", "sop-care-cases", "shop-overview", "shop-account", "sys-counts", "sop-stock-count", "sop-transfers", "sop-vm-visits", ...END],
  },
  {
    job: "warehouse",
    purpose: "Every online order leaves right and on time, and every unit in the warehouse is where the system says.",
    read: [...FIRST, "job-warehouse", ...BASICS, "sys-overview", "sys-orders", "sys-fulfilment", "sys-bins-picking", "sop-pick-pack", "sop-courier-handover",
      "sop-failed-deliveries", "sys-inventory", "sys-transfers", "sop-transfers", "sop-receiving", "sys-counts", "sop-stock-count", "sys-damaged", "sop-damaged",
      "sop-online-changes", "shop-policies", ...END],
  },
  {
    job: "care",
    purpose: "Every customer who contacts us gets a fast, honest answer and a problem solved.",
    read: [...FIRST, "job-care", ...BASICS, "sys-overview", "shop-overview", "shop-account", "shop-policies", "sys-orders", "sop-confirm-orders", "sys-care",
      "sop-care-cases", "sop-online-changes", "sys-fulfilment", "sop-failed-deliveries", "sys-customers-loyalty", "sys-notifications", "sys-lookbook-reviews", ...END],
  },
  {
    job: "shop-manager",
    purpose: "A shop that hits its target, runs to standard every day, and a team that's trained and fairly treated.",
    read: [...FIRST, "job-shop-manager", ...BASICS, "sys-overview", "sys-pos", "sop-open-shop", "sop-till", "sop-close-day", "sys-closing", "sys-cash", "sop-cash-bank",
      "sop-store-returns", "sop-pickups", "sys-people", "sys-rosters", "sys-ops", "sys-training", "sys-vm-visits", "sop-vm-visits", "sys-inventory", "sys-transfers",
      "sop-transfers", "sys-counts", "sop-stock-count", "sys-damaged", "sop-damaged", "sys-care", "sop-care-cases", "shop-policies", "sys-customers-loyalty",
      "hiring-process", "hiring-interviews", "hiring-new-joiner-setup", "onboarding-new-joiner", "hiring-reviews", "hiring-leaving", "owner-incidents", ...END],
  },
  {
    job: "ops-manager",
    purpose: "Every location in the network runs to the same standard, problems are owned the same day, and stock flows to where it sells.",
    read: [...FIRST, "job-ops-manager", ...BASICS, "sys-overview", "sys-scorecard-network", "sys-ops", "sys-vm-visits", "sys-orders", "sys-fulfilment",
      "sys-bins-picking", "sys-care", "sys-inventory", "sys-transfers", "sys-counts", "sys-damaged", "sys-purchasing", "sys-pos", "sys-closing", "sys-cash", "sys-cod",
      "sys-people", "sys-rosters", "sys-training", "sys-insights", "sys-locations", "sop-confirm-orders", "sop-pick-pack", "sop-courier-handover", "sop-failed-deliveries",
      "hiring-process", "hiring-interviews", "hiring-new-joiner-setup", "hiring-reviews", "hiring-leaving", "owner-rhythm", "owner-kpis", "owner-new-shop", "owner-festival",
      "owner-incidents", ...END],
  },
  {
    job: "buyer",
    purpose: "The right products, in the right sizes and depth, at the right cost, in the right locations.",
    read: [...FIRST, "job-buyer", ...BASICS, "sys-overview", "sys-products", "sys-inventory", "sys-insights", "sys-purchasing", "sop-receiving", "sys-transfers",
      "sys-coupons-markdowns", "sys-production", "sys-damaged", "sys-payables", "sys-scorecard-network", "owner-kpis", "owner-festival", ...END],
  },
  {
    job: "accountant",
    purpose: "Books that are complete, matched to the bank, closed on time and right for the tax office.",
    read: [...FIRST, "job-accountant", ...BASICS, "sys-overview", "sys-finance", "sys-closing", "sys-cash", "sop-cash-bank", "sys-cod", "sys-bank-close", "sys-payables",
      "sys-purchasing", "sys-vat-year", "sys-payroll", "sys-people", "sys-budgets", "sys-activity", "owner-kpis", ...END],
  },
  {
    job: "marketing",
    purpose: "More of the right customers find us, buy, and come back, with a brand that looks and sounds like Asson everywhere.",
    read: [...FIRST, "job-marketing", ...BASICS, "sys-overview", "shop-overview", "shop-account", "shop-policies", "sys-products", "sys-lookbook-reviews", "sys-marketing",
      "sys-coupons-markdowns", "sys-customers-loyalty", "sys-insights", "owner-festival", ...END],
  },
  {
    job: "owner",
    purpose: "A company that runs without depending on one person, grows profitably, and keeps its promise to customers.",
    read: [...FIRST, "job-owner", "sys-overview", "owner-rhythm", "owner-kpis", "owner-launch", "owner-switch-on", "sys-today", "operating-rhythm", "sys-team-access",
      "owner-access-security", "sys-finance", "sys-budgets", "sys-bank-close", "sys-vat-year", "sys-payroll", "sys-scorecard-network", "sys-insights", "sys-locations",
      "owner-new-shop", "owner-festival", "owner-incidents", "owner-tech", "sys-system-health", "sys-activity", "hiring-process", "hiring-leaving", "worldclass-review",
      "worldclass-roadmap", "conduct", "glossary"],
  },
];

const role = (p: Omit<HandbookPage, "section" | "version" | "minutes"> & { minutes?: number }): HandbookPage => ({ section: "roles", version: 1, minutes: 6, ...p });

export const ROLES: HandbookPage[] = [
  role({
    slug: "job-cashier",
    title: "Job: Cashier",
    summary: "Selling at the till, serving customers, and keeping the sale and the cash exact.",
    audience: ["cashier", "shop-manager"],
    related: ["sys-pos", "sop-till", "sop-close-day"],
    body: `## Purpose
Every customer in the shop leaves well served, with a correct sale and correct cash.

## Responsibilities
- Greet and help customers: sizes, fit, outfits, honest advice.
- Sell every item through the till by scan; link the customer's mobile.
- Take payment exactly; give the right change; check every QR or card payment arrived.
- Returns and exchanges by procedure, with a manager's approval.
- Click-and-collect hand-overs; order for a customer when a size isn't here.
- Opening and closing checklists; the shift's cash count.
- Keep the floor tidy, sizes in order, displays as briefed.
- Count stock when asked; receive transfers at the shop.
- Log customer problems as care cases.

## What good looks like
| Measure | Good |
|---|---|
| Cash difference at shift close | Rs. 0 on almost every shift; any difference explained |
| Sales with the customer's mobile | 70% or more |
| Discounts | Only with a reason; within limits |
| Checklists | Done every day, on time |
| Procedures | All signed in your first week |

## A typical day
Clock in → Today → count float, open shift → opening checklist → sell, pickups, help → closing count → close shift → closing checklist → clock out.

## Your first 30 days
- [ ] Day 1: your login works and you're assigned to your shop; clock in on My time; read the first five pages of your path.
- [ ] Day 1: walk the shop with your manager: stock room, safe rules, fitting rooms, emergency exits.
- [ ] Days 2–5: sell with a colleague beside you. Sign Opening the shop, Selling at the till, Closing, Returns.
- [ ] Week 1: finish the till and policy pages on your path and pass their questions.
- [ ] Week 2: open and close a shift on your own with your manager checking.
- [ ] Weeks 3–4: finish your path; first stock count; first transfer received.

## Skills your manager signs off (by watching you)
- [ ] Opens a shift with the correct float.
- [ ] Completes a sale with a split payment and a customer mobile.
- [ ] Applies a discount with a reason and gets a manager's approval above 5%.
- [ ] Processes a return (resellable and damaged) and a size swap with store credit.
- [ ] Hands over a click-and-collect order.
- [ ] Places an "order for a customer" from another location.
- [ ] Closes a shift with the real count and a note for any difference.

## Where it leads
Senior cashier → assistant shop manager → shop manager.`,
  }),
  role({
    slug: "job-warehouse",
    title: "Job: Warehouse and fulfilment",
    summary: "Picking, packing and shipping online orders, receiving and moving stock, and counting it.",
    audience: ["warehouse", "ops-manager"],
    related: ["sys-fulfilment", "sop-pick-pack", "sop-receiving"],
    body: `## Purpose
Every online order leaves right and on time, and every unit in the warehouse is where the system says.

## Responsibilities
- Pick in waves, express first; pack by scan; label; hand to couriers on manifests.
- Record failed delivery attempts; receive returned parcels.
- Receive supplier deliveries by count with quality checks; put away to bins.
- Send and receive transfers; prepare replenishment for shops.
- Cycle counts; keep bins labelled and tidy; damaged items off sale.

## What good looks like
| Measure | Good |
|---|---|
| Orders confirmed today shipped today (before courier cut-off) | 95% or more |
| Wrong item sent | Fewer than 1 in 500 |
| Parcels without a signed manifest | Zero |
| Count accuracy in your zone | 99.5% or more |
| Receiving done the day goods arrive | 100% |

## A typical day
Clock in → Today → waves (express first) → pack by scan → courier hand-overs → receiving and transfers → returned parcels → cycle count → tidy bins → clock out.

## Your first 30 days
- [ ] Day 1: login, safety walk (lifting, ladders, fire exits), the bin system explained.
- [ ] Days 2–5: pick and pack alongside a colleague. Sign Packing online orders and Handing parcels to couriers.
- [ ] Week 1: finish the fulfilment pages on your path and pass the questions.
- [ ] Week 2: run a wave and a courier hand-over on your own with checks.
- [ ] Weeks 3–4: receive a supplier delivery; send and receive a transfer; do a cycle count.

## Skills your manager signs off
- [ ] Runs a wave from start to "everything picked" without substitutions.
- [ ] Packs only by scan; knows what to do when an item is refused.
- [ ] Completes a manifest where the rider's count matches, and files the signed copy.
- [ ] Receives a PO with a shortage and a damaged piece recorded correctly.
- [ ] Receives a returned parcel and sorts resellable from damaged.
- [ ] Does a blind count of a zone.

## Where it leads
Senior picker/packer → shift lead → warehouse manager → fulfilment centre manager.`,
  }),
  role({
    slug: "job-care",
    title: "Job: Customer care",
    summary: "Answering every customer quickly and honestly, fixing their orders, and confirming COD orders.",
    audience: ["care", "ops-manager"],
    related: ["sys-care", "sop-care-cases", "sop-online-changes"],
    body: `## Purpose
Every customer who contacts us gets a fast, honest answer and a problem solved.

## Responsibilities
- Work the care queue: every channel, every case before its deadline.
- Confirmation calls for COD orders on the queue; confirm or cancel with a reason.
- Change, cancel and exchange orders for customers; arrange returns.
- Chase late parcels with couriers; keep the customer updated.
- Moderate reviews; answer questions about products, sizes and delivery.
- Spot repeat problems (a product, a courier, a district) and report them.

## What good looks like
| Measure | Good |
|---|---|
| Cases answered before the deadline | 95% or more |
| First reply time (working hours) | Under 2 hours |
| Customer satisfaction after resolution | 4.5 / 5 or more |
| COD refusals on confirmed orders | Under 5% |

## Your first 30 days
- [ ] Day 1: login; the website from a customer's view (place a test order on staging if available); the policies.
- [ ] Week 1: shadow a colleague on the queue and confirmation calls. Sign Looking after customers.
- [ ] Week 2: handle cases with a colleague checking replies before sending.
- [ ] Weeks 3–4: handle the queue alone; one review session on tone with your manager.

## Skills your manager signs off
- [ ] Logs a phone case linked to the order, with a clear note.
- [ ] Changes an order before packing (size and address).
- [ ] Arranges a size exchange after delivery.
- [ ] Does a COD confirmation call: name, items, address with landmark, amount.
- [ ] Writes a reply that owns the problem and gives a specific time.

## Where it leads
Senior care agent → care lead → customer experience manager.`,
  }),
  role({
    slug: "job-shop-manager",
    title: "Job: Shop manager",
    summary: "Running one or more shops: sales, standards, cash, stock and the team.",
    audience: ["shop-manager", "ops-manager"],
    minutes: 8,
    related: ["sys-closing", "sys-people", "sys-rosters", "operating-rhythm"],
    body: `## Purpose
A shop that hits its target, runs to standard every day, and a team that's trained and fairly treated.

## Responsibilities
- **Sales**: the shop's monthly target; coaching the team to serve and sell (outfits, order for a customer, mobile numbers).
- **Standards**: checklists, VM briefs, store visit fixes, cleanliness, opening on time.
- **Money**: discount and return approvals with your PIN, daily closing and lock, the safe, bank deposits, petty cash.
- **Stock**: receiving transfers, counts, damaged stock, keeping sizes on the floor, asking for replenishment.
- **People**: rosters published by Thursday, leave approvals, attendance corrections, missed shifts, swaps, training sign-offs, coaching, first warnings, onboarding new joiners.
- **Problems**: Needs attention for your shop down to zero every day; issues reported and followed.

## What good looks like
| Measure | Good |
|---|---|
| Sales vs target | 100% or more |
| Days locked on time | 100% |
| Cash differences | Under 2% of shifts, each explained |
| Stock accuracy at monthly count | 99.5% or more |
| Checklists done | 95% or more |
| Shop operations score | Top half of the network |
| Team fully onboarded within 30 days of joining | 100% |

## Your week
Monday: last week's numbers and this week's plan with the team. Every day: opening, Needs attention, floor, closing and lock. Weekly: roster by Thursday, cycle count, safe count and bank, issues and visit fixes. Monthly: full count, budget check, people review.

## Your first 30 days
- [ ] Week 1: everything a cashier learns, plus Daily closing and Cash with the ops manager.
- [ ] Week 1: set your approval PIN. Sign every cashier and manager procedure.
- [ ] Week 2: run opening and closing yourself; publish a roster; approve leave.
- [ ] Week 3: a full shop count; review the scorecard with the ops manager.
- [ ] Week 4: run a team meeting on last month's numbers; set targets with the team.

## Skills signed off by your ops manager
- [ ] Locks a day after checking every shift and difference.
- [ ] Counts the safe and records a deposit with the slip photo.
- [ ] Approves a discount and a return with the PIN, and knows when to say no.
- [ ] Builds and publishes a roster that passes every check.
- [ ] Decides missed shifts correctly before payroll.
- [ ] Runs a blind count and approves variances properly.
- [ ] Onboards a new cashier using their path and Team onboarding.

## Where it leads
Shop manager of a bigger or flagship shop → area manager (several shops) → operations manager.`,
  }),
  role({
    slug: "job-ops-manager",
    title: "Job: Operations manager",
    summary: "Running the network: every shop and the warehouse to the same standard, with stock and people in the right places.",
    audience: ["ops-manager", "owner"],
    minutes: 7,
    related: ["sys-scorecard-network", "owner-rhythm", "owner-new-shop"],
    body: `## Purpose
Every location in the network runs to the same standard, problems are owned the same day, and stock flows to where it sells.

## Responsibilities
- Needs attention across the network: owned and cleared daily.
- Shop scorecard and Network: find the weakest shops and fix the cause.
- Store visits, VM briefs, checklists and announcements.
- Fulfilment performance: same-day shipping, wrong items, returns by courier and district.
- Replenishment and rebalancing: drafts checked and sent.
- Shop managers: coaching, targets, reviews; hiring and onboarding managers.
- New shop openings (with the owner).
- Approvals above shop level; incidents.

## What good looks like
| Measure | Good |
|---|---|
| Needs attention items older than 24 h | Zero |
| Network average operations score | Rising month on month |
| Orders shipped within promise | 95% or more |
| Network stock accuracy | 99.5% or more |
| Stock-outs of top 50 SKUs in shops | Fewer each month |
| Shop managers onboarded and reviewed on time | 100% |

## Your first 30 days
- [ ] Week 1: every page on your path; shadow a shop manager's close and a warehouse day.
- [ ] Week 2: visit three shops with a visit checklist; send a VM brief.
- [ ] Week 3: lead the weekly network review with the owner.
- [ ] Week 4: present a 90-day plan for the network's weakest areas.

## Where it leads
Head of retail operations → chief operating officer.`,
  }),
  role({
    slug: "job-buyer",
    title: "Job: Buyer / merchandiser",
    summary: "Deciding what we sell, in what sizes and depth, at what cost and price, and when to mark down.",
    audience: ["buyer", "owner"],
    related: ["sys-insights", "sys-purchasing", "sys-coupons-markdowns", "owner-festival"],
    body: `## Purpose
The right products, in the right sizes and depth, at the right cost, in the right locations.

## Responsibilities
- Range planning: what we sell each season, true to "limited designs, made to last".
- Buying: purchase orders from the demand forecast and reorder signals; supplier negotiation; quality standards.
- Own production: bills of materials, production orders with workshops.
- Pricing and margin: cost, price, margin floor; markdowns at the right time.
- Allocation: which shops get what (with replenishment), rebalancing slow stock.
- Supplier performance: scorecards, credit notes for damaged goods.

## What good looks like
| Measure | Good |
|---|---|
| Gross margin | 45% or more |
| Stock-outs on best sellers | Rare and short |
| Dead stock (no sale in 90 days) at cost | Falling |
| Sell-through of each season | 70% or more before markdown |
| Supplier damage and shortage rate | Under 2% |

## Your week
Monday: Insights (reorder, dead stock, demand radar, searches with no result). Midweek: purchase orders, supplier calls, production. Friday: markdown plan, next week's arrivals and allocation.

## Your first 30 days
- [ ] Week 1: your path; every product in the range, its cost, margin and sales.
- [ ] Week 2: receive a delivery with the warehouse; review supplier scorecards.
- [ ] Week 3: draft the next month's purchase orders from the forecast; review with the owner.
- [ ] Week 4: present a season plan: depth by size, markdown plan, new designs.`,
  }),
  role({
    slug: "job-accountant",
    title: "Job: Accountant",
    summary: "Keeping the books complete, matched to the bank, closed every month and right for tax.",
    audience: ["accountant", "owner"],
    restricted: "finance",
    related: ["sys-finance", "sys-bank-close", "sys-vat-year", "sys-payroll"],
    body: `## Purpose
Books that are complete, matched to the bank, closed on time and right for the tax office.

## Responsibilities
- Bank statements imported and fully explained, weekly.
- Shop deposits and COD remittances checked; chase anything short.
- Supplier bills and credit notes recorded with PAN; payment plan for the owner.
- Expenses recorded with receipts and the right location.
- Payroll with the owner: check, approve, pay, TDS and SSF deposits on time.
- VAT return every Nepali month, on time.
- Month-end close and lock; fiscal year close and the auditor's pack.
- Watching the activity log for unusual changes.

## What good looks like
| Measure | Good |
|---|---|
| Bank lines unexplained at month end | Zero |
| Month closed by | The 10th of the next month |
| VAT, TDS, SSF filed and paid | On time, every time |
| P&L from the system vs the books | Within 1% |

## Your first 30 days
- [ ] Week 1: your path; the chart of costs and how each flows into the P&L.
- [ ] Week 2: import a bank statement and clear the queue with the owner.
- [ ] Week 3: a VAT return and a month close, checked by the owner.
- [ ] Week 4: payroll for the month with the owner.`,
  }),
  role({
    slug: "job-marketing",
    title: "Job: Marketing",
    summary: "Product content, the lookbook, campaigns, coupons, reviews and growth from data.",
    audience: ["marketing", "owner"],
    related: ["sys-marketing", "sys-lookbook-reviews", "sys-insights", "owner-festival"],
    body: `## Purpose
More of the right customers find us, buy and come back, with a brand that looks and sounds like Asson everywhere.

## Responsibilities
- Product content: names, descriptions, fabric and fit notes, photos to the standard, Nepali names.
- The lookbook and styling content; social media from our own photos.
- Campaigns: festival plans with the buyer, coupons, markdown communication, ads measured with the pixels.
- Reviews and customer feedback; answering what searches with no result tell us.
- Growth numbers: visits, bag rate, conversion, repeat rate, cost per order from ads.

## What good looks like
| Measure | Good |
|---|---|
| Visit → order conversion | 2% or more |
| Products with complete content and 4+ photos | 100% |
| Searches that find something | 95% or more |
| Repeat customers within 6 months | 30% or more |

## Your first 30 days
- [ ] Week 1: your path; the brand promise; every product page as a customer.
- [ ] Week 2: fix the 10 products with the lowest bag rate (photos, words, sizes).
- [ ] Week 3: build two looks from our own products.
- [ ] Week 4: a campaign plan for the next festival or season, with the buyer.

> **Rule:** only our own photos and words, and only honest claims. Never copy other brands' content.`,
  }),
  role({
    slug: "job-owner",
    title: "Job: Owner",
    summary: "Running the company through the system: direction, controls, people, money and growth.",
    audience: ["owner"],
    minutes: 6,
    related: ["owner-rhythm", "owner-kpis", "owner-access-security", "worldclass-review"],
    body: `## Purpose
A company that runs without depending on one person, grows profitably, and keeps its promise to customers.

## What only the owner does
- Sets direction: range, prices and margins, where to open next, budgets.
- Controls access: who works here, their job, locations and permissions; removes access the day someone leaves.
- Approves what's above everyone else's limit: big discounts, margin-floor exceptions, large payments.
- Payroll and pay terms; supplier payments.
- Hires and develops the managers; reviews them.
- Keeps the system healthy: alerts, backups, deploys (with the developer), the switch-on of new services.

## The owner's controls in the system
| Control | Where |
|---|---|
| Who can do what | Team & access |
| What happened, by whom | Activity log |
| Every exception today | Needs attention |
| Shops compared | Network, Shop scorecard |
| Money | Finance, Payables, Payroll, Cash |
| Is it all running | System |

## Your rhythm
See the Owner's rhythm page: a short daily check, a weekly review, the monthly close, and the yearly plan.

> **Why:** the owner's job in a growing company is to build the machine, not to be the machine. Every decision written into a rule, a procedure or a target is one less that depends on you being in the room.`,
  }),
];
