import Link from "next/link";
import { Search } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { canOpen, myPath, searchPages } from "@/lib/handbook";
import { mySops } from "@/lib/training";
import { PAGES, SECTIONS } from "@/handbook";
import { Card, PageHeader } from "@/components/admin/ui";
import { StateMark, PathBar } from "./marks";

export const metadata = { title: "Handbook" };

export default async function HandbookHome({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const me = await requirePermission("self.time");
  const q = ((await searchParams).q ?? "").trim().slice(0, 80);
  const [path, sops] = await Promise.all([myPath(me), mySops(me)]);
  const sopsDue = sops.filter((s) => s.required), sopsSigned = sopsDue.filter((s) => s.state === "signed").length;
  const results = q ? searchPages(me, q) : null;
  const next = path.items.find((i) => i.state !== "done");

  return (
    <>
      <PageHeader
        title="Handbook"
        description="How Asson works: the company, every part of the system, how we do things, and your path through your first weeks. Everything here is for the whole team."
        actions={can(me, "people") ? <Link href="/admin/handbook/onboarding" className="rounded-md border border-line bg-white px-3 py-2 text-[13.5px] hover:border-ink">Team onboarding</Link> : undefined}
      />

      <form className="mb-5 flex max-w-xl items-center gap-2 rounded-md border border-line bg-white px-3 focus-within:border-ink" role="search">
        <Search className="h-4 w-4 text-muted" aria-hidden />
        <input name="q" defaultValue={q} placeholder="Search the handbook: refund, closing, transfer, leave…" aria-label="Search the handbook" className="h-11 min-w-0 flex-1 bg-transparent text-[14.5px] outline-none" />
      </form>

      {results && (
        <Card title={`${results.length} page${results.length === 1 ? "" : "s"} for “${q}”`} className="mb-6" action={<Link href="/admin/handbook" className="text-[13px] text-muted hover:text-ink">Clear</Link>}>
          {results.length ? (
            <ul className="divide-y divide-line">{results.map((p) => (
              <li key={p.slug}><Link href={`/admin/handbook/${p.slug}`} className="block px-5 py-3 hover:bg-cloud/40">
                <span className="text-[14.5px] font-medium">{p.title}</span>
                <span className="mt-0.5 block text-[13px] text-muted">{SECTIONS.find((s) => s.key === p.section)?.title} · {p.summary}</span>
              </Link></li>
            ))}</ul>
          ) : <p className="px-5 py-4 text-[14px] text-muted">Nothing matches. Try one word, like “cash” or “return”, or ask your manager.</p>}
        </Card>
      )}

      <Card title={`Your path · ${path.jobLabel}`} className="mb-6">
        <div className="space-y-4 p-5">
          <PathBar done={path.done} of={path.of} />
          <p className="text-[14px] text-ink-soft">
            {path.done === path.of
              ? "You've finished your reading path. Keep coming back: pages marked “changed” have something new for you."
              : <>Read these in order. Pages with questions count once you score 80% or more.{next && <> Next up: <Link href={`/admin/handbook/${next.slug}`} className="font-medium text-accent underline underline-offset-2">{next.title}</Link>.</>}</>}
            {" "}Procedures to sign in <Link href="/admin/training" className="font-medium text-accent underline underline-offset-2">Training</Link>: {sopsSigned} of {sopsDue.length}.
          </p>
          <ol className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
            {path.items.map((i, n) => (
              <li key={i.slug}><Link href={`/admin/handbook/${i.slug}`} className="flex items-center gap-2.5 rounded px-1 py-1 text-[14px] hover:bg-cloud/50">
                <StateMark state={i.state} /><span className="tabular-nums text-muted">{n + 1}.</span><span className="min-w-0 flex-1 truncate">{i.title}</span><span className="text-[12px] text-muted">{i.minutes} min</span>
              </Link></li>
            ))}
          </ol>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {SECTIONS.map((s) => {
          const pages = PAGES.filter((p) => p.section === s.key && canOpen(me, p));
          if (!pages.length) return null;
          return (
            <Card key={s.key} title={s.title}>
              <p className="border-b border-line px-5 py-2.5 text-[13px] text-muted">{s.blurb}</p>
              <ul className="divide-y divide-line">{pages.map((p) => (
                <li key={p.slug}><Link href={`/admin/handbook/${p.slug}`} className="flex items-start gap-2.5 px-5 py-2.5 hover:bg-cloud/40">
                  <span className="mt-0.5"><StateMark state={path.stateOf(p)} /></span>
                  <span className="min-w-0 flex-1"><span className="text-[14px] font-medium">{p.title}</span><span className="block truncate text-[12.5px] text-muted">{p.summary}</span></span>
                </Link></li>
              ))}</ul>
            </Card>
          );
        })}
      </div>
    </>
  );
}
