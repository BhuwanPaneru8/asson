import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { closeShift, createPosSale, lockDay, openShift } from "@/actions/pos";
import { reportTillQueue, resolvePosException, tillPriceList } from "@/actions/pos-offline";
import { priceSig } from "@/lib/pos-offline";
import { buildDaySummary, expectedCashForShift, ktmDate } from "@/lib/pos";
import { attention } from "@/lib/attention";
import { actAs, makeLocation, makeProduct, makeUser, resetDb, stockAt } from "../support/db";

// The offline till: sales made with no internet reach the server later through createPosSale, keyed by the
// till's clientRef, dated when they happened, on the shift they were made on.

let n = 0;
const ref = () => `offline-${++n}-${Math.random().toString(36).slice(2, 10)}`;
const cash = (amount: number, tendered?: number) => ({ method: "CASH" as const, amount, tendered });

async function till(float = 1000) {
  const cashier = await makeUser("CASHIER");
  actAs(cashier);
  expect((await openShift(float)).ok).toBe(true);
  // opened a couple of hours ago, before the till lost its connection
  const open = await db.shift.findFirstOrThrow({ where: { cashierId: cashier.id, status: "OPEN" } });
  const shift = await db.shift.update({ where: { id: open.id }, data: { openedAt: new Date(Date.now() - 2 * 3_600_000) } });
  return { cashier, shift };
}

/** A sale as the till sends it after being offline, priced from the list the server signed. */
function offlineSale(shift: { id: string; storeId: string }, items: { variantId: string; price: number; quantity?: number }[], opts: { soldAt?: Date; tenders?: { method: "CASH" | "ESEWA_QR" | "VOUCHER" | "BANK"; amount: number; tendered?: number; reference?: string }[]; clientRef?: string; discount?: { type: "PERCENT"; value: number; reason: string } | null; sig?: (v: string, p: number, at: string) => string } = {}) {
  const issuedAt = new Date(Date.now() - 60_000).toISOString();
  const total = items.reduce((s, i) => s + i.price * (i.quantity ?? 1), 0);
  return {
    clientRef: opts.clientRef ?? ref(),
    lines: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity ?? 1 })),
    discount: opts.discount ?? null,
    tenders: opts.tenders ?? [cash(total)],
    offline: {
      soldAt: (opts.soldAt ?? new Date(Date.now() - 5 * 60_000)).toISOString(),
      shiftId: shift.id,
      prices: items.map((i) => ({ variantId: i.variantId, price: i.price, issuedAt, sig: (opts.sig ?? ((v, p, at) => priceSig(shift.storeId, v, p, at)))(i.variantId, i.price, issuedAt) })),
    },
  };
}

