import type { HandbookPage } from "../types";

export const SYSTEM_TEAM: HandbookPage[] = [
  {
    slug: "sys-my-time",
    section: "system",
    title: "My time: clocking in, leave, payslips and your sales",
    summary: "Your own page: clock in and out, ask for leave, see missed shifts, payslips and commission.",
    audience: "all",
    minutes: 4,
    version: 1,
    open: [{ label: "My time", href: "/admin/time" }],
    related: ["sop-time-leave", "sys-rosters", "sys-payroll"],
    body: `My time is yours alone. Everything on it feeds payroll, so keep it right.

## Clocking in and out
**Clock in** when you start work, at the location you're working at, and **clock out** when you finish (including going home early). You can only have one open clock-in at a time. If you forget to clock out, the system closes it automatically at a set time and a manager reviews it.

## Leave
Ask for leave from My time: type of leave, first day, last day and a reason. Your balances (from the Labour Act rules) are shown. Your manager approves or declines, and you get an SMS. Leave on your weekly day off (Saturday) counts as 0 days.

## Missed shifts
If you were on the published roster but didn't clock in, it shows as a missed shift. Your manager decides: worked (you forgot to clock in), leave, or unpaid. Tell your manager the same day if you forgot.

## Payslips and sales
**My payslips** has every month's payslip. Till staff also see **My sales this month** and the commission it's earning once the shop reaches its target.

> **Rule:** never clock in or out for someone else, and never ask anyone to do it for you. It's recorded as you, and it changes their pay.`,
    quiz: [
      { q: "You forgot to clock in this morning but worked the whole shift. What should you do?", options: ["Nothing, it'll sort itself out", "Tell your manager the same day so they can mark it worked", "Ask a colleague to clock you in"], answer: 1, why: "A missed shift is decided by your manager. Telling them quickly makes sure you're paid correctly." },
    ],
  },
  {
    slug: "sys-people",
    section: "system",
    title: "People: attendance, leave and the monthly record",
    summary: "For managers: who's working, leave to approve, entries to fix, missed shifts to decide.",
    audience: ["shop-manager", "ops-manager", "owner", "accountant"],
    minutes: 5,
    version: 1,
    open: [{ label: "People", href: "/admin/people" }, { label: "Missed shifts", href: "/admin/people/absences" }],
    related: ["sys-rosters", "sys-payroll", "sop-time-leave"],
    body: `People is the record payroll is built on, for the locations you manage.

- **Who's working now**: everyone clocked in, where and since when.
- **Leave waiting for you**: approve or decline. Balances are checked against Labour Act rules.
- **Entries to fix**: forgotten clock-outs closed automatically, impossible hours. Correct them with a reason.
- **Each person's month**: days worked, hours, leave days. This is what payroll uses.
- **Missed shifts**: published shifts nobody clocked in for. Decide each one: **unpaid** (a day's pay comes off that month), **taken as leave**, or **worked** (they forgot to clock in). Payroll waits until every one is decided.

> **Why:** pay mistakes destroy trust fast. A correct record each day means payroll is right the first time, and people trust it.`,
  },
  {
    slug: "sys-rosters",
    section: "system",
    title: "Rosters and shift swaps",
    summary: "Planning each week's shifts with Labour Act and minimum-staff checks, publishing, and swaps.",
    audience: ["shop-manager", "ops-manager", "owner", "cashier", "warehouse"],
    minutes: 5,
    version: 1,
    open: [{ label: "Rosters", href: "/admin/rosters" }],
    related: ["sys-people", "sys-my-time"],
    body: `## Planning a week
Rosters shows one location's week, Sunday to Saturday. Type shifts like **10-18** or **9:30-17:30**; leave a box empty for a day off. The planner checks as you type:
- impossible times are refused;
- **Labour Act limits** (hours per day and week, weekly rest);
- **minimum staff per day** for the shop (set on the page);
- people on approved leave, and people already working at another location that day;
- public holidays (from the holiday calendar).

**Copy last week** fills the week from the one before. **Publish to staff** makes it visible: each person sees their shifts on Today and My time. Changes after publishing are flagged so you publish again.

## Roster vs clock-ins
The last 14 days of shifts against real clock-ins: early, late, no-show, days short of staff. Missed shifts become absences to decide.

## Shift swaps
Staff can give a shift away or trade one: they choose a colleague, the colleague accepts, and a manager approves. The approval re-checks everything (hours, rest, leave) before the shift moves.`,
  },
  {
    slug: "sys-ops",
    section: "system",
    title: "Shop operations: announcements and checklists",
    summary: "How HQ tells every shop what matters and checks the daily routine is done.",
    audience: ["shop-manager", "ops-manager", "owner"],
    minutes: 4,
    version: 1,
    open: [{ label: "Shop operations", href: "/admin/ops" }],
    related: ["sys-today", "sys-scorecard-network"],
    body: `## Announcements
HQ sends an announcement to every location or chosen locations. It can ask people to **read and confirm**. Read receipts show who has read it, shop by shop. Use announcements for anything people must act on: price changes, a sale starting, a new rule, a recall.

## Checklists
Each location has daily checklists (opening, during the day, closing), set by HQ with **New checklist**. Staff tick items on Today; each day's checklist is saved as it was. The **compliance grid** shows every shop's checklists over recent days: what was done, late or missed.

> **Why:** a national chain runs on routine. The same checklist in every shop is how a customer gets the same experience in Ilam as in Kathmandu.`,
  },
  {
    slug: "sys-issues",
    section: "system",
    title: "Issues: getting things fixed",
    summary: "Reporting broken equipment, maintenance, IT and safety problems, and tracking the fix.",
    audience: "all",
    minutes: 3,
    version: 1,
    open: [{ label: "Issues", href: "/admin/issues" }],
    related: ["sop-issues"],
    body: `Anything broken or unsafe at a location is an **issue**: a dead barcode scanner, a leaking roof, a broken shutter, no internet, a frayed cable.

- **Report** it with a title, category (Equipment, Building, IT, Safety, Stock, Other), priority (Urgent, Normal, Low) and photos.
- Each priority has a **due time**. Overdue issues escalate to Needs attention.
- HQ assigns it to someone. The status timeline shows every step: assigned, in progress, waiting, fixed.
- The **repair cost** is recorded when fixed, and stats per location show how quickly things get fixed (median time to fix).

> **Tip:** report it even if you think someone already has. Two reports of the same problem are better than none.`,
  },
  {
    slug: "sys-vm-visits",
    section: "system",
    title: "Visual merchandising and store visits",
    summary: "Display briefs with photo checks, and scored store visits with fixes and deadlines.",
    audience: ["shop-manager", "ops-manager", "owner", "marketing"],
    minutes: 5,
    version: 1,
    open: [{ label: "Visual merchandising", href: "/admin/vm" }, { label: "Store visits", href: "/admin/visits" }],
    related: ["sop-vm-visits", "sys-scorecard-network"],
    body: `## Visual merchandising (VM)
HQ sends a **display brief**: what to show where, with reference photos and a deadline. Each shop sends photos of its display. HQ (or the shop's manager) scores each shot **0–2** and approves, or asks for a **redo** with a comment. A leaderboard shows which shops get it right first time.

## Store visits
An area or ops manager walks a shop with a **visit checklist** (cleanliness, stock on the floor, staff, till, safety, displays). Each item is scored; failures become **fixes** with a deadline and an owner at the shop. A critical failure becomes a fix immediately. The shop **acknowledges** the visit, does the fixes, and the visitor **verifies** them.

> **Why:** what gets checked gets done. Visits and VM briefs make standards visible and comparable across every shop.`,
  },
  {
    slug: "sys-scorecard-network",
    section: "system",
    title: "Network and shop scorecard",
    summary: "Comparing every location on sales, margin, stock and operations, with explainable scores.",
    audience: ["ops-manager", "owner", "buyer"],
    minutes: 5,
    version: 1,
    open: [{ label: "Network", href: "/admin/network" }, { label: "Shop scorecard", href: "/admin/scorecard" }],
    related: ["sys-insights", "sys-finance", "owner-rhythm"],
    body: `## Network
League tables for every location, district and province over a period: revenue, orders, average basket, margin, units sold, sell-through, stock at cost and stock cover, discounts given, and a cashier table (at the tills). Alerts flag locations far from the rest. Everything is scoped to the locations you can see.

## Shop scorecard
Every shop on one page with an **operations score**, made from checklists done, displays approved, issues open, the last visit's score, cash differences and more. The score is **explainable**: open a shop to see exactly which parts pulled it down, and the flags that need attention.

> **Why:** with dozens of shops, nobody can visit them all every week. The scorecard tells HQ where to go and what to fix, and lets good managers see they're doing well.`,
  },
  {
    slug: "sys-training",
    section: "system",
    title: "Training: procedures to sign",
    summary: "How procedures are written, signed per version, and tracked per person and shop.",
    audience: "all",
    minutes: 3,
    version: 1,
    open: [{ label: "Training", href: "/admin/training" }],
    related: ["using-the-handbook", "onboarding-new-joiner"],
    body: `Training holds the company's **standard operating procedures** (SOPs): the agreed way to do a task, written step by step.

- Each procedure says which levels must sign it (cashiers, fulfilment staff, managers, owner).
- You read it and **sign**: "I've read this and will follow it". Your signature is for that version.
- When HQ makes an important change, the **version goes up** and everyone signs again. A typo fix doesn't.
- Outstanding procedures show on your Today page.
- Managers see **who has signed what** at their locations. HQ writes and edits procedures (New procedure), and can load the starter set.

The Handbook explains how things work. Training is the short, signed version of what you must do.`,
  },
  {
    slug: "sys-team-access",
    section: "system",
    title: "Team & access (owner)",
    summary: "Adding people, giving them the right job and locations, and removing access when they leave.",
    audience: ["owner"],
    minutes: 6,
    version: 2,
    restricted: "team.manage",
    open: [{ label: "Team & access", href: "/admin/team" }],
    related: ["roles-and-access", "hiring-new-joiner-setup", "hiring-leaving"],
    body: `Team & access lists everyone who can sign in to the staff side: their level, job, locations, whether they've set an approval PIN, whether two-step sign-in is on, and whether their invite is still unused.

## Adding someone
**Add a team member**: name, email or mobile, level, job, and the locations they work at. They get a **one-time link** to set their own password. Nobody, including the owner, ever knows another person's password.

## Changing access
- **Job**: the set of screens they see. Choose the closest job.
- **Extra or removed permissions**: for this person only (for example, a cashier who also counts at the warehouse).
- **Works at**: the locations they can act at. Tills, stock moves, closing and counts only work at their own locations.
- Owner-only permissions (Team & access, System) can't be given to anyone else.

## Two-step sign-in
- **Managers and owners always need it.** A new manager sets it up straight after choosing their password from the invite link, before they see any staff page. Their row shows **Two-step required, not set up** until they do, then **Two-step on**.
- **Require two-step sign-in** (tick box on someone's row): for cashiers or staff you want to protect too, for example anyone who handles cash, refunds or customer data. It applies at their next click: they sign in again and set it up.
- **Reset two-step sign-in**: when someone lost their phone and their backup codes. Check it's really them first and write why. They're signed out on every device and set up a new app next time. You can't reset your own; another owner can, or use your backup codes.

## When someone leaves
Remove their access **the same day**: their sessions end immediately on every device, trusted devices stop working and their two-step sign-in is cleared. Their history stays in the activity log.

> **Rule:** one person, one login. Never create a shared "shop" login. Accountability depends on knowing who did what.`,
  },
  {
    slug: "sys-locations",
    section: "system",
    title: "Locations and opening a shop",
    summary: "Shops, warehouses and fulfilment centres, how online orders choose one, and opening a new shop.",
    audience: ["owner", "ops-manager"],
    minutes: 4,
    version: 1,
    open: [{ label: "Locations", href: "/admin/locations" }, { label: "Open a shop", href: "/admin/locations/new" }],
    related: ["owner-new-shop", "sys-transfers"],
    body: `Each location has a name, code, kind (shop, warehouse, fulfilment centre), **district and province**, whether it **ships online orders**, whether it's a **pickup point**, and a priority number.

Online orders are filled from: one location with the whole order first, then the same district, the same province, the nearest fulfilment centre, then the lowest priority number.

## Open a shop
One page creates a new shop in one go: details (district, pickup point, ships online), its **team** (existing people assigned to it), and its **opening stock** from a template, with a preview, sent as a transfer draft from the warehouse. The till, closing, cash book, checklists and roster work from day one. See the New shop playbook for the full 30-day plan.`,
  },
];
