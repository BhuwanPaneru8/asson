import Link from "next/link";
import type { ProductCardData } from "@/lib/catalog";
import { ProductCard } from "./product-card";

/** viewAll: the link text, already translated (this renders on the server and the client). */
/** priority: the rail is the first thing on the page (an empty bag), so its first cards load straight away. */
export function ProductRail({ title, href, products, eyebrow, viewAll = "View all", priority }: { title: string; href?: string; products: ProductCardData[]; eyebrow?: string; viewAll?: string; priority?: boolean }) {
  if (!products.length) return null;
  return (
    <section className="container-page py-12">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          {eyebrow && <p className="mb-1 text-[12px] font-semibold uppercase tracking-[0.16em] text-accent">{eyebrow}</p>}
          <h2 className="font-display text-3xl md:text-[34px]">{title}</h2>
        </div>
        {href && <Link href={href} className="shrink-0 text-[14px] font-medium underline underline-offset-4 hover:text-accent">{viewAll}</Link>}
      </div>
      <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-4 md:gap-5 md:overflow-visible md:px-0">
        {products.slice(0, 8).map((p, i) => (
          <div key={p.id} className={`w-[46%] shrink-0 snap-start md:w-auto ${i >= 4 ? "md:hidden" : ""}`}>
            <ProductCard p={p} priority={priority && i < 2} />
          </div>
        ))}
      </div>
    </section>
  );
}
