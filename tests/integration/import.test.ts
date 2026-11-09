import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { previewImport, runImport } from "@/actions/admin/import";
import { exportCatalogueCsv, templateCsv } from "@/lib/product-import";
import { parseCsv, toCsv } from "@/lib/csv";
import { RedirectError } from "../support/next-mocks";
import { actAs, makeUser, resetDb } from "../support/db";

const HEAD = ["handle", "name", "status", "category", "price", "mrp", "description", "features", "fabric", "tags", "images", "color", "color_hex", "size", "sku", "stock", "cost"];
const sheet = (rows: (string | number)[][]) => toCsv([HEAD, ...rows]);
const DESC = "Soft cotton, cut for every day.";

async function setup() {
  const men = await db.category.create({ data: { name: "Men", slug: "men" } });
  await db.category.create({ data: { name: "Shirts", slug: "men-shirts", parentId: men.id } });
  const women = await db.category.create({ data: { name: "Women", slug: "women" } });
  await db.category.create({ data: { name: "Shirts", slug: "women-shirts", parentId: women.id } });
  await db.category.create({ data: { name: "Kurtas", slug: "women-kurtas", parentId: women.id } });
  actAs(await makeUser("ADMIN"));
}

describe("spreadsheet import", () => {
  beforeEach(async () => { await resetDb(); await setup(); });

  it("the blank template imports cleanly as a draft product with logged stock", async () => {
    const pv = await previewImport(templateCsv());
    expect(pv.errors).toEqual([]);
    expect(pv).toMatchObject({ ok: true, summary: { create: 1, update: 0, newVariants: 4, units: 38 } });
    expect(await db.product.count()).toBe(0); // preview writes nothing

    const r = await runImport(templateCsv());
    expect(r).toMatchObject({ ok: true, created: 1 });
    const p = await db.product.findUniqueOrThrow({ where: { slug: "oxford-shirt" }, include: { variants: { orderBy: { position: "asc" } }, category: true } });
    expect(p).toMatchObject({ status: "DRAFT", gender: "MEN", price: 249900, compareAtPrice: 299900, brand: "Asson", material: "100% cotton" });
    expect(p.category.slug).toBe("men-shirts");
    expect(p.details).toHaveLength(3);
    expect(p.variants.map((v) => [v.sku, v.color, v.colorHex, v.size, v.stock, v.costPrice])).toEqual([
      ["AS-00001", "White", "#F5F5F2", "M", 10, 110000],
      ["AS-00002", "White", "#F5F5F2", "L", 12, 110000],
      ["AS-00003", "Sky Blue", "#8DB6D9", "M", 8, 110000],
      ["AS-00004", "Sky Blue", "#8DB6D9", "L", 8, 110000],
    ]);
    const log = await db.inventoryLog.findMany({ where: { variant: { productId: p.id } } });
    expect(log.reduce((s, l) => s + l.delta, 0)).toBe(38);
    expect(log.every((l) => l.reason === "RECEIVED" && l.note === "Spreadsheet import")).toBe(true);
  });

  it("reports every problem with its row number and imports nothing", async () => {
    await db.variant.create({ data: { sku: "TAKEN-1", color: "Black", colorHex: "#000000", size: "M", product: { create: { name: "Other", slug: "other", description: DESC, brand: "Asson", gender: "MEN", price: 100, categoryId: (await db.category.findFirstOrThrow({ where: { slug: "men-shirts" } })).id } } } });
    const csv = sheet([
      ["linen-shirt", "Linen Shirt", "", "Shirts", "1999", "", DESC, "", "", "", "", "White", "", "M", "", "5", ""], // "Shirts" is ambiguous (men + women)
      ["linen-shirt", "", "", "", "", "", "", "", "", "", "", "White", "", "M", "", "5", ""], // duplicate colour/size
      ["kurta", "Kurta", "", "Women / Kurtas", "abc", "100", "short", "", "", "", "ftp://x", "Rust", "zz", "S", "TAKEN-1", "-1", ""],
      ["", "", "", "", "", "", "", "", "", "", "", "Rust", "", "", "", "", ""], // continues kurta, missing size
    ]);
    const pv = await previewImport(csv);
    expect(pv.ok).toBe(false);
    const msgs = pv.errors.map((e) => `${e.row}: ${e.message}`).join("\n");
    expect(msgs).toMatch(/2: Category "Shirts" matches 2 categories/);
    expect(msgs).toMatch(/3: White \/ M appears twice/);
    expect(msgs).toMatch(/4: Price "abc"/);
    expect(msgs).toMatch(/4: Description should be at least a sentence/);
    expect(msgs).toMatch(/4: Image "ftp:\/\/x" must be an https/);
    expect(msgs).toMatch(/4: SKU TAKEN-1 already belongs to another product/);
    expect(msgs).toMatch(/5: Each variant row needs both a colour and a size/);
    expect(await runImport(csv)).toMatchObject({ ok: false });
    expect(await db.product.count()).toBe(1);
  });

  it("export → edit → import updates products but never touches existing stock, and adds new sizes", async () => {
    await runImport(templateCsv());
    const before = await db.variant.findMany({ orderBy: { sku: "asc" } });
    // someone sells a unit meanwhile; the stale spreadsheet must not undo it
    const sold = await db.variant.findUniqueOrThrow({ where: { sku: "AS-00001" } });
    await db.storeStock.updateMany({ where: { variantId: sold.id, quantity: { gte: 1 } }, data: { quantity: { decrement: 1 } } });

    const rows = parseCsv(await exportCatalogueCsv(db, { includeCost: true }));
    const h = rows[0];
    const col = (n: string) => h.indexOf(n);
    rows[1][col("price")] = "2299";
    rows[1][col("status")] = "active";
    rows[1][col("description")] = "Updated: a crisp cotton oxford for office and weekends.";
    rows.push(h.map((c) => ({ handle: "oxford-shirt", color: "White", size: "XL", stock: "4" } as Record<string, string>)[c] ?? ""));
    const csv = toCsv(rows);

    const pv = await previewImport(csv);
    expect(pv).toMatchObject({ ok: true, summary: { create: 0, update: 1, newVariants: 1, units: 4 } });
    expect(pv.warnings.map((w) => w.message).join()).toMatch(/Stock left unchanged for 4 existing variants/);
    expect(await runImport(csv)).toMatchObject({ ok: true, updated: 1 });

    const p = await db.product.findUniqueOrThrow({ where: { slug: "oxford-shirt" }, include: { variants: { orderBy: { sku: "asc" } } } });
    expect(p).toMatchObject({ price: 229900, compareAtPrice: 299900, status: "ACTIVE" });
    expect(p.description).toMatch(/^Updated/);
    expect(p.variants.find((v) => v.sku === "AS-00001")!.stock).toBe(before[0].stock - 1);
    expect(p.variants.find((v) => v.size === "XL")).toMatchObject({ sku: "AS-00005", stock: 4 });
    expect(p.variants).toHaveLength(5);
  });

  it("a blank MRP keeps the old one, unless the new price reaches it", async () => {
    await runImport(templateCsv());
    await runImport(sheet([["oxford-shirt", "", "", "", "3500", "", "", "", "", "", "", "", "", "", "", "", ""]]));
    expect(await db.product.findUniqueOrThrow({ where: { slug: "oxford-shirt" } })).toMatchObject({ price: 350000, compareAtPrice: null });
  });

  it("owner only", async () => {
    actAs(await makeUser("MANAGER"));
    await expect(previewImport(templateCsv())).rejects.toBeInstanceOf(RedirectError);
    await expect(runImport(templateCsv())).rejects.toBeInstanceOf(RedirectError);
    expect(await db.product.count()).toBe(0);
  });
});
