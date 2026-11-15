import { describe, expect, it, vi } from "vitest";
import {
  discountAmount, expired, offlineCode, offlineDiscountLimit, offlineSaleProblem, priceListProblem, queueSale, queueStats, saleInput,
  searchPriceList, syncQueue, unitsQueued, unsent, type OfflineLine, type PriceList, type QueuedSale, type SendResult, type TillSession,
} from "@/lib/till-offline";

const H = 3_600_000;
const session: TillSession = { cashierId: "c1", cashierName: "Sita", discountLimit: 5, shift: { id: "s1", storeId: "st1", store: "Flagship", openedAt: "2026-11-15T03:00:00.000Z", openingFloat: 500_000, expectedCash: 500_000, sales: 0, total: 0 } };
const row = (sku: string, name: string, price = 100_000, stock = 3) => ({ variantId: `v-${sku}`, sku, name, color: "Navy", size: "M", price, stock, issuedAt: "2026-11-15T03:00:00.000Z", sig: `sig-${sku}` });
const list: PriceList = { storeId: "st1", savedAt: "2026-11-15T03:00:00.000Z", rows: [row("AS-01104", "Oxford Button-Down Shirt", 239_900), row("AS-01105", "Linen Kurta"), row("AS-02000", "Oxford Chino")] };
const line = (sku = "AS-01104", quantity = 1, price = 239_900): OfflineLine => ({ variantId: `v-${sku}`, sku, name: "x", color: "Navy", size: "M", price, issuedAt: "2026-11-15T03:00:00.000Z", sig: `sig-${sku}`, quantity });
const cash = (amount: number, tendered?: number) => ({ method: "CASH" as const, amount, tendered });

function sale(seq: number, over: Partial<QueuedSale> = {}): QueuedSale {
  return { ...queueSale({ clientRef: `pos-${seq}`, queue: [], session, lines: [line()], discount: null, tenders: [cash(239_900)], soldAt: new Date(Date.UTC(2026, 10, 15, 4, seq)) }), seq, ...over };
}

describe("offline till: selling from the saved price list", () => {
  it("finds a scanned SKU exactly, else every word of a name", () => {
    expect(searchPriceList(list, "as-01104").map((r) => r.sku)).toEqual(["AS-01104"]);
    expect(searchPriceList(list, "oxford").map((r) => r.sku)).toEqual(["AS-01104", "AS-02000"]);
    expect(searchPriceList(list, "oxford chino navy").map((r) => r.sku)).toEqual(["AS-02000"]);
    expect(searchPriceList(list, "  ")).toEqual([]);
  });

  it("won't sell from a price list that's missing, for another shop, or too old", () => {
    const at = Date.parse(list.savedAt);
    expect(priceListProblem(list, "st1", at + H)).toBeNull();
    expect(priceListProblem(null, "st1", at)).toMatch(/no saved price list/);
    expect(priceListProblem(list, "other", at)).toMatch(/another shop/);
    expect(priceListProblem(list, "st1", at + 73 * H)).toMatch(/72 hours/);
    expect(priceListProblem({ ...list, savedAt: "garbage" }, "st1", at)).toMatch(/72 hours/);
  });

  it("rounds discounts like the server and caps offline discounts at the cashier's own limit", () => {
    expect(discountAmount(239_900, { type: "PERCENT", value: 5 })).toBe(11_900); // Rs. 119.95 → 119
    expect(discountAmount(10_000, { type: "AMOUNT", value: 500 })).toBe(10_000); // never more than the bag
    expect(offlineDiscountLimit(5)).toBe(5);
    expect(offlineDiscountLimit(15)).toBe(5); // a manager offline: no PIN, so the cashier limit
    expect(offlineDiscountLimit(0)).toBe(0);
  });

  it("refuses offline what can't be checked offline", () => {
    const ok = { lines: [line()], discount: null, tenders: [cash(239_900, 250_000)], ownLimit: 5 };
    expect(offlineSaleProblem(ok)).toBeNull();
    expect(offlineSaleProblem({ ...ok, lines: [] })).toMatch(/Add an item/);
    expect(offlineSaleProblem({ ...ok, tenders: [cash(100_000)] })).toMatch(/equal the total/);
    expect(offlineSaleProblem({ ...ok, tenders: [{ method: "VOUCHER", amount: 239_900, reference: "CR-1" }] })).toMatch(/Store credit/);
    expect(offlineSaleProblem({ ...ok, tenders: [{ method: "BANK", amount: 239_900, reference: "x" }] })).toMatch(/bank transfers/);
    expect(offlineSaleProblem({ ...ok, tenders: [{ method: "ESEWA_QR", amount: 239_900 }] })).toMatch(/transaction ID/);
    expect(offlineSaleProblem({ ...ok, tenders: [{ method: "ESEWA_QR", amount: 239_900, reference: "0ABC12" }] })).toBeNull();
    expect(offlineSaleProblem({ ...ok, tenders: [cash(239_900, 200_000)] })).toMatch(/less than/);
    const tenPercent = { type: "PERCENT" as const, value: 10, reason: "Loyal customer" };
    expect(offlineSaleProblem({ ...ok, discount: tenPercent, tenders: [cash(239_900 - discountAmount(239_900, tenPercent))], ownLimit: 15 })).toMatch(/at most 5%/);
    const five = { type: "PERCENT" as const, value: 5, reason: "" };
    expect(offlineSaleProblem({ ...ok, discount: five, tenders: [cash(239_900 - 11_900)] })).toMatch(/reason/);
    expect(offlineSaleProblem({ ...ok, discount: { ...five, reason: "Loyal customer" }, tenders: [cash(239_900 - 11_900)] })).toBeNull();
  });

  it("counts units already sold offline so the same unit isn't sold twice", () => {
    const q = [sale(1, { lines: [line("AS-01104", 2)] }), sale(2), sale(3, { status: "synced" })];
    expect(unitsQueued(q, "v-AS-01104")).toBe(3); // the synced one is on the server's count already
    expect(unitsQueued(q, "v-AS-01105")).toBe(0);
  });
});

