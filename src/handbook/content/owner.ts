import type { HandbookPage } from "../types";

export const OWNER: HandbookPage[] = [
  {
    slug: "owner-rhythm",
    section: "owner",
    title: "The owner's and HQ's rhythm",
    summary: "The daily check, weekly review, monthly close and yearly plan that run the company from the system.",
    audience: ["owner", "ops-manager"],
    minutes: 6,
    version: 1,
    related: ["operating-rhythm", "owner-kpis", "sys-today"],
    body: `## Daily (15 minutes)
1. **Needs attention**: anything red or old? Who owns it?
2. **KPI pulse**: any number far from normal for this weekday?
3. Yesterday's sales vs target (Dashboard, Network); any shop not closed and locked?
4. System: any critical alert texted overnight?

## Weekly review (Monday, 60–90 minutes, with ops, buying, care, finance)
| Item | Screen | Question |
|---|---|---|
| Sales and margin vs target, by shop | Network, Budgets | Who's behind, why, what's the fix? |
| Online: orders, conversion, delivery on time, refusals | Insights, Deliveries | Where are we losing customers? |
| Stock: reorder signals, stock-outs, dead stock | Insights | What do we buy, move or mark down? |
| Operations: scorecard, issues, visits | Shop scorecard, Issues | Which shops need a visit this week? |
| Customers: care cases, satisfaction, reviews | Customer care, Reviews | What keeps going wrong? |
| Cash: deposits, COD remittances, payables due | Cash, COD remittance, Payables | Is money where it should be? |
| People: onboarding, absences, open roles | Team onboarding, People | Who needs support? |

Write three actions with owners and dates. Check last week's three first.

## Monthly (first week of the month)
- Month close and lock; VAT return; payroll and deposits.
- P&L and profit by shop; budget vs actual; next month's budgets.
- Supplier payment plan; stock valuation; markdown plan.
- One deep dive: a category, a region, a process.
- Announcement to all staff: last month's results, thanks, this month's focus.

## Yearly
- Shrawan: confirm tax bands, set the year's budgets per location, review every Training procedure, review this handbook.
- Before Dashain: the festival playbook.
- Ashadh: full counts, fiscal year close, auditor's pack, yearly reviews for every manager.
- Strategy day: where to open next, what to make ourselves, what the World-class review says to build next.`,
  },
  {
    slug: "owner-kpis",
    section: "owner",
    title: "The numbers that matter: KPIs and targets",
    summary: "The company's measures, their targets, where to see each, and who owns it.",
    audience: ["owner", "ops-manager", "buyer", "accountant", "marketing", "shop-manager"],
    minutes: 5,
    version: 1,
    related: ["owner-rhythm", "welcome", "sys-insights"],
    body: `| Area | Measure | Target | Where | Owner |
|---|---|---|---|---|
| Growth | Sales vs budget | 100%+ | Budgets, Network | Owner, shop managers |
| Growth | Districts with a delivered order | 50+ of 77 in year 1 | Network, Insights | Ops, marketing |
| Growth | Repeat customers within 6 months | 30%+ | Insights → customers | Marketing, care |
| Online | Visit → order conversion | 2%+ | Insights → funnel | Marketing |
| Online | Checkout start → order | 60%+ | Insights → funnel | Marketing |
| Online | Searches that find something | 95%+ | Insights → searches | Marketing, buyer |
| Profit | Gross margin | 45%+ | Finance | Buyer, owner |
| Profit | Net profit by shop | Positive within 6 months of opening | Profit by shop | Owner, ops |
| Stock | System vs physical count | 99.5%+ | Stock counts | Shop and warehouse managers |
| Stock | Sell-through before markdown | 70%+ | Insights, Markdowns | Buyer |
| Delivery | Delivered within promised days | 95%+ | Deliveries | Ops |
| Delivery | COD refused at the door | 5% or less | Deliveries | Care, ops |
| Returns | Returns by units | 8% or less | Insights | Buyer, care |
| Service | Care cases answered before deadline | 95%+ | Customer care | Care lead |
| Control | Days with a cash difference | 2% or less, each explained | Daily closing | Shop managers |
| Control | Days locked on time | 100% | Daily closing | Shop managers |
| People | New joiners onboarded within 30 days | 100% | Team onboarding | Managers |
| Reliability | Website uptime | 99.9% monthly | System, UptimeRobot | Owner, developer |

> **Why:** what's measured and reviewed weekly improves. Each number has one owner, so it's always clear who acts.`,
  },
  {
    slug: "owner-launch",
    section: "owner",
    title: "Launch readiness: what's left before real customers",
    summary: "The owner-side checklist between today's system and taking real orders across Nepal.",
    audience: ["owner"],
    minutes: 5,
    version: 2,
    restricted: "system",
    related: ["owner-switch-on", "worldclass-roadmap", "owner-tech", "sys-vat-year"],
    body: `The system is built and running on production. These are what stand between it and a public launch. Most need the owner's accounts or decisions, not more code.

## Must do before launch
- [ ] **Real catalogue**: replace the starter products, prices and stock with ours; real studio photos to the photo standard; fabric, fit and care for each.
- [ ] **Brand basics**: final logo, favicon and share image; the final domain if not using the current one.
- [ ] **Uptime alerts**: UptimeRobot (free) on the health address, texting the owner.
- [ ] **Production server size**: a proper VM (2+ dedicated vCPU, 8 GB+) for production; the small free one stays for staging. See Technology overview.
- [ ] **Policies reviewed by a lawyer**: returns, delivery, privacy, terms, cookies.
- [ ] **Nepali text** reviewed by a native speaker.
- [ ] **Tax invoices**: give the developer the business **PAN and registered name** for the invoices (they print "PAN/VAT No.: not set" today), and have the accountant answer the open questions (abbreviated invoices, the CBMS turnover threshold, invoice timing for prepaid orders, cancellations). Tax invoices, credit notes and copy marking are built.
- [ ] **IRD electronic billing**: if turnover requires real-time CBMS sync, apply to the IRD to enlist the software, then put the taxpayer login into the server settings to switch it on.
- [ ] **Real staff accounts** created; the demo accounts don't exist on production; everyone onboarded.
- [ ] **Procedures** in Training edited to match how we work, and signed by everyone.
- [ ] **Shop hardware**: receipt printer, barcode scanner, cash drawer, label printer, a backup internet connection (4G) and a UPS at every shop.

## Strongly recommended at launch
- [ ] **SMS gateway** (Sparrow SMS or Aakash SMS): order texts, sign-in codes, alerts.
- [ ] **Courier account and API** (Nepal Can Move): automatic shipments and tracking.
- [ ] **Ad accounts**: Meta, TikTok, Google IDs to switch on measurement.

## Later
- Online payments (eSewa, Khalti): built, on hold by decision.
- Google sign-in: needs the owner's Google OAuth client.`,
  },
  {
    slug: "owner-switch-on",
    section: "owner",
    title: "Switching on the waiting services",
    summary: "Each service that's built and waiting for an account: what it does and what to provide.",
    audience: ["owner"],
    minutes: 4,
    version: 1,
    restricted: "system",
    related: ["owner-launch", "owner-tech"],
    body: `| Service | What it switches on | What the owner provides | Cost |
|---|---|---|---|
| SMS gateway (Sparrow or Aakash) | Every order SMS, sign-in codes, back-in-stock and price-drop alerts, care replies, leave decisions | Account and API token (into the server settings, never in chat) | Per SMS |
| Nepal Can Move API | Shipments created automatically when packed, labels, tracking sync | API access | Per parcel (existing) |
| UptimeRobot | Text or email when the site is down | Account, alert phone and email | Free |
| Sentry (optional) | Detailed error reports | Project key (DSN) | Free tier |
| Meta pixel + Conversions API | Measuring Facebook/Instagram ads | Pixel ID and access token | Free |
| TikTok pixel | Measuring TikTok ads | Pixel ID | Free |
| Google Analytics 4 | Site analytics | Measurement ID | Free |
| Google sign-in | "Continue with Google" | OAuth client ID and secret | Free |
| eSewa and Khalti | Online payment at checkout | Merchant accounts (on hold by decision) | Per transaction |
| Cloudinary (optional) | Image hosting at scale | Cloud name and key | Free tier |

Secrets go into the server's settings file by the developer or through GitHub's secret settings. **Never paste a password, token or key into a chat, email or WhatsApp.**`,
  },
  {
    slug: "owner-new-shop",
    section: "owner",
    title: "Playbook: opening a new shop",
    summary: "From choosing a site to a shop that's selling and to standard after 30 days.",
    audience: ["owner", "ops-manager"],
    minutes: 6,
    version: 1,
    restricted: "ops.manage",
    open: [{ label: "Open a shop", href: "/admin/locations/new" }],
    related: ["sys-locations", "hiring-process", "sys-transfers"],
    body: `## 8–12 weeks before: decide
- [ ] Choose the district from data: online orders and demand per district (Delivery rates shows 90-day demand; Insights and Network show sales by district), searches, courier return rates.
- [ ] Site: footfall, visibility, rent as a share of expected sales, security, power and internet.
- [ ] Budget: fit-out, opening stock at cost, 6 months of costs; break-even month.

## 6–8 weeks before: prepare
- [ ] Lease signed; fit-out to the Asson shop standard; signage.
- [ ] Hire the shop manager first (Hiring process), then cashiers. Train them at an existing shop.
- [ ] Hardware: till device, scanner, receipt printer, cash drawer, label printer, safe, CCTV, UPS, internet plus a 4G backup.

## 2 weeks before: set up in the system
- [ ] **Open a shop**: details (district, pickup point, ships online), team, opening stock from the template with a preview. This creates the location, assigns the team and drafts the opening transfer.
- [ ] Budgets for the first months; checklists for the location; roster published.
- [ ] Opening stock picked, sent, and **counted in** at the shop.
- [ ] Bins or shelf plan; displays to the VM brief; price tags.

## Opening week
- [ ] An experienced manager or the ops manager on site all week.
- [ ] Daily: closing locked, cash checked, Needs attention clear.
- [ ] Local marketing: announcement to customers in the district (with an opening offer), social media.

## First 30 days
- [ ] Replenishment on; the first rebalance of slow sizes.
- [ ] Store visit at day 14 and day 30; scorecard review.
- [ ] Profit by shop at month end against the plan.`,
  },
  {
    slug: "owner-festival",
    section: "owner",
    title: "Playbook: Dashain, Tihar and other peaks",
    summary: "Buying, stock, staffing, sales and delivery for the biggest weeks of the year.",
    audience: ["owner", "ops-manager", "buyer", "marketing"],
    minutes: 6,
    version: 1,
    related: ["sys-insights", "sys-coupons-markdowns", "sys-rosters"],
    body: `Dashain and Tihar can be several times a normal month. Everything that's slightly wrong on a normal day breaks at the peak, so plan early.

## 10–12 weeks before
- [ ] **Demand forecast** (Insights): it includes festival seasonality. Buy and produce by size from it, plus safety stock on best sellers.
- [ ] Purchase orders and production orders placed with delivery dates 4 weeks before the peak.
- [ ] Budget per location for the festival months.

## 4–6 weeks before
- [ ] Stock received, counted and put away; replenishment sends each shop its festival depth.
- [ ] **Markdowns** planned (dates, prices, margin floors); coupons created with limits.
- [ ] Gift messaging, lookbook, campaign content; ad measurement on.
- [ ] Courier capacity confirmed; extra packing staff hired and onboarded (their path and procedures done before the rush).
- [ ] Rosters: no leave in peak weeks except approved in advance; extra shifts published.

## Peak weeks
- [ ] Waves several times a day; courier hand-overs at fixed times.
- [ ] Care staffed for double volume; COD confirmation calls for high-value orders (fraud and refusals rise in peaks).
- [ ] Daily review of Needs attention twice a day; stock-outs moved between shops quickly.
- [ ] Cash banked daily at busy shops.

## After
- [ ] Returns and exchanges handled fast (the return window runs after the festival).
- [ ] Markdown results reviewed; leftover stock plan.
- [ ] Lessons written down for next year.`,
  },
  {
    slug: "owner-incidents",
    section: "owner",
    title: "When things go wrong: incident runbook",
    summary: "What to do when the site is down, a shop loses internet or power, cash goes missing, or data is at risk.",
    audience: ["owner", "ops-manager", "shop-manager"],
    minutes: 7,
    version: 2,
    related: ["sop-issues", "sys-system-health", "owner-tech"],
    body: `In every incident: **people safe first, then protect money and data, then restore service, then write down what happened.**

## The website or the system is down
1. The watchdog texts the owner when something critical breaks (and UptimeRobot once it's set up).
2. Check the health page from a phone on mobile data (to rule out your own internet).
3. Contact the developer with the time and what you see. Deploys never take the site down, and a bad build never goes live, so an outage is usually the server or the network.
4. Tell staff (WhatsApp group) and, if long, customers on social media.
5. Afterwards: what happened, why, and what stops it happening again.

## A shop loses internet
The till keeps selling by itself (**offline mode**, see the Point of sale page): cash, and QR or card with the transaction ID. Sales are saved on the till and sync on their own when the connection is back.
1. Keep selling on the till. Returns, pickups, orders for customers and discounts above 5% wait until it's back; tell customers it will be a short wait.
2. Switch to the shop's **4G backup** (hotspot from the shop phone or a 4G router) as soon as you can, so sales sync and returns work. Every shop must have one.
3. Don't close the shift or lock the day until the till shows every offline sale has synced. The system blocks both while a till still holds sales.
4. Afterwards the manager checks **Needs attention** and the closing page's **Offline sales to check** (stock sold that the system didn't have, a sale that arrived after the shift closed) and ticks each off with a note.
5. Only if the till device itself won't work: record each sale on the **numbered paper sales sheet** (item, size, price, payment, time), ring them in when it's back, and attach the sheet to the day's closing.
6. Report a long outage in Issues (category IT, Urgent).

## Power cut at a shop
UPS keeps the till device, router and printer running. For long cuts, the same steps as internet loss: the till sells offline as long as its device has power. Keep the safe and drawer locked.

## Cash missing or a till short
1. Recount with a second person. Check the shift's sales, refunds and payments on Daily closing.
2. Check the activity log for the shift: discounts, refunds, voids.
3. Record the real count with a note. Never cover it.
4. Repeated shortages: the ops manager investigates with the facts; follow the disciplinary process if it's misconduct.

## Theft or robbery
Safety first: never resist. Call the police (100). Record what was taken (stock: a count; cash: the safe count). Report in Issues (Safety). Insurance claim with the police report.

## Suspected staff fraud
Don't confront alone. The owner checks the activity log, closing records and counts quietly. Remove access if needed **before** the conversation. Follow the disciplinary process.

## Data at risk (a lost phone, a leaked password, a suspicious sign-in)
1. Remove the person's access or reset their password immediately (Team & access ends all their sessions).
2. Check the activity log for what was done.
3. Tell the developer: secrets may need changing.
4. If customer data may have leaked, get legal advice on telling customers.

## A wrong price went live
Fix the price (or end the markdown). Orders already placed at a clearly wrong price: care contacts the customer before dispatch (the policy allows paying the right price or cancelling with a full refund).`,
  },
  {
    slug: "owner-access-security",
    section: "owner",
    title: "Access and security controls",
    summary: "How the owner keeps access tight: accounts, permissions, PINs, the activity log and outside accounts.",
    audience: ["owner"],
    minutes: 4,
    version: 1,
    restricted: "team.manage",
    related: ["sys-team-access", "sys-activity", "hiring-leaving"],
    body: `## Monthly access review (15 minutes)
- [ ] Team & access: everyone listed still works here, in the right job and locations.
- [ ] Unused invites removed; extra permissions still needed.
- [ ] Activity log: sign-ins at odd hours, unusual refunds, price changes, permission changes.

## Built-in protections
- Passwords are stored scrambled (never readable); sign-in attempts are rate-limited, so guessing locks out.
- Every session can be ended at once by removing access.
- Approval PINs are personal and recorded on every approval.
- Staff can only act at their own locations.
- Closed days, months, VAT periods and fiscal years are locked in the database.
- Nothing financial can be deleted; corrections are new entries.
- Backups every hour, copied off-site every night.

## Outside accounts the owner must protect
Turn on **two-factor authentication** on every one: GitHub, Cloudflare, Oracle Cloud, the domain, the bank, Google, Meta, TikTok, the SMS gateway, the courier account. Use a password manager. Never share these logins; give people their own where the service allows.

> **Note:** two-factor sign-in for staff accounts in Asson OS is on the roadmap (World-class review).`,
  },
  {
    slug: "owner-tech",
    section: "owner",
    title: "Technology overview (for non-technical people)",
    summary: "Where the system runs, how updates go live safely, backups, monitoring and capacity.",
    audience: ["owner"],
    minutes: 6,
    version: 1,
    restricted: "system",
    related: ["sys-system-health", "owner-incidents", "owner-switch-on"],
    body: `## Where it runs
- The system runs on a cloud server in India, behind **Cloudflare** (which protects it and speeds it up).
- There are two copies: **staging** (a test copy with demo data, where every change is checked first) and **production** (the real shop and real data).
- The code lives on **GitHub**. Developer documentation is in the docs folder of the code.

## How updates go live
1. A change is written with automated tests.
2. **Every change runs about 500 automated tests** (unit, database and real-browser tests) before it can be merged.
3. Merged changes go to **staging** automatically.
4. Production is updated **only on the owner's OK**, after a backup. Updates use two slots (blue/green): the new version starts beside the old one and takes over only when healthy, so tills and shoppers are never interrupted, and a bad version never goes live.

## Backups
- Production is backed up **every hour** (24 copies kept), and copied **off-site every night** to separate cloud storage. A full backup is taken before every update.
- Restores are tested (a restore drill). Do one every month.

## Monitoring
- A watchdog checks every 5 minutes and **texts the owner** when something critical breaks, and again when it recovers.
- System (in the admin) shows jobs, errors and health.
- UptimeRobot (to set up) checks from outside.

## Capacity
Tested with a shop in every district, 3,000 products, 1.16 million stock rows and 300,000 orders: pages respond in milliseconds, and one server process serves about 350 pages a second. A national chain needs about 6 pages a second normally and 60 in a sale spike. The step-by-step growth plan (a bigger server, a separate database, more processes) is in the developer docs, each step with the point at which it's needed.`,
  },
];
