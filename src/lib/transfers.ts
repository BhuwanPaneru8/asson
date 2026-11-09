import "server-only";
import type { Prisma } from "@prisma/client";
import { audit, type AuditActor } from "./audit";
import { moveStock, moveStockOrThrow } from "./stock";
import { queueBackInStock } from "./stock-alerts";

// Stock transfers between locations:
//   DRAFT ──send──▶ SENT ──receive (counted)──▶ RECEIVED
//     └──cancel──▶ CANCELLED ◀──recall (units go back to the source)── SENT
// Units leave the source when sent (TRANSFER_OUT) and arrive only as counted (TRANSFER_IN), so
// stock in a van is never sold twice. A shortfall on arrival is logged (TRANSFER_LOSS) and audited.

type Tx = Prisma.TransactionClient;
export class TransferError extends Error {}

export const transferNo = (n: number) => `TR-${String(n).padStart(5, "0")}`;

export const TRANSFER_STATUS_LABEL = { DRAFT: "Draft", SENT: "In transit", RECEIVED: "Received", CANCELLED: "Cancelled" } as const;

async function load(tx: Tx, id: string) {
  const t = await tx.stockTransfer.findUnique({
    where: { id },
    include: { from: { select: { id: true, name: true, active: true } }, to: { select: { id: true, name: true, active: true } }, items: { include: { variant: { select: { sku: true, color: true, size: true, product: { select: { name: true } } } } } } },
  });
  if (!t) throw new TransferError("Transfer not found.");
  return t;
}

/** Move status only if nobody else moved it first. */
async function claim(tx: Tx, id: string, from: "DRAFT" | "SENT", data: Prisma.StockTransferUpdateManyMutationInput) {
  const res = await tx.stockTransfer.updateMany({ where: { id, status: from }, data });
  if (!res.count) throw new TransferError("This transfer was just updated by someone else. Refresh and try again.");
}

export async function createTransfer(tx: Tx, actor: NonNullable<AuditActor>, d: { fromId: string; toId: string; note?: string; items: { variantId: string; quantity: number }[] }) {
  if (d.fromId === d.toId) throw new TransferError("Pick two different locations.");
  const ends = await tx.store.findMany({ where: { id: { in: [d.fromId, d.toId] }, active: true }, select: { id: true, name: true } });
  if (ends.length !== 2) throw new TransferError("Both locations must be active.");
  const qty = new Map<string, number>();
  for (const i of d.items) qty.set(i.variantId, (qty.get(i.variantId) ?? 0) + i.quantity);
  const t = await tx.stockTransfer.create({
    data: { fromId: d.fromId, toId: d.toId, note: d.note || null, createdById: actor.id, items: { create: [...qty].map(([variantId, quantity]) => ({ variantId, quantity })) } },
    select: { id: true, number: true },
  });
  const name = (id: string) => ends.find((e) => e.id === id)!.name;
  const units = [...qty.values()].reduce((s, n) => s + n, 0);
  await audit(tx, actor, { action: "transfer.create", entity: ["StockTransfer", t.id], summary: `${transferNo(t.number)} drafted: ${units} unit${units === 1 ? "" : "s"} ${name(d.fromId)} → ${name(d.toId)}` });
  return t;
}

export async function sendTransfer(tx: Tx, actor: NonNullable<AuditActor>, id: string) {
  const t = await load(tx, id);
  if (t.status !== "DRAFT") throw new TransferError("Only a draft can be sent.");
  if (!t.from.active || !t.to.active) throw new TransferError("Both locations must be active.");
  if (!t.items.length) throw new TransferError("Add at least one item.");
  await claim(tx, id, "DRAFT", { status: "SENT", sentAt: new Date(), sentById: actor.id });
  for (const i of t.items) {
    await moveStockOrThrow(
      tx,
      { variantId: i.variantId, storeId: t.fromId, delta: -i.quantity, reason: "TRANSFER_OUT", note: `${transferNo(t.number)} → ${t.to.name}`, actorId: actor.id },
      `${t.from.name} doesn't have ${i.quantity} × ${i.variant.product.name} (${i.variant.color} ${i.variant.size}). Recount or lower the quantity.`,
    );
  }
  const units = t.items.reduce((s, i) => s + i.quantity, 0);
  await audit(tx, actor, { action: "transfer.send", entity: ["StockTransfer", id], summary: `${transferNo(t.number)} sent: ${units} unit${units === 1 ? "" : "s"} left ${t.from.name} for ${t.to.name}` });
}

