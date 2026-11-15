// Bikram Sambat (BS) dates for tax documents. Nepal's calendar isn't computed: month lengths are published each
// year (Nepal Panchanga Nirnayak Samiti), so this is a table. Anchor: 1 Baisakh 2080 = 14 April 2023 (AD).
// Checked against known dates (tests/unit/nepali-calendar.test.ts): 1 Shrawan 2081 = 16 Jul 2024, 1 Baisakh
// 2083 = 14 Apr 2026, 1 Shrawan 2083 = 17 Jul 2026. Years from 2084 on are the commonly published projection:
// check them against the official calendar when it comes out (docs/Tax-Invoices.md). Client-safe (no server-only).

const FIRST_YEAR = 2080;
const ANCHOR = Date.UTC(2023, 3, 14); // 2080-01-01 BS
// days in Baisakh … Chaitra, per year
const MONTHS: number[][] = [
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30], // 2080
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31], // 2081
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30], // 2082
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30], // 2083
  [31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 30, 30], // 2084
  [31, 32, 31, 32, 30, 31, 30, 30, 29, 30, 30, 30], // 2085
  [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30], // 2086
  [31, 31, 32, 31, 31, 31, 30, 30, 29, 30, 30, 30], // 2087
  [30, 31, 32, 32, 30, 31, 30, 30, 29, 30, 30, 30], // 2088
];
export const BS_RANGE = { from: FIRST_YEAR, to: FIRST_YEAR + MONTHS.length - 1 };

export const BS_MONTHS = ["Baisakh", "Jestha", "Asar", "Shrawan", "Bhadra", "Ashwin", "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra"] as const;

export type BsDate = { year: number; month: number; day: number }; // month 1–12

export class CalendarError extends Error {}

/** BS date of an AD calendar day (YYYY-MM-DD, Nepal's date). */
export function toBs(ad: string): BsDate {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ad);
  if (!m) throw new CalendarError(`Not a date: ${ad}`);
  let days = (Date.UTC(+m[1], +m[2] - 1, +m[3]) - ANCHOR) / 86_400_000;
  if (days < 0) throw new CalendarError(`${ad} is before ${FIRST_YEAR} BS: the calendar table doesn't cover it.`);
  for (let y = 0; y < MONTHS.length; y++) {
    for (let mo = 0; mo < 12; mo++) {
      if (days < MONTHS[y][mo]) return { year: FIRST_YEAR + y, month: mo + 1, day: days + 1 };
      days -= MONTHS[y][mo];
    }
  }
  throw new CalendarError(`${ad} is after ${BS_RANGE.to} BS: add the next years to lib/nepali-calendar.ts.`);
}

/** AD date (YYYY-MM-DD) of a BS date. */
export function toAd(bs: BsDate): string {
  const y = bs.year - FIRST_YEAR;
  if (y < 0 || y >= MONTHS.length || bs.month < 1 || bs.month > 12 || bs.day < 1 || bs.day > MONTHS[y][bs.month - 1]) throw new CalendarError("That BS date isn't in the calendar table.");
  let days = bs.day - 1;
  for (let i = 0; i < y; i++) days += MONTHS[i].reduce((a, b) => a + b, 0);
  for (let i = 0; i < bs.month - 1; i++) days += MONTHS[y][i];
  return new Date(ANCHOR + days * 86_400_000).toISOString().slice(0, 10);
}

const pad = (n: number) => String(n).padStart(2, "0");
/** "2083-07-29" */
export const bsIso = (b: BsDate) => `${b.year}-${pad(b.month)}-${pad(b.day)}`;
/** "29 Kartik 2083" */
export const bsLong = (b: BsDate) => `${b.day} ${BS_MONTHS[b.month - 1]} ${b.year}`;

/** Nepal's fiscal year (Shrawan–Asar) of a BS date, labelled like the fiscal-year close: "2083/84". */
export function fiscalYearOf(b: BsDate) {
  const start = b.month >= 4 ? b.year : b.year - 1;
  return `${start}/${pad((start + 1) % 100)}`;
}
