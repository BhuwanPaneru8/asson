// KPI pulse maths, pure so it's unit-tested (tests/unit/kpi.test.ts).
//  • Is today unusual? Compare it with the same weekday over the last weeks (shops in Nepal have strong weekday
//    patterns: Saturday is the day off, Friday evenings are busy). Robust statistics: the median, and the median
//    absolute deviation (MAD) scaled to a standard deviation, so one huge sale day in the history can't hide a
//    real drop. |z| ≥ 3 is unusual; ≥ 2 is worth a look.
//  • Where will the month end? The month so far, plus each remaining day at its weekday's usual level, with a
//    range from how much those weekdays vary.

export const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export type Verdict = { usual: number; z: number | null; level: "high" | "low" | "normal"; strength: "unusual" | "notable" | null };

/** How unusual `value` is against `history` (the same weekday in earlier weeks). Needs 4+ points. */
export function unusual(value: number, history: number[], opts: { minSpread?: number } = {}): Verdict {
  const usual = median(history);
  if (history.length < 4) return { usual, z: null, level: "normal", strength: null };
  const mad = median(history.map((x) => Math.abs(x - usual))) * 1.4826;
  // a floor on the spread: a steady series (MAD 0) would otherwise call any wobble "unusual"
  const spread = Math.max(mad, opts.minSpread ?? 0, Math.abs(usual) * 0.1, 1e-9);
  const z = Math.round(((value - usual) / spread) * 10) / 10;
  const strength = Math.abs(z) >= 3 ? "unusual" : Math.abs(z) >= 2 ? "notable" : null;
  return { usual, z, level: strength ? (z > 0 ? "high" : "low") : "normal", strength };
}

/**
 * Month-end forecast. `days` are this month's daily values so far (1st … yesterday); `byWeekday[w]` are recent
 * values for weekday w (0 = Sunday); `remaining` are the weekdays of the days left (today included).
 */
export function monthEnd(soFar: number, byWeekday: number[][], remaining: number[]) {
  let rest = 0, varSum = 0;
  for (const w of remaining) {
    const h = byWeekday[w] ?? [];
    const m = median(h);
    rest += m;
    const sd = median(h.map((x) => Math.abs(x - m))) * 1.4826;
    varSum += sd * sd;
  }
  const margin = 1.28 * Math.sqrt(varSum); // 80% range
  return { expected: Math.round(soFar + rest), low: Math.round(soFar + Math.max(0, rest - margin)), high: Math.round(soFar + rest + margin) };
}

/** Change as a share, or null when there's nothing to compare with. */
export const change = (now: number, before: number) => (before ? Math.round(((now - before) / before) * 1000) / 1000 : null);
