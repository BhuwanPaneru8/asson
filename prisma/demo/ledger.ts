/**
 * The demo seed's stock ledger. Every unit movement becomes an InventoryLog row (reason, location, order, who,
 * when) and the running balance per location is kept in memory; `flush` writes the ledger and sets StoreStock to
 * exactly the sum of it, the same invariant lib/stock.ts keeps (Variant.stock follows by the database trigger).
 * Removals are conditional like moveStock: `take` refuses when the location doesn't have the units.
 */
import type { PrismaClient } from "@prisma/client";
import { inChunks, newId } from "./shared";

type Reason = "SALE" | "CANCEL_RESTOCK" | "RETURN_RESTOCK" | "MANUAL_ADJUST" | "RECEIVED" | "DAMAGED" | "TRANSFER_OUT" | "TRANSFER_IN" | "TRANSFER_LOSS" | "COUNT" | "PRODUCED";
type Extra = { note?: string | null; orderId?: string | null; actorId?: string | null };
type Row = { id: string; variantId: string; storeId: string; delta: number; reason: Reason; note: string | null; orderId: string | null; actorId: string | null; createdAt: Date };

export class Ledger {
  private bal = new Map<string, number>();
  private known = new Set<string>(); // StoreStock rows that already exist (loaded before the simulation)
  readonly rows: Row[] = [];

  /** Start from stock already in the database (its ledger rows exist already). */
  load(rows: { storeId: string; variantId: string; quantity: number }[]) {
    for (const r of rows) { this.bal.set(`${r.storeId}|${r.variantId}`, r.quantity); this.known.add(`${r.storeId}|${r.variantId}`); }
  }

  get(storeId: string, variantId: string) {
    return this.bal.get(`${storeId}|${variantId}`) ?? 0;
  }

  /** Add (or, with delta 0, only log) units at a location. */
  add(storeId: string, variantId: string, delta: number, reason: Reason, createdAt: Date, x: Extra = {}) {
    if (delta < 0) throw new Error("use take() for removals");
    this.bal.set(`${storeId}|${variantId}`, this.get(storeId, variantId) + delta);
    this.rows.push({ id: newId("il"), variantId, storeId, delta, reason, note: x.note?.slice(0, 200) ?? null, orderId: x.orderId ?? null, actorId: x.actorId ?? null, createdAt });
  }

  /** Remove units if the location has them (conditional, like moveStock). */
  take(storeId: string, variantId: string, quantity: number, reason: Reason, createdAt: Date, x: Extra = {}) {
    const have = this.get(storeId, variantId);
    if (quantity <= 0 || have < quantity) return false;
    this.bal.set(`${storeId}|${variantId}`, have - quantity);
    this.rows.push({ id: newId("il"), variantId, storeId, delta: -quantity, reason, note: x.note?.slice(0, 200) ?? null, orderId: x.orderId ?? null, actorId: x.actorId ?? null, createdAt });
    return true;
  }

  /** Every location's balance of one variant. */
  where(variantId: string, storeIds: string[]) {
    return storeIds.map((storeId) => ({ storeId, quantity: this.get(storeId, variantId) }));
  }

  async flush(db: PrismaClient) {
    await inChunks(this.rows, 2000, (chunk) => db.inventoryLog.createMany({ data: chunk }));
    const fresh: { storeId: string; variantId: string; quantity: number }[] = [];
    const known: { storeId: string; variantId: string; quantity: number }[] = [];
    for (const [k, quantity] of this.bal) {
      const [storeId, variantId] = k.split("|");
      if (quantity < 0) throw new Error(`negative stock for ${k}`);
      (this.known.has(k) ? known : fresh).push({ storeId, variantId, quantity });
    }
    await inChunks(fresh, 2000, (chunk) => db.storeStock.createMany({ data: chunk }));
    for (const r of known) await db.storeStock.update({ where: { storeId_variantId: { storeId: r.storeId, variantId: r.variantId } }, data: { quantity: r.quantity } });
  }
}
