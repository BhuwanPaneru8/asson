import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { bootstrap } from "../../prisma/bootstrap";
import { CATEGORIES, SUPPLIERS } from "../../prisma/reference-data";
import { resetDb } from "../support/db";

const categoryCount = CATEGORIES.reduce((n, c) => n + 1 + c.children.length, 0);

describe("production bootstrap", () => {
  beforeEach(resetDb);

  it("loads categories, all 77 district rates and suppliers into an empty database", async () => {
    const r = await bootstrap(db);
    expect(r).toEqual({ categoriesCreated: categoryCount, deliveryRatesCreated: 77, suppliersCreated: SUPPLIERS.length });
    expect(await db.deliveryRate.count()).toBe(77);
    const ktm = await db.deliveryRate.findUniqueOrThrow({ where: { district: "Kathmandu" } });
    expect(ktm).toMatchObject({ zone: "VALLEY", fee: 10000, expressAvailable: true });
    const shirts = await db.category.findUniqueOrThrow({ where: { slug: "men-shirts" }, include: { parent: true } });
    expect(shirts.parent?.slug).toBe("men");
    expect(await db.product.count()).toBe(0); // no demo catalogue, orders or users
    expect(await db.user.count()).toBe(0);
  });

  it("is safe to re-run: creates nothing twice and keeps the owner's edits", async () => {
    await bootstrap(db);
    await db.deliveryRate.update({ where: { district: "Kathmandu" }, data: { fee: 8000 } });
    await db.category.update({ where: { slug: "men" }, data: { name: "Menswear" } });
    await db.deliveryRate.delete({ where: { district: "Jhapa" } });
    await db.supplier.deleteMany({ where: { name: { not: SUPPLIERS[0].name } } });

    const r = await bootstrap(db);
    expect(r).toEqual({ categoriesCreated: 0, deliveryRatesCreated: 1, suppliersCreated: 0 });
    expect((await db.deliveryRate.findUniqueOrThrow({ where: { district: "Kathmandu" } })).fee).toBe(8000);
    expect((await db.category.findUniqueOrThrow({ where: { slug: "men" } })).name).toBe("Menswear");
    expect(await db.category.count()).toBe(categoryCount);
    expect(await db.supplier.count()).toBe(1); // owner's own list is left alone once it exists
  });
});
