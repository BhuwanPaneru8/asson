/**
 * A year of trading, day by day: customers signing up, online orders (see online.ts), the shops' tills (tills.ts),
 * purchasing and transfers (supply.ts), with festival peaks (Dashain, Tihar), seasons and growth. Everything is
 * written in bulk at the end, then the tax invoices and credit notes are issued with the app's own lib/invoices.ts
 * in date order, so their numbers, BS dates and VAT are exactly what the live system would print.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { makeContext, type Customer, type P, type V } from "./context";
import type { OrderStatus } from "@prisma/client";
import { onlineOrders, closeManifests, type Coupon, type Outcome, type Rate } from "./online";
import type { Person, Shop } from "./people";
import { makeSupply } from "./supply";
import { makeTills } from "./tills";
import { DAY, NOW, TODAY, addDays, at, chance, inChunks, int, ktm, newId, pick, rand, slugify, weekday } from "./shared";

export const HISTORY_DAYS = 364;

const FIRST = ["Sita", "Bikash", "Anjali", "Prakash", "Sunita", "Rohan", "Pooja", "Nabin", "Srijana", "Suman", "Kritika", "Bibek", "Asmita", "Ramesh", "Manisha", "Sagar", "Pratiksha", "Aayush", "Sabina", "Dipesh", "Rabin", "Sarita", "Niraj", "Alisha", "Kabita", "Sujan", "Rojina", "Binod", "Samjhana", "Ujjwal", "Puja", "Roshan", "Shristi", "Pemba", "Dawa", "Rita", "Kamal", "Gita", "Hemant", "Bina"];
const LAST = ["Shrestha", "Maharjan", "Thapa", "Gurung", "Adhikari", "Rai", "Karki", "Tamang", "Bhandari", "Poudel", "KC", "Joshi", "Sharma", "Lama", "Yadav", "Magar", "Limbu", "Basnet", "Sherpa", "Pradhan", "Dahal", "Bista", "Khadka", "Chaudhary"];
// [city, district, province, postal code, tole, weight]
const CITIES: [string, string, string, string, string, number][] = [
  ["Kathmandu Metropolitan City", "Kathmandu", "Bagmati", "44600", "Baneshwor", 6], ["Kathmandu Metropolitan City", "Kathmandu", "Bagmati", "44600", "Maharajgunj", 4],
  ["Kathmandu Metropolitan City", "Kathmandu", "Bagmati", "44600", "Koteshwor", 3], ["Budhanilkantha", "Kathmandu", "Bagmati", "44600", "Narayanthan", 2],
  ["Lalitpur Metropolitan City", "Lalitpur", "Bagmati", "44700", "Jhamsikhel", 4], ["Lalitpur Metropolitan City", "Lalitpur", "Bagmati", "44700", "Kupondole", 3],
  ["Bhaktapur", "Bhaktapur", "Bagmati", "44800", "Suryabinayak", 2], ["Pokhara Metropolitan City", "Kaski", "Gandaki", "33700", "Lakeside", 4],
  ["Pokhara Metropolitan City", "Kaski", "Gandaki", "33700", "Chipledhunga", 2], ["Biratnagar", "Morang", "Koshi", "56613", "Traffic Chowk", 2],
  ["Butwal", "Rupandehi", "Lumbini", "32907", "Traffic Chowk", 2], ["Bharatpur", "Chitwan", "Bagmati", "44200", "Narayangadh", 2],
  ["Dharan", "Sunsari", "Koshi", "56700", "Bhanu Chowk", 1], ["Birgunj", "Parsa", "Madhesh", "44300", "Ghantaghar", 1],
  ["Janakpur", "Dhanusha", "Madhesh", "45600", "Bhanu Chowk", 1], ["Nepalgunj", "Banke", "Lumbini", "21900", "Dhamboji", 1],
  ["Dhangadhi", "Kailali", "Sudurpashchim", "10900", "Chauraha", 1], ["Birendranagar", "Surkhet", "Karnali", "21700", "Birendra Chowk", 1],
  ["Jomsom", "Mustang", "Gandaki", "33100", "Jomsom Bazaar", 0.3], ["Damak", "Jhapa", "Koshi", "57217", "Damak Chowk", 1], ["Hetauda", "Makwanpur", "Bagmati", "44107", "Bus Park", 1],
];
const HOME: Record<string, string> = { Kathmandu: "FLAGSHIP", Bhaktapur: "LTP", Lalitpur: "LTP", Kaski: "PKR" };

/** Dashain and Tihar shopping windows (Nepal buys ahead of the day). Demo dates: check them against the calendar. */
export const FESTIVE: [string, string][] = [["2025-09-18", "2025-10-03"], ["2025-10-14", "2025-10-23"], ["2026-10-07", "2026-10-21"], ["2026-10-30", "2026-11-11"]];
const festiveOn = (day: string) => FESTIVE.some(([a, b]) => day >= a && day <= b);

