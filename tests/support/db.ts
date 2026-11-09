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
/** Staff act at every location unless `locations` lists the only store ids they work at. */
export async function makeUser(role: Role, opts: { pin?: string; name?: string; locations?: string[] } = {}) {
  n++;
  const u = await db.user.create({
    data: {
      email: `${role.toLowerCase()}${n}@test.local`, name: opts.name ?? `${role} ${n}`, role,
      passwordHash: await bcrypt.hash("Password1", 4),
      approvalPinHash: opts.pin ? await bcrypt.hash(opts.pin, 4) : null,
      allLocations: role !== "CUSTOMER" && !opts.locations,
      ...(opts.locations ? { locations: { create: opts.locations.map((storeId) => ({ storeId })) } } : {}),
    },
  });
  return { id: u.id, email: u.email, name: u.name, phone: u.phone, role: u.role };
}

export function actAs(user: Awaited<ReturnType<typeof makeUser>> | null) {
  session.user = user;
}

/** A sellable product with one variant per size. Price/cost in rupees for readability. */
export async function makeProduct(opts: { name?: string; price?: number; mrp?: number; cost?: number; stock?: Record<string, number>; at?: string } = {}) {
  n++;
  const cat = await db.category.upsert({ where: { slug: "test-cat" }, update: {}, create: { name: "Test", slug: "test-cat" } });
  const stock = opts.stock ?? { M: 10 };
  const p = await db.product.create({
    data: {
      name: opts.name ?? `Test Shirt ${n}`, slug: `test-shirt-${n}`, brand: "Asson", description: "A test product.", gender: "MEN", status: "ACTIVE",
      price: (opts.price ?? 1000) * 100, compareAtPrice: opts.mrp ? opts.mrp * 100 : null, categoryId: cat.id,
      variants: { create: Object.entries(stock).map(([size], i) => ({ sku: `T${n}-${size}`, color: "White", colorHex: "#FFFFFF", size, position: i, costPrice: opts.cost != null ? opts.cost * 100 : null })) },
    },
    include: { variants: { orderBy: { position: "asc" } } },
  });
  // stock lives at a location (opts.at, else the flagship); Variant.stock follows by trigger
  const at = opts.at ?? (await makeLocation({ code: "FLAGSHIP" })).id;
  const rows = p.variants.map((v) => ({ storeId: at, variantId: v.id, quantity: stock[v.size] })).filter((r) => r.quantity > 0);
  if (rows.length) await db.storeStock.createMany({ data: rows });
  return db.product.findUniqueOrThrow({ where: { id: p.id }, include: { variants: { orderBy: { position: "asc" } } } });
}

/** A location (shop by default). Re-using a code returns the existing one. */
export async function makeLocation(opts: { code: string; name?: string; kind?: "SHOP" | "WAREHOUSE"; priority?: number; pickup?: boolean; active?: boolean }) {
  return db.store.upsert({
    where: { code: opts.code },
    update: {},
    create: { code: opts.code, name: opts.name ?? opts.code, address: "Kathmandu", kind: opts.kind ?? "SHOP", priority: opts.priority ?? 100, pickup: opts.pickup ?? false, active: opts.active ?? true },
  });
}

/** Units of a variant at a location. */
export async function stockAt(storeId: string, variantId: string) {
  return (await db.storeStock.findUnique({ where: { storeId_variantId: { storeId, variantId } } }))?.quantity ?? 0;
}
