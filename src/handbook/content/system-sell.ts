import type { HandbookPage } from "../types";

export const SYSTEM_SELL: HandbookPage[] = [
  {
    slug: "sys-overview",
    section: "system",
    title: "Asson OS at a glance",
    summary: "How the parts of the system fit together, from a customer's tap to the monthly accounts.",
    audience: "all",
    minutes: 7,
    version: 1,
    related: ["sys-today", "sys-pos", "sys-orders", "sys-inventory"],
    body: `Asson OS is one system with two faces: **the shop** that customers use (website and app) and **the staff side** at /admin that the team uses. Both read and write the same data.

## Follow one shirt through the system
1. **Buying.** The buyer sees in Insights that Oxford shirts in M are selling fast. Purchasing suggests how many to reorder. A purchase order goes to the supplier.
2. **Receiving.** The warehouse counts the delivery against the order. Stock goes up by what was counted, at the real landed cost. The supplier's bill lands in Payables.
3. **Putting away.** Each size goes to its home bin. The putaway list is in walking order.
4. **To the shops.** Replenishment sees Pokhara will run out of M in 6 days and drafts a transfer. The warehouse scans the box and sends it; Pokhara counts it in.
5. **Selling in a shop.** A cashier scans the shirt. Stock drops at that shop, the sale goes into the till's shift, and the customer's phone earns loyalty points.
6. **Selling online.** A customer in Dharan orders one. The system picks the nearest location that has the whole order, the order is confirmed (COD call if needed), picked in a wave, packed by scan, handed to the courier on a manifest, and tracked to the door. The customer gets an SMS at each step.
7. **Money.** The till's cash goes to the shop's safe and then the bank. The courier pays the COD. Bank statements are imported and matched. Every sale's cost was recorded the moment it sold, so profit is exact.
8. **Month end.** Finance closes the month, files VAT, runs payroll (with commission from till sales), and the owner sees profit per shop.

## The main areas
| Area | What it does | Main screens |
|---|---|---|
| Sell | Shop tills, closing, cash | Point of sale, Daily closing, Cash, COD remittance |
| Orders | Online orders to the customer's door | Orders, Fulfilment, Pick lists, Customer care, Notifications |
| Stock | Products and where every unit is | Products, Inventory, Transfers, Replenishment, Bins, Stock counts, Damaged stock, Purchasing, Production |
| Shops & team | Running locations and people | Network, Shop scorecard, Shop operations, People, Rosters, Store visits, Visual merchandising, Issues, My time |
| Money | The books | Payables, Finance, Payroll |
| Grow | Customers and sales growth | Insights, Customers, Coupons, Markdowns, Lookbook, Nepali names, Reviews |
| Settings | The owner's controls | Team & access, Locations, Delivery rates, Activity log, System |
| Learn | How we work | Handbook, Training |

## What runs by itself
Background jobs do routine work so nobody has to remember it: sending SMS with retries, closing forgotten clock-outs, starting and ending sales on time, drafting replenishment, rebuilding recommendations, nightly stock checks, backups every hour, and a health watchdog that texts the owner if something breaks.`,
  },
  {
    slug: "sys-today",
    section: "system",
    title: "Dashboard, Needs attention and Today",
    summary: "Where each person starts the day: the exceptions list for managers, and Today for everyone.",
    audience: "all",
    minutes: 4,
    version: 1,
    open: [{ label: "Today", href: "/admin/today" }, { label: "Dashboard", href: "/admin" }],
    related: ["operating-rhythm", "sys-ops"],
    body: `## Today: everyone's start page
Today shows what matters to **you**, at **your** location:
- **From HQ**: announcements to read. Some ask you to confirm you've read them.
- **Checklists**: the opening, daytime and closing checklists for your shop. Tick as you go.
- **My shifts, next 7 days** and any **shift swaps** waiting for you.
- **Training to read and sign**.
- **Open issues** at your location, **display photos to send**, and **fixes from store visits**.
- **This month's sales target** for your shop and how far along it is.

> **Tip:** open Today at the start of every shift, before anything else. If Today is clear, your shop is in good shape.

## Dashboard and Needs attention (managers and HQ)
The Dashboard shows the last 30 days: sales, average order value, orders to confirm, pack and ship, returns to process, low stock and stock value.

**Needs attention** is the most important list in the company. It gathers every exception across the business, for the locations and permissions you have:
- orders waiting too long to be confirmed, packed or shipped;
- tills with cash differences, days not closed, deposits not matched;
- care cases past their deadline, issues overdue;
- leave waiting for approval, missed shifts to decide;
- stock problems: counts to approve, damaged stock to decide, transfers stuck;
- supplier bills overdue, VAT or TDS due;
- unusual moves in the KPI pulse (a number far from its normal level for that weekday).

> **Why:** a world-class operation isn't one where nothing goes wrong. It's one where every problem is seen and owned the same day. Managers work Needs attention down to empty, every day.`,
  },
  {
    slug: "sys-pos",
    section: "system",
    title: "Point of sale (the till)",
    summary: "Selling in a shop: shifts, scanning, discounts, payments, receipts, returns, pickups, ordering for a customer, and selling when the internet is down.",
    audience: ["cashier", "shop-manager", "ops-manager", "owner"],
    minutes: 11,
    version: 3,
    open: [{ label: "Point of sale", href: "/admin/pos" }],
    related: ["sop-open-shop", "sop-till", "sop-store-returns", "sop-pickups", "sys-closing"],
    body: `The till sells from the same stock as the website. It's built for speed: **scan, scan, scan, pay**.

## Shifts
A shift is one cashier's session at the till. **Open your shift** with the exact cash in the drawer (Opening cash). Every sale, refund and cash payment in your shift is counted toward what should be in the drawer. At the end, **Close shift**: type the cash you counted. If it's different from **Expected in drawer**, you must explain the difference. Never make the cash "fit".

## A sale
1. **Scan** each item (or type the SKU or product name). Scanned items are added instantly; scanning the same item again adds one more.
2. **Customer** (optional but always ask for the mobile): links the sale to their account and loyalty points. A business buyer gives their **Buyer PAN** (9 digits) so it prints on their tax invoice and they can claim the VAT.
3. **Discount** if needed: choose percent or amount, and the reason (Loyal customer, Festival offer, Price match, Bulk purchase, Staff purchase, Damaged / display piece, Other). Above 5% an approver types their **Approver PIN**.
4. **Payment**: Cash (type Cash received, and the change is shown), Fonepay QR, Khalti, eSewa, card, bank transfer or store credit. You can split across methods; payments must add up exactly to the total. QR, card and bank payments need the transaction reference.
5. **Sale complete**: print the **tax invoice** and give the change shown.

Each sale is recorded once even if the button is pressed twice, and stock is checked live: the till won't sell what isn't there.

## The tax invoice
Every sale gets a **tax invoice** with its own number (for example FLAGSHIP-8384-000123: the shop, the fiscal year, then the number). Numbers follow each other with no gaps within the year, and are separate from order numbers. It shows our PAN, the buyer (and their PAN if given), the date in BS and AD, each item before VAT, the discount, the taxable amount, **VAT 13%** and the total.
- Print it with the **Print** button. The first print is the original. **Any later print says "Copy of original (1)", "(2)"…** and is recorded with your name. Never use the browser's own print: it prints a note instead of the invoice.
- An invoice can't be changed or deleted, by anyone. If something was wrong, the fix is a return (a credit note).

## Return / exchange
Find the sale by receipt or phone. For each item choose the condition (**RESELLABLE** goes back on sale; **DAMAGED** goes to the damaged register) and the reason (Size too small, Size too large, Colour not as expected, Quality issue / defect, Changed mind). A manager approves with their PIN. **Refund as**: the original way, or **Store credit** (a voucher). For a size swap, return as store credit and sell the new size with that credit.

Every refund on an invoiced sale is a **credit note** against that invoice (its own CN number, the invoice number, the reason and the VAT given back). Print it from the return slip and give it with the refund.

## Pickups (click-and-collect)
Online orders for collection at this shop appear under **Pickups**. Find by order number or phone, take payment if it's due (Pay when collecting), and **Hand over**. The order is marked collected and the money lands in your shift.

## When the internet drops (offline mode)
The till keeps selling. A yellow strip says **Offline: sales are saved on this device**, with how many sales are waiting to sync.
- Scanning works from this shop's **price list saved on the till** (it refreshes by itself every few minutes while online). The till won't sell offline from a list more than 3 days old: keep it online at least once a day.
- Take **cash**, or **QR or card with the transaction ID** from the customer's app or the card slip (required offline).
- Press **Save sale offline**. The receipt says **OFFLINE · PENDING SYNC** and has a code like OFF-7K3F9Q instead of an order number.
- **Not possible offline:** returns and exchanges, pickups, ordering for a customer, store credit, bank transfer, discounts above **5%** (no manager PIN can be checked), and closing your shift.
- When the connection is back the saved sales **go to the server by themselves**, oldest first, with the time you made them and on your shift. Each is recorded once, however often it's sent. The strip shows "N offline sales sent" and your shift count goes up.
- **You can't close your shift until every offline sale has synced**, because the drawer count would miss them. Only the cashier who made the sales can send them: don't sign someone else in on your till while sales are waiting.
- If the shelf had fewer units than the system thought (another shop or the website took them meanwhile), the sale is still recorded and your manager sees it on **Needs attention** to check.
- If the till itself won't open at all (device broken), use the numbered paper sales sheet: see the incident runbook.

## Order for a customer
When the size isn't here: **Order for a customer** shows which locations have it. Choose **PICKUP** (they collect here later) or **DELIVERY** (to their address), and **Pay now** or **Pay when collecting**. It becomes a normal order the warehouse or other shop fulfils.

> **Rule:** never take money without ringing up a sale. Never sell on another person's shift. Never give a discount without its reason.`,
    quiz: [
      { q: "The drawer has Rs. 120 less than Expected in drawer when you close. What do you do?", options: ["Add Rs. 120 from your own pocket", "Type the real count and explain the difference", "Type the expected amount so it balances"], answer: 1, why: "Always the real count. Differences are explained and reviewed; hiding them is the serious problem." },
      { q: "A customer pays half by Fonepay QR and half in cash. Can the till do that?", options: ["No, one payment method per sale", "Yes, split the payment; the QR part needs its transaction reference", "Only with a manager PIN"], answer: 1, why: "Split payments are normal. Every non-cash payment needs its reference so it can be matched later." },
      { q: "A customer comes back for another copy of yesterday's invoice. What do you print?", options: ["A new invoice for the same sale", "A reprint, which says Copy of original with its number", "Nothing: invoices can't be printed twice"], answer: 1, why: "Reprints are allowed and must say Copy of original (n); the system numbers and records each one. A sale never gets a second invoice." },
      { q: "The internet is down and a customer pays by Fonepay QR. What do you do?", options: ["Refuse: QR needs the internet", "Take it and type the transaction ID from their app, then Save sale offline", "Write it on paper"], answer: 1, why: "Offline the till takes QR and card with the transaction ID, so the payment can be matched later. The sale syncs by itself." },
      { q: "A returned shirt has a stain. Which condition?", options: ["RESELLABLE", "DAMAGED", "Doesn't matter"], answer: 1, why: "Damaged items never go back on the shelf. DAMAGED sends it to the damaged register for a decision." },
    ],
  },
  {
    slug: "sys-closing",
    section: "system",
    title: "Daily closing",
    summary: "Checking and locking each shop's day: sales, refunds, discounts, cash and stock movements.",
    audience: ["shop-manager", "ops-manager", "owner", "accountant"],
    minutes: 4,
    version: 1,
    open: [{ label: "Daily closing", href: "/admin/closing" }],
    related: ["sop-close-day", "sys-cash", "sys-pos"],
    body: `Daily closing is the manager's end-of-day check. One page shows the shop's whole day:
- **Store sales**, **Discounts given**, **Returns & refunds** and **Net store sales**;
- **Payments received in store** by method (cash, QR, card, bank, store credit);
- **Shifts**: each cashier's expected and counted cash, and any **Cash difference** with its note;
- **Stock movements (non-sale)**: adjustments, damaged, transfers in and out;
- **Store gross profit** (owner only): sales against the cost of the goods sold.

## Locking the day
When everything is right, the manager **locks the day**. A locked day can't change: no back-dated sale, refund or adjustment can slip into it. If something is wrong (a shift still open, a difference not explained), fix that first.

> **Why:** a day that isn't closed is a day nobody checked. Our target is a cash difference on fewer than 2% of days, each one explained. Closing every day keeps small problems from becoming big ones.

## What the owner looks for
Repeated small shortages on one cashier, discounts above normal, refunds with no matching returns, many "Other" reasons. These show up on Needs attention and the Shop scorecard.`,
    quiz: [
      { q: "When should the day be locked?", options: ["At the end of the month", "Every day, once sales, refunds and cash are checked", "Only when there's a difference"], answer: 1, why: "Rule 7: close and lock every day." },
    ],
  },
  {
    slug: "sys-cash",
    section: "system",
    title: "Cash: safes, deposits and petty cash",
    summary: "Every location's cash book, from till takings to the bank, with petty cash and safe counts.",
    audience: ["shop-manager", "ops-manager", "owner", "accountant"],
    minutes: 5,
    version: 1,
    open: [{ label: "Cash", href: "/admin/cash" }],
    related: ["sop-cash-bank", "sys-closing", "sys-bank-close"],
    body: `Each location has a **cash book**: a running record of what its safe should hold. It can't be edited after the fact; mistakes are corrected with a new entry.

## How money moves
1. **Till to safe.** When a shift closes, its cash takings post to the shop's cash book by themselves.
2. **Safe count.** The manager counts the safe regularly (Cash counted in the safe) and saves the count. A difference is flagged.
3. **Bank deposit.** Record each deposit: amount, date, slip number and a photo of the deposit slip. It waits as "to check" until the bank statement shows it.
4. **Bank check.** When the bank statement is imported in Finance → Bank, deposits are matched automatically. A deposit the bank doesn't show (or shows differently) is flagged.
5. **Petty cash.** Small shop costs (Packaging, Utilities, Marketing, Small equipment, Other) are recorded with a description and a receipt photo. Bigger costs go through Finance.

## The network view
HQ sees every location's position on one page: cash in safes, in open tills, deposits waiting for the bank, and what needs doing (overdue counts, unmatched deposits).

> **Rule:** cash leaves a safe only as a recorded deposit or recorded petty spend. Never "borrow" from the safe, even for a moment.`,
  },
  {
    slug: "sys-cod",
    section: "system",
    title: "COD remittance",
    summary: "Making sure every rupee couriers collect on delivery reaches our bank.",
    audience: ["accountant", "ops-manager", "owner", "shop-manager"],
    minutes: 3,
    version: 1,
    open: [{ label: "COD remittance", href: "/admin/cod" }],
    related: ["sys-bank-close", "sys-fulfilment"],
    body: `Most online orders in Nepal are paid cash on delivery. The courier's rider collects the money, and the courier pays it to us later in a batch (a **remittance**).

COD remittance shows, for each courier, the delivered COD orders not yet paid (**Expected**). When a remittance arrives:
1. Open the courier, tick the orders the remittance covers (or **Select all**).
2. Type the **Amount received** and the **Remittance reference** (bank or statement reference).
3. **Record remittance**. If it's less than expected, the gap shows as **Short** and stays open.

The bank import in Finance also matches courier remittances automatically when the reference matches.

> **Why:** COD money sits with couriers for days. Without tracking each order, short payments go unnoticed. Chase anything short or older than the courier's agreed payment days.`,
  },
];