/** Count in what actually arrived. `received` maps item id → units counted (missing = all arrived). */
export async function receiveTransfer(tx: Tx, actor: NonNullable<AuditActor>, id: string, received: Record<string, number>, note?: string) {
  const t = await load(tx, id);
  if (t.status !== "SENT") throw new TransferError("Only a transfer in transit can be received.");
  if (!t.to.active) throw new TransferError(`${t.to.name} isn't active.`);
  if (!note?.trim() && t.items.some((i) => (received[i.id] ?? i.quantity) < i.quantity)) throw new TransferError("Some units are missing. Add a note saying what happened.");
  await claim(tx, id, "SENT", { status: "RECEIVED", receivedAt: new Date(), receivedById: actor.id, ...(note ? { note: [t.note, `On arrival: ${note}`].filter(Boolean).join("\n").slice(0, 1000) } : {}) });
  const short: string[] = [];
  for (const i of t.items) {
    const got = received[i.id] ?? i.quantity;
    if (!Number.isInteger(got) || got < 0 || got > i.quantity) throw new TransferError(`Count for ${i.variant.sku} must be between 0 and ${i.quantity}.`);
    await tx.stockTransferItem.update({ where: { id: i.id }, data: { received: got } });
    if (got > 0) await moveStock(tx, { variantId: i.variantId, storeId: t.toId, delta: got, reason: "TRANSFER_IN", note: `${transferNo(t.number)} from ${t.from.name}`, actorId: actor.id });
    if (got < i.quantity) {
      // the units already left the source when sent; this records why they never arrived
      await moveStock(tx, { variantId: i.variantId, storeId: t.toId, delta: 0, reason: "TRANSFER_LOSS", note: `${transferNo(t.number)}: ${i.quantity - got} of ${i.quantity} missing on arrival`, actorId: actor.id });
      short.push(`${i.variant.sku} −${i.quantity - got}`);
    }
  }
  await queueBackInStock(tx, t.items.filter((i) => (received[i.id] ?? i.quantity) > 0).map((i) => i.variantId));
  const got = t.items.reduce((s, i) => s + (received[i.id] ?? i.quantity), 0);
  await audit(tx, actor, {
    action: "transfer.receive", entity: ["StockTransfer", id],
    summary: `${transferNo(t.number)} received at ${t.to.name}: ${got} unit${got === 1 ? "" : "s"}${short.length ? ` — SHORT ${short.join(", ")}` : " — all arrived"}`,
    changes: { received, short },
  });
  return { short: short.length };
}

/** Cancel a draft, or recall a transfer in transit (its units go back to the source). */
export async function cancelTransfer(tx: Tx, actor: NonNullable<AuditActor>, id: string, reason: string) {
  const t = await load(tx, id);
  if (t.status !== "DRAFT" && t.status !== "SENT") throw new TransferError("This transfer is already closed.");
  await claim(tx, id, t.status, { status: "CANCELLED", note: [t.note, `Cancelled: ${reason}`].filter(Boolean).join("\n").slice(0, 1000) });
  if (t.status === "SENT") {
    for (const i of t.items) await moveStock(tx, { variantId: i.variantId, storeId: t.fromId, delta: i.quantity, reason: "TRANSFER_IN", note: `${transferNo(t.number)} recalled`, actorId: actor.id });
    await queueBackInStock(tx, t.items.map((i) => i.variantId));
  }
  await audit(tx, actor, { action: "transfer.cancel", entity: ["StockTransfer", id], summary: `${transferNo(t.number)} ${t.status === "SENT" ? "recalled (units back at " + t.from.name + ")" : "cancelled"} — ${reason}` });
}

