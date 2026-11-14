import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { adjustStock, saveProduct } from "@/actions/admin/catalog";
import { changeAccess } from "@/actions/admin/team";
import { updateOrderStatus } from "@/actions/admin/orders";
import { login } from "@/actions/auth";
import { addToCart } from "@/actions/cart";
import { placeOrder } from "@/actions/checkout";
import { closeShift, createPosSale, openShift } from "@/actions/pos";
import { cancelOrder } from "@/actions/account";
import { getActivity } from "@/lib/audit-query";
import { redactChanges } from "@/lib/audit";
import { hashPassword } from "@/lib/auth";
import { RedirectError } from "../support/next-mocks";
import { actAs, makeProduct, makeUser, resetDb } from "../support/db";

const ref = () => `t-${Math.random().toString(36).slice(2, 12)}`;

function loginForm(email: string, password: string) {
  const f = new FormData();
  f.set("email", email); f.set("password", password);
  return f;
}

describe("audit trail", () => {
  beforeEach(resetDb);

  it("is append-only: the database refuses to edit or delete history", async () => {
    const e = await db.auditLog.create({ data: { action: "test", entityType: "Test", summary: "x" } });
    await expect(db.auditLog.update({ where: { id: e.id }, data: { summary: "changed" } })).rejects.toThrow(/append-only/);
    await expect(db.auditLog.delete({ where: { id: e.id } })).rejects.toThrow(/append-only/);
    await expect(db.auditLog.deleteMany({})).rejects.toThrow(/append-only/);
    expect((await db.auditLog.findUniqueOrThrow({ where: { id: e.id } })).summary).toBe("x");
  });

  it("records price changes with before → after, and keeps cost out of the summary", async () => {
    const owner = await makeUser("ADMIN", { name: "Bhuwan" });
    actAs(owner);
    const p = await makeProduct({ price: 2499, cost: 1000, stock: { M: 3 } });
    const v = p.variants[0];
    const r = await saveProduct({
      name: p.name, slug: p.slug, brand: "Asson", description: p.description, details: [], gender: "MEN", status: "ACTIVE", categoryId: p.categoryId,
      price: "2299", compareAtPrice: "2999", material: "", fit: "", care: "", tags: [], featured: false, collectionIds: [], images: [],
      variants: [{ id: v.id, sku: v.sku, color: v.color, colorHex: v.colorHex, size: v.size, stock: 3, costPrice: 120000 }],
    } as never, p.id);
    expect(r.ok).toBe(true);
    const e = await db.auditLog.findFirstOrThrow({ where: { action: "product.update" } });
    expect(e).toMatchObject({ actorId: owner.id, actorName: "Bhuwan", actorRole: "ADMIN", entityType: "Product", entityId: p.id });
    expect(e.summary).toMatch(/Price Rs\. 2,499 → Rs\. 2,299/);
    expect(e.summary).toMatch(/MRP — → Rs\. 2,999/);
    expect(e.summary).toMatch(/cost changed on 1 size/);
    expect(e.summary).not.toMatch(/1,200|1,000/); // no cost figures in the one-line summary
    expect(e.changes).toMatchObject({ price: [249900, 229900], costPrice: [{ sku: v.sku, costPrice: [100000, 120000] }] });
    expect(JSON.stringify(redactChanges(e.changes, false))).not.toMatch(/120000/);

    // saving again without changes adds nothing
    await saveProduct({
      name: p.name, slug: p.slug, brand: "Asson", description: p.description, details: [], gender: "MEN", status: "ACTIVE", categoryId: p.categoryId,
      price: "2299", compareAtPrice: "2999", material: "", fit: "", care: "", tags: [], featured: false, collectionIds: [], images: [],
      variants: [{ id: v.id, sku: v.sku, color: v.color, colorHex: v.colorHex, size: v.size, stock: 3, costPrice: 120000 }],
    } as never, p.id);
    expect(await db.auditLog.count({ where: { action: "product.update" } })).toBe(1);
  });

  it("records stock adjustments, role changes and staff order changes — but not customers' own actions", async () => {
    const p = await makeProduct({ stock: { M: 5 } });
    const manager = await makeUser("MANAGER");
    actAs(manager);
    await adjustStock(p.variants[0].id, -2, "DAMAGED", "Torn seam");
    expect((await db.auditLog.findFirstOrThrow({ where: { action: "stock.adjust" } })).summary).toMatch(/at FLAGSHIP: -2 damaged — Torn seam → 3 there, 3 in stock/);
    expect(await db.damageEntry.findFirstOrThrow()).toMatchObject({ kind: "IN", quantity: 2, source: "Found damaged by staff", note: "Torn seam" }); // in the damaged register

    const owner = await makeUser("ADMIN");
    const cashier = await makeUser("CASHIER", { name: "Ram" });
    actAs(owner);
    expect(await changeAccess({ userId: cashier.id, job: "shop-manager", add: [], remove: [] })).toEqual({ ok: true });
    expect((await db.auditLog.findFirstOrThrow({ where: { action: "team.access" } })).summary).toMatch(/^Ram: Shop manager \(now can: .*Approve discounts/);

    // customer places and cancels their own order: on the order timeline, not the staff audit trail
    const customer = await makeUser("CUSTOMER");
    actAs(customer);
    await db.deliveryRate.create({ data: { district: "Kathmandu", province: "Bagmati", zone: "VALLEY", fee: 10000, etaMinDays: 1, etaMaxDays: 2 } });
    await addToCart({ variantId: p.variants[0].id, quantity: 1 });
    const placed = await placeOrder({ email: "c@test.local", phone: "9841234567", address: { fullName: "Sita Rai", phone: "9841234567", line1: "Ward 4, House 12", city: "Kathmandu", district: "Kathmandu", postalCode: "" }, shippingMethod: "standard", paymentMethod: "COD" }).catch((e) => e);
    const order = await db.order.findFirst();
    if (!order) throw new Error(`order not placed: ${placed}`);
    actAs(customer);
    await cancelOrder(order.id).catch(() => undefined);
    expect(await db.auditLog.count({ where: { action: "order.status" } })).toBe(0);

    // staff changes are recorded
    const o2 = await db.order.update({ where: { id: order.id }, data: { status: "PENDING" } });
    actAs(manager);
    await updateOrderStatus({ orderId: o2.id, to: "CONFIRMED", note: "Called, confirmed" });
    const e = await db.auditLog.findFirstOrThrow({ where: { action: "order.status" } });
    expect(e).toMatchObject({ actorId: manager.id, entityType: "Order", entityId: order.id });
    expect(e.summary).toMatch(/Order placed → Confirmed — Called, confirmed/);
  });

  it("records failed and successful staff sign-ins, never customer sign-ins", async () => {
    await db.user.create({ data: { email: "boss@test.local", name: "Boss", role: "ADMIN", passwordHash: await hashPassword("Right-pass-1") } });
    await db.user.create({ data: { email: "shopper@test.local", name: "Shopper", passwordHash: await hashPassword("Right-pass-1") } });
    await login(undefined, loginForm("boss@test.local", "wrong"));
    await login(undefined, loginForm("shopper@test.local", "wrong"));
    // the owner's password is right, but two-step sign-in comes first: recorded once it's done (tests/integration/two-factor.test.ts)
    await expect(login(undefined, loginForm("boss@test.local", "Right-pass-1"))).rejects.toMatchObject({ url: "/login/two-factor" });
    await expect(login(undefined, loginForm("shopper@test.local", "Right-pass-1"))).rejects.toBeInstanceOf(RedirectError);
    await db.user.create({ data: { email: "till@test.local", name: "Till", role: "CASHIER", passwordHash: await hashPassword("Right-pass-1") } });
    await expect(login(undefined, loginForm("till@test.local", "Right-pass-1"))).rejects.toBeInstanceOf(RedirectError);
    const rows = await db.auditLog.findMany({ orderBy: { at: "asc" } });
    expect(rows.map((r) => r.action)).toEqual(["auth.login_failed", "auth.login"]);
    expect(rows[1].summary).toMatch(/Till signed in/);
    expect(rows[0].summary).toMatch(/boss@test\.local/);
    expect(rows[0].actorId).toBeNull(); // whoever typed it is unknown
  });

  it("records till discounts with the approver, and short cash at shift close", async () => {
    const p = await makeProduct({ price: 1000, stock: { M: 5 } });
    await makeUser("MANAGER", { pin: "2468", name: "Sita" });
    const cashier = await makeUser("CASHIER", { name: "Hari" });
    actAs(cashier);
    await openShift(500);
    const sale = await createPosSale({ clientRef: ref(), lines: [{ variantId: p.variants[0].id, quantity: 1 }], discount: { type: "PERCENT", value: 10, reason: "Regular customer" }, approverPin: "2468", tenders: [{ method: "CASH", amount: 90_000 }] });
    expect(sale.ok).toBe(true);
    expect((await db.auditLog.findFirstOrThrow({ where: { action: "pos.discount" } })).summary).toMatch(/Rs\. 100 discount \(10\.0%\) on Rs\. 1,000 — Regular customer · approved by Sita/);

    expect((await createPosSale({ clientRef: ref(), lines: [{ variantId: p.variants[0].id, quantity: 1 }], discount: { type: "PERCENT", value: 10, reason: "x" }, approverPin: "1111", tenders: [{ method: "CASH", amount: 90_000 }] })).ok).toBe(false);
    expect(await db.auditLog.count({ where: { action: "auth.pin_failed" } })).toBe(1);

    expect((await closeShift(1300, "Gave change wrong")).ok).toBe(true); // expected 500 + 900 = 1,400
    expect((await db.auditLog.findFirstOrThrow({ where: { action: "shift.close" } })).summary).toMatch(/SHORT Rs\. 100: Gave change wrong/);
  });

  it("filters by area and paginates newest-first without skipping rows", async () => {
    const at = (min: number) => new Date(Date.UTC(2026, 10, 1, 6, min));
    await db.auditLog.createMany({ data: Array.from({ length: 7 }, (_, i) => ({ action: i % 2 ? "auth.login_failed" : "product.update", entityType: "X", summary: `e${i}`, at: at(i) })) });
    const sec = await getActivity({ group: "security" }, { take: 2 });
    expect(sec.rows.map((r) => r.summary)).toEqual(["e5", "e3"]);
    const next = await getActivity({ group: "security" }, { take: 2, before: sec.rows[1].id });
    expect(next.rows.map((r) => r.summary)).toEqual(["e1"]);
    expect(next.more).toBe(false);
    expect((await getActivity({ from: "2026-11-01", to: "2026-11-01", q: "e6" })).rows).toHaveLength(1);
  });
});