describe("offline till: syncing sales", () => {
  beforeEach(resetDb);

  it("records each offline sale exactly once, however often (or however concurrently) the till sends it", async () => {
    const p = await makeProduct({ price: 1200, stock: { M: 5 } });
    const { cashier, shift } = await till();
    const soldAt = new Date(Date.now() - 20 * 60_000);
    const input = offlineSale(shift, [{ variantId: p.variants[0].id, price: 120_000, quantity: 2 }], { soldAt, tenders: [cash(240_000, 250_000)] });
    const [a, b, c] = await Promise.all([createPosSale(input), createPosSale(input), createPosSale(input)]);
    expect(a.ok && b.ok && c.ok).toBe(true);
    expect(new Set([a, b, c].map((r) => (r.ok ? r.orderId : "")))).toHaveProperty("size", 1);
    expect((await createPosSale(input)).ok).toBe(true); // a later retry, too
    expect(await db.order.count()).toBe(1);
    const order = await db.order.findFirstOrThrow({ include: { tenders: true, events: true, items: true } });
    // the real sale time, the cashier and the shift it was made on
    expect(order).toMatchObject({ channel: "STORE", clientRef: input.clientRef, cashierId: cashier.id, shiftId: shift.id, total: 240_000, paymentStatus: "PAID" });
    expect(order.createdAt.toISOString()).toBe(soldAt.toISOString());
    expect(order.events[0].message).toMatch(/made offline/);
    expect(order.tenders[0]).toMatchObject({ method: "CASH", amount: 240_000, tendered: 250_000 });
    expect((await db.variant.findUniqueOrThrow({ where: { id: p.variants[0].id } })).stock).toBe(3);
    expect(await db.inventoryLog.count({ where: { reason: "SALE" } })).toBe(1);
    // counted in the shift's drawer and the day's sales
    expect(await expectedCashForShift(shift.id)).toBe(100_000 + 240_000);
    expect((await buildDaySummary(shift.storeId, ktmDate(soldAt))).store.transactions).toBe(1);
    expect(await db.posException.count()).toBe(0);
    // one tax invoice, numbered when the sale reached the server (invoice numbers must run in date order)
    expect(await db.taxInvoice.count({ where: { orderId: order.id } })).toBe(1);
  });

  it("gives an offline sale its tax invoice on sync, with the business buyer's PAN", async () => {
    const p = await makeProduct({ price: 1000, stock: { M: 5 } });
    const { shift } = await till();
    const r = await createPosSale({ ...offlineSale(shift, [{ variantId: p.variants[0].id, price: 100_000 }]), customer: { name: "Himal Traders", phone: "", pan: "301234567" } });
    expect(r.ok).toBe(true);
    expect(await db.taxInvoice.findFirstOrThrow()).toMatchObject({ buyerPan: "301234567", storeId: shift.storeId });
  });

  it("charges the price the till showed when the server signed it, even if the price changed since", async () => {
    const p = await makeProduct({ price: 1000, stock: { M: 5 } });
    const { shift } = await till();
    await db.product.update({ where: { id: p.id }, data: { price: 120_000 } }); // marked up after the till saved its list
    const r = await createPosSale(offlineSale(shift, [{ variantId: p.variants[0].id, price: 100_000 }]));
    expect(r.ok).toBe(true);
    const item = await db.orderItem.findFirstOrThrow();
    expect(item.unitPrice).toBe(100_000);
    expect(await db.posException.count()).toBe(0);
  });

  it("keeps a price the server never issued, but flags it for the manager", async () => {
    const p = await makeProduct({ price: 1000, stock: { M: 5 } });
    const { shift } = await till();
    const r = await createPosSale(offlineSale(shift, [{ variantId: p.variants[0].id, price: 10_000 }], { sig: () => "forged-signature-000000" }));
    expect(r.ok).toBe(true);
    expect(await db.posException.findFirstOrThrow()).toMatchObject({ kind: "PRICE_UNVERIFIED", variantId: p.variants[0].id, storeId: shift.storeId });
    // a signature for another shop doesn't count either
    const other = await makeLocation({ code: "PATAN" });
    await createPosSale(offlineSale(shift, [{ variantId: p.variants[0].id, price: 10_000 }], { sig: (v, pr, at) => priceSig(other.id, v, pr, at) }));
    expect(await db.posException.count({ where: { kind: "PRICE_UNVERIFIED" } })).toBe(2);
  });

  it("refuses what can't be allowed offline: a discount above 5%, a manager PIN, store credit or bank transfer, a QR payment with no reference", async () => {
    const p = await makeProduct({ price: 1000, stock: { M: 5 } });
    await makeUser("MANAGER", { pin: "2580" });
    const { shift } = await till();
    const v = p.variants[0].id;
    const ten = { type: "PERCENT" as const, value: 10, reason: "Loyal customer" };
    expect(await createPosSale(offlineSale(shift, [{ variantId: v, price: 100_000 }], { discount: ten, tenders: [cash(90_000)] }))).toMatchObject({ ok: false, error: expect.stringMatching(/discount/) });
    expect(await createPosSale({ ...offlineSale(shift, [{ variantId: v, price: 100_000 }], { discount: ten, tenders: [cash(90_000)] }), approverPin: "2580" })).toMatchObject({ ok: false });
    expect(await createPosSale(offlineSale(shift, [{ variantId: v, price: 100_000 }], { tenders: [{ method: "VOUCHER", amount: 100_000, reference: "CR-X" }] }))).toMatchObject({ ok: false, error: expect.stringMatching(/can't take offline/) });
    expect(await createPosSale(offlineSale(shift, [{ variantId: v, price: 100_000 }], { tenders: [{ method: "BANK", amount: 100_000, reference: "x" }] }))).toMatchObject({ ok: false });
    expect(await createPosSale(offlineSale(shift, [{ variantId: v, price: 100_000 }], { tenders: [{ method: "ESEWA_QR", amount: 100_000 }] }))).toMatchObject({ ok: false });
    // within the cashier's own 5% and a QR with its reference: fine
    expect(await createPosSale(offlineSale(shift, [{ variantId: v, price: 100_000 }], { discount: { ...ten, value: 5 }, tenders: [{ method: "ESEWA_QR", amount: 95_000, reference: "0A1B2C" }] }))).toMatchObject({ ok: true });
    expect(await db.order.count()).toBe(1);
  });

  it("only the cashier who made an offline sale can send it", async () => {
    const p = await makeProduct({ stock: { M: 5 } });
    const { shift } = await till();
    const input = offlineSale(shift, [{ variantId: p.variants[0].id, price: 100_000 }]);
    actAs(await makeUser("CASHIER"));
    expect(await createPosSale(input)).toMatchObject({ ok: false, error: expect.stringMatching(/another cashier's shift/) });
    expect(await db.order.count()).toBe(0);
  });

  it("dates a sale from a till whose clock was wrong at the time it arrived, and says so", async () => {
    const p = await makeProduct({ stock: { M: 5 } });
    const { shift } = await till();
    const before = Date.now();
    expect((await createPosSale(offlineSale(shift, [{ variantId: p.variants[0].id, price: 100_000 }], { soldAt: new Date(Date.now() + 3 * 86_400_000) }))).ok).toBe(true);
    const o = await db.order.findFirstOrThrow({ include: { events: true } });
    expect(o.createdAt.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(o.createdAt.getTime()).toBeLessThanOrEqual(Date.now());
    expect(o.events[0].message).toMatch(/clock was wrong/);
  });
});

describe("offline till: stock exceptions", () => {
  beforeEach(resetDb);

  it("records a sale of more than the system had, flags the shortfall, and never lets stock go below zero or oversell online", async () => {
    const p = await makeProduct({ name: "Linen Kurta", price: 1000, stock: { M: 1 } });
    const { shift } = await till();
    const v = p.variants[0].id;
    const r = await createPosSale(offlineSale(shift, [{ variantId: v, price: 100_000, quantity: 3 }]));
    expect(r.ok).toBe(true);
    expect(await db.order.count()).toBe(1);
    expect(await stockAt(shift.storeId, v)).toBe(0);
    expect((await db.variant.findUniqueOrThrow({ where: { id: v } })).stock).toBe(0);
    const x = await db.posException.findFirstOrThrow();
    expect(x).toMatchObject({ kind: "STOCK_SHORT", variantId: v, quantity: 2, storeId: shift.storeId, resolvedAt: null });
    expect(x.detail).toMatch(/2 × Linen Kurta/);
    expect(await db.auditLog.count({ where: { action: "pos.offline_exception" } })).toBe(1);
    // nothing extra to sell: an online sale of the same size is refused
    expect(await createPosSale({ clientRef: ref(), lines: [{ variantId: v, quantity: 1 }], discount: null, tenders: [cash(100_000)] })).toMatchObject({ ok: false });

    // the manager sees it on Needs attention and the closing page, and ticks it off with a note
    const manager = await makeUser("MANAGER");
    const items = await attention(manager, { all: true });
    expect(items.find((i) => i.key === "offline")).toMatchObject({ href: "/admin/closing", text: expect.stringMatching(/^1 offline-sale exception/) });
    expect((await buildDaySummary(shift.storeId, ktmDate())).alerts.join(" ")).toMatch(/1 offline-sale exception/);
    actAs(manager);
    expect(await resolvePosException({ id: x.id, note: "x" })).toMatchObject({ ok: false });
    expect(await resolvePosException({ id: x.id, note: "Counted the shelf: 0 left, online order moved to the warehouse" })).toMatchObject({ ok: true });
    expect(await resolvePosException({ id: x.id, note: "again, twice" })).toMatchObject({ ok: false, error: expect.stringMatching(/already/) });
    expect((await attention(manager, { all: true })).some((i) => i.key === "offline")).toBe(false);
  });

  it("a manager at another shop can't tick off this shop's exceptions", async () => {
    const p = await makeProduct({ stock: { M: 0 } });
    const { shift } = await till();
    await createPosSale(offlineSale(shift, [{ variantId: p.variants[0].id, price: 100_000 }]));
    const x = await db.posException.findFirstOrThrow();
    const elsewhere = await makeLocation({ code: "PATAN" });
    actAs(await makeUser("MANAGER", { locations: [elsewhere.id] }));
    expect(await resolvePosException({ id: x.id, note: "Checked it all" })).toMatchObject({ ok: false });
  });

  it("flags a sale that arrives after its shift was closed and its day locked, and still records it", async () => {
    const p = await makeProduct({ stock: { M: 5 } });
    const { cashier, shift } = await till(0);
    const input = offlineSale(shift, [{ variantId: p.variants[0].id, price: 100_000 }]);
    expect((await closeShift(0)).ok).toBe(true); // closed from another device while this till was offline
    const manager = await makeUser("MANAGER");
    actAs(manager);
    expect((await lockDay(ktmDate(), undefined, shift.storeId)).ok).toBe(true);
    actAs(cashier);
    expect((await createPosSale(input)).ok).toBe(true);
    const order = await db.order.findFirstOrThrow();
    expect(order.shiftId).toBe(shift.id);
    expect((await db.posException.findMany({ orderBy: { kind: "asc" } })).map((x) => x.kind).sort()).toEqual(["DAY_LOCKED", "SHIFT_CLOSED"]);
  });
});

describe("offline till: closing waits for unsynced sales", () => {
  beforeEach(resetDb);

  it("blocks closing the shift and locking the day while a till reports unsynced sales, and allows both once they're in", async () => {
    const p = await makeProduct({ stock: { M: 5 } });
    const { cashier, shift } = await till(0);
    const deviceId = "till-0b6d2c1e-7f1a-4c2e-9d55-000000000001";
    expect(await reportTillQueue({ deviceId, shiftId: shift.id, pending: 2, oldestAt: new Date(Date.now() - 600_000).toISOString() })).toMatchObject({ ok: true });
    expect(await closeShift(0)).toMatchObject({ ok: false, error: expect.stringMatching(/2 sales made offline/) });

    // the day can't lock either (even with every shift closed): the till still holds sales for it
    const other = await makeUser("CASHIER");
    await db.shift.update({ where: { id: shift.id }, data: { status: "CLOSED", closedAt: new Date(), expectedCash: 0, countedCash: 0, difference: 0 } });
    const manager = await makeUser("MANAGER");
    actAs(manager);
    expect(await lockDay(ktmDate(), undefined, shift.storeId)).toMatchObject({ ok: false, error: expect.stringMatching(/haven't synced/) });
    expect((await buildDaySummary(shift.storeId, ktmDate())).alerts.join(" ")).toMatch(/still on a till/);
    await db.shift.update({ where: { id: shift.id }, data: { status: "OPEN", closedAt: null } });

    // nobody else can report for this shift
    actAs(other);
    expect(await reportTillQueue({ deviceId, shiftId: shift.id, pending: 0, oldestAt: null })).toMatchObject({ ok: false });

    // the till syncs and reports it holds nothing: closing works, and the drawer includes the offline sale
    actAs(cashier);
    expect((await createPosSale(offlineSale(shift, [{ variantId: p.variants[0].id, price: 100_000 }]))).ok).toBe(true);
    expect(await reportTillQueue({ deviceId, shiftId: shift.id, pending: 0, oldestAt: null })).toMatchObject({ ok: true });
    expect(await closeShift(1000)).toMatchObject({ ok: true, expected: 100_000, difference: 0 });
    actAs(manager);
    expect((await lockDay(ktmDate(), undefined, shift.storeId)).ok).toBe(true);
    expect(await db.posDevice.count()).toBe(1);
  });

  it("gives the till a signed price list for its own shop, with this shop's count and no costs", async () => {
    const here = await makeLocation({ code: "FLAGSHIP" });
    const p = await makeProduct({ price: 2399, cost: 1100, stock: { M: 4, L: 0 } });
    await db.product.create({ data: { name: "Draft", slug: "draft-x", brand: "Asson", description: "d", gender: "MEN", status: "DRAFT", price: 100, categoryId: p.categoryId, variants: { create: [{ sku: "DRAFT-M", color: "W", colorHex: "#fff", size: "M" }] } } });
    const { shift } = await till();
    expect(shift.storeId).toBe(here.id);
    const r = await tillPriceList(null);
    if (!r.ok) throw new Error(r.error);
    expect(r).toMatchObject({ storeId: here.id, next: null });
    expect(r.rows.map((x) => [x.sku, x.stock, x.price])).toEqual(expect.arrayContaining([[p.variants[0].sku, 4, 239_900], [p.variants[1].sku, 0, 239_900]]));
    expect(r.rows.some((x) => x.sku === "DRAFT-M")).toBe(false);
    expect(JSON.stringify(r)).not.toMatch(/cost/i);
    const m = r.rows.find((x) => x.sku === p.variants[0].sku)!;
    expect(m.sig).toBe(priceSig(here.id, m.variantId, m.price, m.issuedAt));
  });
});
