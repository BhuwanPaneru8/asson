import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { store } from "@/lib/config";
import { getT } from "@/lib/i18n/server";
import { buttonClass } from "@/components/ui/button";

export const metadata: Metadata = { title: "About Asson", description: "Classic clothing in quality fabric at fair prices, delivered to all 77 districts of Nepal." };

const U = (id: string) => `https://images.unsplash.com/photo-${id}?w=1600&q=70&auto=format&fit=crop`;

export default async function AboutPage() {
  const { t } = await getT();
  const promises = [["about.limited", "about.limitedBody"], ["about.fabric", "about.fabricBody"], ["about.fair", "about.fairBody"], ["about.service", "about.serviceBody"]] as const;
  return (
    <>
      <section className="container-page grid items-center gap-10 py-12 md:grid-cols-2 md:py-20">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-accent">{t("about.eyebrow")}</p>
          <h1 className="mt-3 font-display text-4xl leading-[1.08] md:text-6xl">{store.tagline}</h1>
          <p className="mt-6 max-w-xl text-[16px] leading-relaxed text-ink-soft">{t("about.p1")}</p>
          <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-ink-soft">{t("about.p2")}</p>
        </div>
        <div className="relative aspect-[4/5] overflow-hidden bg-cloud">
          <Image src={U("1441984904996-e0b6ba687e04")} alt={t("about.photoAlt")} fill sizes="(min-width:768px) 50vw, 100vw" className="object-cover" />
        </div>
      </section>

      <section className="border-y border-line bg-white">
        <div className="container-page py-14 md:py-20">
          <h2 className="font-display text-3xl md:text-[34px]">{t("about.promiseTitle")}</h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {promises.map(([title, body], i) => (
              <div key={title}>
                <p className="font-display text-[34px] leading-none text-accent">0{i + 1}</p>
                <h3 className="mt-4 text-[17px] font-semibold">{t(title)}</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-ink-soft">{t(body)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container-page py-14 text-center md:py-20">
        <h2 className="font-display text-3xl md:text-[34px]">{t("about.reachTitle")}</h2>
        <p className="mx-auto mt-4 max-w-xl text-[16px] leading-relaxed text-ink-soft">{t("about.reach", { days: store.returnWindowDays })}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/shop" className={buttonClass("primary", "lg")}>{t("about.shop")}</Link>
          <Link href="/stores" className={buttonClass("secondary", "lg")}>{t("about.visit")}</Link>
        </div>
      </section>
    </>
  );
}
