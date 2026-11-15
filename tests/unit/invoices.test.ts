import { describe, expect, it } from "vitest";
import { BS_RANGE, bsIso, fiscalYearOf, toAd, toBs } from "@/lib/nepali-calendar";
import { amountInWords, amountText, documentFigures, vatOf } from "@/lib/invoice-math";

describe("Bikram Sambat calendar", () => {
  it("matches known dates", () => {
    expect(bsIso(toBs("2023-04-14"))).toBe("2080-01-01");
    expect(bsIso(toBs("2024-04-13"))).toBe("2081-01-01");
    expect(bsIso(toBs("2024-07-16"))).toBe("2081-04-01"); // Shrawan 1, FY 2081/82 starts
    expect(bsIso(toBs("2025-04-14"))).toBe("2082-01-01");
    expect(bsIso(toBs("2025-07-17"))).toBe("2082-04-01");
    expect(bsIso(toBs("2026-04-14"))).toBe("2083-01-01");
    expect(bsIso(toBs("2026-07-17"))).toBe("2083-04-01");
    expect(bsIso(toBs("2026-07-16"))).toBe("2083-03-32"); // Asar 2083 has 32 days
  });

  it("round-trips every day of the table", () => {
    for (let d = Date.UTC(2023, 3, 14); ; d += 86_400_000) {
      const ad = new Date(d).toISOString().slice(0, 10);
      let bs;
      try { bs = toBs(ad); } catch { break; }
      expect(toAd(bs)).toBe(ad);
    }
    expect(() => toBs("2023-04-13")).toThrow(/before/);
  });

  it("fiscal years run Shrawan to Asar", () => {
    expect(fiscalYearOf(toBs("2026-07-16"))).toBe("2082/83");
    expect(fiscalYearOf(toBs("2026-07-17"))).toBe("2083/84");
    expect(fiscalYearOf(toBs("2027-04-14"))).toBe("2083/84"); // Baisakh 2084 is still FY 2083/84
    expect(fiscalYearOf({ year: 2099, month: 4, day: 1 })).toBe("2099/00");
  });

  it("covers at least the next year (extend the table from the official calendar before it runs out)", () => {
    const nextYear = new Date(Date.now() + 366 * 86_400_000).toISOString().slice(0, 10);
    expect(toBs(nextYear).year).toBeLessThanOrEqual(BS_RANGE.to);
  });
});

describe("invoice figures", () => {
  it("splits VAT from the total like the registers do, and the lines add up exactly", () => {
    const f = documentFigures([{ name: "Shirt", quantity: 2, amount: 479_800 }, { name: "Delivery charge", quantity: 1, amount: 10_000 }], 459_800, 13);
    expect(f.vat).toBe(vatOf(459_800, 13));
    expect(f.taxable + f.vat).toBe(459_800);
    expect(f.lines.reduce((s, l) => s + l.amount, 0)).toBe(f.gross);
    expect(f.gross - f.discount).toBe(f.taxable);
    expect(f.discount).toBe(Math.round((30_000 * 100) / 113));
  });

  it("holds for awkward amounts with no discount", () => {
    for (const prices of [[99_900, 99_900, 99_900], [123_457], [1, 2, 3], [239_900, 1_499_900, 10_000]]) {
      const lines = prices.map((p, i) => ({ name: `L${i}`, quantity: 1 + i, amount: p }));
      const total = prices.reduce((a, b) => a + b, 0);
      const f = documentFigures(lines, total, 13);
      expect(f.discount).toBe(0);
      expect(f.lines.reduce((s, l) => s + l.amount, 0)).toBe(f.taxable);
      expect(f.taxable + f.vat).toBe(total);
    }
  });

  it("refuses totals above the lines", () => {
    expect(() => documentFigures([{ name: "x", quantity: 1, amount: 100 }], 101, 13)).toThrow();
    expect(() => documentFigures([], 0, 13)).toThrow();
  });

  it("writes amounts and words the Nepali way", () => {
    expect(amountText(12_345_678)).toBe("1,23,456.78");
    expect(amountInWords(113_000)).toBe("One thousand one hundred thirty rupees only");
    expect(amountInWords(12_345_678_950)).toBe("Twelve crore thirty-four lakh fifty-six thousand seven hundred eighty-nine rupees and fifty paisa only");
    expect(amountInWords(0)).toBe("Zero rupees only");
  });
});
