"use client";

import { useEffect, useState } from "react";
import { Truck } from "lucide-react";
import { DistrictSelect } from "@/components/ui/district-select";
import { store } from "@/lib/config";
import { deliveryFee, etaRange, rateFor, type RateMap } from "@/lib/delivery-shared";
import { cn, formatPrice, formatShortDate } from "@/lib/utils";
import { useT } from "@/components/site/i18n-provider";
import { useShop } from "@/components/site/shop-provider";

const KEY = "asson_district";

/** Lets shoppers pick their district once (remembered on the device) and shows the exact fee and arrival date. */
export function DeliveryEstimator({ rates, subtotal, className }: { rates: RateMap; subtotal?: number; className?: string; /** kept for callers; the dates now fit everywhere */ compact?: boolean }) {
  const [district, setDistrict] = useState("");
  const { t, l } = useT();
  // restore after hydration — localStorage is client-only
  // the district chosen on this device, else a signed-in shopper's saved address
  const saved = useShop().user?.district;
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { let d: string | null = null; try { d = localStorage.getItem(KEY); } catch {} if (d || saved) setDistrict(d || saved!); }, [saved]);
  const choose = (d: string) => { setDistrict(d); try { localStorage.setItem(KEY, d); } catch {} };

  const rate = rateFor(rates, district);
  // real dates ("arrives Thu 19 Nov – Sat 21 Nov"), counted without Saturdays, Nepal's weekly holiday
  const arrives = (r: NonNullable<typeof rate>) => {
    const [a, b] = etaRange(r);
    return a.getTime() === b.getTime() ? t("de.arrivesOn", { date: formatShortDate(b) }) : t("de.arrivesBetween", { from: formatShortDate(a), to: formatShortDate(b) });
  };
  const fee = rate && subtotal != null ? deliveryFee("standard", rate, subtotal, false) : rate?.fee;

  return (
    <div className={cn("bg-cloud/70 p-4", className)}>
      <p className="flex items-center gap-2 text-[13.5px] font-semibold"><Truck className="h-4 w-4" /> {t("de.title")}</p>
      <DistrictSelect className="mt-2.5 h-10" value={district} onChange={(e) => choose(e.target.value)} aria-label={t("de.district")} placeholder={t("de.choose")} />
      {rate && (
        <div className="mt-2.5 space-y-0.5 text-[13px] text-ink-soft" aria-live="polite">
          {!rate.serviceable ? (
            <p className="text-danger">{t("de.noDelivery", { district: rate.district, phone: store.supportPhone })}</p>
          ) : (
            <>
              <p>
                <b className="text-ink">{fee === 0 ? t("home.freeDelivery") : formatPrice(fee ?? 0)}</b> · {arrives(rate)}
              </p>
              {fee !== 0 && <p>{t("de.freeAbove", { amount: formatPrice(store.shipping.freeThreshold) })}</p>}
              {rate.expressAvailable && <p>{t("de.express", { eta: l(store.shipping.express.eta).toLowerCase(), fee: formatPrice(store.shipping.express.fee) })}</p>}
              <p>{rate.codAvailable ? t("de.cod") : t("de.noCod")}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
