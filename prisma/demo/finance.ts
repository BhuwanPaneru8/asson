/**
 * The books and the back office, as demo data: markdown events (their sale prices are what history charged),
 * monthly shop budgets, recurring costs posted month by month, a year of other expenses, supplier payments and a
 * credit note against the bills from the goods receipts, bank statement lines matched to deposits, courier payouts
 * and supplier payments, a stock count, warehouse bins, locked day closes (built with the app's own closing
 * summary) and the recommendation links (the app's own nightly job). Also resets every document-number sequence.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import type { Ctx, P } from "./context";
import type { Shop } from "./people";
import { DAY, NOW, TODAY, addDays, at, inChunks, int, ktm, monthsBack, newId, pick, weekday } from "./shared";

// ---------- markdowns (planned before the history, so sale prices are charged during them) ----------

export function planMarkdowns(products: P[], protect: string[]) {
  const pool = products.filter((p) => p.status === "ACTIVE" && !protect.includes(p.slug));
  const festive = pool.filter((p) => p.tags.some((t) => ["festive", "kurta", "saree", "ethnic", "dashain"].includes(t))).slice(0, 6);
  const knits = pool.filter((p) => p.tags.some((t) => ["winter", "hoodie", "sweater"].includes(t))).slice(0, 6);
  const round = (n: number) => Math.round(n / 10_000) * 10_000 - 100;
  const events = [
    { name: "Dashain Sale 2082", from: "2025-09-20", to: "2025-10-03", status: "ENDED" as const, items: [...festive, ...pool.slice(0, 4)].map((p) => ({ p, price: round(p.price * 0.85) })) },
    { name: "Dashain & Tihar Sale 2083", from: "2026-10-08", to: "2026-11-11", status: "ENDED" as const, items: [...festive, ...knits.slice(0, 3), ...pool.slice(4, 8)].map((p) => ({ p, price: round(p.price * 0.8) })) },
    { name: "Poush winter sale", from: addDays(TODAY, 22), to: addDays(TODAY, 36), status: "SCHEDULED" as const, items: knits.map((p) => ({ p, price: round(p.price * 0.85) })) },
    { name: "Year-end clearance (draft)", from: addDays(TODAY, 45), to: addDays(TODAY, 60), status: "DRAFT" as const, items: pool.slice(-6).map((p) => ({ p, price: round(p.price * 0.7) })) },
  ];
  const windows = events.filter((e) => e.status === "ENDED").flatMap((e) => e.items.map((i) => ({ productId: i.p.id, price: i.price, from: e.from, to: e.to })));
  async function write(db: PrismaClient, ownerId: string) {
    for (const [n, e] of events.entries()) {
      const start = at(e.from, 0, 5), end = at(e.to, 23, 55);
      await db.priceEvent.create({ data: { number: 11 + n, name: e.name, startsAt: start, endsAt: end, status: e.status, createdById: ownerId, createdAt: new Date(start.getTime() - 6 * DAY), startedAt: e.status === "ENDED" ? start : null, endedAt: e.status === "ENDED" ? end : null, items: { create: [...new Map(e.items.map((i) => [i.p.id, i])).values()].map((i) => ({ productId: i.p.id, newPrice: i.price, originalPrice: e.status === "ENDED" ? i.p.price : null })) } } });
    }
  }
  return { windows, write };
}

// ---------- budgets, monthly costs and expenses ----------

export async function writeExpenses(db: PrismaClient, c: Ctx, shops: Shop[]) {
  const owner = c.people.owner, acct = c.people.sarita;
  const wh = c.shops["WH-KTM"];
  const rows: Prisma.ExpenseCreateManyInput[] = [];
  const months = Array.from({ length: 13 }, (_, i) => monthsBack(12 - i));
  // monthly costs, posted on the 1st (source = recurring:<id>:<month>, like the app's own posting)
  const recurring = [
    { store: c.shops.FLAGSHIP, category: "RENT" as const, amount: 18_000_000, description: "Durbar Marg shop rent" },
    { store: c.shops.PKR, category: "RENT" as const, amount: 9_500_000, description: "Lakeside shop rent" },
    { store: c.shops.LTP, category: "RENT" as const, amount: 14_000_000, description: "Labim Mall unit rent and service charge" },
    { store: wh, category: "RENT" as const, amount: 7_500_000, description: "Balaju warehouse rent" },
    { store: wh, category: "OTHER" as const, amount: 1_800_000, description: "Warehouse night guard" },
    { store: null, category: "UTILITIES" as const, amount: 450_000, description: "Fibre internet, all locations" },
  ];
  for (const r of recurring) {
    const start = r.store && r.store.opened > `${months[0]}-01` ? r.store.opened.slice(0, 7) : months[0];
    const rc = await db.recurringCost.create({ data: { storeId: r.store?.id ?? null, category: r.category, amount: r.amount, description: r.description, startMonth: start, createdById: owner.id, createdAt: at(`${start}-01`, 10) } });
    for (const m of months.filter((x) => x >= start)) rows.push({ date: `${m}-01`, category: r.category, amount: r.amount, storeId: r.store?.id ?? null, description: `${r.description} (monthly)`, source: `recurring:${rc.id}:${m}`, createdById: owner.id, createdAt: at(`${m}-01`, 6) });
  }
  const festiveMonth = (m: string) => ["2025-09", "2025-10", "2026-10", "2026-11"].includes(m);
  for (const m of months) {
    const d = (day: number) => `${m}-${String(day).padStart(2, "0")}`;
    const past = (day: number) => d(day) <= TODAY;
    for (const shop of shops) if (shop.opened.slice(0, 7) <= m && past(8)) rows.push({ date: d(8), category: "UTILITIES", amount: int(6, 12) * 100_000, storeId: shop.id, description: "NEA electricity", paidVia: "eSewa", createdById: acct.id });
    if (past(5)) rows.push({ date: d(5), category: "MARKETING", amount: (festiveMonth(m) ? int(150, 220) : int(60, 110)) * 100_000, description: festiveMonth(m) ? "Meta and TikTok ads: festival campaign" : "Meta and TikTok ads", paidVia: "Card", createdById: acct.id });
    if (past(12)) rows.push({ date: d(12), category: "PACKAGING", amount: int(18, 32) * 100_000, storeId: wh.id, description: "Mailer bags, tissue, stickers and boxes", paidVia: "Bank", createdById: acct.id });
    if (past(20)) rows.push({ date: d(20), category: "DELIVERY", amount: int(25, 60) * 100_000, storeId: wh.id, description: "Courier invoices (returns and remote surcharges)", paidVia: "Bank", createdById: acct.id });
    if (past(25)) rows.push({ date: d(25), category: "FEES", amount: int(4, 9) * 100_000, description: "Bank, card and wallet fees", paidVia: "Bank", createdById: acct.id });
    // salaries before payroll moved into the system (three and two months back are posted by payroll itself)
    if (m < monthsBack(3) && past(2)) rows.push({ date: d(2), category: "SALARIES", amount: 33_000_000, description: "Staff salaries (paid outside the system, before Payroll)", paidVia: "Bank", createdById: owner.id });
  }
  rows.push({ date: addDays(TODAY, -70), category: "EQUIPMENT", amount: 6_500_000, storeId: c.shops.LTP.id, description: "Till, receipt printer and scanner for Labim", paidVia: "Bank", createdById: owner.id });
  rows.push({ date: addDays(TODAY, -20), category: "EQUIPMENT", amount: 450_000, storeId: c.shops.FLAGSHIP.id, description: "Replacement barcode scanner (issue ISS-504)", paidVia: "Cash", createdById: c.people.manager.id });
  await inChunks(rows, 1000, (x) => db.expense.createMany({ data: x }));

  // shop budgets: last three months, this month and next
  const sales = new Map<string, number>();
  const shopOfShift = new Map(c.rows.shifts.map((s) => [s.id, s.storeId]));
  for (const o of c.rows.orders) if (o.channel === "STORE") { const k = `${shopOfShift.get(o.shiftId!)}|${ktm(o.createdAt as Date).slice(0, 7)}`; sales.set(k, (sales.get(k) ?? 0) + o.total); }
  const budgets: Prisma.ShopBudgetCreateManyInput[] = [];
  for (const shop of shops) for (const back of [3, 2, 1, 0, -1]) {
    const m = monthsBack(back), prev = monthsBack(back + 1);
    if (shop.opened.slice(0, 7) > prev) continue;
    const base = sales.get(`${shop.id}|${prev}`) ?? 0;
    if (!base) continue;
    budgets.push({ storeId: shop.id, month: m, sales: Math.round((base * (["10", "11"].includes(m.slice(5)) ? 1.25 : 1.05)) / 100_000) * 100_000, marginPm: 520, costs: shop.code === "FLAGSHIP" ? 25_000_000 : 15_000_000, note: back === -1 ? "Draft: winter push" : "", updatedById: owner.id });
  }
  await db.shopBudget.createMany({ data: budgets });
}

// ---------- supplier bills, payments, a credit note ----------

export async function writePayables(db: PrismaClient, c: Ctx, bills: (Prisma.SupplierBillCreateManyInput & { id: string })[]) {
  const acct = c.people.sarita;
  const payments: Prisma.SupplierPaymentCreateManyInput[] = [], allocs: Prisma.PaymentAllocationCreateManyInput[] = [];
  let payNo = 700;
  let partialDone = false, overdueLeft = false;
  for (const b of bills) {
    const due = b.dueDate as Date;
    const s = c.suppliers.find((x) => x.id === b.supplierId)!;
    let pay = 0;
    if (due.getTime() < NOW.getTime() - 3 * DAY) {
      if (!overdueLeft && s.name === "Gandhi Nagar market" && due.getTime() > NOW.getTime() - 40 * DAY) { overdueLeft = true; continue; } // one bill left overdue
      pay = b.amount;
    } else if (!partialDone && (b.billDate as Date).getTime() < NOW.getTime() - 12 * DAY) { pay = Math.round(b.amount / 2 / 100_000) * 100_000; partialDone = true; }
    if (!pay) continue;
    const id = newId("sp");
    const paidAt = new Date(Math.min(due.getTime() - int(0, 6) * DAY, NOW.getTime() - DAY));
    const method = s.country === "Nepal" ? pick(["BANK", "CHEQUE"] as const) : "BANK";
    payments.push({ id, number: ++payNo, supplierId: b.supplierId, amount: pay, unallocated: 0, method, reference: method === "CHEQUE" ? `CHQ ${int(100000, 999999)}` : s.country === "Nepal" ? `NIC-${int(1000000, 9999999)}` : `LC/TT ${int(10000, 99999)}`, paidAt, createdById: acct.id, createdAt: paidAt });
    allocs.push({ paymentId: id, billId: b.id, amount: pay, createdAt: paidAt });
    b.paid = pay;
    b.status = pay >= b.amount ? "PAID" : "OPEN";
  }
  // an advance to the Guangzhou market for the spring order: credit waiting for its bill
  const baima = c.suppliers.find((s) => s.name === "Baima Clothing Market")!;
  payments.push({ id: newId("sp"), number: ++payNo, supplierId: baima.id, amount: 5_000_000, unallocated: 5_000_000, method: "BANK", reference: `LC/TT ${int(10000, 99999)}`, paidAt: new Date(NOW.getTime() - 5 * DAY), note: "Advance for the spring shirt order (PO draft)", createdById: acct.id, createdAt: new Date(NOW.getTime() - 5 * DAY) });
  await db.supplierBill.createMany({ data: bills });
  await db.supplierPayment.createMany({ data: payments });
  await db.paymentAllocation.createMany({ data: allocs });

  // damaged goods sent back to Ranjana Trade: their credit note, used against an open bill
  const ranjana = c.suppliers.find((s) => s.name === "Ranjana Trade")!;
  const sent = await db.damageEntry.findMany({ where: { kind: "TO_SUPPLIER", supplierId: ranjana.id, createdAt: { lt: new Date(NOW.getTime() - 20 * DAY) } }, select: { id: true, creditExpected: true } });
  const total = sent.reduce((s, d) => s + (d.creditExpected ?? 0), 0);
  if (total > 0) {
    const open = bills.find((b) => b.supplierId === ranjana.id && b.status === "OPEN" && b.amount - (b.paid ?? 0) >= total);
    const used = open ? total : 0;
    const date = new Date(NOW.getTime() - 15 * DAY);
    const credit = await db.supplierCredit.create({ data: { number: 31, supplierId: ranjana.id, reference: `RT-CN-${int(100, 999)}`, date, amount: total, vatAmount: 0, unallocated: total - used, reason: `Damaged goods returned (${sent.length} pieces)`, createdById: acct.id, createdAt: date } });
    if (open && used) {
      await db.creditAllocation.create({ data: { creditId: credit.id, billId: open.id, amount: used } });
      await db.supplierBill.update({ where: { id: open.id }, data: { paid: { increment: used } } });
    }
    for (const d of sent) await db.damageEntry.update({ where: { id: d.id }, data: { creditReceived: d.creditExpected, creditAt: date, creditNoteId: credit.id } });
  }
  await db.$executeRaw`UPDATE "SupplierBill" SET "status" = 'PAID' WHERE "paid" >= "amount" AND "status" = 'OPEN'`;
}

// ---------- the bank statement ----------

export async function writeStatement(db: PrismaClient, c: Ctx) {
  const acct = c.people.sarita;
  const since = new Date(NOW.getTime() - 45 * DAY);
  const account = "NIC Asia current ·· 0102";
  const lines: Prisma.StatementLineCreateManyInput[] = [];
  let n = 0;
  const key = (date: string, amount: number) => `${account}|${date}|${amount}|${n++}`;
  for (const d of c.rows.deposits.filter((x) => x.status !== "RECORDED" && (x.createdAt as Date) > since)) {
    const date = addDays(d.depositedOn, 0);
    lines.push({ account, date, amount: d.bankAmount ?? d.amount, description: `CASH DEP ${d.bank.toUpperCase()} SLIP ${d.slipNo}`, reference: d.slipNo, key: key(date, d.amount), status: "MATCHED", depositId: d.id, matchedById: acct.id, matchedAt: d.checkedAt as Date, importedById: acct.id, importedAt: d.checkedAt as Date });
  }
  const remits = await db.codRemittance.findMany({ where: { createdAt: { gt: since } } });
  for (const r of remits) { const date = ktm(r.createdAt); lines.push({ account, date, amount: r.received, description: `RTGS ${r.carrier.toUpperCase()} COD SETTLEMENT`, reference: r.reference, key: key(date, r.received), status: "MATCHED", remittanceId: r.id, matchedById: acct.id, matchedAt: r.createdAt, importedById: acct.id, importedAt: r.createdAt }); }
  const paid = await db.supplierPayment.findMany({ where: { method: "BANK", paidAt: { gt: since }, unallocated: 0 } });
  for (const p of paid) { const date = ktm(p.paidAt); lines.push({ account, date, amount: -p.amount, description: `TRF TO SUPPLIER ${p.reference ?? ""}`.trim(), reference: p.reference ?? "", key: key(date, -p.amount), status: "MATCHED", paymentId: p.id, matchedById: acct.id, matchedAt: p.paidAt, importedById: acct.id, importedAt: p.paidAt }); }
  const extra: [number, number, string, "UNMATCHED" | "IGNORED", string][] = [[-12, 1_843_00, "INTEREST CREDIT", "IGNORED", "Quarterly interest"], [-9, -750_00, "SMS ALERT AND STATEMENT CHARGES", "UNMATCHED", ""], [-6, 50_000_000, "TRF FROM OWNER", "IGNORED", "Owner top-up for the winter order"], [-3, -2_260_00, "FONEPAY SETTLEMENT FEE", "UNMATCHED", ""], [-2, 18_450_00, "FONEPAY SETTLEMENT", "UNMATCHED", ""]];
  for (const [back, amount, description, status, note] of extra) { const date = addDays(TODAY, back); lines.push({ account, date, amount, description, key: key(date, amount), status, note, matchedById: status === "IGNORED" ? acct.id : null, matchedAt: status === "IGNORED" ? at(date, 16) : null, importedById: acct.id, importedAt: at(date, 15) }); }
  await db.statementLine.createMany({ data: lines });
}

// ---------- a stock count, bins ----------

export async function writeCounts(db: PrismaClient, c: Ctx) {
  const pkr = c.shops.PKR, ltp = c.shops.LTP;
  const cat = await db.category.findUnique({ where: { slug: "men-t-shirts" } });
  const lines = await db.storeStock.findMany({ where: { storeId: pkr.id, variant: { product: { categoryId: cat?.id } } }, select: { variantId: true, quantity: true }, take: 40 });
  const t = at(addDays(TODAY, -12), 18, 30);
  const approver = c.people.manager, counter = c.people.sujan;
  const diffs = lines.map((l, i) => ({ ...l, counted: i % 13 === 4 && l.quantity > 0 ? l.quantity - 1 : i === 7 ? l.quantity + 1 : l.quantity }));
  await db.stockCount.create({ data: { number: 61, storeId: pkr.id, categoryId: cat?.id ?? null, scopeLabel: "T-Shirts & Polos", status: "APPROVED", note: "Monthly count", createdById: c.people.bimala.id, submittedById: counter.id, submittedAt: t, approvedById: approver.id, approvedAt: new Date(t.getTime() + 14 * 3_600_000), createdAt: new Date(t.getTime() - 2 * 3_600_000), lines: { create: diffs.map((d) => ({ variantId: d.variantId, counted: d.counted, systemAt: d.quantity, countedAt: t, countedById: counter.id })) } } });
  for (const d of diffs.filter((x) => x.counted !== x.quantity)) {
    const delta = d.counted - d.quantity;
    await db.storeStock.update({ where: { storeId_variantId: { storeId: pkr.id, variantId: d.variantId } }, data: { quantity: { increment: delta } } });
    await db.inventoryLog.create({ data: { variantId: d.variantId, storeId: pkr.id, delta, reason: "COUNT", note: `Count SC-61: counted ${d.counted}, system ${d.quantity}`, actorId: approver.id, createdAt: new Date(t.getTime() + 14 * 3_600_000) } });
  }
  // one waiting for a manager to approve at Labim
  const cat2 = await db.category.findUnique({ where: { slug: "women-tops" } });
  const l2 = await db.storeStock.findMany({ where: { storeId: ltp.id, variant: { product: { categoryId: cat2?.id } } }, select: { variantId: true, quantity: true }, take: 25 });
  const t2 = at(addDays(TODAY, -1), 19);
  await db.stockCount.create({ data: { number: 62, storeId: ltp.id, categoryId: cat2?.id ?? null, scopeLabel: "Tops & Tees", status: "SUBMITTED", createdById: c.people.rojina.id, submittedById: c.people.prabin.id, submittedAt: t2, createdAt: new Date(t2.getTime() - 3_600_000), lines: { create: l2.map((d, i) => ({ variantId: d.variantId, counted: i === 3 && d.quantity ? d.quantity - 1 : d.quantity, systemAt: d.quantity, countedAt: t2, countedById: c.people.prabin.id })) } } });

  // warehouse bins in walking order, every variant given a home bin
  const wh = c.shops["WH-KTM"];
  const bins: { id: string; code: string; zone: string }[] = [];
  for (const zone of ["A", "B", "C", "D"]) for (let aisle = 1; aisle <= 5; aisle++) for (let shelf = 1; shelf <= 4; shelf++) bins.push({ id: newId("bin"), code: `${zone}-${String(aisle).padStart(2, "0")}-${shelf}`, zone: { A: "Tops", B: "Bottoms", C: "Outerwear", D: "Ethnic & kids" }[zone]! });
  await db.bin.createMany({ data: bins.map((b) => ({ id: b.id, storeId: wh.id, code: b.code, sortKey: b.code, zone: b.zone, createdAt: new Date(NOW.getTime() - 60 * DAY) })) });
  const zoneOf = (p: P) => (/jeans|trousers|skirts/.test(p.cat) ? "B" : /jackets|blazers|knitwear|hoodies/.test(p.cat) ? "C" : /ethnic|kids/.test(p.cat) ? "D" : "A");
  const assign: Prisma.BinAssignmentCreateManyInput[] = [];
  const used = new Map<string, number>();
  for (const p of c.products.filter((x) => x.status !== "ARCHIVED")) {
    const zone = zoneOf(p), zb = bins.filter((b) => b.code.startsWith(zone));
    const k = used.get(zone) ?? 0; used.set(zone, k + 1);
    const bin = zb[k % zb.length];
    for (const v of p.variants) assign.push({ storeId: wh.id, variantId: v.id, binId: bin.id, assignedById: c.people.dinesh.id });
  }
  await inChunks(assign, 2000, (x) => db.binAssignment.createMany({ data: x }));
}

// ---------- day closes, recommendations, sequences ----------

export async function lockDays(db: PrismaClient, c: Ctx, shops: Shop[]) {
  const { buildDaySummary } = await import("../../src/lib/pos");
  for (const shop of shops) {
    const by = shop.code === "FLAGSHIP" ? c.people.manager : shop.code === "PKR" ? c.people.bimala : c.people.rojina;
    const days: string[] = [];
    for (let back = 45; back >= 2; back--) { const d = addDays(TODAY, -back); if (d >= shop.opened && !shop.closedOn.includes(weekday(d))) days.push(d); }
    for (let i = 0; i < days.length; i += 8) {
      await Promise.all(days.slice(i, i + 8).map(async (date) => {
        const summary = await buildDaySummary(shop.id, date);
        if (!summary.store.transactions && !summary.shifts.length) return;
        await db.dayClose.create({ data: { storeId: shop.id, date, summary: JSON.parse(JSON.stringify(summary)) as Prisma.InputJsonValue, note: summary.cash.difference ? "Cash difference explained by the cashier" : null, lockedById: by.id, lockedAt: at(date, 20, int(15, 55)) } });
      }));
    }
  }
}

export async function buildLinks() {
  const { buildRecommendations } = await import("../../src/lib/recommend");
  await buildRecommendations(NOW);
}

export async function resetSequences(db: PrismaClient) {
  const tables = ["Order", "Return", "Exchange", "BankDeposit", "Manifest", "PurchaseOrder", "GoodsReceipt", "SupplierBill", "SupplierPayment", "SupplierCredit", "StockTransfer", "CareCase", "Issue", "StoreVisit", "LeaveRequest", "StockCount", "PickWave", "PriceEvent", "ProductionOrder", "ProductionReceipt", "VmBrief"];
  // explicit numbers were written above, so each sequence continues after the highest one
  for (const t of tables) await db.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"${t}"', 'number'), (SELECT COALESCE(MAX("number"), 0) + 1 FROM "${t}"), false)`);
}

