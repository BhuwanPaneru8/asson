import type { HandbookPage } from "../types";

export const PROCEDURES: HandbookPage[] = [
  {
    slug: "operating-rhythm",
    section: "procedures",
    title: "The operating rhythm: daily, weekly, monthly, yearly",
    summary: "What happens when, for every job: the routine that keeps every location running the same way.",
    audience: "all",
    minutes: 7,
    version: 1,
    related: ["owner-rhythm", "sys-today", "sop-open-shop", "sop-close-day"],
    body: `A world-class operation runs on rhythm. Everyone knows what they do every day, week and month, and the system shows when something is missed.

## Every day
| Who | When | What |
|---|---|---|
| Everyone | Start | Clock in. Open Today: HQ messages, checklists, your shifts, training. |
| Cashier | Opening | Count the float, open your shift, opening checklist, pickups ready, sale tags. |
| Cashier | All day | Sell by scan, ask every customer's mobile, take pickups, log customer problems as care cases. |
| Cashier | Closing | Count the drawer twice, close your shift with the real count, closing checklist. |
| Shop manager | Closing | Check Daily closing, approve what's due, count the safe when due, lock the day. |
| Warehouse | Morning | Confirmed orders: start waves (express first), pick, pack by scan. |
| Warehouse | Courier time | Scan parcels onto each courier's manifest, rider counts, sign. |
| Warehouse | All day | Receive transfers and returned parcels, put away, record failed attempts. |
| Care | All day | Work the queue: urgent and overdue first; confirmation calls for COD. |
| Managers / HQ | Morning and afternoon | Work Needs attention down to empty. |
| Everyone | End | Clock out. |

## Every week
| Who | What |
|---|---|
| Shop manager | Publish next week's roster (by Thursday). Cycle count fast sellers. Count the safe and bank cash. Review open issues and visit fixes. |
| Ops manager | Review the Shop scorecard and Network. Plan store visits. Send VM briefs. Check replenishment drafts are sent. |
| Buyer | Insights: reorder signals, dead stock, demand radar. Draft purchase orders. Plan markdowns. |
| Accountant | Import bank statements, clear the explain-the-rest queue, chase COD remittances, record bills. |
| Care lead | Review case stats: response times, repeat problems, satisfaction. |
| Owner | Weekly review: sales vs target, margin, stock, cash, people, top problems. |

## Every month
| Who | When | What |
|---|---|---|
| Shop manager | Month start | Count the whole shop. Check budget vs actual. |
| People / managers | Month end | Decide every missed shift, fix entries, approve leave. |
| Accountant + owner | Early next month | Payroll: create, check, approve, pay, mark paid. TDS and SSF deposits. |
| Accountant | By the deadline | VAT return for the Nepali month. Month-end close and lock. |
| Owner | Month end | Profit by shop, budgets for next month, supplier payments plan. |

## Every year
- **Before Dashain and Tihar**: festival playbook (buying, staffing, markdowns, COD risk).
- **Ashadh (fiscal year end)**: full warehouse count, year-end tax settlement in payroll, fiscal year close and auditor's pack.
- **Shrawan**: confirm the new year's tax bands, set the year's budgets, review every procedure in Training.`,
    quiz: [
      { q: "Who locks the shop's day, and when?", options: ["The cashier, at month end", "The shop manager, at closing every day", "HQ, once a week"], answer: 1, why: "Daily closing is the manager's job, every day." },
      { q: "When should next week's roster be published?", options: ["On Sunday morning", "By Thursday", "Only when someone asks"], answer: 1, why: "Publishing by Thursday gives everyone time to plan and swap shifts." },
    ],
  },
  {
    slug: "sop-open-shop",
    section: "procedures",
    title: "Procedure: opening the shop",
    summary: "From unlocking the door to the first customer, in order.",
    audience: ["cashier", "shop-manager"],
    minutes: 3,
    version: 1,
    open: [{ label: "Today", href: "/admin/today" }, { label: "Point of sale", href: "/admin/pos" }],
    related: ["sop-till", "sys-pos"],
    body: `## Before the doors open (15 minutes before)
1. Unlock, switch off the alarm, lights and music on. Check for anything wrong (damage, leaks). Report problems in Issues straight away.
2. **Clock in** on My time at this shop.
3. Open **Today**: read every HQ message, especially those asking you to confirm. Tick the **opening checklist** as you go.
4. Count the cash float in the drawer. **Open your shift** with exactly that amount.
5. Test the scanner and the receipt printer with a quick scan.
6. **Pickups**: check orders ready for collection are behind the counter and easy to find.
7. If a sale starts today, put on the new **price tags** (Markdowns → the sale → Price tags).
8. Walk the floor: displays match the current VM brief, sizes in order, fitting rooms clean, no empty hangers.
9. Open the doors on time.

> **Rule:** never sell without an open shift, and never use someone else's login or shift.`,
    quiz: [
      { q: "The float you count is Rs. 50 less than yesterday's closing note. What opening cash do you enter?", options: ["Yesterday's figure", "Exactly what you counted, and tell your manager", "Round it up"], answer: 1, why: "The shift starts from the real count. The manager looks into the difference." },
    ],
  },
  {
    slug: "sop-till",
    section: "procedures",
    title: "Procedure: selling at the till",
    summary: "Every sale, every time: scan, customer, discount, payment, receipt.",
    audience: ["cashier", "shop-manager"],
    minutes: 4,
    version: 1,
    open: [{ label: "Point of sale", href: "/admin/pos" }],
    related: ["sys-pos", "sop-store-returns", "sop-pickups"],
    body: `## Every sale
1. Greet the customer. Scan every item (or search by name). Check the size and colour on screen match the item in your hand.
2. Ask: "May I have your mobile number for your points?" Type it in.
3. Discount only with a reason. Up to 5% you can give; above that a manager types their PIN (up to 15%), the owner above.
4. Take payment so it adds up exactly to the total. Cash: type what you received and give the change on screen. QR, card or bank: type the transaction reference **after** the payment shows as successful on the customer's phone or the terminal.
5. Print the receipt, hand it over with the bag. Thank them by name if you have it.

## If the size isn't here
Use **Order for a customer**: see where it's in stock, choose pickup here or delivery, pay now or when collecting. Never send a customer away without offering this.

## If something goes wrong
- **Scanner won't read a barcode**: search by name or SKU; report a damaged label to your manager.
- **Customer changes their mind before paying**: remove the item.
- **Wrong sale completed**: call your manager for a return. Never ring a "negative" sale yourself.
- **Payment failed but customer says it went through**: don't complete until you see the confirmation. If in doubt, your manager checks.

> **Rule:** never take money without ringing it up. Never accept a QR payment screenshot as proof; check the confirmation. Never give a discount without a reason.`,
    quiz: [
      { q: "A customer shows a screenshot of a Fonepay payment. Is that enough?", options: ["Yes, screenshots are proof", "No: confirm the payment arrived (merchant app or terminal) before completing", "Only for small amounts"], answer: 1, why: "Screenshots can be faked or reused. Only a confirmed payment counts." },
      { q: "The customer wants a size you don't have. What do you do?", options: ["Say it's sold out", "Use Order for a customer to get it from another location", "Tell them to check the website"], answer: 1, why: "Order for a customer keeps the sale: pickup here later or delivery." },
    ],
  },
  {
    slug: "sop-close-day",
    section: "procedures",
    title: "Procedure: closing the till and the day",
    summary: "Counting the drawer, closing shifts, the safe, and locking the day.",
    audience: ["cashier", "shop-manager"],
    minutes: 4,
    version: 1,
    open: [{ label: "Daily closing", href: "/admin/closing" }, { label: "Cash", href: "/admin/cash" }],
    related: ["sys-closing", "sys-cash", "sop-cash-bank"],
    body: `## Cashier: closing your shift
1. Finish the last sale. No more sales on this shift.
2. Count the drawer **twice**, note by note. If the two counts differ, count a third time.
3. **Close shift**: type the counted cash. If it doesn't match Expected in drawer, write what happened in the note. Don't adjust the cash to make it match.
4. Hand the drawer cash to the manager (or put it in the safe as your shop's procedure says). Leave the float for tomorrow if that's your shop's way, and say how much.
5. Closing checklist on Today. Clock out.

## Manager: closing the day
1. Check every shift is closed.
2. Open **Daily closing**: sales, discounts, returns, payments by method, cash differences, stock movements.
3. Look for anything odd: a large discount, a refund without a return, a difference without a note. Ask now, while people remember.
4. Approve what's waiting (counts, returns).
5. **Lock the day.**
6. Safe: put the day's cash in. Count the safe when it's due (at least every few days), and bank it.
7. Security: lock up, alarm on.

> **Rule:** a difference is not a disaster; hiding one is. Always record the real count.`,
    quiz: [
      { q: "Your two drawer counts are different. What next?", options: ["Average them", "Count a third time", "Type the higher one"], answer: 1, why: "Count again until you're sure. The real count is what you record." },
    ],
  },
  {
    slug: "sop-store-returns",
    section: "procedures",
    title: "Procedure: returns and exchanges at the till",
    summary: "Checking the item, choosing the condition, the manager's PIN, and how the money goes back.",
    audience: ["cashier", "shop-manager"],
    minutes: 3,
    version: 1,
    related: ["sys-pos", "sys-damaged", "shop-policies"],
    body: `1. Find the sale (receipt number or phone). Online orders can be returned at a shop too: find by order number.
2. Check the policy: within 7 days, unworn, unwashed, unaltered, tags on. Innerwear, socks and altered items only if faulty. Outside policy: call your manager before saying no.
3. Look at each item and choose its condition:
   - **RESELLABLE**: perfect, back on sale.
   - **DAMAGED**: worn, marked, broken or faulty. It goes to the damaged register by itself. Put it in the damaged box, never on the shelf.
4. Choose the reason: size too small or large, colour, quality / defect, changed mind.
5. A manager types their PIN to approve.
6. **Refund as**: the original method (cash from the drawer, card, wallet) or **store credit**.
7. Give the customer the return receipt.

## Size swap
Return the item as **store credit**, then sell the new size and pay with that credit. Both sides are recorded correctly.

> **Why:** the condition decides where the item goes. A damaged item put back on the shelf will be sold to the next customer and come back again.`,
  },
  {
    slug: "sop-pickups",
    section: "procedures",
    title: "Procedure: click-and-collect pickups",
    summary: "Receiving orders for collection, keeping them ready, and handing over.",
    audience: ["cashier", "shop-manager"],
    minutes: 2,
    version: 1,
    related: ["sys-pos", "sys-orders"],
    body: `1. When a pickup order arrives at the shop (from the warehouse or another shop), check it against the order and put it in the pickup shelf, labelled with the order number.
2. The customer gets an SMS when it's ready.
3. When they come: **Pickups** on the till, find by order number or phone. Check their name and phone match.
4. Take payment if it's due ("Pay when collecting").
5. **Hand over**. The order is marked collected and the money is in your shift.
6. Orders not collected after the holding time: tell your manager; care contacts the customer.`,
  },
  {
    slug: "sop-confirm-orders",
    section: "procedures",
    title: "Procedure: confirming online orders and COD calls",
    summary: "Checking orders are real before we pick them, and handling risky COD orders.",
    audience: ["care", "warehouse", "ops-manager"],
    minutes: 3,
    version: 1,
    open: [{ label: "Orders", href: "/admin/orders" }],
    related: ["sys-orders", "sys-care"],
    body: `1. Open Orders → To confirm. Oldest first; express first.
2. Orders on the **confirmation-call queue** (high value, a customer with past refusals, a district with many returns) get a call. The **COD risk rating** shows why.
3. On the call: confirm the name, the items and sizes, the full address with a landmark, the total to pay in cash, and a good time for delivery.
4. Confirmed: **Confirm** the order. It goes to picking.
5. Wants a change: change the order now (size, items, address) rather than cancelling.
6. No answer: try twice more at different times, then send an SMS. Still nothing after a day: cancel with the reason "Unreachable".
7. Clearly fake or the customer cancels: cancel with the reason.

> **Why:** every refused parcel costs two delivery fees and ties up stock for a week. Confirming risky COD orders keeps refusals under 5%.`,
  },
  {
    slug: "sop-pick-pack",
    section: "procedures",
    title: "Procedure: picking and packing online orders",
    summary: "Waves, slots, scanning every item, and a parcel that represents the brand.",
    audience: ["warehouse", "ops-manager"],
    minutes: 4,
    version: 1,
    open: [{ label: "Fulfilment", href: "/admin/fulfilment" }],
    related: ["sys-fulfilment", "sys-bins-picking", "sop-courier-handover"],
    body: `## Picking
1. **Start a wave** (Fulfilment). Express orders come first.
2. Take a trolley with numbered slots. Walk the bins in the order on the list; put each item in its order's slot.
3. Can't find an item: check the neighbouring bins, then tell your manager. Never take a different size "for now".
4. When every item is in, press **Everything is picked**.

## Packing
1. At the packing station, scan the order's slip, then scan **every** item. A refused item isn't in the order: put it back and find the right one.
2. Check each item: no marks, tags on, correct size label.
3. Fold neatly, tissue paper, invoice/slip, any insert (thank-you card). The parcel should look like Asson: clean and careful.
4. Pack only when the screen says everything matches. A barcode that won't scan: a manager packs with an override and a reason.
5. Weigh, choose the box, stick the shipping label straight and flat.
6. Exchange parcels say **collect old item**: mark the parcel and tell the rider.

> **Rule:** never pack without scanning. Never pack a damaged item. Never write on a customer's product.`,
    quiz: [
      { q: "Bin A-03-2 is empty but the list says 1 medium is there. What do you do?", options: ["Take a large instead", "Check the neighbouring bins, then tell your manager", "Skip the order and say nothing"], answer: 1, why: "Never substitute. Check nearby, then tell the manager so stock can be counted." },
    ],
  },
  {
    slug: "sop-courier-handover",
    section: "procedures",
    title: "Procedure: handing parcels to couriers",
    summary: "The manifest, the rider's count, and the signed copy.",
    audience: ["warehouse", "ops-manager"],
    minutes: 2,
    version: 1,
    related: ["sys-fulfilment", "sop-failed-deliveries"],
    body: `1. Open the courier's manifest (Fulfilment → scan parcels for this courier).
2. Scan each parcel's slip and its tracking number. Don't type tracking numbers from memory.
3. Ask the rider to count the parcels. Their count must match the manifest. If not, find the difference before handing over.
4. Ship the manifest: every order on it ships at once and customers get their SMS with tracking.
5. Print the manifest (with the COD total) and have the rider sign it. File the signed copy.

> **Rule:** no parcel leaves without being on a signed manifest.`,
  },
  {
    slug: "sop-failed-deliveries",
    section: "procedures",
    title: "Procedure: failed deliveries and returned parcels",
    summary: "Recording attempts, receiving returns to origin, and claiming lost parcels.",
    audience: ["warehouse", "care", "ops-manager"],
    minutes: 3,
    version: 1,
    open: [{ label: "Deliveries", href: "/admin/fulfilment/deliveries" }],
    related: ["sys-fulfilment", "sys-damaged"],
    body: `## A failed attempt
1. Record each attempt the courier reports on Deliveries, with the reason (not reachable, refused, wrong address, rescheduled). The customer gets an SMS.
2. Care calls the customer for anything fixable (address, timing).
3. Parcels stuck with a courier longer than usual are listed oldest first: chase the courier.

## A parcel comes back
1. **Receive a returned parcel** at whichever location it arrives.
2. Open it, check every item: perfect items go back to stock; damaged ones are recorded as damaged.
3. If the courier lost it, record it as lost and claim it from the courier.

> **Why:** a returned parcel is our stock. Received quickly, it's on sale again the same day.`,
  },
  {
    slug: "sop-receiving",
    section: "procedures",
    title: "Procedure: receiving stock from suppliers",
    summary: "Counting against the purchase order, quality checks, shortages and putaway.",
    audience: ["warehouse", "buyer", "ops-manager"],
    minutes: 3,
    version: 1,
    open: [{ label: "Purchasing", href: "/admin/purchasing" }],
    related: ["sys-purchasing", "sys-bins-picking", "sys-damaged"],
    body: `1. Find the purchase order. No PO? Don't receive: call the buyer.
2. Count every carton and every piece against the PO **before signing** the supplier's delivery paper.
3. Quality check a sample from each carton: stitching, fabric, colour against the approved sample, size labels, measurements.
4. Record in Purchasing: quantities received, **shortfalls**, and **damaged** pieces.
5. Record the supplier's bill number (with their PAN) if the bill came with the goods.
6. Sign the supplier's paper noting any shortages and damage.
7. Put away using the **putaway list** (bin order). Items without a bin get one.

> **Rule:** stock goes up by what was counted, never by what the invoice says.`,
  },
  {
    slug: "sop-transfers",
    section: "procedures",
    title: "Procedure: sending and receiving transfers",
    summary: "Scanning boxes out and counting them in, so stock is never lost between locations.",
    audience: ["warehouse", "shop-manager", "cashier", "ops-manager"],
    minutes: 3,
    version: 1,
    open: [{ label: "Transfers", href: "/admin/transfers" }],
    related: ["sys-transfers"],
    body: `## Sending
1. Open the transfer (or a replenishment draft). Pick each item and **scan** it into the box.
2. Label the box with the transfer number and destination. Seal it.
3. **Send**: stock leaves your location now.

## Receiving
1. When the box arrives, open the transfer and scan every item you actually received.
2. Missing or extra items are recorded automatically as differences. Damaged items: record them.
3. Complete the receipt. Stock arrives at your location as counted.
4. Put the stock out (shop) or put it away (warehouse).

> **Rule:** never receive a transfer without opening the box and scanning. "Received as sent" without counting hides losses.`,
  },
  {
    slug: "sop-stock-count",
    section: "procedures",
    title: "Procedure: counting stock",
    summary: "How to do a blind count properly, and what a manager does with the differences.",
    audience: ["cashier", "warehouse", "shop-manager", "ops-manager"],
    minutes: 3,
    version: 1,
    open: [{ label: "Stock counts", href: "/admin/counts" }],
    related: ["sys-counts", "sys-inventory"],
    body: `## Counting
1. Open the count assigned to you. Follow the sheet in its order (bin or shelf order).
2. Count every piece, including the back room, fitting rooms and the window. Scan or type what you see.
3. You won't see what the system expects. That's on purpose: count what's there.
4. Two people for high-value or big areas: one counts, one records, then swap for a check.
5. Submit when done.

## Manager
1. Review the differences and their value.
2. Recount anything large or surprising.
3. Approve. Stock becomes what was counted.
4. Look for patterns: the same items going missing, one area always wrong. Act on them.`,
  },
  {
    slug: "sop-damaged",
    section: "procedures",
    title: "Procedure: damaged stock",
    summary: "Taking damaged items off sale and deciding what happens to them.",
    audience: ["shop-manager", "warehouse", "ops-manager", "buyer"],
    minutes: 2,
    version: 1,
    related: ["sys-damaged", "sys-payables"],
    body: `1. Damaged item found (on the shelf, in a delivery, a return): take it off sale. Record it as damaged (Inventory, or the return flow does it automatically).
2. Keep damaged items in the labelled damaged box, never on the floor.
3. Each week, the manager decides each one in Damaged stock: **repaired** (back on sale), **written off** (with the reason), or **back to the supplier** (we expect a credit).
4. Supplier credits are tracked until the credit note arrives in Payables.`,
  },
  {
    slug: "sop-care-cases",
    section: "procedures",
    title: "Procedure: handling a customer case",
    summary: "From first contact to resolved: tone, deadlines, what to promise, and notes.",
    audience: ["care", "shop-manager", "cashier", "ops-manager"],
    minutes: 4,
    version: 1,
    open: [{ label: "Customer care", href: "/admin/care" }],
    related: ["sys-care", "sop-online-changes", "conduct"],
    body: `1. Every contact becomes a case: website form cases arrive by themselves; for calls, WhatsApp, social media or shop visits, **Log a case** with the order number.
2. Read the order history before replying. Know what happened.
3. Reply before the deadline. Urgent cases (wrong item, not delivered, payment problem) first.
4. Be warm, clear and specific: what happened, what we'll do, and **when**. Never blame the customer, the courier or a colleague.
5. Fix what you can directly: change or cancel an order, arrange an exchange, send a reset link.
6. Refunds and exceptions to policy: ask your manager, note their decision in the case.
7. Write what you promised in an internal note.
8. Resolve the case only when the customer's problem is actually solved.

## Tone
| Instead of | Say |
|---|---|
| "That's not our fault." | "I'm sorry this happened. Here's what I'll do." |
| "You should have read the policy." | "Our policy is 7 days, but let me see what I can do." |
| "I don't know." | "Let me find out and reply by 4 pm today." |

> **Why:** a customer whose problem is solved fast often becomes more loyal than one who never had a problem.`,
    quiz: [
      { q: "A customer's parcel is 3 days late. Which reply is best?", options: ["The courier is slow, not us.", "I'm sorry. I've chased the courier; you'll hear from me by 5 pm today with a delivery date.", "Please wait."], answer: 1, why: "Own it, act, and give a specific time. Never blame others." },
    ],
  },
  {
    slug: "sop-online-changes",
    section: "procedures",
    title: "Procedure: changing, cancelling and exchanging online orders",
    summary: "What to do when a customer wants something different, at each stage of their order.",
    audience: ["care", "warehouse", "ops-manager"],
    minutes: 3,
    version: 1,
    related: ["sys-orders", "shop-account", "sys-fulfilment"],
    body: `| Stage | Customer wants | Do this |
|---|---|---|
| Before packing | Different size, fewer items, new address | Change the order (admin order page, or they can on their order page). |
| Before packing | To cancel | Cancel with the reason. Stock is released, points refunded. |
| Packed, not shipped | Any change | Ask the warehouse to stop it, then change or cancel. |
| Shipped | To cancel | Can't cancel: it becomes a refusal. Explain kindly; offer an exchange or return after delivery. |
| Delivered, within 7 days | Different size | **Exchange**: free new size, rider collects the old one. |
| Delivered, within 7 days | Doesn't want it | Return: pickup arranged or at a shop; refund in 3–5 working days after it reaches us. |
| Delivered | Faulty or wrong item | Apologise. Replace or full refund including delivery; collect free. Photo in the case. |

> **Tip:** an exchange keeps the sale and the customer. Offer it first for any size problem.`,
  },
  {
    slug: "sop-time-leave",
    section: "procedures",
    title: "Procedure: clocking in, leave and shift swaps",
    summary: "Your hours, asking for time off, swapping shifts, and what managers do.",
    audience: "all",
    minutes: 3,
    version: 1,
    related: ["sys-my-time", "sys-people", "sys-rosters"],
    body: `## Everyone
1. Clock in at the start of every shift, at the location you're at. Clock out when you leave.
2. Forgot? Tell your manager the same day.
3. Leave: ask on My time as early as you can (planned leave at least a week ahead). Sick leave: call your manager before your shift, then request it.
4. Can't work a shift: offer it as a **swap** to a colleague; they accept, your manager approves. Until approved, it's still your shift.

## Managers
1. Approve or decline leave within 2 days. Check the roster still has the minimum staff.
2. Fix forgotten clock-outs and wrong entries with a reason.
3. Decide every missed shift before payroll: unpaid, leave or worked.
4. Approve swaps only if the new person can work it (the system re-checks hours and rest).`,
  },
  {
    slug: "sop-issues",
    section: "procedures",
    title: "Procedure: reporting and fixing issues",
    summary: "When something's broken or unsafe: report it, follow it, close it.",
    audience: "all",
    minutes: 2,
    version: 1,
    open: [{ label: "Issues", href: "/admin/issues" }],
    related: ["sys-issues", "owner-incidents"],
    body: `1. **Safety first**: if anyone could be hurt (fire, electric, theft in progress), make it safe and call for help before anything else. Then call your manager.
2. Report it in Issues: clear title, category, priority, photos, and what you've done so far.
3. **Urgent**: stops selling or is unsafe (till down, no internet, broken shutter, leak on stock). Call your manager as well.
4. Follow it on Today. Add information when you have it.
5. Whoever fixes it records what was done and the cost, then marks it resolved.`,
  },
  {
    slug: "sop-vm-visits",
    section: "procedures",
    title: "Procedure: display briefs and store visits",
    summary: "Doing a VM brief right first time, and preparing for and following up a visit.",
    audience: ["shop-manager", "ops-manager", "cashier"],
    minutes: 3,
    version: 1,
    related: ["sys-vm-visits"],
    body: `## A display brief
1. Read the brief and the reference photos on Today.
2. Set the display exactly as briefed, by the deadline.
3. Take the photos asked for: straight, well lit, the whole display, no people or boxes in the shot.
4. Send them. If HQ asks for a redo, fix exactly what the comment says and send again.

## A store visit
1. Every day should be visit-ready: checklists done, floor clean, sizes in order, displays as briefed.
2. During the visit, walk with the visitor and note every finding.
3. **Acknowledge** the visit, then do every fix before its deadline, with a photo.
4. The visitor verifies the fixes.`,
  },
  {
    slug: "sop-cash-bank",
    section: "procedures",
    title: "Procedure: the safe, bank deposits and petty cash",
    summary: "Keeping each location's cash book exact, from safe counts to the bank.",
    audience: ["shop-manager", "accountant", "ops-manager"],
    minutes: 3,
    version: 1,
    open: [{ label: "Cash", href: "/admin/cash" }],
    related: ["sys-cash", "sys-bank-close"],
    body: `1. The safe holds only shop cash. Nothing personal, no "borrowing", ever.
2. **Count the safe** at least every few days and whenever the manager changes: Cash → count, type the counted amount.
3. **Bank** cash regularly (daily for busy shops). Two people where possible. Record the deposit: amount, date, slip number, photo of the slip.
4. The deposit stays "to check" until the bank statement matches it. If it doesn't match, the accountant asks within a day.
5. **Petty cash**: small shop costs only, with a receipt photo and description. Anything bigger goes through Finance.

> **Rule:** cash leaves a safe only as a recorded deposit or a recorded petty spend.`,
  },
  {
    slug: "sop-security",
    section: "procedures",
    title: "Procedure: accounts, passwords and customer data",
    summary: "Keeping logins, PINs and customers' personal information safe.",
    audience: "all",
    minutes: 4,
    version: 1,
    related: ["how-we-run", "conduct", "owner-access-security"],
    body: `## Your login and PIN
- Use a strong password you don't use anywhere else (12+ characters). Never write it on the till.
- Never share your password or approval PIN. Never use someone else's login.
- Lock or sign out of a shared device when you step away.
- If you think someone knows your password or PIN, change it and tell your manager straight away.

## Scams
- Asson will **never** ask for your password, PIN or a one-time code by phone, SMS, WhatsApp or email. Anyone who does is a scammer.
- Don't click links in unexpected messages "from Asson" or "from the bank". Go to the site yourself.

## Customer data
- Look up a customer only to serve that customer.
- Never copy customer lists, phone numbers or addresses to your phone, WhatsApp or anywhere outside the system.
- Never share a customer's details with anyone except the customer (check who you're talking to).
- Never post customers, orders or screens on social media.

> **Rule:** misuse of customer data is serious misconduct. It breaks the law and our promise to customers.`,
    quiz: [
      { q: "Someone calls saying they're from HQ IT and need your one-time code. What do you do?", options: ["Give it, they're from HQ", "Refuse and tell your manager: Asson never asks for codes", "Give an old code"], answer: 1, why: "Nobody genuine ever asks for your password, PIN or code." },
      { q: "Can you save a customer's number to your phone to message them about a new arrival?", options: ["Yes, if they're a regular", "No: customer data stays in the system", "Only on WhatsApp Business"], answer: 1, why: "Customer data never leaves the system. Marketing goes through the company's channels." },
    ],
  },
];
