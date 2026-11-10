import Link from "next/link";
import { Heart } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { cardSelect, toCard } from "@/lib/catalog";
import { ProductGrid } from "@/components/product/product-card";
import { EmptyState } from "@/components/ui/misc";
import { buttonClass } from "@/components/ui/button";
import { getT } from "@/lib/i18n/server";

export const metadata = { title: "Wishlist" };

export default async function WishlistPage() {
  const user = await requireUser("/account/wishlist");
  const { t } = await getT();
  const items = await db.wishlistItem.findMany({ where: { userId: user.id, product: { status: "ACTIVE" } }, orderBy: { createdAt: "desc" }, include: { product: { select: cardSelect } } });
  if (!items.length) return <EmptyState icon={<Heart className="h-10 w-10" strokeWidth={1.2} />} title={t("acc.wishEmpty")} body={t("acc.wishEmptyBody")} action={<Link href="/shop" className={buttonClass()}>{t("acc.discover")}</Link>} />;
  return (
    <div>
      <h2 className="mb-6 text-[18px] font-semibold">{t("acc.saved", { n: items.length })}</h2>
      <ProductGrid products={items.map((i) => toCard(i.product))} className="md:grid-cols-3 xl:grid-cols-3" />
    </div>
  );
}
