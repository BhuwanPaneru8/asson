import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ExternalLink, Printer } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { JOBS } from "@/lib/permissions";
import { canOpen, myPath } from "@/lib/handbook";
import { pageBySlug, PAGES, sectionOf } from "@/handbook";
import { Card } from "@/components/admin/ui";
import { HandbookText } from "@/components/admin/handbook-text";
import { MarkRead, Quiz } from "@/components/admin/handbook-forms";
import { PrintButton } from "./print-button";
import { StateMark } from "../marks";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const p = pageBySlug((await params).slug);
  return { title: p ? `${p.title} · Handbook` : "Handbook" };
}

export default async function HandbookPageView({ params }: { params: Promise<{ slug: string }> }) {
  const me = await requirePermission("self.time");
  const page = pageBySlug((await params).slug);
  if (!page || !canOpen(me, page)) notFound();
  const path = await myPath(me);
  const state = path.stateOf(page);
  const row = path.reads.get(page.slug);
  const section = sectionOf(page.section);
  const siblings = PAGES.filter((p) => p.section === page.section && canOpen(me, p));
  const at = siblings.findIndex((p) => p.slug === page.slug);
  const prev = siblings[at - 1], next = siblings[at + 1];
  const onPath = path.items.findIndex((i) => i.slug === page.slug);
  const related = (page.related ?? []).map((s) => pageBySlug(s)).filter((p) => p && canOpen(me, p));

  return (
    <article className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
        <Link href="/admin/handbook" className="inline-flex items-center gap-1 text-[13.5px] text-muted hover:text-ink"><ChevronLeft className="h-4 w-4" />Handbook · {section.title}</Link>
        <PrintButton><Printer className="h-4 w-4" />Print</PrintButton>
      </div>
      <header className="mb-6">
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight">{page.title}</h1>
        <p className="mt-2 text-[16px] text-ink-soft">{page.summary}</p>
        <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-muted">
          <span className="inline-flex items-center gap-1.5"><StateMark state={state} />{state === "done" ? "Done" : state === "read" ? "Read · questions to pass" : state === "changed" ? "Changed since you read it" : "Not read yet"}</span>
          <span>{page.minutes} min read</span>
          <span>For: {page.audience === "all" ? "everyone" : page.audience.map((j) => JOBS.find((x) => x.key === j)?.label ?? j).join(", ")}</span>
          {onPath >= 0 && <span className="rounded-full bg-accent-soft px-2 py-0.5 font-medium text-accent">Step {onPath + 1} of your path</span>}
        </p>
        {page.open?.length ? (
          <div className="mt-4 flex flex-wrap gap-2 print:hidden">{page.open.map((o) => (
            <Link key={o.href} href={o.href} className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-3 py-1.5 text-[13px] hover:border-ink">{o.label}<ExternalLink className="h-3.5 w-3.5 text-muted" /></Link>
          ))}</div>
        ) : null}
      </header>

      <HandbookText body={page.body} />

      <div className="mt-8 space-y-6 print:hidden">
        <Card><div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <MarkRead slug={page.slug} state={state} />
          <span className="text-[12.5px] text-muted">Page version {page.version}</span>
        </div></Card>

        {page.quiz?.length ? (
          <Card title={`Check yourself · ${page.quiz.length} question${page.quiz.length === 1 ? "" : "s"}`}>
            <div className="p-5"><Quiz slug={page.slug} questions={page.quiz.map(({ q, options }) => ({ q, options }))} best={row && row.version >= page.version ? row.quizScore : null} /></div>
          </Card>
        ) : null}

        {related.length > 0 && (
          <Card title="Read next">
            <ul className="divide-y divide-line">{related.map((p) => (
              <li key={p!.slug}><Link href={`/admin/handbook/${p!.slug}`} className="block px-5 py-2.5 hover:bg-cloud/40"><span className="text-[14px] font-medium">{p!.title}</span><span className="block text-[12.5px] text-muted">{p!.summary}</span></Link></li>
            ))}</ul>
          </Card>
        )}

        <nav className="flex justify-between gap-4 text-[13.5px]" aria-label="More in this section">
          {prev ? <Link href={`/admin/handbook/${prev.slug}`} className="text-muted hover:text-ink">← {prev.title}</Link> : <span />}
          {next ? <Link href={`/admin/handbook/${next.slug}`} className="text-right text-muted hover:text-ink">{next.title} →</Link> : <span />}
        </nav>
      </div>
    </article>
  );
}
