import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";
import { store } from "./config";
import { formatPrice } from "./utils";

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

/**
 * Queue "price drop" SMS for everyone watching these products whose price is now below what it was when they
 * asked. One SMS per phone (several products are listed together); each alert fires once. Call inside the
 * transaction that lowered the price.
 */
export async function queuePriceDrops(tx: Tx, productIds: string[]) {
  if (!productIds.length) return 0;
  const rows = await tx.$queryRaw<{ id: string; phone: string; was: number; now: number; name: string; slug: string }[]>`
    SELECT a."id", a."phone", a."price" AS "was", p."price" AS "now", p."name", p."slug"
    FROM "PriceAlert" a JOIN "Product" p ON p."id" = a."productId"
    WHERE a."productId" = ANY(${[...new Set(productIds)]}) AND a."notifiedAt" IS NULL AND p."status" = 'ACTIVE' AND p."price" < a."price"
    ORDER BY a."phone", (a."price" - p."price") DESC LIMIT 5000`;
  const byPhone = new Map<string, typeof rows>();
  for (const r of rows) byPhone.set(r.phone, [...(byPhone.get(r.phone) ?? []), r]);
  let queued = 0;
  for (const [phone, list] of byPhone) {
    const claimed = await tx.priceAlert.updateMany({ where: { id: { in: list.map((r) => r.id) }, notifiedAt: null }, data: { notifiedAt: new Date() } });
    if (!claimed.count) continue;
    const top = list[0];
    const more = list.length > 1 ? ` and ${list.length - 1} more you watched` : "";
    await tx.notification.create({ data: { channel: "SMS", template: "price_drop", to: phone,
      body: `${store.name}: price drop! ${top.name} is now ${formatPrice(top.now)} (was ${formatPrice(top.was)})${more}. ${siteUrl()}/p/${top.slug}` } });
    queued++;
  }
  return queued;
}
