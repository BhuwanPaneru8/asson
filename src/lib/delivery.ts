import "server-only";
import { unstable_cache } from "next/cache";
import { db } from "./db";
import { DISTRICTS, type Zone } from "./config";
import { defaultRate, type RateMap } from "./delivery-shared";

/** All 77 district rates, cached and busted with tag "delivery" when the owner edits them. */
export const getDeliveryRates = unstable_cache(
  async (): Promise<RateMap> => {
    const rows = await db.deliveryRate.findMany();
    const map: RateMap = {};
    for (const d of DISTRICTS) map[d] = defaultRate(d);
    for (const r of rows) {
      map[r.district] = {
        district: r.district, province: r.province, zone: r.zone as Zone, fee: r.fee,
        etaMinDays: r.etaMinDays, etaMaxDays: r.etaMaxDays,
        expressAvailable: r.expressAvailable, codAvailable: r.codAvailable, serviceable: r.serviceable,
      };
    }
    return map;
  },
  ["delivery-rates"],
  { tags: ["delivery"], revalidate: 3600 },
);
