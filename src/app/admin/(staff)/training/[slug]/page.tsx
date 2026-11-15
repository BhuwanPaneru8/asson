import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { AREA_LABEL, blocks, ROLE_NAME } from "@/lib/training";
import { formatDate } from "@/lib/utils";
import { Card, PageHeader } from "@/components/admin/ui";
import { SignOff, SopEditor } from "@/components/admin/training-forms";

export const metadata = { title: "Procedure" };

export default async function SopPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ edit?: string }> }) {
  const me = await requirePermission("self.time");
  const s = await db.sop.findUnique({ where: { slug: (await params).slug }, include: { signoffs: { where: { userId: me.id } } } });
  if (!s) notFound();
  const editor = can(me, "ops.manage");
  const editing = editor && (await searchParams).edit === "1";
  const sig = s.signoffs[0];
  const state = sig && sig.version >= s.version ? "signed" : sig ? "changed" : "todo";
  return (
    <>
      <Link href="/admin/training" className="mb-4 inline-flex items-center gap-1.5 text-[13.5px] text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> Training</Link>
      <PageHeader title={s.title} description={`${AREA_LABEL[s.area]} · for ${s.roles.map((r) => ROLE_NAME[r as keyof typeof ROLE_NAME] ?? r).join(", ").toLowerCase()} · version ${s.version}, updated ${formatDate(s.updatedAt)}${s.active ? "" : " · retired"}`} actions={editor && !editing ? <Link href={`/admin/training/${s.slug}?edit=1`} className="rounded-md border border-line bg-white px-3 py-2 text-[13.5px] hover:border-ink">Edit</Link> : undefined} />
      {editing ? <Card><SopEditor sop={{ id: s.id, title: s.title, area: s.area, roles: s.roles, body: s.body, active: s.active }} /></Card> : (
        <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
          <Card><article className="space-y-3 p-6 text-[15px] leading-relaxed">{blocks(s.body).map((b, i) =>
            b.kind === "h" ? <h2 key={i} className="pt-2 text-[17px] font-semibold">{b.text}</h2>
            : b.kind === "p" ? <p key={i}>{b.text}</p>
            : b.kind === "ol" ? <ol key={i} className="list-decimal space-y-1.5 pl-6">{b.items.map((x, j) => <li key={j}>{x}</li>)}</ol>
            : <ul key={i} className="list-disc space-y-1.5 pl-6">{b.items.map((x, j) => <li key={j}>{x}</li>)}</ul>)}
          </article></Card>
          <div className="space-y-3">{s.active && s.roles.includes(me.role) ? <SignOff sopId={s.id} state={state} /> : <p className="text-[13.5px] text-muted">{s.active ? "This one isn't for your role; you can still read it." : "Retired: no longer in use."}</p>}</div>
        </div>
      )}
    </>
  );
}
