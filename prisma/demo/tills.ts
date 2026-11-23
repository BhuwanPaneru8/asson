/**
 * The shops' tills: one shift a day per shop (the rota decides the cashier), sales from that shop's own stock with
 * split payments, approved discounts and known customers earning points, returns at the counter, the shift's cash
 * count, and each shop's cash book (float out, counted cash in, bank deposits that finance checks, petty cash).
 * Mirrors createPosSale / closeShift / lib/cash.ts row for row.
 */
import type { TenderMethod } from "@prisma/client";
import type { Ctx, Customer, P, V } from "./context";
import type { Person, Shop } from "./people";
import { DAY, IS_E2E, NOW, TODAY, at, chance, int, ktm, newId, pick, rand } from "./shared";

export type Handle = { id: string; storeId: string; cashierId: string; cashIn: (n: number) => void };

export function makeTills(c: Ctx, o: { tillOf: (storeId: string, day: string) => Person | null; priceAt: (p: P, t: Date) => number; near: (code: string) => Customer[]; walkIns: Customer }) {
  const open = new Map<string, Handle & { cash: number; float: number; openedAt: Date; closesAt: Date }>(); // `${storeId}|${day}`
  const safe = new Map<string, number>();
  const sinceDeposit = new Map<string, number>();
  const managerOf = (shop: Shop) => (shop.code === "FLAGSHIP" ? c.people.manager : shop.code === "PKR" ? c.people.bimala : c.people.rojina);

  function post(shop: Shop, kind: "OPENING" | "FLOAT_OUT" | "SHIFT_IN" | "DEPOSIT" | "DEPOSIT_FIX" | "PETTY" | "COUNT", amount: number, by: Person, t: Date, note: string, source: string | null = null) {
    safe.set(shop.id, (safe.get(shop.id) ?? 0) + amount);
    const id = newId("ce");
    c.rows.cash.push({ id, storeId: shop.id, kind, amount, note, source, byId: by.id, byName: by.name, createdAt: t });
    return id;
  }

  function startBook(shop: Shop) {
    post(shop, "OPENING", 2_500_000, managerOf(shop), at(shop.opened, 9, 30), "Cash book started: safe counted on opening day");
  }

  function openShift(shop: Shop, day: string) {
    const cashier = o.tillOf(shop.id, day);
    if (!cashier) return null;
    const openedAt = at(day, shop.hours[0] - 1, int(40, 58));
    if (openedAt > NOW) return null;
    const closesAt = at(day, shop.hours[1], int(5, 25));
    const id = newId("sh");
    const float = 500_000;
    post(shop, "FLOAT_OUT", -float, cashier, openedAt, "Float for the till", `shift-open:${id}`);
    const h = { id, storeId: shop.id, cashierId: cashier.id, cash: float, float, openedAt, closesAt, cashIn: (n: number) => { h.cash += n; } };
    open.set(`${shop.id}|${day}`, h);
    c.rows.shifts.push({ id, storeId: shop.id, cashierId: cashier.id, status: "OPEN", openingFloat: float, openedAt });
    return h;
  }

  function closeShift(shop: Shop, day: string) {
    const h = open.get(`${shop.id}|${day}`);
    const row = c.rows.shifts.find((s) => s.id === h?.id);
    if (!h || !row) return;
    if (h.closesAt > NOW) return; // still trading
    const r = rand();
    const diff = r < 0.86 ? 0 : r < 0.96 ? -int(1, 30) * 1000 : int(1, 10) * 1000;
    const counted = h.cash + diff;
    const cashier = Object.values(c.people).find((p) => p.id === h.cashierId)!;
    Object.assign(row, { status: "CLOSED", closedAt: h.closesAt, expectedCash: h.cash, countedCash: counted, difference: diff, closedById: cashier.id, closeNote: diff ? (diff < 0 ? pick(["Short: gave change twice, I think", "Short Rs. " + Math.abs(diff / 100) + ": couldn't find it", "Customer paid less, came back later"]) : "Over: customer left without change") : null });
    post(shop, "SHIFT_IN", counted, cashier, h.closesAt, "Counted cash from the till", `shift-close:${h.id}`);
    // take cash to the bank every few days, keeping some change in the safe
    const days = (sinceDeposit.get(shop.id) ?? 0) + 1;
    sinceDeposit.set(shop.id, days);
    const balance = safe.get(shop.id) ?? 0;
    if (days >= 3 && balance > 3_000_000) {
      const amount = Math.floor((balance - 1_500_000) / 100_000) * 100_000;
      const t = at(ktm(new Date(h.closesAt.getTime() + DAY)), 11, int(0, 50));
      if (t <= NOW && amount > 0) deposit(shop, amount, t);
      sinceDeposit.set(shop.id, 0);
    }
  }

  const banks = ["NIC Asia", "Global IME", "Nabil Bank"];
  function deposit(shop: Shop, amount: number, t: Date) {
    const by = managerOf(shop);
    const id = newId("dep"), number = c.next.deposit();
    const bank = shop.code === "PKR" ? "Global IME" : pick(banks);
    const slipNo = `${bank.slice(0, 3).toUpperCase()}${int(100000, 999999)}`;
    post(shop, "DEPOSIT", -amount, by, t, `${bank} slip ${slipNo}`, `deposit:${id}`);
    const recent = NOW.getTime() - t.getTime() < 4 * DAY;
    // one deposit long ago came up short on the bank statement: the difference went back on the book
    const disputed = !recent && shop.code === "FLAGSHIP" && number % 37 === 0;
    const bankAmount = disputed ? amount - 100_000 : amount;
    const checkedAt = new Date(t.getTime() + int(1, 3) * DAY);
    c.rows.deposits.push({ id, number, storeId: shop.id, amount, bank, slipNo, depositedOn: ktm(t), status: recent ? "RECORDED" : disputed ? "DISPUTED" : "VERIFIED", bankAmount: recent ? null : bankAmount, checkNote: disputed ? "Statement shows Rs. 1,000 less: counting error at the bank counter?" : "", byId: by.id, byName: by.name, checkedById: recent ? null : c.people.sarita.id, checkedAt: recent ? null : checkedAt, createdAt: t });
    if (disputed) post(shop, "DEPOSIT_FIX", amount - bankAmount, c.people.sarita, checkedAt, `DEP-${number}: bank shows less. Checking with the branch`, `deposit-fix:${id}`);
  }

  function petty(shop: Shop, day: string) {
    const by = managerOf(shop);
    for (const [what, amount, category] of [["Tea, milk and sugar for the team", 180_000, "OTHER"], ["Cleaning supplies and mop", 95_000, "OTHER"], ["Price tags and hangers", 240_000, "PACKAGING"]] as const) {
      if (!chance(0.7)) continue;
      const t = at(day, 13, int(0, 50));
      if (t > NOW || (safe.get(shop.id) ?? 0) < amount) continue;
      const entry = post(shop, "PETTY", -amount, by, t, what);
      c.rows.expenses.push({ date: day, category, amount, storeId: shop.id, description: what, paidVia: "Petty cash", source: `petty:${entry}`, createdById: by.id, createdAt: t });
    }
    // a monthly safe count
    const t = at(day, 18, 30);
    if (t <= NOW) {
      const off = chance(0.15) ? -int(1, 5) * 10_000 : 0;
      post(shop, "COUNT", off, by, t, off ? "Short in the coin bag: probably change for the tea shop" : "Matched the book");
    }
  }

  const METHODS: [TenderMethod, number][] = [["CASH", 0.55], ["FONEPAY_QR", 0.2], ["ESEWA_QR", 0.1], ["KHALTI_QR", 0.05], ["CARD", 0.1]];
  const method = () => { let r = rand(); for (const [m, w] of METHODS) { r -= w; if (r <= 0) return m; } return "CASH" as TenderMethod; };

  function sale(shop: Shop, day: string, t: Date, festive: boolean, scheduleLater: (t: Date, run: () => void) => void) {
    const h = open.get(`${shop.id}|${day}`);
    if (!h || t > NOW || t < h.openedAt || t > h.closesAt) return;
    const lines = c.chooseLines(t, festive, chance(0.6) ? 1 : chance(0.75) ? 2 : 3, null, (v) => c.ledger.get(shop.id, v.id) > 0);
    if (!lines.length) return;
    const id = newId("ord"), number = c.next.order();
    const cashier = Object.values(c.people).find((p) => p.id === h.cashierId)!;
    const itemIds: string[] = [];
    const priced = lines.map((l) => ({ ...l, unitPrice: o.priceAt(l.p, t) }));
    for (const l of priced) {
      l.q = Math.min(l.q, c.ledger.get(shop.id, l.v.id));
      const itemId = c.item(id, l.p, l.v, l.unitPrice, l.q);
      itemIds.push(itemId);
      c.ledger.take(shop.id, l.v.id, l.q, "SALE", t, { orderId: id, actorId: cashier.id, note: `Store sale · ${shop.name}` });
      c.rows.allocations.push({ orderId: id, orderItemId: itemId, variantId: l.v.id, storeId: shop.id, quantity: l.q, createdAt: t, pickedAt: t, pickedById: cashier.id });
    }
    const subtotal = priced.reduce((s, l) => s + l.unitPrice * l.q, 0);
    // discounts with accountability: within the cashier's 5%, or a manager's approval up to 15%
    let discount = 0, discountReason: string | null = null, approverId: string | null = null;
    if (chance(festive ? 0.14 : 0.07)) {
      const pct = pick([5, 5, 10, 10, 15]);
      discount = Math.floor((subtotal * pct) / 100 / 100) * 100;
      discountReason = pct === 5 ? pick(["Regular customer", "Bought three pieces", "Paid in cash, rounded off"]) : pct === 10 ? pick(["Minor mark on the fabric", "Staff family", "Festival offer"]) : "Last piece, display item";
      if (pct > 5) approverId = managerOf(shop).id;
      c.audit(cashier, t, "pos.discount", ["Order", id], `${c.ref(number)}: Rs. ${(discount / 100).toLocaleString("en-IN")} discount (${pct}.0%) — ${discountReason}${approverId ? ` · approved by ${managerOf(shop).name}` : ""}`);
    }
    const total = subtotal - discount;
    // customer: a known one (earns points) or a walk-in
    const known = chance(0.3) ? pick(o.near(shop.code)) : null;
    const cust = known ?? o.walkIns;
    const company = !known && chance(0.02) ? { name: pick(["Everest Traders", "Himal Hotel Pvt. Ltd.", "Lakeside Adventure Treks", "Bagmati Garments Pvt. Ltd."]), pan: `30${int(1000000, 9999999)}` } : null;
    // payment: one method, or cash + QR split now and then
    const m = method();
    const split = m !== "CASH" && chance(0.06) ? Math.floor(total / 2 / 10000) * 10000 : 0;
    const tenders: { method: TenderMethod; amount: number }[] = split ? [{ method: "CASH", amount: split }, { method: m, amount: total - split }] : [{ method: m, amount: total }];
    for (const tn of tenders) {
      const cash = tn.method === "CASH";
      c.rows.tenders.push({ orderId: id, method: tn.method, amount: tn.amount, tendered: cash ? Math.ceil(tn.amount / 50000) * 50000 : null, reference: cash ? null : `${tn.method === "CARD" ? "AUTH" : "TXN"}${int(10000000, 99999999)}`, createdAt: t });
      if (cash) h.cash += tn.amount;
    }
    const pointsEarned = known?.id ? c.earn(known.id, id, total, t) : 0;
    c.event(id, "DELIVERED", `Sold in store by ${cashier.name}${discount ? ` · discount Rs. ${(discount / 100).toLocaleString("en-IN")} (${discountReason})` : ""}`, cashier.email, t);
    c.rows.orders.push({
      id, number, channel: "STORE", userId: known?.id ?? null, email: known?.email ?? "", phone: known?.phone ?? "", status: "DELIVERED", paymentStatus: "PAID", paymentMethod: "IN_STORE",
      subtotal, discount, shippingFee: 0, total, discountReason, discountApprovedById: approverId, cashierId: cashier.id, shiftId: h.id, shippingMethod: "store",
      shippingAddress: { store: shop.name, fullName: company?.name ?? known?.name ?? "Walk-in customer", phone: known?.phone ?? "" }, pointsEarned, clientRef: `till-${id}`, createdAt: t, updatedAt: t,
    });
    c.invoices.push({ orderId: id, at: t, actorId: cashier.id, buyerPan: company?.pan, buyerName: company?.name });
    // now and then something comes back to the counter within the return window
    if (chance(0.012)) {
      const back = at(ktm(new Date(t.getTime() + int(1, 6) * DAY)), 15, int(0, 50));
      if (back <= NOW) scheduleLater(back, () => counterReturn(shop, { id, number, cust, line: priced[0], itemId: itemIds[0], subtotal, discount, total, pointsEarned, t: back }));
    }
  }

  function counterReturn(shop: Shop, d: { id: string; number: number; cust: Customer; line: { p: P; v: V; q: number; unitPrice: number }; itemId: string; subtotal: number; discount: number; total: number; pointsEarned: number; t: Date }) {
    const h = open.get(`${shop.id}|${ktm(d.t)}`);
    if (!h || d.t > h.closesAt) return;
    const amount = Math.floor((d.line.unitPrice * (d.subtotal - d.discount)) / d.subtotal);
    const credit = chance(0.5), damaged = chance(0.15);
    const id = newId("ret"), number = c.next.ret(), voucher = credit ? c.next.voucher() : null;
    c.rows.returns.push({ id, number, orderId: d.id, shiftId: credit ? null : h.id, storeId: shop.id, processedById: h.cashierId, approvedById: managerOf(shop).id, reason: damaged ? "Button came off on first wear" : pick(["Wrong size, no exchange size left", "Gift: they had one already", "Changed mind within 7 days"]), refundMethod: credit ? "STORE_CREDIT" : "CASH", refundAmount: amount, voucherCode: voucher, clientRef: `till-ret-${id}`, createdAt: d.t });
    c.rows.returnItems.push({ returnId: id, orderItemId: d.itemId, quantity: 1, condition: damaged ? "DAMAGED" : "RESELLABLE", amount });
    if (damaged) {
      c.ledger.add(shop.id, d.line.v.id, 0, "DAMAGED", d.t, { orderId: d.id, actorId: h.cashierId, note: `Return R${number}: 1 damaged, quarantined` });
      c.rows.damage.push({ storeId: shop.id, variantId: d.line.v.id, kind: "IN", quantity: 1, unitCost: d.line.v.costPrice, source: `Return R${number}`, note: "Button missing", createdById: h.cashierId, createdAt: d.t });
    } else c.ledger.add(shop.id, d.line.v.id, 1, "RETURN_RESTOCK", d.t, { orderId: d.id, actorId: h.cashierId, note: `Return R${number}` });
    if (credit) c.rows.vouchers.push({ code: voucher!, description: `Store credit from return R${number}`, type: "FIXED", isCredit: true, value: amount, usageLimit: 1, createdAt: d.t, endsAt: new Date(d.t.getTime() + 365 * DAY) });
    else h.cash -= amount;
    c.credits.push({ orderId: d.id, returnId: id, lines: [{ name: `${d.line.p.name} (${d.line.v.color}/${d.line.v.size})`, sku: d.line.v.sku, quantity: 1, amount }], reason: `Return R${number}`, storeId: shop.id, at: d.t, actorId: h.cashierId });
    if (d.cust.id && d.pointsEarned) c.point(d.cust.id, -Math.min(d.pointsEarned, Math.ceil((d.pointsEarned * amount) / Math.max(1, d.total))), "RETURN_REVERSE", d.t, d.id);
  }

  /** The shift open at a shop at a moment (pickups and counter returns land in its drawer). */
  const shiftAt = (storeId: string, t: Date) => {
    const h = open.get(`${storeId}|${ktm(t)}`);
    return h && t >= h.openedAt && t <= h.closesAt ? h : null;
  };

  /** Shops trade every open day; the E2E database gets no sales today (tests open their own shifts). */
  const trades = (shop: Shop, day: string) => day >= shop.opened && !shop.closedOn.includes(new Date(`${day}T00:00:00Z`).getUTCDay()) && !(IS_E2E && day === TODAY);

  return { startBook, openShift, closeShift, sale, petty, shiftAt, trades };
}
