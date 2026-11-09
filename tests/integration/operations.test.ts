import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { transitionOrder } from "@/lib/orders";
import { dispatchNotifications, providers, queueOrderNotice, renderSms } from "@/lib/notifications";
import { recordCall, recordCodRemittance } from "@/actions/admin/orders";
import { actAs, makeProduct, makeUser, resetDb } from "../support/db";

async function onlineOrder(opts: { phone?: string; total?: number; status?: "PENDING" | "DELIVERED"; carrier?: string } = {}) {
  const p = await makeProduct({ price: (opts.total ?? 150_000) / 100, stock: { M: 10 } });
  return db.order.create({
    data: {
      email: "c@test.local", phone: opts.phone ?? "9841234567", status: opts.status ?? "PENDING", paymentMethod: "COD",
      paymentStatus: opts.status === "DELIVERED" ? "PAID" : "PENDING", subtotal: opts.total ?? 150_000, total: opts.total ?? 150_000,
      shippingMethod: "standard", shippingAddress: { fullName: "Sita Rai" }, carrier: opts.carrier ?? null,
      items: { create: [{ variantId: p.variants[0].id, productId: p.id, name: p.name, slug: p.slug, sku: "x", color: "W", size: "M", image: "", unitPrice: opts.total ?? 150_000, quantity: 1 }] },
    },
  });
}

describe("customer notifications (outbox)", () => {
  beforeEach(resetDb);

  it("queues an SMS for each customer-facing status change, in the same transaction", async () => {
    const o = await onlineOrder();
    await transitionOrder({ orderId: o.id, to: "CONFIRMED", actor: "t" });
    await transitionOrder({ orderId: o.id, to: "PACKED", actor: "t" }); // internal step — no SMS
    await db.order.update({ where: { id: o.id }, data: { carrier: "Pathao Parcel", trackingNumber: "NP123" } });
    await transitionOrder({ orderId: o.id, to: "SHIPPED", actor: "t" });
    const msgs = await db.notification.findMany({ where: { orderId: o.id }, orderBy: { createdAt: "asc" } });
    expect(msgs.map((m) => m.template)).toEqual(["confirmed", "shipped"]);
    expect(msgs[1].body).toMatch(/Pathao Parcel \(NP123\).*Please keep Rs\. 1,500 ready/);
  });

  it("skips customers without a valid Nepali mobile", async () => {
    const o = await onlineOrder({ phone: "12345" });
    await queueOrderNotice(db, o.id, "placed");
    expect((await db.notification.findFirstOrThrow()).status).toBe("SKIPPED");
  });

  it("sends each message exactly once, even with concurrent dispatchers", async () => {
    const o = await onlineOrder();
    await queueOrderNotice(db, o.id, "placed");
    await queueOrderNotice(db, o.id, "confirmed");
    const results = await Promise.all([dispatchNotifications(), dispatchNotifications(), dispatchNotifications()]);
    expect(results.reduce((s, r) => s + r.sent, 0)).toBe(2);
    const rows = await db.notification.findMany();
    expect(rows.every((r) => r.status === "SENT" && r.attempts === 1)).toBe(true);
  });

  it("a dispatcher that reads a message while another is sending it does not send it again", async () => {
    const o = await onlineOrder();
    await queueOrderNotice(db, o.id, "placed");
    const sends: string[] = [];
    // while the first send is "on the wire", a whole second dispatcher runs (the window the old claim left open)
    providers.slow = {
      name: "slow",
      async send(to) {
        sends.push(to);
        if (sends.length === 1) await dispatchNotifications();
        return { ok: true, ref: `slow-${sends.length}` };
      },
    };
    const before = process.env.NOTIFY_SMS_PROVIDER;
    process.env.NOTIFY_SMS_PROVIDER = "slow";
    try {
      await dispatchNotifications();
      expect(sends).toHaveLength(1);
      expect(await db.notification.findFirstOrThrow()).toMatchObject({ status: "SENT", attempts: 1 });
    } finally {
      if (before === undefined) delete process.env.NOTIFY_SMS_PROVIDER; else process.env.NOTIFY_SMS_PROVIDER = before;
      delete providers.slow;
    }
  });

  it("retries a message whose dispatcher crashed mid-send, but not a fresh claim", async () => {
    const o = await onlineOrder();
    await queueOrderNotice(db, o.id, "placed");
    await queueOrderNotice(db, o.id, "confirmed");
    const [stale, fresh] = await db.notification.findMany({ orderBy: { createdAt: "asc" } });
    await db.notification.update({ where: { id: stale.id }, data: { status: "SENDING", attempts: 1, claimedAt: new Date(Date.now() - 11 * 60_000) } });
    await db.notification.update({ where: { id: fresh.id }, data: { status: "SENDING", attempts: 1, claimedAt: new Date() } });
    expect((await dispatchNotifications()).sent).toBe(1);
    expect(await db.notification.findUniqueOrThrow({ where: { id: stale.id } })).toMatchObject({ status: "SENT", attempts: 2 });
    expect((await db.notification.findUniqueOrThrow({ where: { id: fresh.id } })).status).toBe("SENDING");
  });

  it("keeps SMS copy to roughly one segment", async () => {
    const o = await onlineOrder();
    for (const n of ["placed", "confirmed", "out_for_delivery", "cancelled"] as const) {
      expect(renderSms(n, { ...o, carrier: null, trackingNumber: null }).length).toBeLessThanOrEqual(170);
    }
  });
});

