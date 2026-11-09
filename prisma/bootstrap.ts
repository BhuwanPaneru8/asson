/**
 * Production-safe setup: loads the reference data a new shop needs and nothing else.
 * Never deletes and never overwrites, so it is safe to re-run on a live database:
 *  - categories: created when their slug is missing (owner edits to names/images are kept)
 *  - delivery rates: created for districts that have no row (owner fee changes are kept)
 *  - suppliers: loaded only when there are no suppliers at all
 *
 *   DATABASE_URL=... npx tsx prisma/bootstrap.ts
 * On a server database use: deploy/with-db.sh <staging|production> npx tsx prisma/bootstrap.ts
 */
import { PrismaClient } from "@prisma/client";
import { CATEGORIES, SUPPLIERS, deliveryRates } from "./reference-data";

export async function bootstrap(db: PrismaClient) {
  const result = { categoriesCreated: 0, deliveryRatesCreated: 0, suppliersCreated: 0 };

  for (const [i, root] of CATEGORIES.entries()) {
    let parent = await db.category.findUnique({ where: { slug: root.slug } });
    if (!parent) {
      parent = await db.category.create({ data: { name: root.name, slug: root.slug, image: root.image, description: root.desc, sortOrder: i } });
      result.categoriesCreated++;
    }
    for (const [j, child] of root.children.entries()) {
      if (await db.category.findUnique({ where: { slug: child.slug } })) continue;
      await db.category.create({ data: { name: child.name, slug: child.slug, parentId: parent.id, sortOrder: j } });
      result.categoriesCreated++;
    }
  }

  result.deliveryRatesCreated = (await db.deliveryRate.createMany({ data: deliveryRates(), skipDuplicates: true })).count;

  if ((await db.supplier.count()) === 0) {
    result.suppliersCreated = (await db.supplier.createMany({ data: SUPPLIERS })).count;
  }
  return result;
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL first.");
  const db = new PrismaClient();
  try {
    const r = await bootstrap(db);
    const totals = {
      categories: await db.category.count(),
      deliveryRates: await db.deliveryRate.count(),
      suppliers: await db.supplier.count(),
      products: await db.product.count(),
    };
    console.log("Created:", r);
    console.log("Now in the database:", totals);
  } finally {
    await db.$disconnect();
  }
}

if (process.argv[1]?.endsWith("bootstrap.ts")) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
