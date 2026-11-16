// Client-safe delivery logic. The server loads rates from the DB (lib/delivery.ts); UI and pricing share these helpers.
import { store, zoneOf, provinceOf, type ShippingMethodId, type Zone } from "./config";

export type DeliveryRate = {
  district: string;
  province: string;
  zone: Zone;
  fee: number; // paisa
  etaMinDays: number;
  etaMaxDays: number;
  expressAvailable: boolean;
  codAvailable: boolean;
  serviceable: boolean;
};
export type RateMap = Record<string, DeliveryRate>;

/** Config-based rate for a district — used to seed and as a fallback if a row is missing. */
export function defaultRate(district: string): DeliveryRate {
  const zone = zoneOf(district);
  const z = store.shipping.zones[zone];
  return {
    district,
    province: provinceOf(district) ?? "",
    zone,
    fee: z.fee,
    etaMinDays: z.etaMinDays,
    etaMaxDays: z.etaMaxDays,
    expressAvailable: z.express,
    codAvailable: true,
    serviceable: true,
  };
}

export function rateFor(rates: RateMap, district: string | null | undefined): DeliveryRate | null {
  if (!district) return null;
  return rates[district] ?? defaultRate(district);
}

export function etaLabel(rate: DeliveryRate, method: ShippingMethodId = "standard") {
  if (method === "express" && rate.expressAvailable) return store.shipping.express.eta;
  return rate.etaMinDays === rate.etaMaxDays ? `${rate.etaMinDays} day${rate.etaMinDays > 1 ? "s" : ""}` : `${rate.etaMinDays}–${rate.etaMaxDays} days`;
}

/** Fee for a method to a district. Free standard delivery covers the standard part of express. */
export function deliveryFee(method: ShippingMethodId, rate: DeliveryRate, subtotalAfterDiscount: number, freeShipping: boolean) {
  const freeStandard = freeShipping || subtotalAfterDiscount >= store.shipping.freeThreshold;
  if (method === "express" && rate.expressAvailable) {
    return freeStandard ? Math.max(0, store.shipping.express.fee - rate.fee) : store.shipping.express.fee;
  }
  return freeStandard ? 0 : rate.fee;
}

/** Saturday is Nepal's weekly holiday: couriers don't deliver, so it never counts as a delivery day. */
const KTM_OFFSET_MS = (5 * 60 + 45) * 60_000;
const isSaturdayInNepal = (d: Date) => new Date(d.getTime() + KTM_OFFSET_MS).getUTCDay() === 6;

/** `days` delivery days after `from`, skipping Saturdays. */
export function addDeliveryDays(from: Date, days: number) {
  const d = new Date(from);
  for (let left = days; left > 0; ) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (!isSaturdayInNepal(d)) left--;
  }
  return d;
}

/** Earliest and latest arrival for an order placed at `from`. */
export function etaRange(rate: DeliveryRate, from = new Date(), method: ShippingMethodId = "standard"): [Date, Date] {
  if (method === "express" && rate.expressAvailable) { const d = addDeliveryDays(from, 1); return [d, d]; }
  return [addDeliveryDays(from, rate.etaMinDays), addDeliveryDays(from, rate.etaMaxDays)];
}

/** The latest arrival date (the promise to keep). */
export function etaDate(rate: DeliveryRate, from = new Date(), method: ShippingMethodId = "standard") {
  return etaRange(rate, from, method)[1];
}
