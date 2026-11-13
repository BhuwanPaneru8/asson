// Demand forecasting, pure so it's unit-tested (tests/unit/forecast.test.ts). Input: units sold per week, oldest
// first. Two methods, chosen by the shape of the history:
//   • Regular sellers: Holt's damped trend (exponential smoothing of level and trend; the trend fades so a hot
//     month isn't projected forever). Parameters are picked by trying a small grid and keeping the lowest
//     one-step-ahead error on the history itself.
//   • Slow, lumpy sellers (more than half the weeks with no sale): Croston's method with the SBA correction,
//     which forecasts the average rate instead of chasing zeros and spikes.
// Festival weeks (Dashain, Tihar…) are scaled by an uplift: learnt from last year's festival weeks when there are
// enough, otherwise the shop's default. The spread of past errors gives an 80% range.

export type Forecast = {
  method: "holt" | "croston" | "none";
  perWeek: number[]; // the next `horizon` weeks, units
  total: number;
  low: number; // 80% range for the total
  high: number;
  trend: "rising" | "falling" | "steady" | "new";
  /** last 4 weeks vs the 4 before, as a share (0.25 = 25% up) */
  change: number | null;
};

const sum = (a: number[]) => a.reduce((s, x) => s + x, 0);
const round1 = (x: number) => Math.round(x * 10) / 10;

/** Holt's damped trend. Returns one-step-ahead fitted values and the final level and trend. */
export function holt(y: number[], alpha: number, beta: number, phi: number) {
  let level = y[0], trend = y.length > 1 ? y[1] - y[0] : 0;
  const fitted: number[] = [y[0]];
  for (let t = 1; t < y.length; t++) {
    const f = level + phi * trend;
    fitted.push(f);
    const prev = level;
    level = alpha * y[t] + (1 - alpha) * (level + phi * trend);
    trend = beta * (level - prev) + (1 - beta) * phi * trend;
  }
  return { fitted, level, trend };
}

/** Croston with the Syntetos–Boylan correction: average demand per week for intermittent sales. */
export function croston(y: number[], alpha = 0.1) {
  let z: number | null = null, p: number | null = null, q = 1;
  for (const v of y) {
    if (v > 0) {
      z = z == null ? v : alpha * v + (1 - alpha) * z;
      p = p == null ? q : alpha * q + (1 - alpha) * p;
      q = 1;
    } else q++;
  }
  if (z == null || p == null) return 0;
  return (1 - alpha / 2) * (z / p);
}

/**
 * Forecast the next `horizon` weeks. `festival[i]` says whether future week i is a festival week; `pastFestival`
 * marks the history the same way (to learn the uplift and to keep festival spikes out of the base level).
 */
export function forecast(history: number[], opts: { horizon?: number; festival?: boolean[]; pastFestival?: boolean[]; defaultUplift?: number } = {}): Forecast {
  const horizon = opts.horizon ?? 8;
  const nonzero = history.filter((x) => x > 0).length;
  const recent = sum(history.slice(-4)), before = sum(history.slice(-8, -4));
  const change = history.length >= 8 && before > 0 ? round1(((recent - before) / before) * 100) / 100 : null;
  if (!nonzero) return { method: "none", perWeek: Array(horizon).fill(0), total: 0, low: 0, high: 0, trend: history.length < 8 ? "new" : "steady", change };

  // festival uplift: last year's festival weeks against the ordinary weeks around them
  const pastF = opts.pastFestival ?? [];
  const fw = history.filter((_, i) => pastF[i]), ow = history.filter((_, i) => !pastF[i]);
  const learnt = fw.length >= 2 && sum(ow) > 0 ? (sum(fw) / fw.length) / (sum(ow) / ow.length) : null;
  const uplift = Math.min(4, Math.max(1, learnt ?? opts.defaultUplift ?? 1.5));
  // the base series without festival spikes
  const base = history.map((v, i) => (pastF[i] ? v / uplift : v));

  let perWeekBase: number[], residuals: number[], method: Forecast["method"];
  if (nonzero / history.length < 0.5 || history.length < 6) {
    const rate = croston(base);
    perWeekBase = Array(horizon).fill(rate);
    residuals = base.map((v) => v - rate);
    method = "croston";
  } else {
    let best: { err: number; fit: ReturnType<typeof holt>; phi: number } | null = null;
    for (const alpha of [0.1, 0.2, 0.3, 0.5]) for (const beta of [0.05, 0.1, 0.2]) {
      const fit = holt(base, alpha, beta, 0.9);
      const err = sum(fit.fitted.slice(1).map((f, t) => (base[t + 1] - f) ** 2));
      if (!best || err < best.err) best = { err, fit, phi: 0.9 };
    }
    const { fit, phi } = best!;
    let damp = 0;
    perWeekBase = Array.from({ length: horizon }, (_, h) => { damp += phi ** (h + 1); return Math.max(0, fit.level + damp * fit.trend); });
    residuals = fit.fitted.slice(1).map((f, t) => base[t + 1] - f);
    method = "holt";
  }
  const perWeek = perWeekBase.map((v, i) => round1(v * (opts.festival?.[i] ? uplift : 1)));
  const total = round1(sum(perWeek));
  // 80% range for the total: weekly error spread, growing with the square root of the horizon
  const sd = Math.sqrt(sum(residuals.map((r) => r * r)) / Math.max(1, residuals.length - 1));
  const margin = 1.28 * sd * Math.sqrt(horizon);
  const trend: Forecast["trend"] = history.length < 8 ? "new" : change == null ? "steady" : change >= 0.25 && recent >= 4 ? "rising" : change <= -0.25 && before >= 4 ? "falling" : "steady";
  return { method, perWeek, total, low: round1(Math.max(0, total - margin)), high: round1(total + margin), trend, change };
}

/**
 * What to do about stock: days it lasts at the forecast rate, the day it runs out, and how much to order so it
 * lasts `coverDays` after a reorder arrives in `leadDays` (minus what's already on order).
 */
export function stockPlan(f: Pick<Forecast, "perWeek" | "high">, stock: number, onOrder: number, opts: { leadDays: number; coverDays: number; today: string }) {
  const daily = f.perWeek.length ? sum(f.perWeek) / (f.perWeek.length * 7) : 0;
  const daysLeft = daily > 0 ? Math.floor(stock / daily) : null;
  const runsOut = daysLeft == null ? null : new Date(Date.parse(`${opts.today}T00:00:00Z`) + daysLeft * 86_400_000).toISOString().slice(0, 10);
  const need = Math.ceil(daily * (opts.leadDays + opts.coverDays));
  const reorder = Math.max(0, need - stock - onOrder);
  const urgent = daysLeft != null && daysLeft <= opts.leadDays;
  return { daily: round1(daily), daysLeft, runsOut, reorder, urgent };
}
