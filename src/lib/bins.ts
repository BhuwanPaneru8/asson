import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { audit, type AuditActor } from "./audit";
import { requireStoreAccess } from "./scope";

// Bins: shelf positions at a location (A-03-2 = zone A, aisle 3, shelf 2). Each size has one home bin per
// location, where it's put away and picked from. Quantities stay per location (StoreStock); bins say where to
// look. Pick lists, putaway and count sheets walk bins in natural order (A-2 before A-10), so one pass covers
// the floor. Unbinned stock is listed so it gets a home.

type Tx = Prisma.TransactionClient;
type Actor = NonNullable<AuditActor>;
export class BinError extends Error {}

/** "a 3 2" / "a-03-02" → "A-3-2"-style codes: upper case, dashes, no spaces. */
export function normaliseCode(raw: string) {
  const c = raw.trim().toUpperCase().replace(/[\s_/.]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (!/^[A-Z0-9][A-Z0-9-]{0,19}$/.test(c)) throw new BinError(`“${raw.trim()}” isn't a bin code (letters, numbers and dashes, up to 20).`);
  return c;
}
/** Numbers zero-padded so codes sort the way people walk: A-2-1 < A-10-1 < B-1-1. */
export const sortKeyOf = (code: string) => code.replace(/\d+/g, (n) => n.padStart(4, "0"));
export const zoneOf = (code: string) => code.split("-")[0];

async function ensureBins(tx: Tx, storeId: string, codes: string[]) {
  const unique = [...new Set(codes)];
  if (unique.length) await tx.bin.createMany({ data: unique.map((code) => ({ storeId, code, sortKey: sortKeyOf(code), zone: zoneOf(code) })), skipDuplicates: true });
  const bins = await tx.bin.findMany({ where: { storeId, code: { in: unique } } });
  return new Map(bins.map((b) => [b.code, b]));
}

export async function createBins(tx: Tx, user: Actor, storeId: string, raw: string[]) {
  await requireStoreAccess(user, storeId, tx);
  const codes = raw.map((r) => r.trim()).filter(Boolean).map(normaliseCode);
  if (!codes.length) throw new BinError("List the bins, one per line.");
  if (codes.length > 5000) throw new BinError("Up to 5,000 bins at a time.");
  const before = await tx.bin.count({ where: { storeId } });
  await ensureBins(tx, storeId, codes);
  const added = (await tx.bin.count({ where: { storeId } })) - before;
  await audit(tx, user, { action: "bin.create", entity: ["Store", storeId], summary: `${added} bin(s) added (${codes.length} listed)` });
  return { added, existing: codes.length - added };
}

async function upsertAssignment(tx: Tx, storeId: string, variantId: string, binId: string, by: string) {
  await tx.$executeRaw`INSERT INTO "BinAssignment" ("storeId", "variantId", "binId", "assignedById", "updatedAt") VALUES (${storeId}, ${variantId}, ${binId}, ${by}, NOW())
    ON CONFLICT ("storeId", "variantId") DO UPDATE SET "binId" = EXCLUDED."binId", "assignedById" = EXCLUDED."assignedById", "updatedAt" = NOW()`;
}

/** Give one size a home bin (by SKU or barcode-scanned SKU). A new bin code is created on the way. */
export async function assignBin(tx: Tx, user: Actor, d: { storeId: string; sku: string; code: string }) {
  await requireStoreAccess(user, d.storeId, tx);
  const sku = d.sku.trim().toUpperCase();
  const v = await tx.variant.findFirst({ where: { sku: { equals: sku, mode: "insensitive" } }, select: { id: true, sku: true } });
  if (!v) throw new BinError(`No size with SKU ${sku}.`);
  const code = normaliseCode(d.code);
  const bin = (await ensureBins(tx, d.storeId, [code])).get(code)!;
  if (!bin.active) throw new BinError(`Bin ${code} is switched off.`);
  const prev = await tx.binAssignment.findUnique({ where: { storeId_variantId: { storeId: d.storeId, variantId: v.id } }, include: { bin: { select: { code: true } } } });
  await upsertAssignment(tx, d.storeId, v.id, bin.id, user.id);
  if (prev?.bin.code !== code) await audit(tx, user, { action: "bin.assign", entity: ["Variant", v.id], summary: `${v.sku} → bin ${code}${prev ? ` (was ${prev.bin.code})` : ""}` });
  return { sku: v.sku, code, previous: prev?.bin.code ?? null };
}

/**
 * Bulk "SKU,BIN" lines (from a spreadsheet). Everything is checked first; nothing is saved if a line is wrong,
 * so a half-imported layout never happens.
 */
export async function importAssignments(tx: Tx, user: Actor, storeId: string, text: string) {
  await requireStoreAccess(user, storeId, tx);
  const rows = text.split(/\r?\n/).map((l, i) => ({ line: i + 1, cells: l.split(/[,\t;]/).map((c) => c.trim()) })).filter((r) => r.cells.some(Boolean));
  if (rows.length && /sku/i.test(rows[0].cells[0])) rows.shift(); // header
  if (!rows.length) throw new BinError("Paste lines of SKU, BIN.");
  if (rows.length > 20_000) throw new BinError("Up to 20,000 lines at a time.");
  const errors: string[] = [];
  const parsed: { line: number; sku: string; code: string }[] = [];
  for (const r of rows) {
    const [sku, bin] = r.cells;
    if (!sku || !bin) { errors.push(`line ${r.line}: needs a SKU and a bin`); continue; }
    try { parsed.push({ line: r.line, sku: sku.toUpperCase(), code: normaliseCode(bin) }); } catch (e) { errors.push(`line ${r.line}: ${(e as Error).message}`); }
  }
  const variants = await tx.variant.findMany({ where: { sku: { in: [...new Set(parsed.map((p) => p.sku))] } }, select: { id: true, sku: true } });
  const bySku = new Map(variants.map((v) => [v.sku.toUpperCase(), v.id]));
  for (const p of parsed) if (!bySku.has(p.sku)) errors.push(`line ${p.line}: no size with SKU ${p.sku}`);
  const seen = new Map<string, string>();
  for (const p of parsed) { const was = seen.get(p.sku); if (was && was !== p.code) errors.push(`${p.sku} is given two bins (${was} and ${p.code})`); seen.set(p.sku, p.code); }
  if (errors.length) throw new BinError(`Nothing imported. Fix these first: ${errors.slice(0, 8).join("; ")}${errors.length > 8 ? `; and ${errors.length - 8} more` : ""}.`);
  const bins = await ensureBins(tx, storeId, parsed.map((p) => p.code));
  for (const [sku, code] of seen) await upsertAssignment(tx, storeId, bySku.get(sku)!, bins.get(code)!.id, user.id);
  await audit(tx, user, { action: "bin.import", entity: ["Store", storeId], summary: `${seen.size} size(s) given home bins (${new Set(seen.values()).size} bins)` });
  return { assigned: seen.size, bins: new Set(seen.values()).size };
}

// ---------- reading ----------

/** Home bins for these sizes at a location. */
export async function binMap(storeId: string, variantIds: string[]) {
  if (!variantIds.length) return new Map<string, { code: string; sortKey: string }>();
  const rows = await db.binAssignment.findMany({ where: { storeId, variantId: { in: variantIds } }, select: { variantId: true, bin: { select: { code: true, sortKey: true } } } });
  return new Map(rows.map((r) => [r.variantId, r.bin]));
}

/** Sort by bin walking order; anything without a bin goes last (by SKU). */
export function byBin<T extends { sku: string; bin?: { sortKey: string } | null }>(rows: T[]) {
  return [...rows].sort((a, b) => (a.bin ? 0 : 1) - (b.bin ? 0 : 1) || (a.bin?.sortKey ?? "").localeCompare(b.bin?.sortKey ?? "") || a.sku.localeCompare(b.sku));
}

/** Bins at a location with how many sizes and units each holds (units from the location's stock). */
export async function binOverview(storeId: string) {
  const [bins, unbinned, binnedUnits] = await Promise.all([
    db.$queryRaw<{ id: string; code: string; zone: string; active: boolean; sizes: number; units: number }[]>`
      SELECT b."id", b."code", b."zone", b."active", COUNT(a."variantId")::int AS "sizes", COALESCE(SUM(s."quantity"), 0)::int AS "units"
      FROM "Bin" b LEFT JOIN "BinAssignment" a ON a."binId" = b."id" LEFT JOIN "StoreStock" s ON s."storeId" = b."storeId" AND s."variantId" = a."variantId"
      WHERE b."storeId" = ${storeId} GROUP BY b."id" ORDER BY b."sortKey"`,
    db.$queryRaw<{ variantId: string; sku: string; name: string; size: string; color: string; quantity: number }[]>`
      SELECT s."variantId", v."sku", p."name", v."size", v."color", s."quantity"
      FROM "StoreStock" s JOIN "Variant" v ON v."id" = s."variantId" JOIN "Product" p ON p."id" = v."productId"
      WHERE s."storeId" = ${storeId} AND s."quantity" > 0
        AND NOT EXISTS (SELECT 1 FROM "BinAssignment" a WHERE a."storeId" = s."storeId" AND a."variantId" = s."variantId")
      ORDER BY s."quantity" DESC, v."sku" LIMIT 300`,
    db.$queryRaw<{ total: number; binned: number }[]>`
      SELECT COALESCE(SUM(s."quantity"), 0)::int AS "total",
        COALESCE(SUM(s."quantity") FILTER (WHERE EXISTS (SELECT 1 FROM "BinAssignment" a WHERE a."storeId" = s."storeId" AND a."variantId" = s."variantId")), 0)::int AS "binned"
      FROM "StoreStock" s WHERE s."storeId" = ${storeId} AND s."quantity" > 0`,
  ]);
  const unbinnedCount = await db.storeStock.count({ where: { storeId, quantity: { gt: 0 }, variant: { binAssignments: { none: { storeId } } } } });
  return { bins, unbinned, unbinnedCount, units: binnedUnits[0] };
}

/** Where a goods receipt's items go (putaway), in walking order. */
export async function putawayList(receiptId: string) {
  const r = await db.goodsReceipt.findUnique({ where: { id: receiptId }, include: { items: { select: { variantId: true, quantity: true } } } });
  if (!r?.storeId) return null;
  const ids = r.items.map((i) => i.variantId);
  const [bins, variants] = await Promise.all([binMap(r.storeId, ids), db.variant.findMany({ where: { id: { in: ids } }, select: { id: true, sku: true, color: true, size: true, product: { select: { name: true } } } })]);
  const v = new Map(variants.map((x) => [x.id, x]));
  return { storeId: r.storeId, lines: byBin(r.items.filter((i) => i.quantity > 0 && v.has(i.variantId)).map((i) => { const x = v.get(i.variantId)!; return { sku: x.sku, name: x.product.name, color: x.color, size: x.size, quantity: i.quantity, bin: bins.get(i.variantId) ?? null }; })) };
}
