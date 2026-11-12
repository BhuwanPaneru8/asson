import Image from "next/image";
import Link from "next/link";
import type { LookSummary } from "@/lib/looks";
import { cn, formatPrice } from "@/lib/utils";
import { makeT, type T } from "@/lib/i18n";

/** Editorial card: portrait photo, title over a soft gradient, pieces and price below the fold of the image. */
export function LookCard({ look, large, priority, t = makeT("en") }: { look: LookSummary; large?: boolean; priority?: boolean; t?: T }) {
  return (
    <Link href={`/lookbook/${look.slug}`} className={cn("group relative block overflow-hidden bg-cloud", large ? "aspect-[4/5] md:aspect-[16/11]" : "aspect-[4/5]")}>
      {look.hero && <Image src={look.hero} alt={look.title} fill loading={priority ? "eager" : undefined} fetchPriority={priority ? "high" : undefined} sizes={large ? "(min-width:768px) 66vw, 100vw" : "(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw"} className="object-cover transition-transform duration-[1.2s] group-hover:scale-[1.03]" />}
      <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-5 text-white md:p-7">
        <p className="text-[11.5px] font-semibold uppercase tracking-[0.2em] text-white/70">{t("look.pieces", { n: look.pieces, amount: formatPrice(look.total) })}</p>
        <h3 className={cn("mt-1.5 font-display", large ? "text-3xl md:text-5xl" : "text-2xl md:text-3xl")}>{look.title}</h3>
        {look.subtitle && <p className="mt-1 max-w-md text-[14px] text-white/85">{look.subtitle}</p>}
        <span className="mt-3 inline-block border-b border-white/80 pb-0.5 text-[13.5px] font-medium">{t("look.shop")}</span>
      </div>
    </Link>
  );
}