function poisson(lambda: number) {
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= rand(); } while (p > L);
  return k - 1;
}

export async function runHistory(db: PrismaClient, o: {
  products: P[]; shops: Record<string, Shop>; people: Record<string, Person>; suppliers: { id: string; name: string; country: string; pan: string | null }[];
  rates: Map<string, Rate>; coupons: Coupon[]; markdowns: { productId: string; price: number; from: string; to: string }[];
  tillOf: (storeId: string, day: string) => Person | null; regular: Customer; opening: { storeId: string; variantId: string; quantity: number; at: Date }[];
  protect: string[]; passwordHash: string;
}) {
  const c = makeContext({ products: o.products, shops: o.shops, people: o.people, suppliers: o.suppliers });
  c.point(o.regular.id!, 100, "WELCOME", o.regular.createdAt, null, "Welcome to Asson");
  const D0 = addDays(TODAY, -HISTORY_DAYS);
  const shops = [o.shops.FLAGSHIP, o.shops.PKR, o.shops.LTP];
  const wh = o.shops["WH-KTM"];

  // opening stock (old stock already in the database was loaded into the ledger by the caller)
  for (const x of o.opening) c.ledger.add(x.storeId, x.variantId, x.quantity, "RECEIVED", x.at, { note: "Opening stock" });
  const existing = await db.storeStock.findMany({ select: { storeId: true, variantId: true, quantity: true } });
  c.ledger.load(existing);

  const priceAt = (p: P, t: Date) => { const day = ktm(t); return o.markdowns.find((m) => m.productId === p.id && day >= m.from && day <= m.to)?.price ?? p.price; };

  // ---------- customers: signed up when they first order (some sign up and never do) ----------
  const people: Customer[] = [o.regular];
  const pool: Customer[] = [];
  const phones = new Set(["9841234567", "9841234568", "9841234569", "9841234570", o.regular.phone]);
  const phone = () => { let p: string; do p = `98${int(0, 6)}${int(1000000, 9999999)}`; while (phones.has(p)); phones.add(p); return p; };
  for (let i = 0; i < 300; i++) {
    const name = `${pick(FIRST)} ${pick(LAST)}`;
    const cc = (() => { let r = rand() * CITIES.reduce((s, x) => s + x[5], 0); for (const x of CITIES) { r -= x[5]; if (r <= 0) return x; } return CITIES[0]; })();
    const ph = phone();
    pool.push({ id: newId("usr"), email: `${slugify(name).replace("-", ".")}${i}@example.com`, phone: ph, name, district: cc[1], createdAt: new Date(0), zone: "", home: HOME[cc[1]] ?? null,
      address: { fullName: name, phone: chance(0.85) ? ph : phone(), line1: `${cc[4]}, House ${int(1, 300)}`, line2: pick(["Near the temple", "Opposite the bank", "Behind the school", "Next to the pharmacy", null]), city: cc[0], district: cc[1], state: cc[2], postalCode: cc[3], country: "Nepal" } });
  }
  const users: Customer[] = [];
  const newCustomer = (t: Date) => {
    const cust = pool.shift();
    if (!cust) return pick(people);
    cust.createdAt = new Date(t.getTime() - int(2, 40) * 60_000);
    c.point(cust.id!, 100, "WELCOME", cust.createdAt, null, "Welcome to Asson");
    people.push(cust); users.push(cust);
    return cust;
  };
  const guest = (): Customer => {
    const name = `${pick(FIRST)} ${pick(LAST)}`, cc = pick(CITIES), ph = phone();
    return { id: null, email: chance(0.4) ? `${slugify(name).replace("-", "")}${int(10, 99)}@gmail.com` : "", phone: ph, name, district: cc[1], createdAt: NOW, zone: "", home: null, address: { fullName: name, phone: ph, line1: `${cc[4]}, House ${int(1, 300)}`, line2: null, city: cc[0], district: cc[1], state: cc[2], postalCode: cc[3], country: "Nepal" } };
  };
  const ordersBy = new Map<string, number>();
  const choose = (t: Date) => {
    const r = rand();
    if (r < 0.14) return guest();
    if (r < 0.42 || people.length < 15) return newCustomer(t);
    return pick(people.filter((p) => p.createdAt <= t && (ordersBy.get(p.id!) ?? 0) < 14));
  };

  // ---------- the generators ----------
  const queue = new Map<string, { t: Date; run: () => void }[]>();
  const later = (t: Date, run: () => void) => { const d = ktm(t); (queue.get(d) ?? queue.set(d, []).get(d)!).push({ t, run }); };
  const walkIns: Customer = { id: null, email: "", phone: "", name: "Walk-in customer", district: "", address: {}, createdAt: NOW, zone: "", home: null };
  const tills = makeTills(c, { tillOf: o.tillOf, priceAt, near: (code) => { const n = people.filter((p) => p.home === code && p.createdAt <= NOW); return n.length ? n : [walkIns]; }, walkIns });
  const place = onlineOrders(c, { rates: o.rates, coupons: o.coupons, priceAt, scheduleLater: later, shiftAt: tills.shiftAt });
  const supply = makeSupply(c);
  const protectVariants = o.products.filter((p) => o.protect.includes(p.slug)).flatMap((p) => p.variants);

  // showcase orders frozen at each stage of the pipeline (hours ago, stage, outcome, pickup)
  const SHOWCASE: [number, OrderStatus, Outcome, boolean][] = [
    [2, "PENDING", "delivered", false], [4, "PENDING", "delivered", false], [7, "PENDING", "delivered", true],
    [14, "CONFIRMED", "delivered", false], [18, "CONFIRMED", "delivered", false], [22, "CONFIRMED", "delivered", false], [26, "CONFIRMED", "delivered", false],
    [46, "PACKED", "delivered", false], [54, "PACKED", "delivered", false], [40, "PACKED", "delivered", true], [44, "PACKED", "delivered", true],
    [52, "SHIPPED", "delivered", false], [80, "OUT_FOR_DELIVERY", "delivered", false], [100, "OUT_FOR_DELIVERY", "delivered", false],
    [300, "RETURN_REQUESTED", "returned", false], [340, "RETURN_REQUESTED", "returned", false], [180, "RETURNING", "rto", false], [215, "RETURNING", "rto", false], [250, "RETURNING", "rto", false],
  ];
  const VALLEY = ["Kathmandu", "Lalitpur", "Bhaktapur"];
  for (const [hoursAgo, freeze, outcome, pickup] of SHOWCASE) {
    const t = new Date(NOW.getTime() - hoursAgo * 3_600_000);
    later(t, () => {
      // Valley customers (a day's delivery), so the stage is reached in the time given
      const cust = pick(people.filter((p) => p.id && VALLEY.includes(p.district) && p.createdAt <= t && p.home));
      place(t, cust, festiveOn(ktm(t)), { freeze, outcome, pickupCode: pickup ? cust.home : null });
    });
  }

  for (let day = D0, n = 0; day <= TODAY; day = addDays(day, 1), n++) {
    const growth = 0.7 + 0.3 * (n / HISTORY_DAYS);
    const festive = festiveOn(day);
    const wd = weekday(day);
    const month = Number(day.slice(5, 7));
    supply.arrivalsOn(day);
    if (n % 11 === 3) supply.reorder(day);
    if (wd === 0) supply.topUp(day, shops, new Set(o.products.filter((p) => o.protect.includes(p.slug)).map((p) => p.id)));
    if (day === addDays(TODAY, -6)) supply.rush(day, protectVariants.filter((v) => c.ledger.get(wh.id, v.id) < 12));
    if (day === addDays(TODAY, -2)) {
      const lines = protectVariants.map((v) => ({ v, q: Math.min(8 - c.ledger.get(o.shops.FLAGSHIP.id, v.id), c.ledger.get(wh.id, v.id) - 4) })).filter((l) => l.q > 0);
      if (lines.length) supply.send(wh, o.shops.FLAGSHIP, lines, at(day, 9, 15), 0, "Best sellers for the Flagship");
    }
    for (const shop of shops) {
      if (day === (shop.opened > D0 ? shop.opened : D0)) tills.startBook(shop);
      if (day.endsWith("-01") && day > shop.opened) later(at(day, 12), () => tills.petty(shop, day));
      if (!tills.trades(shop, day)) continue;
      const h = tills.openShift(shop, day);
      if (!h) continue;
      const base = shop.code === "FLAGSHIP" ? 4.5 : shop.code === "PKR" ? 3.2 * ([10, 11, 3, 4].includes(month) ? 1.35 : 1) * (wd === 6 ? 1.4 : 1) : 3 * (wd === 6 ? 1.3 : 1);
      const sales = poisson(base * growth * (festive ? 2.2 : 1) * (wd === 5 ? 1.2 : 1));
      for (let k = 0; k < sales; k++) {
        const t = at(day, shop.hours[0], int(5, (shop.hours[1] - shop.hours[0]) * 60 - 10));
        later(t, () => tills.sale(shop, day, t, festive, later));
      }
      later(at(day, shop.hours[1], 30), () => tills.closeShift(shop, day));
    }
    const online = poisson(5 * (0.45 + 0.55 * (n / HISTORY_DAYS)) * (festive ? 2.4 : 1) * (wd === 5 ? 1.15 : wd === 6 ? 0.85 : 1) * ([12, 1].includes(month) ? 1.1 : 1));
    for (let k = 0; k < online; k++) {
      const hour = chance(0.55) ? int(19, 22) : int(8, 18);
      const t = at(day, hour, int(0, 59));
      if (t > NOW) continue;
      later(t, () => {
        // the demo customer (customer@asson.test) shops about once a month
        const cust = n % 29 === 7 && k === 0 && o.regular.createdAt <= t ? o.regular : choose(t);
        if (cust.id) ordersBy.set(cust.id, (ordersBy.get(cust.id) ?? 0) + 1);
        place(t, cust, festive);
      });
    }
    // run the day in time order (tasks may add more for later today)
    const list = queue.get(day) ?? [];
    while (list.length) {
      list.sort((a, b) => a.t.getTime() - b.t.getTime());
      list.shift()!.run();
    }
    queue.delete(day);
  }
  supply.finishing();
  closeManifests(c);

  // ---------- after the fact: damaged stock decided, couriers paying COD ----------
  takeOutDamage(c);
  const remittances = remitCod(c);

  // ---------- write ----------
  console.log(`  writing ${c.rows.orders.length} orders, ${c.ledger.rows.length} stock moves…`);
  await inChunks(users.map((u, i) => ({ id: u.id!, email: u.email, name: u.name, phone: u.phone, passwordHash: o.passwordHash, createdAt: u.createdAt, birthday: chance(0.3) ? `${String(int(1, 12)).padStart(2, "0")}-${String(int(1, 28)).padStart(2, "0")}` : null, referralCode: i % 4 === 0 ? `${u.name.split(" ")[0].toUpperCase().slice(0, 6)}${100 + i}` : null })), 500, (x) => db.user.createMany({ data: x }));
  await inChunks(users.map((u) => ({ userId: u.id!, ...(u.address as { fullName: string; phone: string; line1: string; line2: string | null; city: string; district: string; state: string; postalCode: string }), isDefault: true, createdAt: u.createdAt })), 500, (x) => db.address.createMany({ data: x }));
  // pool customers who signed up and never ordered (a few)
  const lurkers = pool.slice(0, 25).map((u) => ({ ...u, createdAt: new Date(NOW.getTime() - int(1, 200) * DAY) }));
  await db.user.createMany({ data: lurkers.map((u) => ({ id: u.id!, email: u.email, name: u.name, phone: u.phone, passwordHash: o.passwordHash, createdAt: u.createdAt })) });
  for (const u of lurkers) c.point(u.id!, 100, "WELCOME", u.createdAt, null, "Welcome to Asson");

  const R = c.rows;
  await inChunks(R.shifts, 1000, (x) => db.shift.createMany({ data: x }));
  await db.codRemittance.createMany({ data: remittances });
  R.orders.sort((a, b) => a.number - b.number);
  await inChunks(R.orders, 500, (x) => db.order.createMany({ data: x }));
  await inChunks(R.items, 2000, (x) => db.orderItem.createMany({ data: x }));
  await inChunks(R.events, 2000, (x) => db.orderEvent.createMany({ data: x }));
  await inChunks(R.allocations, 2000, (x) => db.orderAllocation.createMany({ data: x }));
  await inChunks(R.tenders, 2000, (x) => db.tender.createMany({ data: x }));
  await inChunks(R.payments, 1000, (x) => db.payment.createMany({ data: x }));
  await inChunks(R.cash, 2000, (x) => db.cashEntry.createMany({ data: x }));
  await db.bankDeposit.createMany({ data: R.deposits });
  await db.return.createMany({ data: R.returns });
  await db.returnItem.createMany({ data: R.returnItems });
  await db.exchange.createMany({ data: R.exchanges });
  await db.exchangeItem.createMany({ data: R.exchangeItems });
  await db.deliveryAttempt.createMany({ data: R.attempts });
  await db.returnToOrigin.createMany({ data: R.rtos });
  await db.damageEntry.createMany({ data: R.damage });
  await db.coupon.createMany({ data: R.vouchers });
  await inChunks(R.expenses, 1000, (x) => db.expense.createMany({ data: x }));
  await db.packCheck.createMany({ data: R.packChecks });
  await db.manifest.createMany({ data: R.manifests });
  await db.manifestOrder.createMany({ data: R.manifestOrders });
  await inChunks(R.points, 2000, (x) => db.pointsEntry.createMany({ data: x }));
  await inChunks(R.audit, 2000, (x) => db.auditLog.createMany({ data: x }));
  const bills = await supply.write(db);
  await c.ledger.flush(db);

  // ---------- tax documents, with the app's own invoice code ----------
  await issueDocuments(db, c);

  // ---------- running totals the app keeps on rows ----------
  await db.$executeRaw`UPDATE "User" u SET "points" = s.p FROM (SELECT "userId", SUM("delta")::int AS p FROM "PointsEntry" GROUP BY "userId") s WHERE s."userId" = u."id"`;
  await db.$executeRaw`UPDATE "Product" p SET "soldCount" = COALESCE(s.n, 0) FROM (SELECT i."productId", SUM(i."quantity")::int AS n FROM "OrderItem" i JOIN "Order" o ON o."id" = i."orderId" WHERE o."status" NOT IN ('CANCELLED', 'RETURNED') AND o."total" > 0 GROUP BY i."productId") s WHERE s."productId" = p."id"`;
  await db.$executeRaw`UPDATE "Coupon" c SET "usedCount" = s.n FROM (SELECT "couponCode", COUNT(*)::int AS n FROM "Order" WHERE "couponCode" IS NOT NULL GROUP BY "couponCode") s WHERE s."couponCode" = c."code"`;
  // about half the store-credit vouchers have been spent since
  const spent = R.vouchers.filter((_, i) => i % 2 === 0).map((v) => v.code);
  await db.coupon.updateMany({ where: { code: { in: spent } }, data: { value: 0, usedCount: 1, active: false } });

  return { c, customers: people, bills };
}

