import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { bootstrap } from "../../prisma/bootstrap";
import { STARTER, loadStarterCatalogue } from "../../prisma/catalogue-starter";
import { resetDb } from "../support/db";

describe("starter catalogue", () => {
  beforeEach(async () => {
    await resetDb();
    await bootstrap(db);
  });

  it("creates every product active, in stock, with a matching inventory ledger", async () => {
    const r = await loadStarterCatalogue(db);
    expect(r.productsCreated).toBe(STARTER.length);
    expect(await db.product.count({ where: { status: "ACTIVE" } })).toBe(STARTER.length);
    const stock = (await db.variant.aggregate({ _sum: { stock: true } }))._sum.stock;
    const ledger = (await db.inventoryLog.aggregate({ _sum: { delta: true }, where: { reason: "RECEIVED" } }))._sum.delta;
    expect(stock).toBe(r.unitsStocked);
    expect(ledger).toBe(stock); // every unit has a reason
    expect(await db.product.count({ where: { images: { none: {} } } })).toBe(0);
    const tee = await db.product.findUniqueOrThrow({ where: { slug: "supima-cotton-crew-tee" }, include: { pairsWith: true, pairedBy: true } });
    expect(tee.price).toBe(189000);
    expect(tee.pairsWith.map((p) => p.slug).sort()).toEqual(expect.arrayContaining(["cotton-twill-chinos", "slim-tapered-jeans"]));
  });

  it("is safe to re-run: never duplicates or edits existing products, and continues the SKU sequence", async () => {
    await db.product.create({
      data: { name: "Owner Tee", slug: "owner-tee", description: "x", brand: "Asson", gender: "MEN", price: 100000, categoryId: (await db.category.findFirstOrThrow()).id, variants: { create: { sku: "AS-00041", color: "Black", colorHex: "#000", size: "M" } } },
    });
    await loadStarterCatalogue(db);
    await db.product.update({ where: { slug: "supima-cotton-crew-tee" }, data: { price: 175000 } });
    const again = await loadStarterCatalogue(db);
    expect(again).toMatchObject({ productsCreated: 0, productsSkipped: STARTER.length, unitsStocked: 0 });
    expect((await db.product.findUniqueOrThrow({ where: { slug: "supima-cotton-crew-tee" } })).price).toBe(175000);
    const skus = await db.variant.findMany({ select: { sku: true } });
    expect(new Set(skus.map((s) => s.sku)).size).toBe(skus.length);
    expect(skus.some((s) => s.sku === "AS-00042")).toBe(true); // continues after the highest existing SKU
  });
});
