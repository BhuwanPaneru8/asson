/**
 * Supply side of the history: purchase orders to the owner's suppliers (Nepal, Delhi, Surat, Guangzhou) with real
 * lead times, counted goods receipts into the warehouse (short deliveries, rejects at the door), the supplier's
 * bill for each receipt, weekly transfers that keep every shop's sizes on the shelf (one still on the road), and
 * stock counts. All stock moves go through the ledger.
 */
import type { Prisma } from "@prisma/client";
import type { Ctx, P, V } from "./context";
import type { Shop } from "./people";
import { DAY, NOW, TODAY, addDays, at, chance, int, ktm, newId } from "./shared";

type Po = Prisma.PurchaseOrderCreateManyInput & { id: string; number: number };

export function makeSupply(c: Ctx) {
  const wh = c.shops["WH-KTM"];
  const po: Po[] = [], poItems: (Prisma.PurchaseOrderItemCreateManyInput & { id: string })[] = [];
  const grn: (Prisma.GoodsReceiptCreateManyInput & { id: string })[] = [], grnItems: Prisma.GoodsReceiptItemCreateManyInput[] = [];
  const bills: (Prisma.SupplierBillCreateManyInput & { id: string })[] = [];
  const transfers: (Prisma.StockTransferCreateManyInput & { id: string })[] = [], transferItems: Prisma.StockTransferItemCreateManyInput[] = [];
  let poNo = 200, grnNo = 300, billNo = 400, trNo = 500;
  const arrivals: { day: string; run: () => void }[] = [];
  const buyer = c.people.anil, receiver = c.people.dinesh;

  // who makes what (by brand), and how long it takes to arrive
  const supplierFor = (p: P) => {
    const brand = p.tags.includes("made in nepal") ? "Made in Nepal" : p.brand;
    const name = { "Indigo & Co": "Tank Road market", "Urban Theory": "Baima Clothing Market", "Loom Craft": "Surat textile market", Northpeak: "Gandhi Nagar market", "Asson Studio": "New Baneshwor wholesalers", "Made in Nepal": "Mahaboudha & Bhotahity wholesalers", "Asson Heritage": "Shaoxing Textile Market" }[brand] ?? "Ranjana Trade";
    return c.suppliers.find((s) => s.name === name) ?? c.suppliers[0];
  };
  const lead = (country: string) => (country === "Nepal" ? int(3, 5) : country === "India" ? int(10, 14) : int(24, 32));

  /** Place an order for what's running low at the warehouse from one supplier. */
  function reorder(day: string, supplierName?: string, force?: V[]) {
    const t = at(day, 11, int(0, 50));
    const low = force ?? c.products.filter((p) => p.status === "ACTIVE" && p.createdAt < t).flatMap((p) => p.variants.map((v) => ({ p, v }))).filter(({ v }) => c.ledger.get(wh.id, v.id) <= 4).sort((a, b) => b.p.popularity - a.p.popularity).map((x) => x.v);
    if (!low.length) return;
    const bySupplier = new Map<string, V[]>();
    for (const v of low) {
      const p = c.products.find((x) => x.id === v.productId)!;
      const s = supplierName ? c.suppliers.find((x) => x.name === supplierName)! : supplierFor(p);
      bySupplier.set(s.id, [...(bySupplier.get(s.id) ?? []), v]);
    }
    const [supplierId, vs] = [...bySupplier.entries()].sort((a, b) => b[1].length - a[1].length)[0];
    const s = c.suppliers.find((x) => x.id === supplierId)!;
    const lines = vs.slice(0, 24);
    const id = newId("po"), number = ++poNo;
    const arrive = addDays(day, lead(s.country));
    const value = lines.reduce((sum, v) => sum + (v.costPrice ?? 50000) * 24, 0);
    const landedCost = s.country === "Nepal" ? 0 : Math.round(value * (s.country === "India" ? 0.06 : 0.09) / 100) * 100;
    po.push({ id, number, supplierId, status: "ORDERED", landedCost, notes: s.country === "Nepal" ? null : s.country === "India" ? "Cargo via Birgunj" : "Sea + road via Kolkata and Birgunj", createdById: buyer.id, orderedAt: t, expectedAt: at(arrive, 12), createdAt: new Date(t.getTime() - 3_600_000), updatedAt: t });
    const items = lines.map((v) => { const q = (int(4, 12)) * 3; const it = { id: newId("poi"), purchaseOrderId: id, variantId: v.id, quantityOrdered: q, unitCost: v.costPrice ?? 50000 }; poItems.push(it); return it; });
    c.audit(buyer, t, "po.order", ["PurchaseOrder", id], `PO-${number} sent to ${s.name}: ${items.length} lines, ${items.reduce((n, i) => n + i.quantityOrdered, 0)} units`);
    arrivals.push({ day: arrive, run: () => receive({ id, number, s, items, landedCost, day: arrive }) });
  }

  function receive(d: { id: string; number: number; s: (typeof c.suppliers)[number]; items: { id: string; variantId: string; quantityOrdered: number; unitCost: number }[]; landedCost: number; day: string }, second = false) {
    const t = at(d.day, 14, int(0, 50));
    if (t > NOW) return;
    const order = po.find((x) => x.id === d.id)!;
    const short = !second && chance(0.15);
    const value = d.items.reduce((s, i) => s + i.unitCost * i.quantityOrdered, 0);
    const id = newId("grn"), number = ++grnNo;
    const got: { item: (typeof d.items)[number]; q: number; bad: number }[] = [];
    for (const it of d.items) {
      const prev = poItems.find((x) => x.id === it.id)!;
      const left = it.quantityOrdered - (prev.quantityReceived ?? 0) - (prev.quantityDamaged ?? 0);
      if (left <= 0) continue;
      const come = short ? Math.floor(left * 0.6) : left;
      const bad = chance(0.12) ? Math.min(come, int(1, 2)) : 0;
      if (come <= 0) continue;
      got.push({ item: it, q: come - bad, bad });
      prev.quantityReceived = (prev.quantityReceived ?? 0) + come - bad;
      prev.quantityDamaged = (prev.quantityDamaged ?? 0) + bad;
    }
    if (!got.length) return;
    grn.push({ id, number, purchaseOrderId: d.id, receivedById: receiver.id, storeId: wh.id, note: `${d.s.name} invoice ${d.s.name.slice(0, 2).toUpperCase()}-${int(1000, 9999)}${got.some((g) => g.bad) ? ` · ${got.reduce((n, g) => n + g.bad, 0)} rejected at the door (stains, wrong size label)` : ""}${short ? " · short delivery: rest promised next week" : ""}`, createdAt: t });
    for (const g of got) {
      const landed = g.item.unitCost + (value ? Math.round((d.landedCost * g.item.unitCost) / value) : 0);
      grnItems.push({ receiptId: id, poItemId: g.item.id, variantId: g.item.variantId, quantity: g.q, damaged: g.bad, landedUnitCost: landed });
      if (g.q > 0) c.ledger.add(wh.id, g.item.variantId, g.q, "RECEIVED", t, { actorId: receiver.id, note: `GRN-${number} (PO-${d.number})` });
    }
    const all = poItems.filter((x) => x.purchaseOrderId === d.id);
    const complete = all.every((x) => (x.quantityReceived ?? 0) + (x.quantityDamaged ?? 0) >= x.quantityOrdered);
    order.status = complete ? "RECEIVED" : "PARTIALLY_RECEIVED";
    order.updatedAt = t;
    c.audit(receiver, t, "po.receive", ["PurchaseOrder", d.id], `GRN-${number} for PO-${d.number}: ${got.reduce((n, g) => n + g.q, 0)} good, ${got.reduce((n, g) => n + g.bad, 0)} rejected`);
    // the supplier's bill for what arrived (Nepali suppliers charge 13% VAT)
    const goods = got.reduce((s, g) => s + g.q * g.item.unitCost, 0);
    const vat = d.s.country === "Nepal" && d.s.pan ? Math.round(goods * 0.13) : 0;
    const terms = d.s.country === "Nepal" ? 30 : 45;
    bills.push({ id: newId("bill"), number: ++billNo, supplierId: d.s.id, purchaseOrderId: d.id, reference: `${d.s.name.split(" ")[0].toUpperCase().slice(0, 4)}-${int(10000, 99999)}`, billDate: t, dueDate: new Date(t.getTime() + terms * DAY), amount: goods + vat, vatAmount: vat, createdById: c.people.sarita.id, createdAt: new Date(t.getTime() + DAY) });
    if (!complete && !second) arrivals.push({ day: addDays(d.day, 7), run: () => receive(d, true) });
  }

  /** Sunday top-ups: each shop gets the sizes it's short of, from the warehouse. */
  function topUp(day: string, shops: Shop[], protect: Set<string>) {
    for (const shop of shops) {
      if (day < shop.opened) continue;
      const t = at(day, 9, int(10, 40));
      const lines: { v: V; q: number }[] = [];
      for (const p of c.products.filter((x) => x.status === "ACTIVE" && x.createdAt < t).sort((a, b) => b.popularity - a.popularity).slice(0, 55)) {
        for (const v of p.variants) {
          const target = protect.has(p.id) ? 8 : ["M", "L", "30", "32"].includes(v.size) ? 4 : 2;
          const need = target - c.ledger.get(shop.id, v.id);
          const can = Math.min(need, c.ledger.get(wh.id, v.id) - 2);
          if (can > 0) lines.push({ v, q: can });
        }
      }
      if (!lines.length) continue;
      const take = lines.slice(0, 40);
      send(wh, shop, take, t, shop.code === "PKR" ? 2 : 1);
    }
  }

  function send(from: Shop, to: Shop, lines: { v: V; q: number }[], t: Date, transit: number, note?: string) {
    const id = newId("tr"), number = ++trNo;
    const receivedAt = at(ktm(new Date(t.getTime() + transit * DAY)), 11, int(0, 50));
    const arrived = receivedAt <= NOW;
    const sender = from.code === "WH-KTM" ? c.people.hari : from.code === "PKR" ? c.people.bimala : c.people.manager;
    const taker = to.code === "FLAGSHIP" ? c.people.manager : to.code === "PKR" ? c.people.bimala : to.code === "LTP" ? c.people.rojina : c.people.dinesh;
    transfers.push({ id, number, fromId: from.id, toId: to.id, status: arrived ? "RECEIVED" : "SENT", note: note ?? "Weekly top-up", createdById: sender.id, sentAt: t, sentById: sender.id, receivedAt: arrived ? receivedAt : null, receivedById: arrived ? taker.id : null, createdAt: new Date(t.getTime() - 3_600_000), updatedAt: arrived ? receivedAt : t });
    // now and then one unit goes missing on the road (counted at the other end)
    const shortLine = arrived && chance(0.07) ? int(0, lines.length - 1) : -1;
    for (const [i, l] of lines.entries()) {
      if (!c.ledger.take(from.id, l.v.id, l.q, "TRANSFER_OUT", t, { actorId: sender.id, note: `TR-${number} to ${to.name}` })) continue;
      const lost = i === shortLine ? 1 : 0;
      transferItems.push({ transferId: id, variantId: l.v.id, quantity: l.q, received: arrived ? l.q - lost : null });
      if (!arrived) continue;
      if (l.q - lost > 0) c.ledger.add(to.id, l.v.id, l.q - lost, "TRANSFER_IN", receivedAt, { actorId: taker.id, note: `TR-${number} from ${from.name}` });
      if (lost) c.ledger.add(to.id, l.v.id, 0, "TRANSFER_LOSS", receivedAt, { actorId: taker.id, note: `TR-${number}: 1 short on arrival` });
    }
  }

  /** Run what arrives today (receipts booked days ago). */
  function arrivalsOn(day: string) {
    for (const a of arrivals.filter((x) => x.day === day)) a.run();
  }

  /** Purchase orders that haven't been sent or were called off, and today's draft transfer. */
  function finishing() {
    po.push({ id: newId("po"), number: ++poNo, supplierId: c.suppliers.find((s) => s.name === "Baima Clothing Market")!.id, status: "DRAFT", landedCost: 0, notes: "Spring shirts: waiting for the swatch card before sending", createdById: buyer.id, createdAt: at(addDays(TODAY, -1), 16), updatedAt: at(addDays(TODAY, -1), 16) });
    const draft = po[po.length - 1];
    for (const v of c.products.filter((p) => p.cat === "men-shirts" && p.status === "ACTIVE").flatMap((p) => p.variants).slice(0, 8)) poItems.push({ id: newId("poi"), purchaseOrderId: draft.id, variantId: v.id, quantityOrdered: 24, unitCost: v.costPrice ?? 60000 });
    const cancelled = { id: newId("po"), number: ++poNo, supplierId: c.suppliers.find((s) => s.name === "Gandhi Nagar market")!.id, status: "CANCELLED" as const, landedCost: 0, notes: "Cancelled: supplier couldn't do the colours before Tihar", createdById: buyer.id, orderedAt: at(addDays(TODAY, -50), 11), createdAt: at(addDays(TODAY, -50), 10), updatedAt: at(addDays(TODAY, -45), 12) };
    po.push(cancelled);
    for (const v of c.products.filter((p) => p.cat === "men-hoodies").flatMap((p) => p.variants).slice(0, 6)) poItems.push({ id: newId("poi"), purchaseOrderId: cancelled.id, variantId: v.id, quantityOrdered: 30, unitCost: v.costPrice ?? 70000 });
    // a shop-to-shop rebalance drafted for the manager to send
    const ltp = c.shops.LTP, pkr = c.shops.PKR;
    const slow = c.products.filter((p) => p.tags.includes("linen")).flatMap((p) => p.variants).filter((v) => c.ledger.get(pkr.id, v.id) > 2).slice(0, 6);
    if (slow.length) {
      const id = newId("tr");
      transfers.push({ id, number: ++trNo, fromId: pkr.id, toId: ltp.id, status: "DRAFT", note: "Linen isn't moving at Lakeside in winter: send to Labim", createdById: c.people.anil.id, createdAt: at(TODAY, 8, 30), updatedAt: at(TODAY, 8, 30) });
      for (const v of slow) transferItems.push({ transferId: id, variantId: v.id, quantity: 2 });
    }
  }

  async function write(db: import("@prisma/client").PrismaClient) {
    await db.purchaseOrder.createMany({ data: po });
    await db.purchaseOrderItem.createMany({ data: poItems });
    await db.goodsReceipt.createMany({ data: grn });
    await db.goodsReceiptItem.createMany({ data: grnItems });
    await db.stockTransfer.createMany({ data: transfers });
    await db.stockTransferItem.createMany({ data: transferItems });
    return bills;
  }

  /** A rush restock of chosen variants from the local wholesaler (lands in a few days). */
  function rush(day: string, variants: V[]) {
    reorder(day, "Ranjana Trade", variants);
    po[po.length - 1].notes = "Rush order: best seller running low";
  }

  return { reorder, rush, arrivalsOn, topUp, send, finishing, write, bills };
}

export type Supply = ReturnType<typeof makeSupply>;