describe("offline till: the queue", () => {
  it("numbers sales in order, keeps totals, cashier, shift and the real time", () => {
    const first = queueSale({ clientRef: "pos-a", queue: [], session, lines: [line("AS-01104", 2)], discount: { type: "PERCENT", value: 5, reason: "Loyal customer" }, tenders: [cash(455_900, 460_000)], soldAt: new Date("2026-11-15T05:00:00Z") });
    expect(first).toMatchObject({ seq: 1, subtotal: 479_800, discountAmount: 23_900, total: 455_900, change: 4_100, cashierId: "c1", shiftId: "s1", storeId: "st1", soldAt: "2026-11-15T05:00:00.000Z", status: "pending" });
    const second = queueSale({ clientRef: "pos-b", queue: [first], session, lines: [line()], discount: { type: "PERCENT", value: 0, reason: "" }, tenders: [cash(239_900)] });
    expect(second.seq).toBe(2);
    expect(second.discount).toBeNull(); // a zero discount isn't sent
  });

  it("sends the server the same sale input as a sale made online, plus when, which shift and the signed prices", () => {
    const s = sale(1, { tenders: [{ method: "FONEPAY_QR", amount: 239_900, reference: " 77AB " }] });
    expect(saleInput(s)).toEqual({
      clientRef: "pos-1",
      lines: [{ variantId: "v-AS-01104", quantity: 1 }],
      discount: null,
      tenders: [{ method: "FONEPAY_QR", amount: 239_900, tendered: undefined, reference: "77AB" }],
      customer: undefined,
      offline: { soldAt: s.soldAt, shiftId: "s1", prices: [{ variantId: "v-AS-01104", price: 239_900, issuedAt: "2026-11-15T03:00:00.000Z", sig: "sig-AS-01104" }] },
    });
  });

  it("reports what's waiting, oldest first, per shift", () => {
    const q = [sale(3), sale(1), sale(2, { status: "failed", error: "x" }), sale(4, { status: "synced" }), sale(5, { shiftId: "s0" })];
    expect(unsent(q).map((s) => s.seq)).toEqual([1, 2, 3, 5]);
    expect(queueStats(q, "s1")).toMatchObject({ pending: 3, failed: 1, oldestAt: sale(1).soldAt, cash: 3 * 239_900, total: 3 * 239_900 });
    expect(queueStats(q).pending).toBe(4);
  });

  it("drops synced sales from the device after a day, never unsynced ones", () => {
    const now = Date.parse("2026-11-17T00:00:00Z");
    const q = [sale(1, { status: "synced", syncedAt: "2026-11-15T05:00:00Z" }), sale(2, { status: "synced", syncedAt: "2026-11-16T12:00:00Z" }), sale(3)];
    expect(expired(q, now).map((s) => s.seq)).toEqual([1]);
  });

  it("prints a short code until the sale has its order number", () => {
    expect(offlineCode("pos-mhz1k2-abcd1234")).toBe("OFF-CD1234");
  });
});

