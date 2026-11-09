import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";
import { store } from "./config";

type Tx = Prisma.TransactionClient | PrismaClient;
const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

/**
 * Queue a "back in stock" SMS for everyone waiting on these variants that now have stock.
 * Call inside the same transaction that added the stock (outbox pattern). Each alert fires once.
 */
export async function queueBackInStock(tx: Tx, variantIds: string[]) {
  if (!variantIds.length) return 0;
  const alerts = await tx.stockAlert.findMany({
    where: { variantId: { in: [...new Set(variantIds)] }, notifiedAt: null, variant: { stock: { gt: 0 }, product: { status: "ACTIVE" } } },
    select: { id: true, phone: true, variant: { select: { color: true, size: true, product: { select: { name: true, slug: true } } } } },
    take: 2000,
  });
  let queued = 0;
  for (const a of alerts) {
    const claimed = await tx.stockAlert.updateMany({ where: { id: a.id, notifiedAt: null }, data: { notifiedAt: new Date() } });
    if (!claimed.count) continue;
    const p = a.variant.product;
    await tx.notification.create({
      data: {
        channel: "SMS", template: "back_in_stock", to: a.phone,
        body: `${store.name}: good news! ${p.name} (${a.variant.color}, ${a.variant.size}) is back in stock. Get yours before it goes again: ${siteUrl()}/p/${p.slug}?color=${encodeURIComponent(a.variant.color)}`,
      },
    });
    queued++;
  }
  return queued;
}
