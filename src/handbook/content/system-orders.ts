import type { HandbookPage } from "../types";

export const SYSTEM_ORDERS: HandbookPage[] = [
  {
    slug: "sys-orders",
    section: "system",
    title: "Online orders: from placed to delivered",
    summary: "The order lifecycle, what each status means, confirming COD orders, and changing or cancelling.",
    audience: ["warehouse", "care", "shop-manager", "ops-manager", "owner"],
    minutes: 7,
    version: 1,
    open: [{ label: "Orders", href: "/admin/orders" }],
    related: ["sop-confirm-orders", "sys-fulfilment", "sop-online-changes", "sys-care"],
    body: `Every online order moves through fixed steps. The system only allows the next valid step, records who moved it, and sends the customer an SMS at each important one.

## The statuses
| Status | Meaning | Who moves it |
|---|---|---|
| Placed (PENDING) | Customer ordered; stock is reserved | Care or fulfilment confirms it |
| Confirmed | We've checked it's real; ready to pick | Picked in a wave |
| Packed | Packed by scan, label printed | Handed to the courier on a manifest |
| Shipped | With the courier, tracking number recorded | Courier updates |
| Out for delivery | Rider has it today | Courier updates |
| Delivered | Customer received it; COD collected | Final |
| Returning (RTO) | Customer didn't accept; parcel coming back | Received at a location |
| Return requested / Returned | Customer is sending something back | Care and the warehouse |
| Cancelled | Stopped before shipping; stock released | Customer (before packing), care or a manager |

Click-and-collect orders use the same steps with different meaning: Packed = **ready at the shop**, Delivered = **collected**. They're handed over at the till, so the payment lands in a cash drawer.

## Confirming orders
Big COD orders and risky ones go on the **confirmation-call queue** with a **COD risk rating** from the customer's history (past refusals) and the district's return rate. Call, confirm the size, address and amount, then confirm the order. Fake or unreachable: cancel with the reason.

## Where an order is filled from
The system picks the location automatically: one location with the whole order first (one parcel), then the same district, then the same province, then the nearest fulfilment centre, then priority order. You don't choose by hand.

## Changing an order
Before packing, an order can be changed instead of cancelled: **size swap, fewer items, new address**. Stock and money follow exactly (a cheaper size reduces the COD amount). Customers can make these changes themselves on their order page; care staff can do it on the admin order page for phone customers. After delivery, a wrong size is an **exchange**: a free new order with the new size; the rider collects the old one.

## The order page
Shows everything about one order: items, customer, address, delivery (Standard or Express), payment (COD or Prepaid), discounts with reasons, points earned, SMS sent, the activity timeline and exchanges. Print the packing slip or label from here.

> **Rule:** never mark an order Delivered, Shipped or Packed by hand to "clean up" a list. Each status triggers SMS, stock and money effects. Use the real flow.`,
    quiz: [
      { q: "A customer calls before their order is packed: they want L instead of M. What's best?", options: ["Cancel and ask them to order again", "Change the size on the order (or they can do it on their order page)", "Pack M and exchange later"], answer: 1, why: "Before packing, change the order. Stock and money follow, and the customer doesn't lose their place." },
      { q: "For a click-and-collect order, what does Delivered mean?", options: ["The courier delivered it", "The customer collected it at the shop", "It's in transit"], answer: 1, why: "Pickup orders reuse the steps: Packed = ready at the shop, Delivered = collected." },
    ],
  },
  {
    slug: "sys-fulfilment",
    section: "system",
    title: "Fulfilment: waves, packing, couriers and returns",
    summary: "How the warehouse turns confirmed orders into parcels, hands them to couriers and handles what comes back.",
    audience: ["warehouse", "ops-manager", "owner"],
    minutes: 7,
    version: 1,
    open: [{ label: "Fulfilment", href: "/admin/fulfilment" }, { label: "Deliveries", href: "/admin/fulfilment/deliveries" }, { label: "Exchanges", href: "/admin/fulfilment/exchanges" }],
    related: ["sop-pick-pack", "sop-courier-handover", "sop-failed-deliveries", "sys-bins-picking"],
    body: `## Waves: picking many orders in one walk
**Start a wave** groups confirmed orders for your location. Express orders come first. The pick list is in **bin order** (walking order), and each order gets a numbered **slot**. You walk once, put each item in its slot, then press "Everything is picked". Small locations can use a **Single pick list** instead.

## Packing station: nothing wrong leaves
Scan the order's slip, then scan every item. The screen **refuses an item that isn't in the order**, so wrong sizes and colours don't go out. Pack only when everything matches. If a barcode is damaged, a manager can pack with an override and a reason (shown as "Packed with an override" so it can be reviewed). Print the shipping label (100 × 150 mm, with the order barcode and the COD amount).

## Handing over to couriers: the manifest
When a rider comes, open that courier's manifest and scan each parcel's slip and its tracking number. The rider counts the parcels; their count must match. Every order on the manifest ships at once, and the printed manifest (with the COD total) is signed by the rider.

> **Why:** the manifest is our proof. If a courier later says they never got a parcel, the signed manifest settles it.

## Deliveries: what's out there and what's coming back
- **With couriers (oldest first)**: parcels in transit, so stuck ones get chased.
- **Failed attempts**: record each attempt the courier reports; the customer gets an SMS.
- **Coming back** (RTO): refused or undeliverable parcels. **Receive a returned parcel** at whichever location it arrives; good items go back to stock, damaged ones to the damaged register, lost parcels are claimed from the courier.
- **Why parcels came back** and **Districts returning the most**: the return rate by courier and district, which also feeds the COD risk rating.

## Exchanges
Customers swap sizes from their order page within the return window. The new size goes out as a free order through the normal pick and pack flow, and the parcel is marked "collect old item": tell the rider. When the old item comes back, receive it like any return.`,
    quiz: [
      { q: "The packing station refuses an item you scanned. Why?", options: ["The scanner is broken", "That item isn't in the order: put it back and find the right one", "You need to scan it twice"], answer: 1, why: "Refusing wrong items is the point of the packing station: wrong sizes never leave." },
      { q: "The rider counts 23 parcels but the manifest has 24. What now?", options: ["Hand over anyway", "Find the difference before handing over; counts must match", "Remove one order from the system"], answer: 1, why: "The signed manifest is proof of hand-over. It must match what the rider takes." },
    ],
  },
  {
    slug: "sys-bins-picking",
    section: "system",
    title: "Bins, pick lists and putaway",
    summary: "Giving every size a home in the warehouse so picking is fast and counting is easy.",
    audience: ["warehouse", "ops-manager"],
    minutes: 4,
    version: 1,
    open: [{ label: "Bins", href: "/admin/bins" }, { label: "Pick lists", href: "/admin/picking" }],
    related: ["sys-fulfilment", "sop-receiving", "sys-counts"],
    body: `A **bin** is a labelled shelf spot (for example A-03-2: aisle A, bay 3, shelf 2). Each size of each product has a **home bin** at a location.

## Why bins matter
- **Picking is fast.** Pick lists and count sheets are printed in walking order, so nobody zig-zags.
- **New staff can pick on day one.** They follow bin codes, not memory.
- **Counts are accurate.** A count sheet goes bin by bin.

## Setting bins
On Bins, scan or type a bin code against each item, or import a list. Unbinned sizes are listed so they get one.

## Putaway
After receiving stock (or a transfer), the **putaway list** shows where each received item goes, in bin order.

## Pick lists
Pick lists shows confirmed online orders whose items come from this location. Walk the shelves once using the SKU list, then tick each order off as you bag it. Waves (Fulfilment) do the same with slots and scan checks, for bigger volumes.`,
  },
  {
    slug: "sys-care",
    section: "system",
    title: "Customer care",
    summary: "One queue for every customer question and complaint, from every channel, with deadlines.",
    audience: ["care", "shop-manager", "ops-manager", "owner"],
    minutes: 5,
    version: 1,
    open: [{ label: "Customer care", href: "/admin/care" }, { label: "Log a case", href: "/admin/care/new" }],
    related: ["sop-care-cases", "sop-online-changes", "sys-orders"],
    body: `Every complaint and order problem lands in one queue: from the website's help form, phone calls, WhatsApp, social media and shops. **If a customer contacted us, it's a case in this queue.** Nothing lives only in someone's phone.

## A case
- **From the website**: the customer fills in the help form (in English or Nepali) and gets a case page to follow it.
- **Logged by staff**: a customer called, messaged or came into a shop: **Log a case** with what they said, linked to their order.
- Each case has a **priority** (Urgent first) and a **reply deadline**. Overdue cases go to Needs attention.
- **Statuses**: Needs a reply → Waiting for customer → Resolved.
- **Replies** to the customer are sent by SMS and shown on their case page. **Internal notes** are for the team only.
- After a case is resolved, the customer can rate how we did.

## Working the queue
Filter by Need a reply, Overdue, Urgent or Unassigned. Take the oldest urgent case first. Write what you promised in the case, so the next person knows.

## What care can fix directly
Change an order before packing (size, fewer items, address), cancel before shipping, arrange an exchange, send a reset link to a customer who can't sign in, check delivery status. Refunds of money follow the refund rules and approvals.

> **Why:** customers forgive problems that are fixed quickly and honestly. They don't forgive silence. Every case answered before its deadline is the standard.`,
    quiz: [
      { q: "A customer messages the shop's WhatsApp about a late parcel. What do you do?", options: ["Reply on WhatsApp and leave it there", "Log a case so it's tracked, then reply", "Tell them to use the website"], answer: 1, why: "Every customer contact is a case in the queue, so nothing is lost and anyone can follow up." },
    ],
  },
  {
    slug: "sys-notifications",
    section: "system",
    title: "Notifications (SMS to customers)",
    summary: "Every SMS the system sends, how retries work, and what customers receive at each step.",
    audience: ["care", "ops-manager", "owner"],
    minutes: 3,
    version: 1,
    open: [{ label: "Notifications", href: "/admin/notifications" }],
    related: ["sys-orders", "sys-system-health"],
    body: `Customers get an SMS at each important step: order placed, confirmed, shipped (with tracking and the COD amount), out for delivery, delivered (with a review link), cancelled, return and refund updates, failed delivery attempts, care replies, back-in-stock and price-drop alerts, sign-in codes.

## How sending works
Each message is first written to the **outbox**, in the same step as the change that caused it (so a message is never lost and never sent twice). The SMS gateway then delivers it, with automatic retries if the gateway is down. Notifications lists every message with its status.

> **Note:** until the SMS gateway account is connected, messages are written to the outbox but not delivered. Customers can still follow everything on their order page.

Order SMS can be in Nepali (Unicode) for customers using the Nepali site. It's switched off for now because Unicode SMS cost more; the owner decides.`,
  },
];
