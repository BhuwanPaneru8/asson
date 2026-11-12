import type { Metadata } from "next";
import Link from "next/link";
import { ShoppingBag, ShieldCheck } from "lucide-react";
import { getCart } from "@/lib/cart";
import { getProductRail } from "@/lib/catalog";
import { CartLine, FreeShippingBar } from "@/components/cart/cart-line";
import { EmptyState } from "@/components/ui/misc";
import { buttonClass } from "@/components/ui/button";
import { ProductRail } from "@/components/product/product-rail";
import { store } from "@/lib/config";
import { getDeliveryRates } from "@/lib/delivery";
import { DeliveryEstimator } from "@/components/cart/delivery-estimator";
import { formatPrice } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";
import { localise } from "@/lib/i18n";

export const metadata: Metadata = { title: "Your bag", robots: { index: false } };

export default async function CartPage() {
  const cart = await getCart();
  const [recs, rates, { t, locale }] = await Promise.all([getProductRail("best", 8), getDeliveryRates(), getT()]);
  if (cart.lines.length === 0)
    return (
      <>
        <EmptyState page icon={<ShoppingBag className="h-12 w-12" strokeWidth={1.1} />} title={t("bag.empty")} body={t("bag.emptyBody2")} action={<Link href="/shop" className={buttonClass()}>{t("bag.continue")}</Link>} />
        <ProductRail title={t("bag.popular")} products={recs} priority />
      </>
    );

  const savings = cart.lines.reduce((s, l) => s + Math.max(0, (l.compareAtPrice ?? l.unitPrice) - l.unitPrice) * l.quantity, 0);
  const blocked = cart.lines.some((l) => !l.available);

  return (
    <div className="container-page py-8 md:py-12">
      <h1 className="font-display text-4xl">{t("bag.title")} <span className="text-2xl text-muted">({cart.count})</span></h1>
      <div className="mt-8 grid gap-10 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <div className="mb-6 bg-cloud/70 p-4"><FreeShippingBar subtotal={cart.subtotal} /></div>
          <div className="divide-y divide-line border-y border-line">
            {cart.lines.map((l) => <div key={l.id} className="py-6"><CartLine line={l} /></div>)}
          </div>
        </div>
        <aside className="lg:col-span-4">
          <div className="sticky top-24 border border-line bg-white p-6">
            <h2 className="text-[16px] font-semibold">{t("sum.title")}</h2>
            <dl className="mt-4 space-y-2.5 text-[14.5px]">
              <div className="flex justify-between"><dt>{t("bag.subtotal")}</dt><dd>{formatPrice(cart.subtotal)}</dd></div>
              {savings > 0 && <div className="flex justify-between text-success"><dt>{t("sum.save")}</dt><dd>−{formatPrice(savings)}</dd></div>}
              <div className="flex justify-between"><dt>{t("sum.delivery")}</dt><dd>{cart.subtotal >= store.shipping.freeThreshold ? t("ship.free") : t("sum.byDistrict")}</dd></div>
            </dl>
            <div className="mt-4 flex justify-between border-t border-line pt-4 text-[16px] font-semibold"><span>{t("bag.subtotal")}</span><span>{formatPrice(cart.subtotal)}</span></div>
            <p className="mt-1 text-[12.5px] text-muted">{localise(locale, store.vatLabel)}. {t("bag.feeNote")}</p>
            <DeliveryEstimator rates={rates} subtotal={cart.subtotal} className="mt-4" compact />
            {blocked && <p className="mt-4 bg-[#fbe9e7] p-3 text-[13px] text-danger">{t("bag.blocked")}</p>}
            <Link href="/checkout" aria-disabled={blocked} className={buttonClass("primary", "lg", `mt-5 w-full ${blocked ? "pointer-events-none opacity-40" : ""}`)}>{t("bag.checkoutSecure")}</Link>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-[12.5px] text-muted"><ShieldCheck className="h-3.5 w-3.5" /> {t("bag.secureCod")}</p>
          </div>
        </aside>
      </div>
      <div className="-mx-4 mt-10 md:-mx-8 xl:-mx-12"><ProductRail title={t("pdp.completeLook")} products={recs} /></div>
    </div>
  );
}
