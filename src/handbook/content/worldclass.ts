import type { HandbookPage } from "../types";

// The honest comparison with the best retail systems, and what to build next. Owner-only: it's strategy.
// Update it whenever an item on the roadmap ships (and raise the version so the owner re-reads it).

export const WORLDCLASS: HandbookPage[] = [
  {
    slug: "worldclass-review",
    section: "worldclass",
    title: "World-class review: where Asson OS stands",
    summary: "Each part of the business compared with what the best retailers run, with strengths and gaps.",
    audience: ["owner"],
    minutes: 12,
    version: 1,
    restricted: "system",
    related: ["worldclass-roadmap", "owner-launch"],
    body: `## How we compared
"World-class" here means what the leading fashion retailers and their systems do: integrated commerce platforms (Shopify Plus, Salesforce Commerce), retail ERPs (SAP and Oracle Retail, Microsoft Dynamics), warehouse systems (Manhattan, Blue Yonder), store operations tools, HR suites (Workday-type), and how chains like Uniqlo, Zara and H&M actually run: one inventory, daily rhythm, data-led buying, strict controls. Each area of Asson OS was checked against that standard, and against what a chain with a shop in every district of Nepal needs.

| Rating | Meaning |
|---|---|
| **World-class** | Matches what market leaders run; nothing important missing |
| **Strong** | Complete for our scale; a few advanced features missing |
| **Partial** | Works, but an important capability is missing |
| **Missing** | Not built |

## The scorecard
| Area | Rating | What's strong | What's missing |
|---|---|---|---|
| Storefront and discovery | Strong | Fast pages (tested at national scale), typo-tolerant search incl. Nepali, live stock, delivery estimate per district, recommendations, lookbook, Nepali language, installable app | Product videos; live chat |
| Checkout and payments | Partial | Guest checkout, COD with limits and risk rating, coupons, points, click-and-collect | **Online payments switched off** (built, on hold); gift cards |
| Omnichannel order management | World-class | One inventory; routing by district/province; click-and-collect; order-for-customer from any location; order changes before packing; self-service exchanges; buy again | Ship-from-store to the customer's door from the till (partly via routing) |
| Store operations and POS | Strong | Shifts, scan-to-sell, split payments, PIN approvals, returns with condition, pickups, daily close and lock, cash books, checklists, VM, visits, scorecard | **Till works only online** (critical for Nepal's internet and power cuts); hardware integration (cash drawer, printers) is basic |
| Inventory and warehouse | Strong | One ledger with reasons, transfers counted in, replenishment and rebalancing, bins, waves with slots, scan-verified packing, manifests, RTO, blind counts, damaged register, nightly audit | Carton and shelf-life features aren't needed; RFID later |
| Buying and merchandise planning | Partial | Demand forecast with festival seasonality, reorder by speed, dead stock, size/colour margin, markdowns with margin floor, supplier scorecards | **Open-to-buy budgets by season and category**; assortment and size-curve allocation for new products by store grade; sample and approval workflow |
| Own production | Partial | Materials at average cost, bills of materials, production orders, rejects, true cost per piece, workshop bills | Tech packs, per-size consumption, piece-rate by worker, quality stages |
| Finance and tax | Strong | Exact cost of goods, P&L and profit by shop, budgets, cash books, bank import and matching, month and year close with locks, VAT returns, TDS/SSF, auditor's pack | **IRD electronic billing compliance** (tax invoice format, fiscal-year invoice series, real-time CBMS sync once turnover requires it); direct accounting-software sync; fixed assets and depreciation; cash-flow forecast |
| People and HR | Strong | Jobs and permissions, attendance, leave by Labour Act, rosters with checks, swaps, missed shifts, payroll with SSF/TDS, commission, Training sign-offs, this Handbook with quizzes and onboarding tracking | **Recruitment pipeline** (vacancies, candidates, interviews); **performance reviews and goals** in the system; employee documents; mid-year leaver tax settlement |
| CRM and marketing | Partial | Loyalty with tiers, referrals, birthdays, back-in-stock and price-drop alerts, RFM segments, cohorts, ad measurement with consent, product feeds | **Campaigns** (SMS, WhatsApp, email to segments, with opt-out); email as a channel; WhatsApp Business; NPS |
| Channels | Partial | Own website and app, own shops | **Marketplaces** (Daraz); **wholesale, dealers and franchise** (credit limits, dealer prices, consignment) |
| Analytics and AI | Strong | Insights, funnel, demand radar, KPI pulse with anomalies, network league tables | AI assistant for questions in plain words; in-store footfall (conversion); BI export |
| Security and privacy | Strong | Roles, jobs and location scope, PIN approvals, full activity log, database locks, rate limits, no deletes of money records | **Two-factor sign-in for staff**; customer data export and deletion on request; a yearly security test |
| Reliability and scale | Partial | Tested at national scale, zero-downtime deploys, hourly and off-site backups, watchdog texts | Production on a small server; one server (no failover); no managed database with point-in-time restore; outside uptime monitor not set up |
| Integrations | Partial | Interfaces ready for SMS, courier, eSewa and Khalti | Waiting for accounts: SMS gateway, Nepal Can Move, payments |
| Knowledge and training | World-class | Handbook for every job with paths and quizzes, signed procedures with versions, onboarding tracking | Video walkthroughs |

## What this means
Asson OS is already beyond what most retailers in Nepal run, and in several areas (omnichannel orders, store controls, finance closes, onboarding) it matches what international chains use. The gaps that matter most for **operating at national scale without problems** are:
1. **The till must keep selling when the internet or power goes.** In many districts this is daily life.
2. **Tax invoices must meet IRD rules** before volume grows.
3. **Staff accounts must have two-factor sign-in**, as more people in more places can touch money.
4. **Production infrastructure** must match the launch (owner accounts and a bigger server).
5. **Growth tools**: campaigns, online payments, recruitment at scale, and new channels (dealers, marketplaces) for districts without a shop yet.

The next page turns these into an ordered roadmap.`,
  },
  {
    slug: "worldclass-roadmap",
    section: "worldclass",
    title: "Roadmap: what to build next, in order",
    summary: "The prioritised list of improvements, why each matters, who does what, and its size.",
    audience: ["owner"],
    minutes: 8,
    version: 1,
    restricted: "system",
    related: ["worldclass-review", "owner-launch", "owner-switch-on"],
    body: `Ordered by risk to daily operations first, then growth. Size: **S** days, **M** 1–2 weeks, **L** several weeks.

## Tier 1: before and at launch (protects operations)
| # | Improvement | Why it matters | Who | Size |
|---|---|---|---|---|
| 1 | **Offline till**: sell, take cash and print receipts with no internet; sales sync with the same safety (no double sale, stock checked on sync) when back | Internet and power cuts are daily in many districts; a shop that can't sell loses money and customers | Developer | L |
| 2 | **IRD-compliant tax invoices**: tax invoice format with PAN, fiscal-year invoice numbers per location, VAT shown, buyer PAN for large sales, "copy" marking on reprints, cancellation by credit note, ready for CBMS sync | Legal requirement for a VAT-registered business; easier to do before volume | Developer + accountant | M |
| 3 | **Two-factor sign-in for staff**: an authenticator app or SMS code for the owner and managers (optional for others), trusted devices | Stolen or shared passwords are the commonest way money is taken | Developer | M |
| 4 | **Production infrastructure**: a proper production server, UptimeRobot, monthly restore drill | Launch traffic and reliability | Owner + developer | S |
| 5 | **Switch on SMS gateway and Nepal Can Move** | Customers informed at every step; no manual tracking | Owner accounts, developer | S each |

## Tier 2: the first six months (growth and scale of people)
| # | Improvement | Why it matters | Who | Size |
|---|---|---|---|---|
| 6 | **Campaigns**: SMS and WhatsApp (later email) to customer segments, with consent and opt-out, results per campaign | Repeat customers are the cheapest growth | Developer + marketing | M |
| 7 | **Recruitment and reviews**: vacancies, candidates, interview scorecards, offers; probation and yearly reviews with goals | Hiring hundreds of people consistently | Developer + owner | M |
| 8 | **Open-to-buy and allocation**: buying budgets by season and category; first allocation of new products to shops by store grade and size curve | Right depth in the right shops from day one | Developer + buyer | M |
| 9 | **Online payments** (eSewa, Khalti, Fonepay) | Prepaid orders cut refusals and cash handling | Owner decision, developer | M (mostly built) |
| 10 | **Gift cards** (physical and digital, usable in shops and online) | Festival gifting | Developer | M |
| 11 | **Customer data rights**: download or delete my data on request | Privacy law and trust | Developer | S |

## Tier 3: national dominance (new channels and depth)
| # | Improvement | Why it matters | Who | Size |
|---|---|---|---|---|
| 12 | **Dealers, wholesale and franchise**: accounts with credit limits, dealer prices, orders, consignment stock, statements | Reach districts before we open our own shop | Developer + owner | L |
| 13 | **Marketplace (Daraz)**: stock and orders synced | Customers who shop only on marketplaces | Developer | M |
| 14 | **Scale steps**: managed database with point-in-time restore, several app processes, a reporting replica | Only when traffic triggers are met (see developer docs) | Developer + owner | M |
| 15 | **Accounting sync, fixed assets, cash-flow forecast** | Fewer manual steps for the accountant at scale | Developer + accountant | M |
| 16 | **Production depth**: tech packs, per-size consumption, piece-rate, quality stages | Making more of our own range | Developer + buyer | M |
| 17 | **AI assistant**: questions about the business in plain words | Faster decisions for managers | Developer (needs an AI provider and the owner's OK on cost and data) | M |
| 18 | **Store footfall** counters for in-store conversion | Know which shops convert visitors | Hardware + developer | S |

> **Note:** this page is updated as items ship. Raise its version so it shows as changed.`,
  },
];
