"use client";

import { useEffect, useState } from "react";
import { Truck } from "lucide-react";
import { DistrictSelect } from "@/components/ui/district-select";
import { store } from "@/lib/config";
import { deliveryFee, etaDate, etaLabel, rateFor, type RateMap } from "@/lib/delivery-shared";
import { cn, formatPrice, formatShortDate } from "@/lib/utils";

const KEY = "asson_district";

/** Lets shoppers pick their district once (remembered on the device) and shows the exact fee and arrival date. */
export function DeliveryEstimator({ rates, subtotal, className, compact }: { rates: RateMap; subtotal?: number; className?: string; compact?: boolean }) {
  const [district, setDistrict] = useState("");
  // restore after hydration — localStorage is client-only
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { try { const d = localStorage.getItem(KEY); if (d) setDistrict(d); } catch {} }, []);
  const choose = (d: string) => { setDistrict(d); try { localStorage.setItem(KEY, d); } catch {} };

  const rate = rateFor(rates, district);
  const fee = rate && subtotal != null ? deliveryFee("standard", rate, subtotal, false) : rate?.fee;

  return (
    <div className={cn("bg-cloud/70 p-4", className)}>
      <p className="flex items-center gap-2 text-[13.5px] font-semibold"><Truck className="h-4 w-4" /> Delivery to your district</p>
      <DistrictSelect className="mt-2.5 h-10" value={district} onChange={(e) => choose(e.target.value)} aria-label="Your district" placeholder="Choose your district" />
      {rate && (
        <div className="mt-2.5 space-y-0.5 text-[13px] text-ink-soft" aria-live="polite">
          {!rate.serviceable ? (
            <p className="text-danger">We don&apos;t deliver to {rate.district} yet — call {store.supportPhone}.</p>
          ) : (
            <>
              <p>
                <b className="text-ink">{fee === 0 ? "Free delivery" : formatPrice(fee ?? 0)}</b> · arrives in {etaLabel(rate)}
                {!compact && <> (by {formatShortDate(etaDate(rate))})</>}
              </p>
              {fee !== 0 && <p>Free above {formatPrice(store.shipping.freeThreshold)}</p>}
              {rate.expressAvailable && <p>Express: {store.shipping.express.eta.toLowerCase()} · {formatPrice(store.shipping.express.fee)}</p>}
              <p>{rate.codAvailable ? "Cash on delivery available" : "Cash on delivery not available here"}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
