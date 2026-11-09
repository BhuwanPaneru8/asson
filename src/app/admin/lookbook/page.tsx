import Image from "next/image";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatPrice } from "@/lib/utils";
import { PageHeader, Pill } from "@/components/admin/ui";

export const metadata = { title: "Lookbook" };

export default async function AdminLookbookPage() {
  await requirePermission("catalog.edit");
  const looks = await db.look.findMany({
    orderBy: [{ published: "desc" }, { position: "asc" }, { createdAt: "desc" }],
    include: { items: { orderBy: { position: "asc" }, include: { product: { select: { price: true, status: true, images: { take: 1, orderBy: { position: "asc" }, select: { url: true } } } } } } },
  });
  return (
    <>
      <PageHeader title="Lookbook" description="Styled outfits made from your own products. Each look shows on the shop's Lookbook page with a “Shop the look” button." actions={<Link href="/admin/lookbook/new" className="flex h-10 items-center gap-1.5 rounded-md bg-ink px-4 text-[14px] text-white"><Plus className="h-4 w-4" /> New look</Link>} />
      {!looks.length ? <p className="rounded-lg border border-line bg-white p-10 text-center text-muted">No looks yet. Start with one outfit you&apos;d happily wear yourself.</p> : (
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {looks.map((l) => {
            const live = l.items.filter((i) => i.product.status === "ACTIVE");
            const hero = l.heroImage || live[0]?.product.images[0]?.url;
            return (
              <li key={l.id}>
                <Link href={`/admin/lookbook/${l.id}`} className="block overflow-hidden rounded-lg border border-line bg-white hover:border-ink">
                  <div className="relative aspect-[4/5] bg-cloud">{hero && <Image src={hero} alt="" fill sizes="300px" className="object-cover" />}</div>
                  <div className="p-3 text-[13.5px]">
                    <p className="font-medium">{l.title}</p>
                    <p className="text-muted">{live.length} piece{live.length === 1 ? "" : "s"} · {formatPrice(live.reduce((s, i) => s + i.product.price, 0))}</p>
                    <div className="mt-1.5">{l.published ? <Pill tone="success">Published</Pill> : <Pill>Draft</Pill>}</div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