describe("COD verification call", () => {
  beforeEach(resetDb);

  it("confirmed → order confirmed; fake → cancelled and restocked; no answer → logged", async () => {
    actAs(await makeUser("STAFF"));
    const a = await onlineOrder();
    const b = await onlineOrder();
    expect((await recordCall(a.id, "NO_ANSWER")).ok).toBe(true);
    expect((await db.order.findUniqueOrThrow({ where: { id: a.id } })).callAttempts).toBe(1);
    expect((await recordCall(a.id, "CONFIRMED", "Deliver after 5pm")).ok).toBe(true);
    expect(await db.order.findUniqueOrThrow({ where: { id: a.id } })).toMatchObject({ status: "CONFIRMED", callOutcome: "CONFIRMED", callAttempts: 2 });

    const stockBefore = (await db.variant.findFirstOrThrow({ where: { orderItems: { some: { orderId: b.id } } } })).stock;
    expect((await recordCall(b.id, "REJECTED")).ok).toBe(true);
    expect((await db.order.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("CANCELLED");
    expect((await db.variant.findFirstOrThrow({ where: { orderItems: { some: { orderId: b.id } } } })).stock).toBe(stockBefore + 1);
    expect((await recordCall(b.id, "CONFIRMED")).ok).toBe(false); // already cancelled
  });
});

describe("COD remittance", () => {
  beforeEach(resetDb);

  it("records what the courier paid, flags shortfalls, and never counts an order twice", async () => {
    actAs(await makeUser("MANAGER"));
    const o1 = await onlineOrder({ status: "DELIVERED", carrier: "NCM", total: 150_000 });
    const o2 = await onlineOrder({ status: "DELIVERED", carrier: "NCM", total: 250_000 });
    const pendingOrder = await onlineOrder({ status: "PENDING", carrier: "NCM" });
    expect((await recordCodRemittance({ carrier: "NCM", reference: "BANK-1", received: 395_000, orderIds: [o1.id, pendingOrder.id] })).ok).toBe(false);
    expect((await recordCodRemittance({ carrier: "NCM", reference: "BANK-1", received: 395_000, orderIds: [o1.id, o2.id] })).ok).toBe(true);
    const rem = await db.codRemittance.findFirstOrThrow();
    expect(rem).toMatchObject({ expected: 400_000, received: 395_000 });
    expect((await recordCodRemittance({ carrier: "NCM", reference: "BANK-2", received: 150_000, orderIds: [o1.id] })).ok).toBe(false);
  });

  it("cashiers can't record remittances", async () => {
    actAs(await makeUser("CASHIER"));
    const o = await onlineOrder({ status: "DELIVERED", carrier: "NCM" });
    await expect(recordCodRemittance({ carrier: "NCM", reference: "X1", received: 1, orderIds: [o.id] })).rejects.toThrow(/NEXT_REDIRECT/);
  });
});
