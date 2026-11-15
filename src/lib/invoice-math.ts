// Figures for a tax invoice or credit note, from VAT-inclusive prices (paisa). Client-safe and pure.
// The VAT is split from the document total exactly as the registers and the VAT return do (splitVat on the
// total), so invoices, the sales register and the VAT return always agree to the paisa. Line amounts are shown
// before VAT (the IRD format: amount, discount, taxable amount, VAT 13%, total); rounding is put on the largest
// line so that  Σ lines − discount = taxable  and  taxable + VAT = total  hold exactly.

export type InLine = { name: string; sku?: string; quantity: number; amount: number }; // amount incl. VAT
export type DocLine = { name: string; sku: string; quantity: number; rate: number; amount: number }; // excl. VAT
export type DocFigures = { lines: DocLine[]; gross: number; discount: number; taxable: number; vat: number; total: number };

export function vatOf(inclusive: number, percent: number) {
  return Math.round((inclusive * percent) / (100 + percent));
}
const exclusive = (inclusive: number, percent: number) => Math.round((inclusive * 100) / (100 + percent));

/** `total` is what the customer paid (incl. VAT); anything the lines add up to above it is the discount. */
export function documentFigures(lines: InLine[], total: number, percent: number): DocFigures {
  if (!lines.length) throw new Error("A tax document needs at least one line.");
  if (!Number.isInteger(total) || total < 0) throw new Error("The total must be whole paisa.");
  const grossIncl = lines.reduce((s, l) => s + l.amount, 0);
  if (total > grossIncl) throw new Error("The total can't be more than the lines.");
  const vat = vatOf(total, percent);
  const taxable = total - vat;
  const gross = taxable + exclusive(grossIncl - total, percent);
  const out = lines.map((l) => ({ name: l.name, sku: l.sku ?? "", quantity: l.quantity, rate: 0, amount: exclusive(l.amount, percent) }));
  const big = out.reduce((b, l, i) => (l.amount > out[b].amount ? i : b), 0);
  out[big].amount += gross - out.reduce((s, l) => s + l.amount, 0);
  for (const l of out) l.rate = l.quantity ? Math.round(l.amount / l.quantity) : l.amount;
  return { lines: out, gross, discount: gross - taxable, taxable, vat, total };
}

/** Rupees and paisa as plain text for documents: 1234.5 → "1,234.50" (lakh grouping). */
export function amountText(paisa: number) {
  const sign = paisa < 0 ? "-" : "";
  const abs = Math.abs(paisa);
  return `${sign}${new Intl.NumberFormat("en-IN").format(Math.floor(abs / 100))}.${String(abs % 100).padStart(2, "0")}`;
}

const ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
function under1000(n: number): string {
  const h = Math.floor(n / 100), r = n % 100;
  const rest = r < 20 ? ONES[r] : `${TENS[Math.floor(r / 10)]}${r % 10 ? `-${ONES[r % 10]}` : ""}`;
  return [h ? `${ONES[h]} hundred` : "", rest].filter(Boolean).join(" ");
}

/** The total in words, Nepali style (crore, lakh, thousand): 123456789 paisa → "Twelve lakh thirty-four thousand … rupees and eighty-nine paisa only". */
export function amountInWords(paisa: number) {
  let n = Math.floor(Math.abs(paisa) / 100);
  const p = Math.abs(paisa) % 100;
  const parts: string[] = [];
  const crore = Math.floor(n / 10_000_000); n %= 10_000_000;
  const lakh = Math.floor(n / 100_000); n %= 100_000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  if (crore) parts.push(`${crore >= 1000 ? `${under1000(Math.floor(crore / 1000))} thousand ${under1000(crore % 1000)}`.trim() : under1000(crore)} crore`);
  if (lakh) parts.push(`${under1000(lakh)} lakh`);
  if (thousand) parts.push(`${under1000(thousand)} thousand`);
  if (n) parts.push(under1000(n));
  const words = `${parts.join(" ") || "zero"} rupees${p ? ` and ${under1000(p)} paisa` : ""} only`;
  return words.charAt(0).toUpperCase() + words.slice(1);
}
