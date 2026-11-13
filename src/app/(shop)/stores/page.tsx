import type { Metadata } from "next";
import Link from "next/link";
import { unstable_cache } from "next/cache";
import { Clock, MapPin, Phone, ShoppingBag } from "lucide-react";
import { db } from "@/lib/db";
import { store } from "@/lib/config";
import { getT } from "@/lib/i18n/server";
import { buttonClass } from "@/components/ui/button";

export const metadata: Metadata = { title: "Find a store", description: "Asson shops across Nepal: addresses, opening hours, phone numbers and click & collect." };

// shops change rarely: an hour's cache keeps this page fast without touching the database each visit
const getShops = unstable_cache(
  () => db.store.findMany({ where: { active: true, kind: "SHOP" }, orderBy: [{ priority: "asc" }, { name: "asc" }] /* the owner's order: the flagship first */, select: { code: true, name: true, address: true, district: true, phone: true, hours: true, pickup: true } }),
  ["public-shops"],
  { revalidate: 3600, tags: ["stores"] },
);

const mapUrl = (name: string, address: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name}, ${address}, Nepal`)}`;

export default async function StoresPage() {
  const [shops, { t }] = await Promise.all([getShops(), getT()]);
  const districts = [...new Set(shops.map((s) => s.district).filter((d): d is string => !!d))];
  return (
    <div className="container-page py-10 md:py-14">
      <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-accent">{t("stores.eyebrow")}</p>
      <h1 className="mt-2 font-display text-4xl md:text-5xl">{t("stores.title")}</h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-soft">{t("stores.body")}</p>
      {districts.length > 1 && <p className="mt-2 text-[14px] text-muted">{t("stores.count", { shops: shops.length, districts: districts.length })}</p>}

      {!shops.length ? (
        <div className="mt-10 border border-line bg-white p-8 text-center">
          <p className="text-[15px] text-ink-soft">{t("stores.none")}</p>
          <Link href="/shop" className={buttonClass("primary", "md", "mt-5")}>{t("bag.continue")}</Link>
        </div>
      ) : (
        <ul className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {shops.map((s) => (
            <li key={s.code} className="flex flex-col border border-line bg-white p-6">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-display text-2xl">{s.name}</h2>
                {s.pickup && <span className="shrink-0 bg-accent-soft px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-accent">{t("stores.pickup")}</span>}
              </div>
              {s.district && <p className="mt-1 text-[13px] uppercase tracking-wider text-muted">{s.district}</p>}
              <ul className="mt-4 space-y-2.5 text-[14.5px] text-ink-soft">
                <li className="flex gap-2.5"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted" strokeWidth={1.6} />{s.address}</li>
                {s.hours && <li className="flex gap-2.5"><Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted" strokeWidth={1.6} />{s.hours}</li>}
                {s.phone && <li className="flex gap-2.5"><Phone className="mt-0.5 h-4 w-4 shrink-0 text-muted" strokeWidth={1.6} /><a href={`tel:${store.phonePrefix}${s.phone}`} className="hover:text-accent">{s.phone}</a></li>}
                {s.pickup && <li className="flex gap-2.5"><ShoppingBag className="mt-0.5 h-4 w-4 shrink-0 text-muted" strokeWidth={1.6} />{t("stores.pickupBody")}</li>}
              </ul>
              <div className="mt-auto flex gap-2 pt-6">
                <a href={mapUrl(s.name, s.address)} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "sm", "flex-1")}>{t("stores.directions")}</a>
                {s.phone && <a href={`tel:${store.phonePrefix}${s.phone}`} className={buttonClass("ghost", "sm", "border border-line")}>{t("stores.call")}</a>}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-12 grid gap-6 border-t border-line pt-10 md:grid-cols-3">
        {(["stores.tryOn", "stores.collect", "stores.exchange"] as const).map((k) => (
          <div key={k}>
            <h3 className="text-[16px] font-semibold">{t(`${k}Title`)}</h3>
            <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink-soft">{t(k, { days: store.returnWindowDays })}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
