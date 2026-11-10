import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { addNote, caseDetail, caseForCustomer, careStats, customerReply, listCases, normalisePhone, openCase, replyToCustomer, updateCase } from "@/lib/care";
import { makeLocation, makeUser, resetDb } from "../support/db";

type U = Awaited<ReturnType<typeof makeUser>>;
type L = Awaited<ReturnType<typeof makeLocation>>;

const t0 = new Date("2026-11-10T04:00:00Z");
const hours = (h: number) => new Date(t0.getTime() + h * 3_600_000);
const web = (o: Partial<Parameters<typeof openCase>[1]> = {}) => ({ channel: "WEB" as const, category: "ORDER" as const, subject: "Kurta not arrived", message: "Ordered last week, still nothing.", name: "Maya Gurung", phone: "+977 984-1234567", ...o });

describe("customer care queue", () => {
  let agent: U, owner: U, mgr: U, ktm: L, pkr: L;
  beforeEach(async () => {
    await resetDb();
    owner = await makeUser("ADMIN", { name: "Owner" });
    agent = await makeUser("STAFF", { name: "Anita Care" });
    ktm = await makeLocation({ code: "KTM", name: "Kathmandu shop" });
    pkr = await makeLocation({ code: "PKR", name: "Pokhara shop" });
    mgr = await makeUser("MANAGER", { name: "Sita", locations: [pkr.id] });
  });

  it("phones are normalised; a case needs a way to reach the customer; double taps join the first case", async () => {
    expect(normalisePhone("+977 984-1234567")).toBe("9841234567");
    expect(normalisePhone("01-4412345")).toBeNull();
    await expect(db.$transaction((tx) => openCase(tx, web({ phone: "12345" })))).rejects.toThrow(/valid mobile/);
    await expect(db.$transaction((tx) => openCase(tx, web({ phone: null, email: null })))).rejects.toThrow(/valid mobile/);
    const a = await db.$transaction((tx) => openCase(tx, web(), null, t0));
    const b = await db.$transaction((tx) => openCase(tx, web(), null, hours(0.05)));
    expect(b.id).toBe(a.id);
    expect(a).toMatchObject({ phone: "9841234567", status: "NEW", respondBy: hours(8) });
    const pay = await db.$transaction((tx) => openCase(tx, web({ category: "PAYMENT", subject: "Charged twice" }), null, t0));
    expect(pay).toMatchObject({ priority: "URGENT", respondBy: hours(2) }); // money problems jump the queue
    expect(a.token).toMatch(/^[A-Za-z0-9_-]{24}$/);
  });

  it("reply → waiting + SMS link; customer writes back → open and owed a reply again; notes stay internal", async () => {
    const c = await db.$transaction((tx) => openCase(tx, web(), null, t0));
    await db.$transaction((tx) => replyToCustomer(tx, agent, c.id, "Sorry Maya, it left our warehouse today: AS000123 with Pathao.", {}, hours(1)));
    let row = await db.careCase.findUniqueOrThrow({ where: { id: c.id } });
    expect(row).toMatchObject({ status: "WAITING", respondBy: null, firstReplyAt: hours(1), assigneeId: agent.id });
    const sms = await db.notification.findFirstOrThrow({ where: { template: "care_reply" } });
    expect(sms).toMatchObject({ to: "9841234567", status: "QUEUED" });
    expect(sms.body).toContain(`C-${c.number}`);
    expect(sms.body).toContain(`/help/case/${c.token}`);

    await db.$transaction((tx) => addNote(tx, agent, c.id, "Courier says Thursday"));
    await db.$transaction((tx) => customerReply(tx, c.token, "Thanks, Thursday is fine", hours(5)));
    row = await db.careCase.findUniqueOrThrow({ where: { id: c.id } });
    expect(row).toMatchObject({ status: "OPEN", respondBy: hours(13), lastCustomerAt: hours(5) });

    const seen = (await caseForCustomer(c.token))!;
    expect(seen.messages.map((m) => [m.kind, m.byName])).toEqual([["CUSTOMER", "Maya Gurung"], ["REPLY", "Anita"], ["CUSTOMER", "Maya Gurung"]]); // no note, first name only
    expect(await caseForCustomer("not-a-real-token-xxxxxxxx")).toBeNull();
  });

  it("resolving; a reply within 14 days reopens; later the customer must start a new case", async () => {
    const c = await db.$transaction((tx) => openCase(tx, web(), null, t0));
    await db.$transaction((tx) => replyToCustomer(tx, agent, c.id, "Refunded to your eSewa.", { resolve: true }, hours(1)));
    expect(await db.careCase.findUniqueOrThrow({ where: { id: c.id } })).toMatchObject({ status: "RESOLVED", resolvedAt: hours(1) });
    await db.$transaction((tx) => customerReply(tx, c.token, "Not received yet", hours(24 * 3)));
    expect(await db.careCase.findUniqueOrThrow({ where: { id: c.id } })).toMatchObject({ status: "OPEN", resolvedAt: null });
    await db.$transaction((tx) => updateCase(tx, agent, c.id, { status: "RESOLVED" }, hours(24 * 4)));
    await expect(db.$transaction((tx) => customerReply(tx, c.token, "Hello again", hours(24 * 20)))).rejects.toThrow(/closed a while ago/);
    await expect(db.careCase.update({ where: { id: c.id }, data: { resolvedAt: null } })).rejects.toThrow(/CareCase_resolved_has_time/);
  });

  it("HQ sees everything; a manager sees their shop's cases and what's assigned to them", async () => {
    const online = await db.$transaction((tx) => openCase(tx, web(), null, t0));
    const shop = await db.$transaction((tx) => openCase(tx, web({ category: "SERVICE", subject: "Rude at the counter", storeId: pkr.id, phone: "9801111111" }), null, t0));
    expect((await listCases(owner, {}, hours(1))).length).toBe(2);
    expect((await listCases(mgr, {}, hours(1))).map((c) => c.id)).toEqual([shop.id]);
    expect(await caseDetail(mgr, online.number)).toBeNull();
    await expect(db.$transaction((tx) => replyToCustomer(tx, mgr, online.id, "hi"))).rejects.toThrow(/isn't for your locations/);
    await expect(db.$transaction((tx) => updateCase(tx, mgr, shop.id, { storeId: ktm.id }))).rejects.toThrow(/only link locations you work at/);
    await expect(db.$transaction((tx) => openCase(tx, web({ channel: "SHOP", storeId: ktm.id }), mgr))).rejects.toThrow(/only log cases for locations you work at/);
    await db.$transaction((tx) => updateCase(tx, owner, online.id, { assigneeId: mgr.id }));
    expect((await listCases(mgr, {}, hours(1))).length).toBe(2);
  });

  it("queue order, overdue, search, priority moves the deadline, order linking, history and stats", async () => {
    const order = await db.order.create({ data: { email: "maya@test.local", phone: "9841234567", status: "SHIPPED", paymentMethod: "COD", subtotal: 249900, discount: 0, shippingFee: 0, total: 249900, shippingMethod: "standard", shippingAddress: { fullName: "Maya Gurung" } } });
    const old = await db.$transaction((tx) => openCase(tx, web({ subject: "Older one" }), null, hours(-10)));
    const late = await db.$transaction((tx) => openCase(tx, web({ subject: "Low one", priority: "LOW", phone: "9802222222" }), null, hours(-1)));
    expect((await listCases(owner, { view: "overdue" }, t0)).map((c) => c.subject)).toEqual(["Older one"]);
    expect((await listCases(owner, {}, t0)).map((c) => c.subject)).toEqual(["Older one", "Low one"]); // earliest deadline first
    await db.$transaction((tx) => updateCase(tx, agent, late.id, { priority: "URGENT" }, t0));
    expect((await db.careCase.findUniqueOrThrow({ where: { id: late.id } })).respondBy).toEqual(hours(1)); // from when they last wrote
    expect((await listCases(owner, { q: "980-2222222" })).map((c) => c.id)).toEqual([late.id]);
    expect((await listCases(owner, { q: "9802222222" })).map((c) => c.id)).toEqual([late.id]); // a bare mobile isn't a case number (it overflowed INT4)
    expect((await listCases(owner, { q: `C-${old.number}` })).map((c) => c.id)).toEqual([old.id]);

    await expect(db.$transaction((tx) => updateCase(tx, agent, old.id, { orderNumber: 999999 }))).rejects.toThrow(/No order/);
    await db.$transaction((tx) => updateCase(tx, agent, old.id, { orderNumber: order.number }));
    expect((await listCases(owner, { q: `AS${String(order.number).padStart(6, "0")}` })).map((c) => c.id)).toEqual([old.id]);
    const d = (await caseDetail(agent, old.number))!;
    expect(d.case.orderId).toBe(order.id);
    expect(d.orders.map((o) => o.id)).toEqual([order.id]); // same phone
    await db.$transaction((tx) => replyToCustomer(tx, agent, old.id, "On its way", {}, hours(2)));
    const s = await careStats({ all: true }, agent.id, 30, hours(3));
    expect(s).toMatchObject({ open: 1, overdue: 1, received: 2, resolved: 0, medianFirstReplyHours: 12 });
    expect(s.byCategory).toEqual([["ORDER", 2]]);
  });

  it("a customer reply and a staff reply at the same moment both land", async () => {
    const c = await db.$transaction((tx) => openCase(tx, web(), null, t0));
    await Promise.all([
      db.$transaction((tx) => customerReply(tx, c.token, "Any news?", hours(1))),
      db.$transaction((tx) => replyToCustomer(tx, agent, c.id, "Checking with the courier", {}, hours(1))),
    ]);
    expect(await db.careMessage.count({ where: { caseId: c.id } })).toBe(3);
  });
});
