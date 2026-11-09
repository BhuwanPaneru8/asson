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

/** Latest date an order placed now should arrive, for display. */
export function etaDate(rate: DeliveryRate, from = new Date(), method: ShippingMethodId = "standard") {
  const d = new Date(from);
  d.setDate(d.getDate() + (method === "express" && rate.expressAvailable ? 1 : rate.etaMaxDays));
  return d;
}
