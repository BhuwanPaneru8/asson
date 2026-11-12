import { describe, expect, it } from "vitest";
import { croston, forecast, holt, stockPlan } from "@/lib/forecast-core";

describe("forecasting", () => {
  it("steady sales forecast steady", () => {
    const f = forecast(Array(16).fill(10), { horizon: 4 });
    expect(f.method).toBe("holt");
    expect(f.perWeek).toEqual([10, 10, 10, 10]);
    expect(f.total).toBe(40);
    expect(f.trend).toBe("steady");
  });

  it("follows a rising seller up, but damps the trend instead of projecting it forever", () => {
    const y = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
    const f = forecast(y, { horizon: 8 });
    expect(f.trend).toBe("rising");
    expect(f.perWeek[0]).toBeGreaterThan(16);
    const steps = f.perWeek.slice(1).map((v, i) => v - f.perWeek[i]);
    expect(steps.at(-1)!).toBeLessThan(steps[0]); // growth slows
    expect(f.low).toBeLessThanOrEqual(f.total);
    expect(f.high).toBeGreaterThanOrEqual(f.total);
  });

  it("flags falling demand", () => {
    expect(forecast([20, 20, 20, 20, 20, 20, 20, 20, 12, 10, 9, 8]).trend).toBe("falling");
  });

  it("slow, lumpy sellers use Croston: the average rate, not the last spike", () => {
    const y = [0, 0, 6, 0, 0, 0, 3, 0, 0, 0, 0, 3];
    const f = forecast(y, { horizon: 4 });
    expect(f.method).toBe("croston");
    expect(f.perWeek[0]).toBeGreaterThan(0.5);
    expect(f.perWeek[0]).toBeLessThan(2); // ~12 units over 12 weeks
    expect(croston([0, 0, 0])).toBe(0);
  });

  it("festival weeks get last year's uplift, learnt from history", () => {
    const history = Array(20).fill(10).map((v, i) => (i === 5 || i === 6 ? 30 : v)); // Dashain last year: 3×
    const pastFestival = history.map((_, i) => i === 5 || i === 6);
    const f = forecast(history, { horizon: 4, pastFestival, festival: [false, true, true, false] });
    expect(f.perWeek[0]).toBeCloseTo(10, 0);
    expect(f.perWeek[1]).toBeCloseTo(30, 0);
    expect(f.perWeek[3]).toBeCloseTo(10, 0);
  });

  it("without festival history, the shop's default uplift applies", () => {
    const f = forecast(Array(12).fill(10), { horizon: 2, festival: [true, false], defaultUplift: 1.5 });
    expect(f.perWeek).toEqual([15, 10]);
  });

  it("never sold: no forecast, marked new while there's little history", () => {
    expect(forecast([0, 0, 0])).toMatchObject({ method: "none", total: 0, trend: "new" });
  });

  it("Holt's fitted values are one step behind the data", () => {
    const { fitted } = holt([1, 2, 3], 0.5, 0.1, 1);
    expect(fitted).toHaveLength(3);
    expect(fitted[0]).toBe(1);
  });
});

describe("stock plan", () => {
  it("days of stock, the day it runs out, and what to order to last through lead time and cover", () => {
    const p = stockPlan({ perWeek: [7, 7, 7, 7], high: 30 }, 20, 5, { leadDays: 14, coverDays: 30, today: "2026-11-13" });
    expect(p).toEqual({ daily: 1, daysLeft: 20, runsOut: "2026-12-03", reorder: 44 - 20 - 5, urgent: false });
    expect(stockPlan({ perWeek: [14, 14], high: 30 }, 10, 0, { leadDays: 14, coverDays: 30, today: "2026-11-13" }).urgent).toBe(true); // runs out before a reorder could arrive
    expect(stockPlan({ perWeek: [0, 0], high: 0 }, 10, 0, { leadDays: 14, coverDays: 30, today: "2026-11-13" })).toMatchObject({ daysLeft: null, runsOut: null, reorder: 0 });
  });
});
