import type { HandbookPage } from "../types";

export const START: HandbookPage[] = [
  {
    slug: "welcome",
    section: "start",
    title: "Welcome to Asson",
    summary: "Who we are, what we promise customers, and where the company is going.",
    audience: "all",
    minutes: 5,
    version: 1,
    open: [{ label: "Your Today page", href: "/admin/today" }],
    related: ["how-we-run", "using-the-handbook", "roles-and-access"],
    body: `Welcome to the team. This handbook explains how Asson works: the company, the way we do things, and Asson OS, the system that runs everything from the till in a shop to the payroll at HQ. Read it in the order your path shows on the Handbook home page. You don't have to remember every detail. You need to know where to find it.

## Our vision
Become the brand Nepal trusts for clothes that look right, feel right and last, **available in all 77 districts**.

## Our mission
Research the best classic designs in the world, make or source them in high-quality fabric, and sell them at a fair price, so nobody has to worry about their clothing sense again.

## What we promise every customer
| Promise | What it means in your work |
|---|---|
| Limited designs, made to last | A small catalogue where every item earns its place. We'd rather sell out than stock junk. |
| No cheap fabric, ever | Fabric, care and fit are shown on every product. Never describe a product as something it isn't. |
| Comfortable to wear | We help customers choose the right size: size guide, fit notes, free size exchanges. |
| Classic and aesthetic | Shops, parcels, photos and messages look calm, clean and consistent. |
| Well finished | No broken promises: stock is accurate, parcels go out when we say, every problem gets an answer. |
| We take care of your clothing sense | Staff help customers put outfits together: the lookbook, "complete the look", honest advice. |

## Where we're going
We sell online to every district and through our own shops, warehouses and, over time, our own workshops. The goal is to be the clothing brand Nepal chooses first. That only works if a shop in Humla runs exactly like a shop in Kathmandu. Asson OS and this handbook are how we make that happen.

## Targets for our first year
| Goal | Target |
|---|---|
| Districts with at least one delivered order | 50 or more of 77 |
| Customers who order again within 6 months | 30% or more |
| Gross margin | 45% or more |
| Returns (by units) | 8% or less |
| Orders delivered on the promised day | 95% or more |
| Cash-on-delivery parcels refused at the door | 5% or less |
| System stock matching a physical count | 99.5% or more |

> **Why:** every person here moves one of these numbers. A cashier who links the customer's phone grows repeat customers. A packer who scans every item keeps returns down. A manager who closes the day on time keeps the money right.`,
    quiz: [
      { q: "What is Asson's vision?", options: ["The cheapest clothes in Nepal", "The brand Nepal trusts for clothes that look right, feel right and last, in all 77 districts", "The biggest number of designs in Nepal"], answer: 1, why: "We compete on trust and quality, not on being cheapest or biggest." },
      { q: "A customer asks if a shirt is 100% cotton and you're not sure. What do you do?", options: ["Say yes, most shirts are", "Check the fabric shown on the product (or ask) before answering", "Change the subject"], answer: 1, why: "\"No cheap fabric, ever\" only works if what we say is true. Fabric is on every product." },
    ],
  },
  {
    slug: "how-we-run",
    section: "start",
    title: "How the company runs: one system, seven rules",
    summary: "Why everything goes through Asson OS, and the seven rules the system enforces.",
    audience: "all",
    minutes: 6,
    version: 1,
    related: ["roles-and-access", "operating-rhythm", "glossary"],
    body: `Asson OS is our single place for everything that touches money, stock, customers or people. The website, the tills in every shop, the warehouse, HQ and payroll all work on **the same data at the same moment**. When a cashier in Pokhara sells the last medium shirt, the website stops selling it within seconds. When a parcel is refused in Dhangadhi, the stock is expected back and the courier's money is chased.

## Why one system
- **No double selling.** One stock ledger for shops and online, so we never sell what we don't have.
- **No lost money.** Every rupee taken, refunded, deposited or paid is recorded with who, when and why, and has to add up.
- **No founder dependency.** The company can grow to hundreds of people because the rules live in the system, not in one person's head.
- **Decisions on facts.** Buying, pricing, staffing and opening new shops are decided from real sales, not guesses.

## The seven rules
1. **If it affects money or stock, it's recorded in Asson OS.** Not WhatsApp, Excel, a notebook or memory.
2. **One source of truth for each thing.** Orders, stock and payments live only here. Nobody keeps a second ledger.
3. **Never delete a transaction.** Void it, refund it or correct it, and keep the original visible. The system won't let you delete anyway.
4. **Every stock change has who, what, when and why.** That's why adjustments ask for a reason.
5. **Discounts need accountability:** who gave it, how much, why, and who approved it.
6. **Count what you receive.** Stock goes up by what was counted, not by what the invoice says.
7. **Close and lock every day.** A day that isn't closed is a day nobody checked.

> **Rule:** use your own login, always. Never share a password or approval PIN, and never let anyone work on your login. Everything you do is recorded under your name in the activity log.

## Simple for staff, strict underneath
Staff never calculate profit, edit stock directly or change payments by hand. You scan, count, choose a reason and confirm; the system does the maths, checks the limits and keeps the record. If the system refuses something (a discount above your limit, packing a wrong item, closing a till that doesn't add up), that's a rule doing its job. Ask your manager; don't look for a way around it.

## Where things live
| Kind of thing | Where |
|---|---|
| Orders, stock, money, people, customers | Asson OS (this system) |
| How we do things (procedures you sign) | Training |
| How the system and company work (this) | Handbook |
| Plans, ideas, campaign drafts | Planning tools, never a second ledger |`,
    quiz: [
      { q: "A supplier's invoice says 50 shirts but you counted 47. What goes into stock?", options: ["50, the invoice is official", "47, what was counted, with the shortfall recorded", "Whatever the manager says"], answer: 1, why: "Rule 6: stock goes up by what was counted. The shortfall is recorded so we don't pay for what never arrived." },
      { q: "A cashier rang up a sale by mistake. What's right?", options: ["Delete the sale", "Refund or void it so the original stays visible", "Leave it and adjust the cash"], answer: 1, why: "Rule 3: never delete a transaction. Correct it so the history stays complete." },
      { q: "Your colleague asks to use your login because theirs is locked. You should:", options: ["Let them, just this once", "Refuse and get a manager to fix their login", "Give them your PIN instead"], answer: 1, why: "Everything on your login is recorded as you. Sharing it breaks accountability for both of you." },
    ],
  },
  {
    slug: "using-the-handbook",
    section: "start",
    title: "How to use this handbook",
    summary: "Your reading path, questions, printing, and how the handbook stays up to date.",
    audience: "all",
    minutes: 3,
    version: 1,
    open: [{ label: "Handbook home", href: "/admin/handbook" }, { label: "Training", href: "/admin/training" }],
    related: ["welcome", "how-we-run"],
    body: `## Your path
The Handbook home page shows **your path**: the pages for your job, in the order to read them. Your first week is the top of the list. Each page has a button at the bottom: press it when you've read and understood the page.

Many pages end with a few **"Check yourself"** questions. They aren't a test to catch you out. They make sure the important points stuck. You need 80% to pass, and you can try again as often as you like. The right answers only show after you answer.

| Mark | Meaning |
|---|---|
| ✓ (green) | Done |
| Half green | Read, questions still to pass |
| ! | The page has changed since you read it: read it again |
| Empty circle | Not read yet |

## Handbook and Training: what's the difference?
- **Handbook** (here) explains how things work and why: the company, the system, your job. Pages change when the system changes.
- **Training** holds the procedures you **sign**: "I've read this and will follow it". When a procedure changes in an important way, everyone signs again.

Your manager sees both on the Team onboarding page. New joiners should finish their path and sign their procedures within 30 days. Nobody works a till alone or ships orders alone before signing the procedures for it.

## Search and print
Search from the box at the top of the Handbook home ("refund", "transfer", "leave"). Any page can be printed for a training folder or the back-room wall with the Print button.

## When something is wrong or missing
If a page doesn't match what you see on screen, or something you do every day isn't here, tell your manager or report it in Issues (category "IT"). The handbook is maintained alongside the system, so it gets fixed in the same update.`,
  },
  {
    slug: "roles-and-access",
    section: "start",
    title: "Jobs, roles and who can do what",
    summary: "The nine jobs, the four levels, approval limits, and why access is split the way it is.",
    audience: "all",
    minutes: 6,
    version: 2,
    open: [{ label: "Team & access", href: "/admin/team" }, { label: "My approval PIN", href: "/admin/me" }],
    related: ["how-we-run", "sys-team-access"],
    body: `Everyone on the staff side has their **own login**, a **level** and a **job**.

## Where staff sign in
Staff sign in at **/admin/login** (asson.bhuwanpaneru.com/admin/login, or just open /admin), never on the shop's sign-in. The shop's sign-in is for customers only: if you type a staff email there, it sends you to the staff page. Customers can't sign in on the staff page. Forgot your password? Ask the owner for a new sign-in link from Team & access.

- Your **level** (Cashier, Fulfilment staff, Manager or Owner) sets your approval limits and which procedures you must sign.
- Your **job** decides which parts of the system you see. The menu on the left only shows what your job needs.
- Your **locations** (Works at) decide which shops or warehouses you can act at: their tills, stock, closing and team.

## The nine jobs
| Job | Level | What it covers |
|---|---|---|
| Owner | Owner | Everything, including the team, prices, costs and payroll. |
| Operations manager | Manager | Runs shops and the warehouse across the network: orders, stock, people, approvals, insights, purchasing. No payroll or finance. |
| Shop manager | Manager | Runs one or more shops: the till, approvals, closing and cash, stock, transfers, the shop's team. |
| Cashier | Cashier | Sells at the till and counts stock. Nothing else. |
| Warehouse & fulfilment | Staff | Picks, packs and ships online orders, moves stock, counts and receives. |
| Customer care | Staff | Answers customers: the care queue, orders, customer details, reviews. |
| Buyer / merchandiser | Manager | What to stock: products and prices, purchasing, production, markdowns, the demand forecast. |
| Accountant | Manager | The books: finance, supplier bills and payments, VAT, bank, payroll, the activity log. |
| Marketing | Staff | Product words and photos, the lookbook, coupons, reviews, what shoppers search. |

The owner can add or remove single permissions for one person (for example, a cashier who also counts stock at the warehouse). Only the owner can manage the team and the system settings.

## Approval limits
| Decision | Cashier | Manager | Owner |
|---|---|---|---|
| Discount at the till | up to 5% alone | approves up to 15% | approves anything |
| Store return or refund | needs a PIN | approves with PIN | approves with PIN |
| Stock adjustment | no | yes, with reason | yes |
| Close and lock the day | no | yes | yes |
| Prices, costs, delivery rates | no | no | yes |

Approvals happen on the spot: the manager types their **approval PIN** on the till. The PIN is personal, set in My approval PIN, and every approval is recorded with their name.

## Why it's split like this
This is called **segregation of duties**. The person who takes cash isn't the person who approves refunds; the person who counts stock isn't the person who can change it. It protects the company, and it protects you: if numbers don't add up, the record shows clearly that it wasn't you.`,
    quiz: [
      { q: "A customer wants 10% off. You're a cashier. What happens?", options: ["You give it; 10% is small", "A manager approves it with their PIN, and you choose the reason", "You can't give discounts at all"], answer: 1, why: "Cashiers can give up to 5% alone. Up to 15% needs a manager's PIN; more needs the owner." },
      { q: "Why can't the cashier who takes cash also approve refunds?", options: ["Managers don't trust cashiers", "Segregation of duties: it protects the company and the cashier", "It's a software limitation"], answer: 1, why: "Splitting duties means no one person can take money out unnoticed, and an honest person is never under suspicion." },
    ],
  },
  {
    slug: "glossary",
    section: "start",
    title: "Glossary: words we use",
    summary: "Short explanations of the words you'll see on screen and hear at work.",
    audience: "all",
    minutes: 6,
    version: 1,
    related: ["how-we-run"],
    body: `| Word | Meaning |
|---|---|
| **Asson OS** | This system: the website, tills, warehouse, HQ, finance and payroll, all on one set of data. |
| **SKU / variant** | One exact item: a product in one colour and one size (Oxford shirt, Sky Blue, M). Each has its own barcode. |
| **Location** | A shop, warehouse or fulfilment centre that holds stock. |
| **Bin** | A numbered shelf spot in a warehouse. Each size has a home bin so it's always found in the same place. |
| **COD** | Cash on delivery: the customer pays the rider. The courier later pays us (COD remittance). |
| **RTO** | Return to origin: a parcel the customer didn't accept, coming back to us. |
| **Wave** | A batch of online orders picked together in one walk through the warehouse. |
| **Manifest** | The list of parcels handed to a courier's rider, scanned and signed. |
| **Shift (till)** | A cashier's session at a till, from the opening float to the cash count at the end. |
| **Float** | The cash in the drawer at the start of a shift, for giving change. |
| **Daily closing** | Checking a shop's day (sales, refunds, discounts, cash) and locking it so it can't change. |
| **Cash book** | The record of every rupee in each location's safe: till takings in, deposits and petty cash out. |
| **Transfer** | Moving stock between locations. It leaves when sent and arrives only as counted. |
| **Replenishment** | Topping up shops from the warehouse based on what each shop sells. |
| **Blind count** | Counting stock without seeing what the system expects, so the count is honest. |
| **Variance** | The difference between counted and expected stock. A manager approves it. |
| **Purchase order (PO)** | What we ordered from a supplier. Goods are received against it. |
| **Landed cost** | What an item really cost us: price plus freight, customs and other charges. |
| **Weighted-average cost** | Our cost per item, averaged across everything we've bought. Used for profit. |
| **Markdown** | A planned price reduction (a sale) with start and end dates. |
| **Payables** | What we owe suppliers, and when. |
| **Credit note** | A supplier reducing what we owe them (returns, damaged goods). |
| **P&L** | Profit and loss: sales minus the cost of goods and other costs. |
| **VAT** | Value Added Tax, 13% in Nepal. Our prices include it. |
| **PAN** | A business's tax number. Supplier bills need it for us to claim input VAT. |
| **TDS** | Tax deducted at source: income tax taken from salaries and paid to the IRD. |
| **SSF** | Social Security Fund: 11% from the employee and 20% from the employer, of basic salary. |
| **Fiscal year** | Nepal's financial year, Shrawan to Ashadh (mid-July to mid-July). |
| **Roster** | The published weekly schedule of who works when. |
| **Absence** | A published shift nobody clocked in for. A manager decides what it was. |
| **SOP** | Standard operating procedure: the agreed way to do a task. Signed in Training. |
| **VM** | Visual merchandising: how products are displayed in a shop. |
| **Care case** | A customer's question or complaint in the Customer care queue. |
| **Needs attention** | The list on the Dashboard of everything that's late, wrong or waiting on someone. |
| **Approval PIN** | A manager's or owner's personal code, typed to approve something on the spot. |
| **Activity log** | The permanent record of every change and every staff sign-in. |`,
  },
];
