"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { applyImport, loadImportContext, planImport, readSheet, type ImportIssue, type PlannedProduct } from "@/lib/product-import";
import { slugify } from "@/lib/utils";
import { audit } from "@/lib/audit";

export type ImportPreview = {
  ok: boolean;
  error?: string;
  errors: ImportIssue[];
  warnings: ImportIssue[];
  unknownColumns: string[];
  summary: { create: number; update: number; newVariants: number; units: number };
  products: { handle: string; name: string; action: PlannedProduct["action"]; category?: string; price?: number; newVariants: number; units: number; images: number; changes: string[] }[];
};

const MAX_BYTES = 900 * 1024; // server actions accept 1 MB; ~3,000 variant rows fit

async function plan(text: string) {
  const sheet = readSheet(text);
  const handles = [...new Set(sheet.rows.map((r) => slugify(r.v.handle || r.v.name)).filter(Boolean))];
  const skus = [...new Set(sheet.rows.map((r) => r.v.sku.toUpperCase()).filter(Boolean))];
  const ctx = await loadImportContext(db, handles, skus);
  const p = planImport(sheet.rows, ctx);
  return { ...p, errors: [...sheet.errors, ...p.errors], unknown: sheet.unknown };
}

function emptyPreview(error: string): ImportPreview {
  return { ok: false, error, errors: [], warnings: [], unknownColumns: [], summary: { create: 0, update: 0, newVariants: 0, units: 0 }, products: [] };
}

/** Dry run: what the file would do. Writes nothing. */
export async function previewImport(text: string): Promise<ImportPreview> {
  await requirePermission("catalog.edit");
  if (typeof text !== "string" || !text.trim()) return emptyPreview("The file is empty.");
  if (text.length > MAX_BYTES) return emptyPreview("This file is too big. Split it into smaller files (about 3,000 rows each).");
  const p = await plan(text);
  return {
    ok: p.errors.length === 0 && p.products.length > 0,
    error: p.products.length === 0 && !p.errors.length ? "No products found in the file." : undefined,
    errors: p.errors.slice(0, 200), warnings: p.warnings.slice(0, 200), unknownColumns: p.unknown, summary: p.summary,
    products: p.products.map((x) => ({
      handle: x.handle, name: x.name, action: x.action, category: x.categoryLabel, price: x.fields.price,
      newVariants: x.newVariants.length, units: x.newVariants.reduce((s, v) => s + v.stock, 0), images: x.newImages.length,
      changes: x.action === "update" ? [...Object.keys(x.fields), ...(x.collectionIds.length ? ["collections"] : []), ...(x.costUpdates.length ? [`cost × ${x.costUpdates.length}`] : [])] : [],
    })),
  };
}

/** Import for real. Re-plans from the file on the server (never trusts the preview), all or nothing. */
export async function runImport(text: string): Promise<{ ok: boolean; error?: string; created?: number; updated?: number; products?: { id: string; slug: string; action: string }[] }> {
  const user = await requirePermission("catalog.edit");
  if (typeof text !== "string" || text.length > MAX_BYTES) return { ok: false, error: "This file is too big." };
  const p = await plan(text);
  if (p.errors.length) return { ok: false, error: `The file has ${p.errors.length} problem${p.errors.length > 1 ? "s" : ""}. Preview it again and fix them first.` };
  if (!p.products.length) return { ok: false, error: "No products found in the file." };
  try {
    const touched = await applyImport(db, p, user.id);
    await audit(db, user, { action: "catalog.import", entity: ["Product"], summary: `Spreadsheet import: ${touched.filter((t) => t.action === "create").length} new, ${touched.filter((t) => t.action === "update").length} updated, ${p.summary.newVariants} new variants, ${p.summary.units} units received`, changes: { products: touched.map((t) => `${t.action}:${t.slug}`).slice(0, 500) } });
    revalidateTag("products", { expire: 0 });
    revalidateTag("catalog", { expire: 0 });
    return { ok: true, created: touched.filter((t) => t.action === "create").length, updated: touched.filter((t) => t.action === "update").length, products: touched };
  } catch (e) {
    console.error("runImport", e);
    const msg = String(e);
    if (/Unique constraint/i.test(msg)) return { ok: false, error: "Someone else added a product or SKU with the same name while you were importing. Preview again and retry." };
    return { ok: false, error: "The import failed and nothing was changed. Try again." };
  }
}
