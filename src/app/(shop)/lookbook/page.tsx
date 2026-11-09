import type { Metadata } from "next";
import Link from "next/link";
import { getLookbook } from "@/lib/looks";
import { LookCard } from "@/components/lookbook/look-card";
import { buttonClass } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Lookbook",
  description: "Outfits styled by Asson from our own classic pieces: what to wear together, and how. Shop each look in one go.",
};

export default async function LookbookPage() {
  const looks = await getLookbook();
  return (
    <div className="container-page pb-16 pt-10 md:pt-16">
      <header className="mx-auto mb-10 max-w-2xl text-center md:mb-14">
        <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-accent">Styled by Asson</p>
        <h1 className="mt-3 font-display text-5xl md:text-6xl">The Lookbook</h1>
        <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">Outfits we&apos;d wear ourselves, put together from our own classics. Pick your sizes and take the whole look home in one go.</p>
      </header>
      {!looks.length ? (
        <div className="mx-auto max-w-md text-center">
          <p className="text-muted">New looks are on their way.</p>
          <Link href="/shop?sort=new" className={buttonClass("secondary", "md", "mt-6")}>See what&apos;s new</Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-3">
          {looks.map((l, i) => (
            <div key={l.slug} className={i === 0 ? "sm:col-span-2 lg:col-span-2 lg:row-span-2" : ""}>
              <LookCard look={l} large={i === 0} priority={i < 2} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
