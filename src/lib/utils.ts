import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { store } from "./config";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const numberFormatter = new Intl.NumberFormat(store.numberLocale, { maximumFractionDigits: 0 });

/** Format an amount stored in paisa, e.g. 249900 -> "Rs. 2,499". */
export function formatPrice(paisa: number) {
  const n = Math.round(paisa) / 100;
  return `${n < 0 ? "-" : ""}${store.currencySymbol} ${numberFormatter.format(Math.abs(n))}`;
}

export function formatNumber(n: number) {
  return numberFormatter.format(n);
}

export function discountPercent(price: number, compareAt?: number | null) {
  if (!compareAt || compareAt <= price) return 0;
  return Math.round(((compareAt - price) / compareAt) * 100);
}

export function formatOrderNumber(n: number) {
  return `${store.orderPrefix}${String(n).padStart(6, "0")}`;
}

export function parseOrderNumber(s: string): number | null {
  const m = s.trim().toUpperCase().replace(store.orderPrefix, "").replace(/^#/, "");
  const n = Number.parseInt(m, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

type AddressLike = { fullName?: string; phone?: string; line1?: string; line2?: string | null; city?: string; district?: string | null; state?: string; postalCode?: string | null };

/** Address as display lines: "Tole, landmark" / "City, District" / "Province Province 44600". */
export function addressLines(a: AddressLike): string[] {
  if (!a?.line1) return []; // store sales have no delivery address
  const place = [a.city, a.district && a.district !== a.city ? a.district : null].filter(Boolean).join(", ");
  return [
    [a.line1, a.line2].filter(Boolean).join(", "),
    place,
    `${a.state} Province${a.postalCode ? ` ${a.postalCode}` : ""}`,
  ].filter(Boolean);
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: store.timeZone });
const dateTimeFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true, timeZone: store.timeZone,
});
const shortDateFmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: store.timeZone });
export const formatShortDate = (d: Date | string) => shortDateFmt.format(new Date(d));
export const formatDate = (d: Date | string) => dateFmt.format(new Date(d));
export const formatDateTime = (d: Date | string) => dateTimeFmt.format(new Date(d));

/** Current time — kept out of component bodies so render stays pure. */
export const now = () => Date.now();

/** Read a single string out of Next's searchParams record. */
export function sp(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}
export function spList(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return (Array.isArray(v) ? v : v.split(",")).flatMap((x) => x.split(",")).filter(Boolean);
}

/** Resize an Unsplash (or compatible) image URL; other URLs pass through untouched. */
export function img(url: string, w: number) {
  if (url.includes("images.unsplash.com")) {
    const u = new URL(url);
    u.searchParams.set("w", String(w));
    u.searchParams.set("q", "75");
    u.searchParams.set("auto", "format");
    u.searchParams.set("fit", "crop");
    return u.toString();
  }
  return url;
}