/** Invoices then credit notes, each series in date order (series run side by side). */
async function issueDocuments(db: PrismaClient, c: ReturnType<typeof makeContext>) {
  const { issueInvoice, issueCreditNote } = await import("../../src/lib/invoices");
  type Tx = Prisma.TransactionClient;
  const tx = db as unknown as Tx;
  const shopOf = new Map(c.rows.shifts.map((s) => [s.id, s.storeId]));
  const orderById = new Map(c.rows.orders.map((x) => [x.id, x]));
  const lane = (orderId: string) => { const x = orderById.get(orderId)!; return x.channel === "STORE" ? shopOf.get(x.shiftId!)! : "WEB"; };
  const lanes = new Map<string, typeof c.invoices>();
  for (const inv of c.invoices) (lanes.get(lane(inv.orderId)) ?? lanes.set(lane(inv.orderId), []).get(lane(inv.orderId))!).push(inv);
  console.log(`  issuing ${c.invoices.length} tax invoices and ${c.credits.length} credit notes…`);
  await Promise.all([...lanes.values()].map(async (list) => {
    list.sort((a, b) => a.at.getTime() - b.at.getTime());
    for (const inv of list) await issueInvoice(tx, inv.orderId, { now: inv.at, actorId: inv.actorId, buyerPan: inv.buyerPan ?? null, buyerName: inv.buyerName ?? null, full: !!inv.buyerPan });
  }));
  const creditLanes = new Map<string, typeof c.credits>();
  for (const cr of c.credits) (creditLanes.get(cr.storeId ?? "WEB") ?? creditLanes.set(cr.storeId ?? "WEB", []).get(cr.storeId ?? "WEB")!).push(cr);
  await Promise.all([...creditLanes.values()].map(async (list) => {
    list.sort((a, b) => a.at.getTime() - b.at.getTime());
    for (const cr of list) await issueCreditNote(tx, { orderId: cr.orderId, returnId: cr.returnId, lines: cr.lines, reason: cr.reason, storeId: cr.storeId, actorId: cr.actorId, now: cr.at });
  }));
  // printed receipts: most till invoices were printed once; a few reprinted
  const printed = await db.taxInvoice.findMany({ where: { storeId: { not: null } }, select: { id: true, issuedAt: true, issuedById: true }, take: 400, orderBy: { issuedAt: "desc" } });
  await db.invoicePrint.createMany({ data: printed.flatMap((p, i) => [{ invoiceId: p.id, copy: 0, printedById: p.issuedById, printedAt: p.issuedAt }, ...(i % 40 === 0 ? [{ invoiceId: p.id, copy: 1, printedById: p.issuedById, printedAt: new Date(p.issuedAt.getTime() + 3_600_000) }] : [])]) });
  // CBMS is off until the IRD enlists the software: documents older than a week show as sent in this demo
  await db.$executeRaw`UPDATE "CbmsSync" SET "status" = 'SENT', "sentAt" = "createdAt", "attempts" = 1, "realtime" = false WHERE "createdAt" < ${new Date(NOW.getTime() - 7 * DAY)}`;
}

