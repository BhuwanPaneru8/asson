import { describe, expect, it } from "vitest";
import { change, median, monthEnd, unusual } from "@/lib/kpi-core";

describe("is it unusual?", () => {
  it("compares with the usual level, robustly", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    const sundays = [100, 110, 95, 105, 98, 102, 400]; // one big sale day in the history
    expect(unusual(102, sundays)).toMatchObject({ level: "normal", strength: null });
    expect(unusual(30, sundays)).toMatchObject({ level: "low", strength: "unusual" }); // the spike doesn't hide a collapse
    expect(unusual(140, sundays)).toMatchObject({ level: "high" });
  });

  it("doesn't cry wolf on steady series or with too little history", () => {
    expect(unusual(104, [100, 100, 100, 100]).strength).toBeNull(); // a 4% wobble on a flat line
    expect(unusual(500, [100, 100])).toMatchObject({ z: null, strength: null });
    expect(unusual(1, [0, 0, 0, 0], { minSpread: 2 }).strength).toBeNull(); // one order on a usually empty day
  });
});

describe("month end", () => {
  it("adds each remaining day at its weekday's usual level, with a range", () => {
    const byWeekday = [[10, 10, 10, 10], [20, 20, 20, 20], [], [], [], [], [0, 0, 0, 0]];
    const f = monthEnd(100, byWeekday, [0, 1, 6, 0]); // Sun, Mon, Sat, Sun left
    expect(f.expected).toBe(100 + 10 + 20 + 0 + 10);
    expect(f.low).toBe(f.expected); // no variation, no range
    const g = monthEnd(100, [[5, 15, 10, 10], [], [], [], [], [], []], [0, 0]);
    expect(g.low).toBeLessThan(g.expected);
    expect(g.high).toBeGreaterThan(g.expected);
  });

  it("change is a share, or nothing without a base", () => {
    expect(change(120, 100)).toBe(0.2);
    expect(change(5, 0)).toBeNull();
  });
});
