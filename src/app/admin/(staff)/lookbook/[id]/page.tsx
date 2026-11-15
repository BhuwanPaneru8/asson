import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/admin/ui";
import { LookEditor } from "@/components/admin/look-editor";
import { EntityHistory } from "@/components/admin/entity-history";

export const metadata = { title: "Edit look" };

export default async function EditLookPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("catalog.edit");
  const l = await db.look.findUnique({
    where: { id: (await params).id },
    include: { items: { orderBy: { position: "asc" }, include: { product: { select: { id: true, name: true, price: true, status: true, images: { take: 1, orderBy: { position: "asc" }, select: { url: true } } } } } } },
  });
  if (!l) notFound();
  const off = l.items.filter((i) => i.product.status !== "ACTIVE");
  return (
    <>
      <Link href="/admin/lookbook" className="mb-4 inline-flex items-center gap-1.5 text-[13.5px] text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> Lookbook</Link>
      <PageHeader title={l.title} description={off.length ? `${off.length} piece${off.length > 1 ? "s are" : " is"} no longer on sale and hidden from shoppers: ${off.map((i) => i.product.name).join(", ")}.` : "Shoppers see every piece below."} />
      <LookEditor look={{ id: l.id, title: l.title, slug: l.slug, subtitle: l.subtitle ?? "", story: l.story ?? "", heroImage: l.heroImage ?? "", published: l.published, position: l.position, items: l.items.map((i) => ({ productId: i.product.id, name: i.product.name, price: i.product.price, image: i.product.images[0]?.url ?? null, note: i.note ?? "" })) }} />
      <div className="mt-4"><EntityHistory type="Look" id={l.id} /></div>
    </>
  );
}
