import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import type { Role } from "@/lib/permissions";
import { session } from "./next-mocks";

/** Empty every table (keeps the schema). Fast enough to run before each test. */
export async function resetDb() {
  const tables = await db.$queryRaw<{ tablename: string }[]>`SELECT tablename::text AS tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await db.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
  session.user = null;
  session.cookies.clear();
}

let n = 0;
export async function makeUser(role: Role, opts: { pin?: string; name?: string } = {}) {
  n++;
  const u = await db.user.create({
    data: {
      email: `${role.toLowerCase()}${n}@test.local`, name: opts.name ?? `${role} ${n}`, role,
      passwordHash: await bcrypt.hash("Password1", 4),
      approvalPinHash: opts.pin ? await bcrypt.hash(opts.pin, 4) : null,
    },
  });
  return { id: u.id, email: u.email, name: u.name, phone: u.phone, role: u.role };
}

export function actAs(user: Awaited<ReturnType<typeof makeUser>> | null) {
  session.user = user;
}

/** A sellable product with one variant per size. Price/cost in rupees for readability. */
export async function makeProduct(opts: { name?: string; price?: number; mrp?: number; cost?: number; stock?: Record<string, number> } = {}) {
  n++;
  const cat = await db.category.upsert({ where: { slug: "test-cat" }, update: {}, create: { name: "Test", slug: "test-cat" } });
  const stock = opts.stock ?? { M: 10 };
  return db.product.create({
    data: {
      name: opts.name ?? `Test Shirt ${n}`, slug: `test-shirt-${n}`, brand: "Asson", description: "A test product.", gender: "MEN", status: "ACTIVE",
      price: (opts.price ?? 1000) * 100, compareAtPrice: opts.mrp ? opts.mrp * 100 : null, categoryId: cat.id,
      variants: { create: Object.entries(stock).map(([size, qty], i) => ({ sku: `T${n}-${size}`, color: "White", colorHex: "#FFFFFF", size, stock: qty, position: i, costPrice: opts.cost != null ? opts.cost * 100 : null })) },
    },
    include: { variants: { orderBy: { position: "asc" } } },
  });
}
