import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { pulse } from "@/lib/pulse";
import { attention } from "@/lib/attention";
import { scopeFor } from "@/lib/scope";
import { makeProduct, makeUser, resetDb } from "../support/db";

type P = Awaited<ReturnType<typeof makeProduct>>;
const DAY = 86_400_000;
const TODAY = "2026-11-13"; // a Friday; yesterday is a Thursday

async function sale(p: P, day: string, qty: number, phone = "9841234567", cost = true) {
  const v = p.variants[0];
  await db.order.create({ data: { email: "x@test.local", phone, status: "DELIVERED", paymentMethod: "COD", subtotal: p.price * qty, total: p.price * qty, shippingMethod: "standard", shippingAddress: {}, createdAt: new Date(`${day}T13:00:00+05:45`),
    items: { create: [{ variantId: v.id, productId: p.id, name: p.name, slug: p.slug, sku: v.sku, color: v.color, size: v.size, image: "", unitPrice: p.price, quantity: qty, unitCost: cost ? p.price / 2 : null }] } } });
}
const daysBefore = (n: number) => new Date(Date.parse(`${TODAY}T00:00:00Z`) - n * DAY).toISOString().slice(0, 10);

describe("KPI pulse", () => {
  let p: P;
  beforeEach(async () => {
    await resetDb();
    p = await makeProduct({ price: 1000 });
    // eight weeks of 4 orders every day (two of them repeat customers)
    for (let d = 2; d <= 57; d++) for (let i = 0; i < 4; i++) await sale(p, daysBefore(d), 1, i < 2 ? "9800000000" : `98${String(d * 10 + i).padStart(8, "0")}`);
  });

  it("an ordinary day is ordinary: nothing flagged, margin worked out from line costs", async () => {
    for (let i = 0; i < 4; i++) await sale(p, daysBefore(1), 1);
    const { kpis } = await pulse(TODAY);
    const k = (key: string) => kpis.find((x) => x.key === key)!;
    expect(k("orders")).toMatchObject({ yesterday: 4, verdict: { usual: 4, strength: null } });
    expect(k("revenue").yesterday).toBe(4 * 1000_00);
    expect(k("aov").yesterday).toBe(1000_00);
    expect(k("margin").yesterday).toBeCloseTo(0.5);
    expect(k("orders").last7).toBe(4 * 7);
  });

  it("a collapse is unusual and goes to Needs attention; a day with no orders has no average, not a zero one", async () => {
    const { kpis } = await pulse(TODAY); // yesterday: nothing sold
    const k = (key: string) => kpis.find((x) => x.key === key)!;
    expect(k("revenue").verdict).toMatchObject({ level: "low", strength: "unusual", usual: 4000_00 });
    expect(k("aov")).toMatchObject({ yesterday: null, verdict: { strength: null } });
    const owner = await makeUser("ADMIN");
    const items = await attention(owner, await scopeFor(owner), new Date(`${TODAY}T10:00:00+05:45`));
    expect(items.find((i) => i.key === "kpi-revenue")).toMatchObject({ tone: "danger", href: "/admin/insights?tab=pulse", text: expect.stringContaining("Sales unusually low yesterday") });
  });

  it("forecasts the month end from the days left, each at its weekday's usual level", async () => {
    const { forecast } = await pulse(TODAY);
    // November so far: 1st–11th (4 orders each) and nothing on the 12th; 18 days left at the usual 4 a day
    expect(forecast.orders.soFar).toBe(11 * 4);
    expect(forecast.daysLeft).toBe(18);
    expect(forecast.orders.expected).toBe(11 * 4 + 18 * 4);
  });
});