/** Damaged units older than ten days are decided: repaired, written off, or sent back to the supplier. */
function takeOutDamage(c: ReturnType<typeof makeContext>) {
  const ins = c.rows.damage.filter((d) => d.kind === "IN" && (d.createdAt as Date).getTime() < NOW.getTime() - 10 * DAY);
  for (const [i, d] of ins.entries()) {
    const t = new Date((d.createdAt as Date).getTime() + int(3, 9) * DAY);
    const by = c.people.manager;
    const kind = i % 3 === 0 ? "REPAIRED" : i % 3 === 1 ? "WRITTEN_OFF" : "TO_SUPPLIER";
    const supplier = kind === "TO_SUPPLIER" ? c.suppliers.find((s) => s.name === "Ranjana Trade")! : null;
    if (kind === "REPAIRED") c.ledger.add(d.storeId, d.variantId, d.quantity, "RETURN_RESTOCK", t, { actorId: by.id, note: `Repaired: ${d.quantity} back on sale from damaged (tailor fixed the seam)` });
    c.rows.damage.push({ storeId: d.storeId, variantId: d.variantId, kind, quantity: -d.quantity, unitCost: d.unitCost, source: supplier ? `To ${supplier.name}` : kind === "REPAIRED" ? "Repaired" : "Written off", note: kind === "WRITTEN_OFF" ? pick(["Donated to the Bal Mandir drive", "Torn beyond repair: thrown away", "Stain won't come out: used as a cleaning cloth"]) : kind === "REPAIRED" ? "Seam re-stitched by the tailor at Mahaboudha" : "Sent back with the next order", supplierId: supplier?.id ?? null, creditExpected: supplier ? (d.unitCost ?? 0) * d.quantity : null, createdById: by.id, createdAt: t });
  }
}

