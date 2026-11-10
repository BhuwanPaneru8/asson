/**
 * National-scale dataset for performance work: a shop in every district, five warehouses, 3,000 products,
 * ~1M location-stock rows and a year of orders (default 300k). Loads into its own database, asson_scale.
 *   npx tsx tests/scale/load.ts [orders]
 * Never point this at a real database: it refuses any name without "scale".
 */
import { execSync } from "node:child_process";
import os from "node:os";
import { PrismaClient } from "@prisma/client";
import { PROVINCES } from "../../src/lib/config";

export const scaleUrl = () => process.env.SCALE_DATABASE_URL ?? `postgresql://${os.userInfo().username}@localhost:5432/asson_scale?schema=public`;

async function main() {
  const url = scaleUrl();
  if (!/scale/.test(url)) throw new Error(`Refusing to load scale data into ${url}`);
  const orders = Number(process.argv[2] ?? 300_000);
  // a throwaway database this script owns: start it fresh, then apply the migrations to it
  const name = new URL(url).pathname.slice(1);
  if (!/scale/.test(name)) throw new Error(`Refusing to recreate database ${name}`);
  execSync(`dropdb --if-exists ${name} && createdb ${name}`, { stdio: "pipe" });
  execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: url }, stdio: "pipe" });
  const db = new PrismaClient({ datasources: { db: { url } } });
  const t0 = Date.now();
  const step = async (label: string, sql: string) => { const s = Date.now(); await db.$executeRawUnsafe(sql); console.log(`  ${label}: ${((Date.now() - s) / 1000).toFixed(1)}s`); };

  // districts in east→west order, with their province
  const districts = PROVINCES.flatMap((p) => p.districts.map((d) => [d, p.name] as const));
  const values = districts.map(([d], i) => `('shop${i}', 'S${String(i).padStart(2, "0")}', 'Asson ${d.replace(/'/g, "''")}', '${d.replace(/'/g, "''")} main road', 'SHOP', ${100 + i}, '${d.replace(/'/g, "''")}', true, true)`);
  const hubs = [0, 2, 3, 4, 6].map((n) => PROVINCES[n]).map((p, i) => `('wh${i}', 'WH${i}', 'Warehouse ${p.name}', '${p.districts[0]}', 'WAREHOUSE', ${10 + i}, '${p.districts[0]}', true, false)`);
  console.log(`Loading ${districts.length} shops, ${hubs.length} warehouses, 3,000 products, ${orders.toLocaleString()} orders into asson_scale`);

  await step("session", `SET session_replication_role = replica`); // bulk load without per-row triggers; totals recomputed below
  await step("locations", `INSERT INTO "Store" (id, code, name, address, kind, priority, district, "shipsOnline", pickup) VALUES ${[...values, ...hubs].join(",")}`);
  await step("categories", `INSERT INTO "Category" (id, name, slug, "sortOrder") SELECT 'cat'||g, 'Category '||g, 'category-'||g, g FROM generate_series(1, 12) g`);
  await step("products", `INSERT INTO "Product" (id, name, slug, description, details, brand, gender, status, price, "compareAtPrice", tags, "soldCount", "categoryId", "createdAt", "updatedAt")
    SELECT 'p'||g, (ARRAY['Linen','Oxford','Denim','Cotton','Wool','Silk','Pashmina','Chino'])[1 + g % 8]||' '||(ARRAY['Shirt','Jeans','Kurta','Hoodie','Dress','Jacket','Tee','Trousers','Saree','Sweater'])[1 + (g / 8) % 10]||' '||g,
      'product-'||g, 'A classic piece made to last, number '||g||'.', ARRAY['Easy care'], 'Asson', (ARRAY['MEN','WOMEN','KIDS','UNISEX'])[1 + g % 4]::"Gender", 'ACTIVE',
      (999 + (g % 40) * 100) * 100, CASE WHEN g % 7 = 0 THEN (1499 + (g % 40) * 100) * 100 END, ARRAY['classic'], (g * 37) % 500, 'cat'||(1 + g % 12), now() - (g % 400) * interval '1 day', now()
    FROM generate_series(1, 3000) g`);
  await step("variants", `INSERT INTO "Variant" (id, "productId", sku, color, "colorHex", size, stock, "costPrice", position, "updatedAt")
    SELECT 'v'||p||'-'||c||'-'||s, 'p'||p, 'AS-'||p||'-'||c||'-'||s, (ARRAY['Black','White','Navy','Olive'])[c], (ARRAY['#111111','#ffffff','#1f2a44','#556b2f'])[c],
      (ARRAY['S','M','L'])[s], 0, (500 + (p % 30) * 40) * 100, c * 3 + s, now()
    FROM generate_series(1, 3000) p, generate_series(1, 4) c, generate_series(1, 3) s`);
  await step("warehouse stock", `INSERT INTO "StoreStock" ("storeId", "variantId", quantity) SELECT w.id, v.id, 20 + (abs(hashtext(w.id||v.id)) % 60) FROM "Store" w, "Variant" v WHERE w.kind = 'WAREHOUSE'`);
  await step("shop stock (35% of sizes)", `INSERT INTO "StoreStock" ("storeId", "variantId", quantity) SELECT s.id, v.id, abs(hashtext(s.id||v.id)) % 8 FROM "Store" s, "Variant" v WHERE s.kind = 'SHOP' AND abs(hashtext(v.id||s.id)) % 100 < 35`);
  await step("variant totals", `UPDATE "Variant" v SET stock = t.q FROM (SELECT "variantId", SUM(quantity)::int q FROM "StoreStock" GROUP BY 1) t WHERE t."variantId" = v.id`);
  await step("orders", `INSERT INTO "Order" (id, email, phone, status, "paymentStatus", "paymentMethod", subtotal, total, "shippingMethod", "shippingAddress", channel, "createdAt", "updatedAt")
    SELECT 'o'||g, 'c'||(g % 60000)||'@scale.local', '98'||lpad((abs(hashtext(g::text)) % 60000)::text, 8, '0'),
      (CASE WHEN g > ${orders} - 3000 THEN 'CONFIRMED' WHEN g % 50 = 0 THEN 'CANCELLED' WHEN g % 9 = 0 THEN 'PENDING' ELSE 'DELIVERED' END)::"OrderStatus", 'PAID', (CASE WHEN g % 3 = 0 THEN 'IN_STORE' ELSE 'COD' END)::"PaymentMethod",
      0, 0, 'standard', '{"fullName":"Scale Shopper","district":"Kathmandu"}'::jsonb, (CASE WHEN g % 3 = 0 THEN 'STORE' ELSE 'ONLINE' END)::"SalesChannel",
      now() - ((g::float / ${orders}) * 365) * interval '1 day', now()
    FROM generate_series(1, ${orders}) g`);
  await step("order items (2 per order)", `INSERT INTO "OrderItem" (id, "orderId", "variantId", "productId", name, slug, sku, color, size, image, "unitPrice", quantity, "unitCost")
    SELECT 'oi'||g||'-'||k, 'o'||g, 'v'||p||'-'||(1 + (g + k) % 4)||'-'||(1 + (g * k) % 3), 'p'||p, 'Product '||p, 'product-'||p, 'AS-'||p, 'Black', 'M', '', (999 + (p % 40) * 100) * 100, 1 + (g % 2), (500 + (p % 30) * 40) * 100
    FROM generate_series(1, ${orders}) g, generate_series(1, 2) k, LATERAL (SELECT 1 + (abs(hashtext(g::text||k::text)) % 3000) AS p) x`);
  await step("order totals", `UPDATE "Order" o SET subtotal = t.s, total = t.s FROM (SELECT "orderId", SUM("unitPrice" * quantity)::int s FROM "OrderItem" GROUP BY 1) t WHERE t."orderId" = o.id`);
  await step("allocations", `INSERT INTO "OrderAllocation" (id, "orderId", "orderItemId", "variantId", "storeId", quantity, "pickedAt", "createdAt")
    SELECT 'a'||oi.id, oi."orderId", oi.id, oi."variantId", CASE WHEN o.channel = 'STORE' THEN 'shop'||(abs(hashtext(o.id)) % ${districts.length}) ELSE 'wh'||(abs(hashtext(o.id)) % ${hubs.length}) END, oi.quantity,
      CASE WHEN o.status IN ('PENDING', 'CONFIRMED') THEN NULL ELSE o."createdAt" END, o."createdAt"
    FROM "OrderItem" oi JOIN "Order" o ON o.id = oi."orderId"`);
  await step("sales ledger", `INSERT INTO "InventoryLog" (id, "variantId", delta, reason, "orderId", "storeId", "createdAt")
    SELECT 'l'||a.id, a."variantId", -a.quantity, 'SALE', a."orderId", a."storeId", a."createdAt" FROM "OrderAllocation" a`);
  await step("session", `SET session_replication_role = DEFAULT`);
  await step("analyze", `ANALYZE`);
  const counts = await db.$queryRawUnsafe<{ t: string; n: bigint }[]>(`SELECT 'StoreStock' t, count(*) n FROM "StoreStock" UNION ALL SELECT 'Order', count(*) FROM "Order" UNION ALL SELECT 'OrderItem', count(*) FROM "OrderItem" UNION ALL SELECT 'InventoryLog', count(*) FROM "InventoryLog"`);
  console.log(counts.map((c) => `${c.t}: ${Number(c.n).toLocaleString()}`).join(" · "), `· total ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
