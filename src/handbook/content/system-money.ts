import type { HandbookPage } from "../types";

export const SYSTEM_MONEY: HandbookPage[] = [
  {
    slug: "sys-finance",
    section: "system",
    title: "Finance: profit, costs and profit by shop",
    summary: "The company P&L from real costs, expenses, profit per location, and the most profitable products.",
    audience: ["accountant", "owner"],
    minutes: 6,
    version: 1,
    restricted: "finance",
    open: [{ label: "Finance", href: "/admin/finance" }, { label: "Profit by shop", href: "/admin/finance/shops" }],
    related: ["sys-budgets", "sys-bank-close", "sys-vat-year", "owner-kpis"],
    body: "## The P&L, month by month\n" +
      "Finance shows each month (or the fiscal year): **Gross sales**, **Discounts**, **Returns & refunds**, **Net sales**, **Delivery charged to customers**, **Cost of goods sold**, **Gross profit** and **Margin**, **Expenses**, and **Net profit**. Stock value at cost is shown alongside.\n\n" +
      "Cost of goods is exact: every sale recorded its cost at the moment it sold (weighted-average, landed). Nobody estimates profit.\n\n" +
      "## Expenses\nRent, utilities, salaries (posted from paid payrolls), marketing, packaging, courier charges and other costs are recorded with a category, the location they belong to, and a receipt. Recurring monthly costs can be set once.\n\n" +
      "## Profit by shop\nThe same rules split by location: sales from the goods each location sold, its own costs, its people (payroll by where each person works), then a share of HQ costs. The shop P&Ls add up exactly to the company P&L.\n\n" +
      "## Most profitable products\nProducts ranked by profit, not just sales. A best-seller with a thin margin may earn less than a quiet one.\n\n" +
      "> **Why:** we target a 45% gross margin. Knowing profit per product and per shop tells us what to buy more of, which shops to grow, and which to fix.",
  },
  {
    slug: "sys-budgets",
    section: "system",
    title: "Budgets: plan vs actual",
    summary: "Each location's sales, margin and cost targets, the pace for the month, and the forecast.",
    audience: ["accountant", "owner", "ops-manager", "shop-manager"],
    minutes: 3,
    version: 1,
    restricted: "finance",
    open: [{ label: "Budgets", href: "/admin/finance/budgets" }],
    related: ["sys-finance", "sys-scorecard-network"],
    body: `Each location gets a monthly **sales target**, **margin target** and **cost budget**. Budgets can be filled from last year's actuals and adjusted (for example, up for Dashain).

For the month in progress, the page shows where each location should be by today (**pace**), where it actually is, and a **forecast** for month end. Each shop's target shows on its staff's Today page, so the whole team knows the number.

> **Why:** a target nobody sees isn't a target. Showing it on Today every day turns a budget into something the team works toward.`,
  },
  {
    slug: "sys-bank-close",
    section: "system",
    title: "Bank statements and month-end close",
    summary: "Importing bank statements, automatic matching, explaining the rest, and locking closed months.",
    audience: ["accountant", "owner"],
    minutes: 5,
    version: 1,
    restricted: "finance",
    open: [{ label: "Bank", href: "/admin/finance/bank" }, { label: "Month-end close", href: "/admin/finance/close" }],
    related: ["sys-cash", "sys-cod", "sys-payables", "sys-vat-year"],
    body: `## Bank statements
Import each bank account's statement (CSV from internet banking). The system matches:
- **money in** to shop cash deposits and courier COD remittances;
- **money out** to supplier payments, expenses, TDS and SSF deposits and VAT payments.

Whatever doesn't match goes into the **explain-the-rest** queue. Each line gets explained (an expense, a transfer between our accounts, bank charges) until nothing is left.

## Month-end close
Close each finished month once its books are complete. The close checklist shows what's missing: unmatched bank lines, deposits not checked, days not locked, bills not recorded. When everything is done, close the month.

A **closed month is locked in the database**: no expense, supplier bill or payment dated in it can be added, changed or voided. Corrections go into the current month.

> **Why:** books that can change after they're reported can't be trusted by banks, investors or the tax office. Closing and locking each month is how a real company runs.`,
  },
  {
    slug: "sys-vat-year",
    section: "system",
    title: "VAT returns, accounting export and the fiscal year close",
    summary: "Monthly VAT returns per Nepali month, registers for the accountant, and signing off the year.",
    audience: ["accountant", "owner"],
    minutes: 7,
    version: 2,
    restricted: "finance",
    open: [{ label: "Tax invoices", href: "/admin/finance/invoices" }, { label: "VAT", href: "/admin/finance/vat" }, { label: "Accounting export", href: "/admin/finance/export" }, { label: "Fiscal year", href: "/admin/finance/year" }],
    related: ["sys-bank-close", "sys-payroll"],
    body: `## Tax invoices and credit notes
Every sale has a **tax invoice** in the IRD format: till sales at once, online orders when they're delivered or collected. Numbers run without gaps per **fiscal year** (Shrawan to Asar) and **series**: each shop's code, and WEB for online orders. Credit notes (CN-…) have their own series. Issued documents can't be changed or deleted, even in the database; a return or refund is a credit note against the invoice. Reprints say "Copy of original (n)" and are in the activity log.

[Tax invoices](/admin/finance/invoices) lists every invoice and credit note with BS and AD dates, prints, and its state in the IRD's **CBMS** (central billing monitoring). Sending to CBMS is **off** until the IRD approves our software and the owner adds the taxpayer login to the server settings; until then documents wait and are sent once it's on.

## VAT returns
One return per Nepali month: **output VAT** on tax invoices (less credit notes), minus **input VAT** on supplier bills **with a PAN**, less any credit carried from the last return. Returns are filed in order, and filing locks the period. The VAT payment is matched from the bank. Every price and delivery fee includes 13% VAT; the system splits it out per document.

## Accounting export
Registers for any period for the accountant: sales (one row per tax invoice, with the buyer's PAN), returns (one row per credit note, with its invoice), purchases, expenses, the VAT summary. Sales from before tax invoices started keep their order numbers. Amounts in rupees with dates in both calendars. Online orders not yet delivered aren't invoiced yet: the export shows them, as the timing difference with the P&L.

## Fiscal year close
The year runs Shrawan to Ashadh. Sign off a year once every month in it is closed, VAT is filed for every day, payroll TDS and SSF are deposited, and the bank is fully explained. The checklist blocks the close until all of that is true, and produces the **auditor's pack**.

> **Note:** the business PAN must be set before invoices are valid (they print "PAN/VAT No.: not set" until then), and the accountant still has open questions to answer on abbreviated invoices, the CBMS threshold and invoice timing (developer docs: Tax-Invoices).`,
  },
  {
    slug: "sys-payables",
    section: "system",
    title: "Payables: supplier bills, payments and credit notes",
    summary: "What we owe suppliers and when, paying the oldest bills first, and supplier credits.",
    audience: ["accountant", "owner", "buyer"],
    minutes: 4,
    version: 1,
    open: [{ label: "Payables", href: "/admin/payables" }],
    related: ["sys-purchasing", "sys-damaged", "sys-bank-close"],
    body: `Payables shows **what we owe each supplier** and when it's due, with **Overdue** bills on Needs attention.

- **Record a bill**: as supplier bills arrive (bills from receiving and from workshops are recorded automatically). Include the supplier's PAN and invoice number to claim input VAT.
- **Record a payment** (the owner records payments): payments are allocated to the **oldest bills first**; anything extra is kept as supplier credit. Payments are matched to the bank statement.
- **Record a credit note**: when a supplier reduces what we owe (returned goods, damaged goods, price corrections). It settles bills or stays as credit, gives back the input VAT, and damaged-goods credits come off the cost of goods.

> **Why:** paying suppliers on time, and never twice, builds the supplier relationships that get us the best fabric and terms.`,
  },
  {
    slug: "sys-payroll",
    section: "system",
    title: "Payroll, commission, TDS and SSF",
    summary: "Monthly salaries from pay terms and the timesheet, tax and social security, commission, payslips.",
    audience: ["accountant", "owner"],
    minutes: 7,
    version: 1,
    restricted: "payroll",
    open: [{ label: "Payroll", href: "/admin/payroll" }, { label: "Pay terms", href: "/admin/payroll/staff" }, { label: "Tax bands", href: "/admin/payroll/tax" }, { label: "Commission", href: "/admin/payroll/commissions" }, { label: "TDS and SSF", href: "/admin/payroll/statutory" }],
    related: ["sys-people", "sys-vat-year"],
    body: `## Setting up
- **Pay terms** for each person: monthly basic salary and fixed allowances. SSF is 11% (employee) and 20% (employer) of basic.
- **Tax bands** for each fiscal year (salary TDS). Payroll won't run for a year until someone confirms its bands, and any edit needs confirming again. Married people can use the couple's bands.
- **Commission rules** per shop: till staff earn a percentage of what they sell (excluding VAT, less refunds given this month) once the shop's monthly target is reached.

## A month's payroll
1. Make sure People is right for the month: every missed shift decided, entries fixed.
2. Create the payroll for the month. Each person's line shows days worked, unpaid days, basic and allowances, commission, bonus, gross, SSF, TDS, net pay and the cost to the company.
3. Check it, then **approve**. (Reopen if something's wrong.)
4. Pay salaries, then mark it **paid**. Paid payrolls post salaries to the P&L.
5. **Download CSV** for the bank or the register. Each person sees their **payslip** on My time.

## TDS and SSF deposits
TDS and SSF deposits shows what each paid payroll owes the IRD (salary TDS) and the Social Security Fund, when it's due, and when it was deposited. Deposits are matched from the bank. The annual salary TDS by employee is ready for e-TDS filing.

## Year end
The year-end check settles each person's tax for the year: Ashadh's (July's) TDS makes the year add up, and over-deductions are shown as refundable. It can be checked any time during the year.

> **Rule:** payroll is owner-only (plus the accountant's job). Salaries are private: never discuss another person's pay.`,
  },
  {
    slug: "sys-activity",
    section: "system",
    title: "Activity log",
    summary: "The permanent record of every change and every staff sign-in.",
    audience: ["owner", "accountant"],
    minutes: 2,
    version: 1,
    restricted: "audit",
    open: [{ label: "Activity log", href: "/admin/activity" }],
    related: ["how-we-run", "owner-access-security"],
    body: `Every change your team makes (prices, stock, orders, refunds, approvals, access, settings) and every sign-in to a staff account is recorded with who, what, when and the before-and-after. **Entries can't be edited or deleted**, by anyone.

Filter by person, level, date or search for an order number, product or word. Use it to answer "who changed this price?", "who approved that refund?", or "who signed in at 11pm?".

> **Why:** an honest team has nothing to fear from a complete record. It protects people from false blame, and it's what auditors and investors expect.`,
  },
];
