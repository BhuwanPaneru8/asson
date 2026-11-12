import Link from "next/link";
import type { Block, Policy } from "@/lib/policies";
import { POLICIES, POLICIES_UPDATED } from "@/lib/policies";
import { cn } from "@/lib/utils";

const date = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((b, i) =>
        typeof b === "string" ? <p key={i} className="mt-3 text-[15px] leading-[1.7] text-ink-soft">{b}</p>
        : "list" in b ? <ul key={i} className="mt-3 list-disc space-y-1.5 pl-5 text-[15px] leading-[1.65] text-ink-soft marker:text-muted">{b.list.map((x) => <li key={x}>{x}</li>)}</ul>
        : <p key={i} className="mt-4 border-l-2 border-accent bg-accent-soft/50 px-4 py-3 text-[14.5px] leading-relaxed text-ink-soft">{b.note}</p>,
      )}
    </>
  );
}

/** A policy page: other policies and this one's sections on the left (desktop), the text on the right. */
export function PolicyView({ p, labels }: { p: Policy; labels: { all: string; onThisPage: string; updated: string; english: string | null; questions: React.ReactNode; titles: Record<string, string> } }) {
  return (
    <div className="container-page py-10 md:py-14">
      <nav aria-label="Breadcrumb" className="mb-6 text-[13px] text-muted"><Link href="/policies" className="hover:text-ink">{labels.all}</Link> <span aria-hidden>/</span> <span className="text-ink">{labels.titles[p.slug]}</span></nav>
      <div className="grid gap-10 lg:grid-cols-12">
        <aside className="hidden lg:col-span-3 lg:block print:hidden">
          <div className="sticky top-[calc(var(--header-offset)+2rem)] space-y-8 motion-safe:transition-[top] motion-safe:duration-300">
            <div>
              <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">{labels.all}</p>
              <ul className="space-y-1 text-[14px]">
                {POLICIES.map((x) => <li key={x.slug}><Link href={`/policies/${x.slug}`} aria-current={x.slug === p.slug ? "page" : undefined} className={cn("block border-l-2 py-1 pl-3 transition-colors", x.slug === p.slug ? "border-ink font-medium text-ink" : "border-transparent text-ink-soft hover:text-accent")}>{labels.titles[x.slug]}</Link></li>)}
              </ul>
            </div>
          </div>
        </aside>
        <article className="min-w-0 lg:col-span-8">
          <h1 className="font-display text-4xl md:text-5xl">{p.title}</h1>
          <p className="mt-3 text-[13px] text-muted">{labels.updated} {date(POLICIES_UPDATED)}</p>
          {labels.english && <p className="mt-4 bg-cloud px-4 py-3 text-[14px] text-ink-soft">{labels.english}</p>}
          <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-ink-soft">{p.summary}</p>
          {p.sections.length > 3 && (
            <nav aria-label={labels.onThisPage} className="mt-8 border border-line bg-white p-5 print:hidden">
              <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">{labels.onThisPage}</p>
              <ol className="grid gap-x-6 gap-y-1 text-[14px] sm:grid-cols-2">{p.sections.map((s) => <li key={s.id}><a href={`#${s.id}`} className="text-ink-soft hover:text-accent">{s.title}</a></li>)}</ol>
            </nav>
          )}
          <div className="mt-6 max-w-3xl">
            {p.sections.map((s) => (
              <section key={s.id} id={s.id} className="scroll-mt-[calc(var(--header-offset)+1.5rem)] border-b border-line py-7 last:border-0">
                <h2 className="text-[19px] font-semibold">{s.title}</h2>
                <Blocks blocks={s.blocks} />
              </section>
            ))}
          </div>
          <div className="mt-8 max-w-3xl bg-cloud p-6 text-[14.5px] text-ink-soft">{labels.questions}</div>
        </article>
      </div>
    </div>
  );
}
