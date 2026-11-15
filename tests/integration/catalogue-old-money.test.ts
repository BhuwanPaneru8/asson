import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { bootstrap } from "../../prisma/bootstrap";
import { loadStarterCatalogue } from "../../prisma/catalogue-starter";
import { OLD_MONEY, OLD_MONEY_LOOKS, loadOldMoneyEdit } from "../../prisma/catalogue-old-money";
import { resetDb } from "../support/db";

describe("the Old Money Edit", () => {
  beforeEach(async () => {
    await resetDb();
    await bootstrap(db);
    await loadStarterCatalogue(db); // as on the live shop
  });

  it("adds its categories, products (stocked, with a ledger), a collection shown first, and the looks", async () => {
    const before = (await db.inventoryLog.aggregate({ _sum: { delta: true } }))._sum.delta ?? 0;
    const r = await loadOldMoneyEdit(db);
    expect(r).toMatchObject({ productsCreated: OLD_MONEY.length, categoriesCreated: 2, collectionsCreated: 1, looksCreated: OLD_MONEY_LOOKS.length });

    const knit = await db.category.findUniqueOrThrow({ where: { slug: "men-knitwear" }, include: { parent: true } });
    expect(knit.parent?.slug).toBe("men");
    const edit = await db.collection.findUniqueOrThrow({ where: { slug: "the-old-money-edit" }, include: { _count: { select: { products: true } } } });
    expect(edit._count.products).toBe(OLD_MONEY.length);
    const first = await db.collection.findFirstOrThrow({ where: { featured: true }, orderBy: { sortOrder: "asc" } });
    expect(first.slug).toBe("the-old-money-edit");

    // every new unit has a reason in the ledger
    const ledger = (await db.inventoryLog.aggregate({ _sum: { delta: true }, where: { note: "Old Money Edit" } }))._sum.delta;
    expect(ledger).toBe(r.unitsStocked);
    expect(((await db.inventoryLog.aggregate({ _sum: { delta: true } }))._sum.delta ?? 0) - before).toBe(r.unitsStocked);

    const coat = await db.product.findUniqueOrThrow({ where: { slug: "camel-wool-overcoat" }, include: { pairsWith: true } });
    expect(coat).toMatchObject({ price: 1_699_000, compareAtPrice: 1_999_000, status: "ACTIVE", brand: "Asson Heritage" });
    expect(coat.pairsWith.map((p) => p.slug)).toEqual(expect.arrayContaining(["merino-roll-neck", "cable-knit-merino-crew"]));

    // the looks lead the Lookbook, each with all three pieces, in order
    const looks = await db.look.findMany({ orderBy: { position: "asc" }, include: { items: { orderBy: { position: "asc" }, include: { product: true } } } });
    expect(looks.slice(0, 4).map((l) => l.slug)).toEqual(["sunday-at-the-club", "the-camel-coat", "linen-pressed", "country-weekend"]);
    expect(looks[1].items.map((i) => i.product.slug)).toEqual(OLD_MONEY_LOOKS[1].pieces);
    expect(looks.every((l) => l.published && l.heroImage?.startsWith("https://images.unsplash.com/photo-"))).toBe(true);
  });

  it("is safe to re-run and never touches what the owner changed", async () => {
    await loadOldMoneyEdit(db);
    await db.product.update({ where: { slug: "navy-hopsack-blazer" }, data: { price: 1_049_000 } });
    const units = (await db.variant.aggregate({ _sum: { stock: true } }))._sum.stock;
    const again = await loadOldMoneyEdit(db);
    expect(again).toMatchObject({ productsCreated: 0, productsSkipped: OLD_MONEY.length, categoriesCreated: 0, collectionsCreated: 0, looksCreated: 0, unitsStocked: 0 });
    expect((await db.product.findUniqueOrThrow({ where: { slug: "navy-hopsack-blazer" } })).price).toBe(1_049_000);
    expect((await db.variant.aggregate({ _sum: { stock: true } }))._sum.stock).toBe(units);
    const skus = await db.variant.findMany({ select: { sku: true } });
    expect(new Set(skus.map((s) => s.sku)).size).toBe(skus.length);
  });
});
