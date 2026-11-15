import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { Card, PageHeader, Pill } from "@/components/admin/ui";
import { Stars } from "@/components/ui/misc";
import { ReviewToggle } from "@/components/admin/review-toggle";

export const metadata = { title: "Reviews" };

export default async function Reviews({ searchParams }: { searchParams: Promise<{ rating?: string }> }) {
  await requirePermission("reviews");
  const sp = await searchParams;
  const rating = Number(sp.rating);
  const reviews = await db.review.findMany({ where: rating ? { rating } : {}, orderBy: { createdAt: "desc" }, take: 100, include: { product: { select: { name: true, slug: true } }, user: { select: { name: true, email: true } } } });
  return (
    <>
      <PageHeader title="Reviews" description="Hide reviews that break guidelines. Ratings recalculate automatically." />
      <div className="mb-4 flex gap-2">{["", "1", "2", "3", "4", "5"].map((r) => <Link key={r} href={r ? `?rating=${r}` : "?"} className={`rounded-md px-3 py-1.5 text-[13.5px] ${String(sp.rating ?? "") === r ? "bg-ink text-white" : "border border-line bg-white"}`}>{r ? `${r}★` : "All"}</Link>)}</div>
      <Card>
        <ul className="divide-y divide-line">
          {reviews.map((r) => (
            <li key={r.id} className={`flex gap-4 px-5 py-4 ${r.status === "HIDDEN" ? "opacity-50" : ""}`}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><Stars value={r.rating} /><span className="font-medium">{r.title}</span>{r.verified && <Pill tone="success">verified</Pill>}{r.status === "HIDDEN" && <Pill>hidden</Pill>}</div>
                <p className="mt-1 text-[14px] text-ink-soft">{r.body}</p>
                <p className="mt-1 text-[12.5px] text-muted">{r.user.name} ({r.user.email}) on <Link href={`/p/${r.product.slug}`} className="underline">{r.product.name}</Link> · {formatDate(r.createdAt)}</p>
              </div>
              <ReviewToggle id={r.id} status={r.status} />
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