describe("offline till: syncing", () => {
  const run = async (queue: QueuedSale[], results: SendResult[], cashierId = "c1") => {
    const saved = new Map<string, QueuedSale>();
    const send = vi.fn(async () => results.shift() ?? { kind: "network" as const });
    const res = await syncQueue({ queue, cashierId, send, save: async (s) => void saved.set(s.clientRef, s), now: () => new Date("2026-11-15T10:00:00Z") });
    return { res, send, saved };
  };

  it("sends oldest first and marks each sent sale with its order number", async () => {
    const { res, send, saved } = await run([sale(2), sale(1)], [{ kind: "ok", orderId: "o1", number: "AS000101" }, { kind: "ok", orderId: "o2", number: "AS000102" }]);
    expect(send.mock.calls.map((c) => (c as unknown as [QueuedSale])[0].seq)).toEqual([1, 2]);
    expect(res).toEqual({ sent: 2, failed: 0, waitingForOthers: 0, stopped: false });
    expect(saved.get("pos-1")).toMatchObject({ status: "synced", orderId: "o1", number: "AS000101", syncedAt: "2026-11-15T10:00:00.000Z" });
  });

  it("stops at the first network failure and leaves the rest waiting, untouched", async () => {
    const { res, send, saved } = await run([sale(1), sale(2), sale(3)], [{ kind: "ok", orderId: "o1", number: "AS1" }, { kind: "network" }]);
    expect(send).toHaveBeenCalledTimes(2);
    expect(res).toMatchObject({ sent: 1, stopped: true });
    expect([...saved.keys()]).toEqual(["pos-1"]);
  });

  it("keeps a refused sale (marked failed, with the reason) and carries on with the next", async () => {
    const { res, saved } = await run([sale(1), sale(2)], [{ kind: "rejected", error: "Contact your manager." }, { kind: "ok", orderId: "o2", number: "AS2" }]);
    expect(res).toMatchObject({ sent: 1, failed: 1 });
    expect(saved.get("pos-1")).toMatchObject({ status: "failed", error: "Contact your manager." });
    expect(saved.get("pos-2")?.status).toBe("synced");
  });

  it("retries failed sales, skips synced ones, and never sends another cashier's sales", async () => {
    const q = [sale(1, { status: "failed", error: "x" }), sale(2, { status: "synced" }), sale(3, { cashierId: "c2" })];
    const { res, send } = await run(q, [{ kind: "ok", orderId: "o1", number: "AS1" }]);
    expect(send).toHaveBeenCalledTimes(1);
    expect(res).toEqual({ sent: 1, failed: 0, waitingForOthers: 1, stopped: false });
  });

  it("is safe to run again: a sale whose answer was lost is sent with the same clientRef", async () => {
    // first run: the server recorded it but the answer never arrived (network)
    const first = await run([sale(1)], [{ kind: "network" }]);
    expect(first.saved.size).toBe(0);
    const second = await run([sale(1)], [{ kind: "ok", orderId: "o1", number: "AS1" }]);
    expect((second.send.mock.calls[0] as unknown as [QueuedSale])[0].clientRef).toBe("pos-1");
  });
});
