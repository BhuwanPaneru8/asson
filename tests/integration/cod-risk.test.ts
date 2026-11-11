import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { codRiskFor, scoreRisk } from "@/lib/cod-risk";
import { resetDb } from "../support/db";

describe("COD risk on the confirmation-call queue", () => {
  beforeEach(resetDb);

  it("scores from the customer's record, the district and a big first order, with reasons", () => {
    const none = { delivered: 0, returned: 0, refused: 0, fake: 0 };
    expect(scoreRisk(none, null, 200000)).toEqual({ level: "low", reasons: [] });
    expect(scoreRisk({ ...none, delivered: 3 }, null, 200000)).toEqual({ level: "low", reasons: ["3 delivered before"] });
    expect(scoreRisk({ ...none, returned: 1, refused: 1 }, null, 200000)).toEqual({ level: "high", reasons: ["refused 1 parcel before"] });
    expect(scoreRisk({ ...none, delivered: 4, returned: 1, refused: 1 }, null, 200000).level).toBe("medium"); // refused once, but a good customer
    expect(scoreRisk({ ...none, returned: 2 }, null, 200000)).toEqual({ level: "high", reasons: ["2 parcels came back undelivered"] });
    expect(scoreRisk({ ...none, fake: 1, delivered: 2 }, null, 200000).level).toBe("high");
    expect(scoreRisk(none, { name: "Jhapa", shipped: 40, returned: 8 }, 200000)).toEqual({ level: "medium", reasons: ["Jhapa returns 20% of parcels"] });
    expect(scoreRisk(none, { name: "Jhapa", shipped: 10, returned: 5 }, 200000).level).toBe("low"); // too few parcels to judge
    expect(scoreRisk(none, null, 1_500_000)).toEqual({ level: "medium", reasons: ["first delivery, Rs. 15,000"] });
    expect(scoreRisk({ ...none, delivered: 1 }, null, 1_500_000).level).toBe("low");
  });

  it("looks up a page of orders at once: history by phone (not the order itself), district rates over 90 days", async () => {
    let n = 0;
    const order = (phone: string, status: string, o: { district?: string; outcome?: string; total?: number; daysAgo?: number } = {}) => db.order.create({ data: {
      email: `c${++n}@t.l`, phone, status: status as never, paymentMethod: "COD", subtotal: o.total ?? 200000, total: o.total ?? 200000, shippingMethod: "standard",
      callOutcome: (o.outcome ?? "NONE") as never, createdAt: new Date(Date.now() - (o.daysAgo ?? 10) * 86_400_000),
      shippingAddress: { fullName: "X", district: o.district ?? "Kaski" } } });
    const lost = (orderId: string, reason: string) => db.returnToOrigin.create({ data: { orderId, reason: reason as never, carrier: "Pathao Parcel", startedById: "x", state: "LOST", closedAt: new Date(), closedById: "x" } });

    const refuser = await order("9811111111", "CANCELLED");
    await lost(refuser.id, "CUSTOMER_REFUSED");
    for (let i = 0; i < 3; i++) await order("9822222222", "DELIVERED");
    await order("9833333333", "CANCELLED", { outcome: "REJECTED" });
    // Jhapa: 20 shipped in the window, 5 came back; an old return outside the window doesn't count
    for (let i = 0; i < 15; i++) await order(`98400000${String(i).padStart(2, "0")}`, "DELIVERED", { district: "Jhapa" });
    for (let i = 0; i < 5; i++) await lost((await order(`98500000${String(i).padStart(2, "0")}`, "CANCELLED", { district: "Jhapa" })).id, "NOT_REACHABLE");
    await lost((await order("9860000000", "CANCELLED", { district: "Jhapa", daysAgo: 200 })).id, "NOT_REACHABLE");

    const pending = await Promise.all([
      order("9811111111", "PENDING"), order("9822222222", "PENDING", { total: 2_000_000 }), order("9833333333", "PENDING"),
      order("9870000000", "PENDING", { district: "Jhapa" }), order("9880000000", "PENDING"),
    ]);
    const r = await codRiskFor(pending);
    expect(pending.map((o) => r.get(o.id)!.level)).toEqual(["high", "low", "high", "medium", "low"]);
    expect(r.get(pending[0].id)!.reasons).toEqual(["refused 1 parcel before"]);
    expect(r.get(pending[1].id)!.reasons).toEqual(["3 delivered before"]); // a big order from a good customer is fine
    expect(r.get(pending[3].id)!.reasons).toEqual(["Jhapa returns 25% of parcels"]);
    expect(r.get(pending[4].id)!.reasons).toEqual([]);
    expect((await codRiskFor([])).size).toBe(0);
  });
});
