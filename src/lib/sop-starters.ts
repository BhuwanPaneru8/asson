import type { SopArea } from "@prisma/client";

// Starter procedures, written from how the system works. The owner loads them once (Training → "Load the starter
// procedures") and edits them to match the business; they're a starting point, not policy.

export const STARTER_SOPS: { title: string; area: SopArea; roles: string[]; body: string }[] = [
  {
    title: "Opening the shop",
    area: "SALES",
    roles: ["CASHIER", "MANAGER"],
    body: `## Before the doors open
1. Clock in (My time → Clock in) at this shop.
2. Count the cash float in the drawer and open your shift with that exact amount (Point of sale → Open shift).
3. Open Today: read every message from HQ marked "read and confirm", and tick the opening checklist as you go.
4. Check Pickups at the till: anything ready for collection today should be easy to find behind the counter.
5. If a sale started today, put the new price tags on (Markdowns → the sale → Price tags).

## Never
- Never sell without an open shift, and never use someone else's login.`,
  },
  {
    title: "Selling at the till",
    area: "SALES",
    roles: ["CASHIER", "MANAGER"],
    body: `## Every sale
1. Scan every item (or search by name). Check the size and colour on screen match what's in your hand.
2. Ask for the customer's mobile number: it links the sale to their loyalty points.
3. Discounts: cashiers can give up to 5% on their own; more needs a manager's PIN (up to 15%) or the owner's. Always choose the reason.
4. Take payment so the payments add up exactly to the total. For QR or card, type the transaction reference.
5. Hand over the receipt and the change shown on screen.

## If the size isn't here
- Use "Order for a customer": it shows where else it's in stock. The customer collects it here later or has it delivered, and pays now or later.

## Never
- Never take money without ringing up a sale, and never give a discount without the reason.`,
  },
  {
    title: "Closing the day and handling cash",
    area: "CASH",
    roles: ["CASHIER", "MANAGER"],
    body: `## Closing your shift
1. Count the drawer twice. Type the counted amount when you close your shift.
2. If it doesn't match what the system expects, write what happened. Don't adjust the cash to make it match.

## The manager
1. Count the safe (Cash → Count the safe) and bank cash at least every few days. The deposit slip number goes in with the deposit.
2. Check Daily closing: sales, refunds, discounts, differences. When it's right, lock the day.
3. Petty cash only for small shop costs, with a receipt photo; bigger costs go through Finance.`,
  },
  {
    title: "Returns and exchanges at the till",
    area: "CUSTOMERS",
    roles: ["CASHIER", "MANAGER"],
    body: `## Taking an item back
1. Find the sale by receipt or phone. Returns are within 7 days of the sale with the receipt.
2. Look at the item: unworn with tags is "back on sale"; worn, marked or broken is "damaged".
3. A return needs a manager's PIN. Choose how the money goes back: the same way it was paid, or store credit.
4. Damaged items go into the damaged register by themselves. Put them aside in the damaged box, never back on the shelf.

## Swapping a size
- Return the item as store credit and sell the new size with that credit, so both sides are recorded.`,
  },
  {
    title: "Packing online orders",
    area: "FULFILMENT",
    roles: ["STAFF", "MANAGER"],
    body: `## Picking
1. Start a wave (Fulfilment → Start a wave). Express orders come first. Walk the bins in the order on the list and put each item in its numbered slot.
2. When every item is in, press "Everything is picked".

## Packing
1. Scan the order number on the slip, then scan every item. The screen refuses an item that isn't in the order: put it back.
2. Pack only when everything matches. If a barcode won't scan, ask a manager: they can pack with a reason.
3. Weigh the parcel, note the box, stick on the shipping label. Exchange parcels say "collect old item": tell the rider.`,
  },
  {
    title: "Handing parcels to couriers",
    area: "FULFILMENT",
    roles: ["STAFF", "MANAGER"],
    body: `## When the rider comes
1. Open the courier's manifest (Fulfilment → Scan parcels for this courier).
2. Scan each parcel's slip and its tracking number. Don't type tracking numbers from memory.
3. Ask the rider to count the parcels. Their count must match the manifest before you hand over.
4. Print the manifest and have the rider sign it. Keep the signed copy.

## When a delivery fails
- Record each failed attempt the courier reports (Deliveries). Parcels that come back are scanned in at the location they arrive at.`,
  },
  {
    title: "Receiving stock and damaged goods",
    area: "STOCK",
    roles: ["STAFF", "MANAGER"],
    body: `## Receiving
1. Count what arrived against the purchase order before you sign the supplier's paper. Record shortfalls and damaged pieces.
2. Put stock away in its home bin (the putaway list is in bin order). Unbinned sizes get a bin.

## Damaged stock
- Anything found damaged: Inventory → adjust with "Damaged". It's off sale and counted in the damaged register.
- From the register a manager decides: repaired (back on sale), written off (say why), or back to the supplier for a credit.`,
  },
  {
    title: "Looking after customers",
    area: "CUSTOMERS",
    roles: ["STAFF", "MANAGER"],
    body: `## Messages and calls
1. Answer every case in Customer care before its deadline. Be clear about what happens next and when.
2. Before an order is packed, change it for the customer rather than cancelling: size, fewer items, address (on the admin order page).
3. After delivery, a wrong size is an exchange (free new size, the rider collects the old one), not a return.
4. Write what you promised in the case, so the next person knows.`,
  },
];
