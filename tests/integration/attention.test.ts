import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { attention } from "@/lib/attention";
import { makeLocation, makeProduct, makeUser, resetDb } from "../support/db";

const H = 3_600_000, DAY = 24 * H;

describe("needs attention", () => {
  let ktm: Awaited<ReturnType<typeof makeLocation>>, pkr: Awaited<ReturnType<typeof makeLocation>>;
  beforeEach(async () => {
    await resetDb();
    ktm = await makeLocation({ code: "KTM", name: "Kathmandu shop" });
    pkr = await makeLocation({ code: "PKR", name: "Pokhara shop" });
  });
  const keys = (a: { key: string }[]) => a.map((x) => x.key).sort();

  it("a new business: only the set-up to-dos (cash books, next week's roster)", async () => {
    const owner = await makeUser("ADMIN");
    const r = await attention(owner, { all: true }, new Date("2026-11-05T12:00:00+05:45")); // before the 10th: last month needn't be closed yet
    // two new shops: the only things to do are to start their cash books and plan next week's roster
    expect(r.map((a) => [a.key, a.text])).toEqual([["cash", "2 locations with a cash to-do (bank it, check a deposit or count the safe)"], ["rosters", "2 locations without a published roster for next week"]]);
  });

  it("each exception shows with a link, most urgent first, only to people who can act on it and only at their locations", async () => {
    const owner = await makeUser("ADMIN");
    const mgr = await makeUser("MANAGER", { name: "Sita", locations: [pkr.id] });
    const staff = await makeUser("STAFF", { name: "Desk", locations: [ktm.id] });
    const p = await makeProduct({ stock: { M: 5 }, at: ktm.id });
    const now = new Date();
    // a confirmed order two days old, allocated at Kathmandu
    const o = await db.order.create({ data: { email: "a@t.l", phone: "9811111111", status: "CONFIRMED", paymentMethod: "COD", subtotal: 1000, total: 1000, shippingMethod: "standard", shippingAddress: {}, channel: "ONLINE", createdAt: new Date(now.getTime() - 2 * DAY),
      items: { create: [{ variantId: p.variants[0].id, productId: p.id, name: p.name, slug: p.slug, sku: p.variants[0].sku, color: "White", size: "M", image: "", unitPrice: 1000, quantity: 1 }] } }, include: { items: true } });
    await db.orderAllocation.create({ data: { orderId: o.id, orderItemId: o.items[0].id, variantId: p.variants[0].id, storeId: ktm.id, quantity: 1 } });
    // a leave request and an overdue supplier bill
    await db.leaveRequest.create({ data: { userId: (await makeUser("CASHIER", { locations: [pkr.id] })).id, type: "HOME", fromDate: "2026-12-01", toDate: "2026-12-01", days: 1 } });
    const sup = await db.supplier.create({ data: { name: "S" } });
    await db.supplierBill.create({ data: { supplierId: sup.id, reference: "INV-1", billDate: new Date(now.getTime() - 40 * DAY), dueDate: new Date(now.getTime() - 10 * DAY), amount: 500_000, createdById: owner.id } });

    const all = await attention(owner, { all: true }, now);
    expect(all.find((a) => a.key === "backlog")).toMatchObject({ tone: "danger", href: "/admin/fulfilment", text: "1 confirmed order waiting more than a day to be packed" });
    expect(all.find((a) => a.key === "bills")).toMatchObject({ tone: "danger", text: "1 supplier bill overdue (Rs. 5,000)" });
    expect(all.find((a) => a.key === "leave")?.text).toBe("1 leave request to decide");
    const tones = all.map((a) => a.tone);
    expect(tones.indexOf("warn") === -1 || tones.lastIndexOf("danger") < tones.indexOf("warn")).toBe(true); // danger first

    // fulfilment staff at Kathmandu: the backlog, but not finance or people things
    const forStaff = keys(await attention(staff, { all: false, storeIds: [ktm.id] }, now));
    expect(forStaff).toContain("backlog");
    expect(forStaff).not.toContain("bills");
    expect(forStaff).not.toContain("leave");
    // a Pokhara manager: the leave request there, not Kathmandu's backlog, no finance
    const forMgr = keys(await attention(mgr, { all: false, storeIds: [pkr.id] }, now));
    expect(forMgr).toContain("leave");
    expect(forMgr).not.toContain("backlog");
    expect(forMgr).not.toContain("bills");
  });
});
