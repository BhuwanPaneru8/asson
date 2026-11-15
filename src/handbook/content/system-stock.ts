import type { HandbookPage } from "../types";

export const SYSTEM_STOCK: HandbookPage[] = [
  {
    slug: "sys-products",
    section: "system",
    title: "Products and the catalogue",
    summary: "Adding and editing products, sizes and colours, photos, prices, import, and Nepali names.",
    audience: ["buyer", "marketing", "owner", "ops-manager"],
    minutes: 6,
    version: 1,
    open: [{ label: "Products", href: "/admin/products" }, { label: "Import", href: "/admin/products/import" }, { label: "Nepali names", href: "/admin/nepali" }],
    related: ["sys-inventory", "sys-coupons-markdowns", "sys-lookbook-reviews"],
    body: `## A product and its variants
A **product** is the design (Oxford Button-Down Shirt). Its **variants** are every colour × size combination (Sky Blue / M). Each variant has its own SKU, barcode, stock per location and home bin. The editor generates all colour × size combinations at once.

## What every product needs
- **Name and description** written to the brand voice: honest, specific, calm.
- **Fabric and composition**, **fit** (Tailored, Regular, Relaxed), **care** instructions and detail points. "No cheap fabric, ever" depends on these being right.
- **Photos** to the photo standard: clean background, true colour, front, back, detail and on-body. Upload in the editor.
- **Category**, **collections**, **tags** (for search) and **gender**.
- **Price** (including 13% VAT) and **MRP** if there's a compare-at price.
- **Cost** (owner only): shown with the margin it gives. Costs normally come from purchasing and production automatically.
- **Nepali name** (optional): what Nepali-language shoppers see.
- **Complete the look**: other products that go with it.
- **Status**: Draft (hidden), Active (on sale), Archived.

## Bulk import
Products → Import adds or updates many products at once from a spreadsheet. **Nothing changes until you've checked the preview**, which shows every new product, update and error.

## Barcodes and labels
Each SKU gets a Code 128 barcode. Print shelf or swing-tag labels from Labels.

> **Rule:** only the owner (and jobs with catalogue editing) change prices. A price change takes effect everywhere at once: website and every till. For a sale, use Markdowns, which starts and ends by itself and puts prices back safely.`,
  },
  {
    slug: "sys-inventory",
    section: "system",
    title: "Inventory: one stock ledger for everything",
    summary: "Stock per location, why every change needs a reason, and how adjustments work.",
    audience: ["warehouse", "shop-manager", "ops-manager", "buyer", "owner"],
    minutes: 5,
    version: 1,
    open: [{ label: "Inventory", href: "/admin/inventory" }],
    related: ["sys-transfers", "sys-counts", "sys-damaged", "sys-purchasing"],
    body: `There is **one stock ledger** for the whole company. Every unit is at one location (a shop, the warehouse, a fulfilment centre), and every movement is recorded: sold, returned, received, transferred, counted, adjusted, damaged, produced.

## Reading inventory
Inventory shows each variant's stock per location, what's reserved for orders, and what's available. **Low stock** is flagged (3 or fewer of an active product). Click through to see the full movement history of one item: who, what, when and why.

## Adjusting stock
Only managers adjust stock (on each item's row in Inventory: the location, how many in or out, and the **reason**: Received, Count correction, Damaged or Return restock). Every adjustment is recorded with who and when. Prefer the proper flow when there is one:
| Situation | Use |
|---|---|
| Goods from a supplier | Purchasing → receive (not an adjustment) |
| Moving between locations | Transfers |
| Full count of a shelf or shop | Stock counts |
| Damaged item | Damaged stock (or adjustment "Damaged") |
| Customer return | The till or the order's return flow |

## Why this matters
Accurate stock is the base of everything: the website only sells what exists, replenishment sends the right sizes, buyers reorder the right amounts, and profit is calculated on real costs. Our target is **99.5% accuracy** between system and shelf. A nightly stock check compares the ledger against stock levels and alerts on any drift.

> **Rule:** never "fix" stock to match what you think it should be. Count it, record what you counted, and let a manager approve the difference.`,
    quiz: [
      { q: "You find 2 shirts in the back room that the system says don't exist. What do you do?", options: ["Sell them as normal", "Tell a manager: they count the shelf and record the correction", "Add them to a transfer"], answer: 1, why: "Every stock change has a reason and a person. A count correction records the found stock so the ledger stays true." },
    ],
  },
  {
    slug: "sys-transfers",
    section: "system",
    title: "Transfers and replenishment",
    summary: "Moving stock between locations and keeping every shop stocked from its own sales.",
    audience: ["warehouse", "shop-manager", "ops-manager", "buyer", "owner"],
    minutes: 6,
    version: 1,
    open: [{ label: "Transfers", href: "/admin/transfers" }, { label: "Replenishment", href: "/admin/replenishment" }],
    related: ["sop-transfers", "sys-inventory", "sys-insights"],
    body: `## Transfers
A transfer moves stock from one location to another.
1. **New transfer**: pick the route (from and to), scan what goes in the box.
2. **Send**: stock leaves the source as soon as it's sent. It's "in transit": not at either location.
3. **Receive**: the receiving location scans what actually arrived. Stock arrives **only as counted**. Shortages and extras are recorded and flagged.

> **Why:** if transfers moved stock on paper, a box that fell off a bus would still be "in Pokhara". Counting in at the other end keeps stock true.

## Replenishment: keeping shops stocked automatically
Each shop's target stock for every size is calculated from **that shop's own sales speed**. Replenishment compares targets with what each shop has (and what's already on the way) and suggests:
- **Restock** from the nearest warehouse, keeping a reserve there for online orders;
- **Rebalance**: move unsold stock from a shop where it isn't selling to one where it is.

One click turns suggestions into transfer drafts. It can also draft them every night by itself; a person still checks and sends them.

## Selling across the network
A shop can **order for a customer** from another location's stock (see Point of sale). Online orders are filled from the best location automatically. So a size sitting in Butwal can sell to a customer in Pokhara the same day.`,
  },
  {
    slug: "sys-counts",
    section: "system",
    title: "Stock counts",
    summary: "Blind counts while the shop stays open, with differences approved by a manager.",
    audience: ["cashier", "warehouse", "shop-manager", "ops-manager", "owner"],
    minutes: 4,
    version: 1,
    open: [{ label: "Stock counts", href: "/admin/counts" }],
    related: ["sop-stock-count", "sys-inventory", "sys-bins-picking"],
    body: `Counts check that the system matches the shelves.

- **Blind**: counters don't see what the system expects. They count what's really there.
- **The shop stays open**: sales during the count are allowed for automatically.
- **By area**: a whole location, some bins, a category or chosen products. Count sheets come in walking (bin) order.
- **Differences** (variances) are shown to a manager after counting, with their value at cost. The manager **approves** them (stock becomes what was counted) or asks for a recount.

## How often
| What | How often |
|---|---|
| Fast sellers and high-value items | Weekly cycle count |
| A whole shop | Monthly |
| The warehouse | By zone through the month; full count at fiscal year end |

> **Why:** cycle counting a little every week keeps accuracy at 99.5% without closing for a big count. Repeated losses on the same items show where to look for theft or process errors.`,
  },
  {
    slug: "sys-damaged",
    section: "system",
    title: "Damaged stock",
    summary: "Every damaged unit counted until someone decides: repair, write off, or back to the supplier.",
    audience: ["shop-manager", "warehouse", "ops-manager", "buyer", "owner"],
    minutes: 3,
    version: 1,
    open: [{ label: "Damaged stock", href: "/admin/damaged" }],
    related: ["sop-damaged", "sys-payables"],
    body: `Everything that came back damaged (store returns, exchanges, parcels back from couriers) or was taken off sale by staff is **off sale and counted here** per location, until a manager decides:
- **Repaired**: back on sale.
- **Written off**: gone, with the reason (shows as a cost).
- **Back to the supplier**: sent back, and the credit we expect is tracked until their credit note arrives in Payables.

> **Why:** damaged goods are money. Without a register, they sit in a corner for months, then vanish. The register shows how much is waiting, and supplier quality problems show up in their scorecard.`,
  },
  {
    slug: "sys-purchasing",
    section: "system",
    title: "Purchasing, suppliers and costing",
    summary: "Ordering from suppliers, receiving by count, landed cost, and how we know the true cost of everything.",
    audience: ["buyer", "warehouse", "accountant", "owner", "ops-manager"],
    minutes: 7,
    version: 1,
    open: [{ label: "Purchasing", href: "/admin/purchasing" }, { label: "Suppliers", href: "/admin/suppliers" }],
    related: ["sop-receiving", "sys-payables", "sys-insights", "sys-production"],
    body: `## Purchase orders
1. **Draft** a purchase order (PO) for a supplier: products, sizes, quantities, prices. Reorder suggestions fill it from sales speed (enough for about 45 days, minus what's already on order). "Customers waiting" shows demand from back-in-stock requests.
2. **Ordered**: sent to the supplier.
3. **Receive**: count what arrived. Record shortfalls and damaged pieces (quality check). Stock goes up by what was **counted**. A PO can be received in parts (Partial) until complete, or cancelled.

## Landed cost and average cost
- **Landed cost** spreads freight, customs and other charges over the items, so cost includes getting them here.
- **Weighted-average cost**: each new receipt is averaged with the stock already held. Every sale records the cost at the moment it sold, so profit is exact even when costs change.
- Costs are **owner-only** in the product editor, shown with the margin.

## Suppliers
Each supplier has a scorecard: what we've spent, how much arrived damaged or short, lead times. Use it before reordering.

## Supplier bills
The supplier's bill is recorded against what was received and goes to Payables. A PAN on the bill lets us claim the input VAT.

> **Rule:** never sign a supplier's delivery paper before counting. Shortages recorded after signing are hard to claim.`,
  },
  {
    slug: "sys-production",
    section: "system",
    title: "Own production (fabric to finished pieces)",
    summary: "Making our own products: materials stock, bills of materials, production orders and true cost per piece.",
    audience: ["buyer", "owner", "ops-manager", "accountant"],
    minutes: 5,
    version: 1,
    open: [{ label: "Production", href: "/admin/production" }, { label: "Materials", href: "/admin/production/materials" }, { label: "Bills of materials", href: "/admin/production/products" }],
    related: ["sys-purchasing", "sys-payables"],
    body: `For products we make ourselves with workshops:

## Materials
Fabric and trims are stocked at locations like any stock, at weighted-average cost. Receiving with the supplier's invoice number also records their bill.

## Bill of materials
For each product we make: the fabric and trims **one piece** uses, and the workshop's **stitching charge**.

## Production orders
1. **Plan** pieces per size for one workshop. It starts as a draft: nothing leaves the shelf yet.
2. **Issue materials**: everything the order needs, plus a cutting allowance, leaves our stock to the workshop.
3. **Count deliveries** as finished pieces come back, with rejects recorded.
4. **Close** when done (or close short, or cancel). Finished pieces enter stock at their **real cost**: materials used plus stitching. The workshop's bill goes to Payables automatically.

> **Why:** making our own clothes is how we offer high quality at fair prices. Knowing the true cost per piece, including waste and rejects, is how we keep it profitable.`,
  },
];
