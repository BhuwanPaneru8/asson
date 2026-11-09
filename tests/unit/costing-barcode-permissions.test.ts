import { describe, expect, it } from "vitest";
import { landedUnitCost, marginPercent, refundPerUnit, weightedAverageCost } from "@/lib/costing";
import { code128Widths, code128Svg } from "@/lib/barcode";
import { can, discountLimitPercent, homeFor } from "@/lib/permissions";
import { TRANSITIONS } from "@/lib/order-status";

describe("costing", () => {
  it("spreads freight over lines by value", () => {
    // goods Rs 2,61,720 + Rs 8,000 freight → a Rs 1,454 item lands at ≈ Rs 1,498.44
    expect(landedUnitCost(145_400, 800_000, 26_172_000)).toBe(149_844);
    expect(landedUnitCost(145_400, 0, 26_172_000)).toBe(145_400);
  });
  it("blends receipts into a weighted-average cost", () => {
    expect(weightedAverageCost(35, 145_400, 30, 149_844)).toBe(147_451);
    expect(weightedAverageCost(0, 145_400, 30, 149_844)).toBe(149_844); // nothing on hand → new cost
    expect(weightedAverageCost(-2, 100_000, 5, 120_000)).toBe(120_000); // negative stock ignored
    expect(weightedAverageCost(10, null, 5, 120_000)).toBe(120_000);
  });
  it("refunds no more than was paid per unit", () => {
    // Rs 7,997 bag with Rs 799 off → a Rs 2,399 shirt refunds Rs 2,159.30 (floored)
    expect(refundPerUnit(239_900, 799_700, 79_900)).toBe(215_930);
    expect(refundPerUnit(239_900, 239_900, 0)).toBe(239_900);
    expect(refundPerUnit(100, 0, 0)).toBe(100);
  });
  it("computes margins", () => {
    expect(marginPercent(1000, 450)).toBe(55);
    expect(marginPercent(0, 10)).toBe(0);
  });
});

describe("Code 128 barcodes", () => {
  it("encodes start B, data, checksum and stop", () => {
    const w = code128Widths("AS-01104");
    // 1 start + 8 chars + checksum = 10 symbols × 6 widths, + stop (7) = 67
    expect(w).toHaveLength(67);
    expect(w.slice(0, 6)).toEqual([2, 1, 1, 2, 1, 4]); // Start B
    expect(w.slice(-7)).toEqual([2, 3, 3, 1, 1, 1, 2]); // Stop
    // every symbol is 11 modules wide
    for (let i = 0; i < 60; i += 6) expect(w.slice(i, i + 6).reduce((a, b) => a + b, 0)).toBe(11);
  });
  it("rejects characters outside printable ASCII", () => {
    expect(() => code128Widths("नेपाल")).toThrow();
  });
  it("renders an accessible SVG", () => {
    expect(code128Svg("AS-1")).toContain('aria-label="Barcode AS-1"');
  });
});

describe("permissions (segregation of duties)", () => {
  it("cashiers sell but cannot touch stock, prices, closing or profit", () => {
    expect(can("CASHIER", "pos.sell")).toBe(true);
    for (const p of ["inventory.adjust", "catalog.edit", "closing", "finance", "orders", "approve.return", "approve.discount"] as const) expect(can("CASHIER", p)).toBe(false);
    expect(homeFor("CASHIER")).toBe("/admin/pos");
  });
  it("managers approve and close, but never see profit or change prices", () => {
    for (const p of ["approve.discount", "approve.return", "closing", "inventory.adjust", "purchasing"] as const) expect(can("MANAGER", p)).toBe(true);
    for (const p of ["finance", "catalog.edit", "delivery", "team.manage"] as const) expect(can("MANAGER", p)).toBe(false);
  });
  it("customers have no admin permissions", () => {
    expect(can("CUSTOMER", "dashboard")).toBe(false);
    expect(can(null, "dashboard")).toBe(false);
  });
  it("discount limits: cashier 5%, manager 15%, owner unlimited", () => {
    expect(discountLimitPercent("CASHIER")).toBe(5);
    expect(discountLimitPercent("MANAGER")).toBe(15);
    expect(discountLimitPercent("ADMIN")).toBe(100);
    expect(discountLimitPercent("STAFF")).toBe(0);
  });
});

describe("order state machine", () => {
  it("never allows leaving a terminal state", () => {
    expect(TRANSITIONS.CANCELLED).toEqual([]);
    expect(TRANSITIONS.RETURNED).toEqual([]);
  });
  it("cannot cancel once shipped", () => {
    expect(TRANSITIONS.SHIPPED).not.toContain("CANCELLED");
    expect(TRANSITIONS.OUT_FOR_DELIVERY).not.toContain("CANCELLED");
  });
  it("returns only after delivery", () => {
    const fromReturnable = Object.entries(TRANSITIONS).filter(([, to]) => to.includes("RETURN_REQUESTED")).map(([s]) => s);
    expect(fromReturnable).toEqual(["DELIVERED"]);
  });
});