/** Couriers pay over the COD they collected about a week later; the last two weeks are still with them. */
function remitCod(c: ReturnType<typeof makeContext>) {
  const delivered = c.rows.orders.filter((x) => x.channel !== "STORE" && x.paymentMethod === "COD" && x.status === "DELIVERED" && !x.pickupStoreId && x.carrier);
  const groups = new Map<string, typeof delivered>();
  for (const x of delivered) {
    const t = x.updatedAt as Date;
    if (NOW.getTime() - t.getTime() < 14 * DAY) continue;
    const week = Math.floor(t.getTime() / (7 * DAY));
    const key = `${x.carrier}|${week}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(x);
  }
  const rows: Prisma.CodRemittanceCreateManyInput[] = [];
  for (const [key, list] of groups) {
    const [carrier, week] = key.split("|");
    const id = newId("cod");
    const expected = list.reduce((s, x) => s + x.total, 0);
    const fee = carrier.startsWith("Aramex") ? 20_000 : 0;
    rows.push({ id, carrier, reference: carrier === "Own rider" ? `Riders' cash, week ${week}` : `${carrier.split(" ")[0].toUpperCase()}-REM-${int(10000, 99999)}`, expected, received: expected - fee, note: fee ? "Courier took Rs. 200 handling off the payout" : null, createdById: c.people.sarita.id, createdAt: new Date((Number(week) + 1) * 7 * DAY + 5 * DAY) });
    for (const x of list) x.codRemittanceId = id;
  }
  return rows;
}

export type { V };
