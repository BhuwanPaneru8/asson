/**
 * Online orders through their whole life. Each order's intended path (placed → confirmed → packed → shipped → out
 * for delivery → delivered, or a cancellation, a parcel that comes back, a return, a size exchange, a pickup) is laid
 * out in time and cut at "now", so recent orders sit in every stage of the pipeline and older ones are finished.
 * Statuses only move along the transitions in lib/order-status.ts; stock is taken when the order is placed and
 * put back where it came from on cancel or return; delivered orders get a tax invoice, returns a credit note.
 */
import type { DeliveryFailReason, OrderStatus } from "@prisma/client";
import { statusLabel } from "../../src/lib/order-status";
import type { Ctx, Customer, P, V } from "./context";
import { DAY, NOW, at, chance, int, ktm, newId, pick } from "./shared";

export type Outcome = "delivered" | "cancelPending" | "cancelConfirmed" | "rto" | "lost" | "returned" | "exchange" | "shopReturn" | "noCollect";
export type Coupon = { code: string; type: "PERCENT" | "FIXED" | "FREE_SHIPPING"; value: number; maxDiscount?: number | null; minSubtotal: number; from?: string; to?: string };
export type Rate = { zone: string; fee: number; etaMax: number };

const H = 3_600_000;
const VALLEY_CARRIERS = ["Own rider", "Pathao Parcel"], OUTSIDE_CARRIERS = ["Nepal Can Move (NCM)", "Upaya City Cargo", "Aramex Nepal"];

export function onlineOrders(c: Ctx, o: { rates: Map<string, Rate>; coupons: Coupon[]; priceAt: (p: P, t: Date) => number; scheduleLater: (t: Date, run: () => void) => void; shiftAt: (storeId: string, t: Date) => { id: string; cashierId: string; cashIn: (n: number) => void } | null }) {
  const wh = c.shops["WH-KTM"], shopsByDistrict: Record<string, string> = { Kathmandu: "FLAGSHIP", Kaski: "PKR", Lalitpur: "LTP" };
  const staff = { confirm: [c.people.nisha, c.people.ops], pack: [c.people.dinesh, c.people.hari, c.people.ops], desk: c.people.ops };
  const firstOrder = new Set<string>();

  /** Where an online order's units come from: the warehouse first, then the shop nearest the customer, then any. */
  function sources(district: string, pickupCode: string | null) {
    const order = pickupCode ? [pickupCode, "WH-KTM"] : ["WH-KTM", shopsByDistrict[district] ?? "FLAGSHIP", "FLAGSHIP", "LTP", "PKR"];
    return [...new Set(order)].map((code) => c.shops[code]);
  }

  /**
   * `force` freezes a showcase order at one stage (cut there instead of at "now") with a chosen outcome, so the
   * pipeline shows every stage whatever time of day the seed runs.
   */
  return function place(t: Date, cust: Customer, festive: boolean, force: { freeze?: OrderStatus; outcome?: Outcome; pickupCode?: string | null } = {}) {
    const pickupCode = force.pickupCode !== undefined ? force.pickupCode : cust.home && chance(0.12) ? cust.home : null;
    const pickup = pickupCode ? c.shops[pickupCode] : null;
    const from = sources(cust.district, pickupCode);
    const lines = c.chooseLines(t, festive, chance(0.55) ? 1 : chance(0.7) ? 2 : 3, null, (v) => from.some((s) => c.ledger.get(s.id, v.id) > 0));
    if (!lines.length) return;
    const id = newId("ord"), number = c.next.order();
    // take the units (conditional, like allocateOrder)
    const alloc: { itemId: string; storeId: string; variantId: string; quantity: number }[] = [];
    const priced = lines.map((l) => ({ ...l, unitPrice: o.priceAt(l.p, t) }));
    const itemIds: string[] = [];
    for (const l of priced) {
      const src = from.find((s) => c.ledger.get(s.id, l.v.id) >= l.q) ?? from.find((s) => c.ledger.get(s.id, l.v.id) > 0)!;
      const q = Math.min(l.q, c.ledger.get(src.id, l.v.id));
      l.q = q;
      const itemId = c.item(id, l.p, l.v, l.unitPrice, q);
      itemIds.push(itemId);
      c.ledger.take(src.id, l.v.id, q, "SALE", t, { orderId: id, note: `Online order ${c.ref(number)}` });
      alloc.push({ itemId, storeId: src.id, variantId: l.v.id, quantity: q });
    }
    const subtotal = priced.reduce((s, l) => s + l.unitPrice * l.q, 0);

    // coupon, then points (after the coupon), then delivery (free over the threshold, judged before points)
    let discount = 0, couponCode: string | null = null, freeShip = false;
    const day = ktm(t);
    const usable = o.coupons.filter((k) => subtotal >= k.minSubtotal && (!k.from || day >= k.from) && (!k.to || day <= k.to) && (k.code !== "WELCOME10" || (cust.id && !firstOrder.has(cust.id))));
    if (usable.length && chance(festive ? 0.3 : 0.14)) {
      const k = pick(usable);
      couponCode = k.code;
      if (k.type === "PERCENT") discount = Math.min(Math.floor((subtotal * k.value) / 100 / 100) * 100, k.maxDiscount ?? Infinity);
      else if (k.type === "FIXED") discount = Math.min(k.value, subtotal);
      else freeShip = true;
    }
    if (cust.id) firstOrder.add(cust.id);
    let pointsRedeemed = 0;
    if (cust.id && chance(0.3)) {
      const bal = c.balanceAt(cust.id, t);
      const cap = Math.floor(((subtotal - discount) * 0.2) / 100);
      if (bal >= 100) pointsRedeemed = Math.min(bal, cap);
      if (pointsRedeemed < 100) pointsRedeemed = 0;
    }
    const pointsDiscount = pointsRedeemed * 100;
    const rate = o.rates.get(cust.district) ?? { zone: "OUTSIDE", fee: 15000, etaMax: 5 };
    const express = !pickup && rate.zone === "VALLEY" && chance(0.1);
    const shippingFee = pickup || freeShip ? 0 : express ? 20000 : subtotal - discount >= 250000 ? 0 : rate.fee;
    const total = subtotal - discount - pointsDiscount + shippingFee;
    const online = chance(0.08) ? (chance(0.6) ? "ESEWA" : "KHALTI") : null;
    const paymentMethod = online ? "ONLINE" : "COD";

    // ---------- the intended path ----------
    const label = (s: OrderStatus) => statusLabel(s, !!pickup);
    const path: { s: OrderStatus; t: Date; actor: string; msg?: string }[] = [];
    const morning = (x: Date) => { const h = Number(new Date(x.getTime() + 345 * 60_000).toISOString().slice(11, 13)); return h >= 19 ? at(ktm(new Date(x.getTime() + DAY)), 10, int(0, 50)) : h < 9 ? at(ktm(x), 10, int(0, 50)) : x; };
    // COD orders are confirmed by phone the same day or the next morning; packed in the next pick wave; couriers
    // take a day in the Valley, three to six outside it
    const tConfirm = morning(new Date(t.getTime() + int(2, 16) * H));
    const tPack = morning(new Date(tConfirm.getTime() + int(6, 26) * H));
    // couriers collect once a day, around 4 pm
    const tShip = (() => { const x = new Date(tPack.getTime() + H); const d = ktm(x); const today = at(d, 16, int(0, 40)); return x <= today ? today : at(ktm(new Date(x.getTime() + DAY)), 16, int(0, 40)); })();
    const travel = express ? int(2, 6) * H : rate.zone === "VALLEY" ? int(18, 40) * H : rate.zone === "REMOTE" ? int(6, 9) * DAY : int(3, 6) * DAY;
    const tOut = morning(new Date(tShip.getTime() + travel));
    // one parcel in eight isn't delivered at the first attempt (nobody home, phone off): it goes out again next day
    const missedFirst = chance(0.12);
    const tDeliver = new Date(tOut.getTime() + (missedFirst ? DAY : 0) + int(1, 6) * H);
    const confirmer = pick(staff.confirm), packer = pick(staff.pack);
    const carrier = pickup ? null : rate.zone === "VALLEY" ? pick(VALLEY_CARRIERS) : pick(OUTSIDE_CARRIERS);
    const tracking = carrier ? `${carrier.startsWith("Own") ? "RD" : carrier.startsWith("Nepal") ? "NCM" : carrier.startsWith("Upaya") ? "UPY" : carrier.startsWith("Pathao") ? "PTH" : "ARX"}${int(1000000, 9999999)}` : null;

    const roll = Math.floor(int(0, 9999)) / 10000;
    let outcome: Outcome =
      force.outcome ?? (roll < 0.04 ? "cancelPending" : roll < 0.07 ? "cancelConfirmed" : roll < 0.11 ? "rto" : roll < 0.113 ? "lost" : roll < 0.14 ? "returned" : roll < 0.155 ? "exchange" : roll < 0.17 ? "shopReturn" : "delivered");
    if (pickup && (outcome === "rto" || outcome === "lost")) outcome = "noCollect";
    if (pickup && outcome === "exchange") outcome = "delivered";

    path.push({ s: "PENDING", t, actor: cust.email || "guest", msg: "Order placed" });
    let callOutcome: "NONE" | "CONFIRMED" | "NO_ANSWER" | "REJECTED" = "NONE", callAttempts = 0;
    if (outcome === "cancelPending") {
      path.push({ s: "CANCELLED", t: new Date(t.getTime() + int(1, 10) * H), actor: cust.email || "guest", msg: pick(["Cancelled by customer: ordered the wrong size", "Cancelled by customer: found it cheaper", "Cancelled by customer: changed my mind", "Cancelled by customer: will buy at the shop"]) });
      if (paymentMethod === "COD") { callAttempts = 1; callOutcome = "NO_ANSWER"; }
    } else {
      callAttempts = paymentMethod === "COD" ? (chance(0.2) ? 2 : 1) : 0;
      callOutcome = paymentMethod === "COD" ? "CONFIRMED" : "NONE";
      if (outcome === "cancelConfirmed" && paymentMethod === "COD" && chance(0.6)) {
        callOutcome = chance(0.5) ? "NO_ANSWER" : "REJECTED"; callAttempts = callOutcome === "NO_ANSWER" ? 3 : 1;
        path.push({ s: "CANCELLED", t: tConfirm, actor: confirmer.email, msg: callOutcome === "REJECTED" ? "Cancelled: customer said they didn't place it (COD call)" : "Cancelled: no answer after three calls" });
      } else {
        path.push({ s: "CONFIRMED", t: tConfirm, actor: confirmer.email });
        if (outcome === "cancelConfirmed") path.push({ s: "CANCELLED", t: new Date(tConfirm.getTime() + int(2, 20) * H), actor: confirmer.email, msg: pick(["Cancelled at the customer's request (phoned)", "Cancelled: out of stock in that colour after all", "Cancelled: customer asked to cancel on WhatsApp"]) });
        else {
          path.push({ s: "PACKED", t: tPack, actor: packer.email });
          if (pickup) {
            if (outcome === "noCollect") path.push({ s: "CANCELLED", t: new Date(tPack.getTime() + 8 * DAY), actor: c.people.manager.email, msg: "Cancelled: not collected within 7 days" });
            else path.push({ s: "DELIVERED", t: morning(new Date(tPack.getTime() + int(4, 60) * H)), actor: "till" });
          } else {
            path.push({ s: "SHIPPED", t: tShip, actor: packer.email, msg: `${label("SHIPPED")} via ${carrier} (${tracking})` });
            if (outcome === "rto" || outcome === "lost") {
              path.push({ s: "OUT_FOR_DELIVERY", t: tOut, actor: "courier" });
              path.push({ s: "RETURNING", t: new Date(tOut.getTime() + int(1, 3) * DAY), actor: staff.desk.email, msg: "Coming back to us: customer refused the parcel" });
              if (outcome === "rto") path.push({ s: "CANCELLED", t: new Date(tOut.getTime() + int(4, 8) * DAY), actor: staff.desk.email, msg: "Came back undelivered: received at Main warehouse, back on sale" });
              else path.push({ s: "CANCELLED", t: new Date(tOut.getTime() + 15 * DAY), actor: staff.desk.email, msg: `Lost by ${carrier}: claiming the goods' value. Courier ref ${int(1000, 9999)}` });
            } else {
              path.push({ s: "OUT_FOR_DELIVERY", t: tOut, actor: "courier" });
              path.push({ s: "DELIVERED", t: tDeliver, actor: carrier === "Own rider" ? packer.email : "courier" });
              if (outcome === "returned") {
                const tReq = new Date(tDeliver.getTime() + int(1, 5) * DAY);
                path.push({ s: "RETURN_REQUESTED", t: tReq, actor: cust.email || "guest", msg: `Return requested: ${pick(["Too small", "Too big", "Colour looks different from the photo", "Fabric not what I expected", "Changed my mind"])}` });
                path.push({ s: "RETURNED", t: new Date(tReq.getTime() + int(3, 6) * DAY), actor: staff.desk.email, msg: "Return received and checked: refunded" });
              }
            }
          }
        }
      }
    }
    const cut = Math.min(NOW.getTime(), force.freeze ? (path.find((x) => x.s === force.freeze)?.t.getTime() ?? NOW.getTime()) + 60_000 : NOW.getTime());
    const done = path.filter((x) => x.t.getTime() <= cut);
    const status = done[done.length - 1].s;
    for (const x of done) c.event(id, x.s, x.msg ?? label(x.s), x.actor, x.t);
    // not confirmed yet: the confirmation call hasn't happened, or nobody picked up
    if (status === "PENDING" && paymentMethod === "COD") { callAttempts = chance(0.35) ? 1 : 0; callOutcome = callAttempts ? "NO_ANSWER" : "NONE"; }
    const tOf = (s: OrderStatus) => done.find((x) => x.s === s)?.t;

    // ---------- what happened, up to now ----------
    const picked = tOf("PACKED");
    for (const a of alloc) c.rows.allocations.push({ orderId: id, orderItemId: a.itemId, variantId: a.variantId, storeId: a.storeId, quantity: a.quantity, createdAt: t, ...(picked ? { pickedAt: picked, pickedById: packer.id } : {}) });
    let paymentStatus: "PENDING" | "PAID" | "REFUNDED" = online ? "PAID" : "PENDING";
    if (online) c.rows.payments.push({ orderId: id, provider: online, status: "COMPLETED", amount: total, reference: `${online === "ESEWA" ? "es" : "kh"}-${id}`, providerRef: `${online === "ESEWA" ? "0" : "pidx"}${int(100000000, 999999999)}`, providerTxn: `T${int(10000000, 99999999)}`, createdAt: new Date(t.getTime() + 60_000), updatedAt: new Date(t.getTime() + 120_000) });
    if (pointsRedeemed && cust.id) c.point(cust.id, -pointsRedeemed, "REDEEM", t, id, `Used on ${c.ref(number)}`);

    const delivered = tOf("DELIVERED");
    let pointsEarned = 0, shiftId: string | null = null, cashierId: string | null = null;
    if (delivered) {
      if (paymentMethod === "COD") paymentStatus = "PAID";
      if (pickup) {
        // paid at the pickup shop's till on collection
        const sh = o.shiftAt(pickup.id, delivered);
        if (sh) {
          shiftId = sh.id; cashierId = sh.cashierId;
          if (paymentMethod === "COD") {
            const method = chance(0.6) ? "CASH" : pick(["FONEPAY_QR", "ESEWA_QR"] as const);
            c.rows.tenders.push({ orderId: id, method, amount: total, tendered: method === "CASH" ? Math.ceil(total / 50000) * 50000 : null, reference: method === "CASH" ? null : `QR${int(1000000, 9999999)}`, createdAt: delivered });
            if (method === "CASH") sh.cashIn(total);
          }
        }
      }
      if (cust.id) pointsEarned = c.earn(cust.id, id, total - shippingFee, delivered);
      if (total > 0) c.invoices.push({ orderId: id, at: delivered, actorId: null });
    }
    const cancelled = tOf("CANCELLED");
    const damagedBack = outcome === "rto" && !!cancelled && chance(0.15);
    if (cancelled) {
      if (paymentStatus === "PAID") paymentStatus = "REFUNDED";
      // back where the units came from, or at the pickup shop if they had been moved there; a parcel back
      // from the courier goes on sale where it arrived (the warehouse) unless it was damaged
      for (const a of alloc) {
        if (outcome === "lost") continue; // nothing comes back: the claim covers it
        if (outcome === "rto") {
          if (damagedBack) {
            c.ledger.add(wh.id, a.variantId, 0, "DAMAGED", cancelled, { orderId: id, actorId: staff.desk.id, note: `${c.ref(number)} came back damaged ×${a.quantity}, quarantined` });
            c.rows.damage.push({ storeId: wh.id, variantId: a.variantId, kind: "IN", quantity: a.quantity, unitCost: c.products.flatMap((p) => p.variants).find((v) => v.id === a.variantId)?.costPrice ?? null, source: `Parcel back ${c.ref(number)}`, note: "Box crushed, shirt torn at the seam", createdById: staff.desk.id, createdAt: cancelled });
          } else c.ledger.add(wh.id, a.variantId, a.quantity, "CANCEL_RESTOCK", cancelled, { orderId: id, actorId: staff.desk.id });
        } else c.ledger.add(pickup && picked && picked <= cancelled ? pickup.id : a.storeId, a.variantId, a.quantity, "CANCEL_RESTOCK", cancelled, { orderId: id, actorId: pickup ? c.people.manager.id : confirmer.id });
      }
      if (pointsRedeemed && cust.id) c.point(cust.id, pointsRedeemed, "REDEEM_REFUND", cancelled, id, `Points back from cancelled ${c.ref(number)}`);
    }
    if (outcome === "rto" || outcome === "lost") {
      const tRet = tOf("RETURNING");
      const lost = outcome === "lost" && !!cancelled;
      if (tOut && tOf("OUT_FOR_DELIVERY")) c.rows.attempts.push({ orderId: id, reason: pick(["NOT_REACHABLE", "NOT_HOME", "COD_NOT_READY"] as DeliveryFailReason[]), note: "Rider called twice", recordedById: staff.desk.id, createdAt: new Date(tOut.getTime() + 5 * H) });
      if (tRet) {
        c.rows.attempts.push({ orderId: id, reason: "CUSTOMER_REFUSED", note: "Refused at the door", recordedById: staff.desk.id, createdAt: tRet });
        c.rows.rtos.push({ orderId: id, reason: "CUSTOMER_REFUSED", carrier: carrier ?? "courier", startedAt: tRet, startedById: staff.desk.id, state: lost ? "LOST" : cancelled ? "RECEIVED" : "IN_TRANSIT", storeId: cancelled && !lost ? wh.id : null, closedAt: cancelled ?? null, closedById: cancelled ? staff.desk.id : null, damaged: damagedBack, courierCharge: cancelled && !lost ? rate.fee : 0, claimAmount: lost ? total - shippingFee : 0, note: lost ? "Courier can't find it: claim filed" : "" });
      }
    } else if (missedFirst && tOf("OUT_FOR_DELIVERY") && new Date(tOut.getTime() + 3 * H) <= NOW) {
      c.rows.attempts.push({ orderId: id, reason: pick(["NOT_REACHABLE", "NOT_HOME", "RESCHEDULED", "COD_NOT_READY"] as DeliveryFailReason[]), note: pick(["Phone switched off", "Asked to come tomorrow after 5", "Nobody at home, neighbour didn't know them", "Didn't have the cash ready"]), recordedById: staff.desk.id, createdAt: new Date(tOut.getTime() + 3 * H) });
    }
    const returned = tOf("RETURNED");
    if (returned) {
      if (paymentStatus === "PAID") paymentStatus = "REFUNDED";
      for (const a of alloc) c.ledger.add(a.storeId, a.variantId, a.quantity, "RETURN_RESTOCK", returned, { orderId: id, actorId: staff.desk.id });
      // the credit note for what was paid for the goods (the delivery charge isn't refunded)
      const net = subtotal - discount - pointsDiscount;
      const value = priced.reduce((s, l) => s + l.unitPrice * l.q, 0);
      const cl = priced.map((l) => ({ name: `${l.p.name} (${l.v.color}/${l.v.size})`, sku: l.v.sku, quantity: l.q, amount: Math.floor((net * l.unitPrice * l.q) / value) }));
      cl[0].amount += net - cl.reduce((s, l) => s + l.amount, 0);
      c.credits.push({ orderId: id, returnId: null, lines: cl, reason: `Order ${c.ref(number)} returned`, storeId: null, at: returned, actorId: staff.desk.id });
      if (cust.id && pointsEarned) c.point(cust.id, -pointsEarned, "RETURN_REVERSE", returned, id);
    }

    // a size exchange: the new size goes out on a free order, the courier brings the old one back
    if (outcome === "exchange" && delivered) {
      const tEx = new Date(delivered.getTime() + int(1, 4) * DAY);
      if (tEx <= NOW) o.scheduleLater(tEx, () => exchange(c, { id, number, cust, priced, itemIds, address: cust.address, t: tEx, packer, carrier: carrier ?? "Own rider", rate }));
    }
    // brought back to a shop instead (part of the order): refunded there in cash or store credit
    if (outcome === "shopReturn" && delivered && !pickup) {
      const tRet = at(ktm(new Date(delivered.getTime() + int(1, 6) * DAY)), 15, int(0, 50));
      const shop = c.shops[shopsByDistrict[cust.district] ?? "FLAGSHIP"];
      if (tRet <= NOW) o.scheduleLater(tRet, () => shopReturn(c, { orderId: id, number, cust, line: priced[0], itemId: itemIds[0], subtotal, discount: discount + pointsDiscount, shop, t: tRet, shiftAt: o.shiftAt, pointsEarned, total, shippingFee }));
    }

    // fulfilment paperwork for recent parcels: the pack check and the courier's manifest
    const shipped = tOf("SHIPPED");
    if (picked && NOW.getTime() - picked.getTime() < 12 * DAY) c.rows.packChecks.push({ orderId: id, storeId: alloc[0].storeId, scans: alloc.map((a) => ({ sku: c.products.flatMap((p) => p.variants).find((v) => v.id === a.variantId)?.sku, n: a.quantity })), matched: true, weightGrams: 350 + 250 * alloc.length, box: alloc.length > 2 ? "Medium box" : "Mailer bag", packedById: packer.id, createdAt: picked });
    if (shipped && carrier && NOW.getTime() - shipped.getTime() < 12 * DAY) manifestFor(c, ktm(shipped), carrier, shipped, packer.id).push({ orderId: id, trackingNumber: tracking!, cod: paymentMethod === "COD" ? total : 0, addedById: packer.id, addedAt: new Date(shipped.getTime() - 30 * 60_000) });

    c.rows.orders.push({
      id, number, userId: cust.id, email: cust.email, phone: cust.phone, status, paymentStatus, paymentMethod, paymentProvider: online,
      paymentRef: online ? `${online === "ESEWA" ? "es" : "kh"}-${id}` : null,
      subtotal, discount, shippingFee, total, couponCode, pointsRedeemed, pointsDiscount, pointsEarned,
      shippingMethod: pickup ? "pickup" : express ? "express" : "standard",
      shippingAddress: pickup ? { pickup: true, storeId: pickup.id, store: pickup.name, fullName: cust.name, phone: cust.phone, country: "Nepal" } : { ...cust.address, zone: rate.zone, etaMaxDays: express ? 1 : rate.etaMax },
      carrier: shipped ? carrier : null, trackingNumber: shipped ? tracking : null, callOutcome, callAttempts, pickupStoreId: pickup?.id ?? null,
      shiftId, cashierId,
      customerNote: chance(0.06) ? pick(["Please call before coming", "Gift wrap if possible", "Leave with the guard if I'm out", "Deliver after 5 pm"]) : null,
      createdAt: t, updatedAt: done[done.length - 1].t,
    });
  };
}

const manifests = new Map<string, { id: string; rows: { orderId: string; trackingNumber: string; cod: number; addedById: string; addedAt: Date }[] }>();
function manifestFor(c: Ctx, day: string, carrier: string, handed: Date, by: string) {
  const key = `${day}|${carrier}`;
  let m = manifests.get(key);
  if (!m) {
    m = { id: newId("mf"), rows: [] };
    manifests.set(key, m);
    c.rows.manifests.push({ id: m.id, number: c.next.manifest(), storeId: c.shops["WH-KTM"].id, carrier, status: "HANDED_OVER", createdById: by, createdAt: new Date(handed.getTime() - 2 * H), riderName: pick(["Bikram", "Suraj", "Rajan", "Pemba"]), riderPhone: `98${int(10000000, 99999999)}`, handedAt: handed, handedById: by });
  }
  return { push: (r: (typeof m.rows)[number]) => { m!.rows.push(r); c.rows.manifestOrders.push({ manifestId: m!.id, ...r }); } };
}

/** Totals on each manifest, once every parcel is on. */
export function closeManifests(c: Ctx) {
  for (const m of c.rows.manifests) {
    const rows = c.rows.manifestOrders.filter((x) => x.manifestId === m.id);
    m.parcels = rows.length;
    m.codTotal = rows.reduce((s, r) => s + (r.cod ?? 0), 0);
  }
}

function exchange(c: Ctx, d: { id: string; number: number; cust: Customer; priced: { p: P; v: V; q: number; unitPrice: number }[]; itemIds: string[]; address: Record<string, unknown>; t: Date; packer: { id: string; email: string }; carrier: string; rate: Rate }) {
  const line = d.priced[0];
  const sizes = line.p.variants.filter((v) => v.color === line.v.color && v.id !== line.v.id && c.ledger.get(c.shops["WH-KTM"].id, v.id) > 0);
  if (!sizes.length) return;
  const nv = sizes[0];
  const repId = newId("ord"), repNo = c.next.order(), exNo = c.next.exchange();
  const wh = c.shops["WH-KTM"];
  c.ledger.take(wh.id, nv.id, 1, "SALE", d.t, { orderId: repId, note: `Exchange for ${c.ref(d.number)}` });
  const repItem = c.item(repId, line.p, nv, line.unitPrice, 1);
  c.rows.allocations.push({ orderId: repId, orderItemId: repItem, variantId: nv.id, storeId: wh.id, quantity: 1, createdAt: d.t, pickedAt: new Date(d.t.getTime() + 5 * H), pickedById: d.packer.id });
  const tShip = new Date(d.t.getTime() + 20 * H), tDel = new Date(d.t.getTime() + (d.rate.zone === "VALLEY" ? 2 : 4) * DAY);
  const path: [OrderStatus, Date, string][] = [["CONFIRMED", d.t, `Exchange for ${c.ref(d.number)}: ${line.p.name} ${line.v.size} → ${nv.size}`], ["PACKED", new Date(d.t.getTime() + 5 * H), "Packed"], ["SHIPPED", tShip, `Shipped via ${d.carrier}`], ["DELIVERED", tDel, "Delivered"]];
  const done = path.filter(([, t]) => t <= NOW);
  for (const [s, t, m] of done) c.event(repId, s, m, s === "CONFIRMED" ? "nisha.lama@asson.test" : d.packer.email, t);
  const status = done[done.length - 1][0];
  c.rows.orders.push({ id: repId, number: repNo, userId: d.cust.id, email: d.cust.email, phone: d.cust.phone, status, paymentStatus: "PAID", paymentMethod: "ONLINE", paymentRef: `exchange of ${c.ref(d.number)}`, subtotal: line.unitPrice, discount: line.unitPrice, shippingFee: 0, total: 0, shippingMethod: "standard", shippingAddress: d.address as object, carrier: done.length > 2 ? d.carrier : null, trackingNumber: done.length > 2 ? `EX${int(100000, 999999)}` : null, customerNote: `Exchange for ${c.ref(d.number)}: collect the old item at the door`, createdAt: d.t, updatedAt: done[done.length - 1][1] });
  const back = new Date(tDel.getTime() + DAY);
  const doneEx = back <= NOW;
  const exId = newId("ex");
  let returnId: string | null = null;
  if (doneEx) {
    returnId = newId("ret");
    const rNo = c.next.ret();
    c.rows.returns.push({ id: returnId, number: rNo, orderId: d.id, storeId: wh.id, processedById: c.people.ops.id, reason: `EX-${exNo}: size exchange, received at ${wh.name}`, refundMethod: "EXCHANGE", refundAmount: 0, createdAt: back });
    c.rows.returnItems.push({ returnId, orderItemId: d.itemIds[0], quantity: 1, condition: "RESELLABLE", amount: 0 });
    c.ledger.add(wh.id, line.v.id, 1, "RETURN_RESTOCK", back, { orderId: d.id, actorId: c.people.ops.id, note: `EX-${exNo}: exchanged item back (R${rNo})` });
    c.event(d.id, null, `EX-${exNo}: old item received back at ${wh.name}`, c.people.ops.name, back);
  }
  c.event(d.id, null, `EX-${exNo}: ${line.p.name} ${line.v.size} → ${nv.size}. New size on ${c.ref(repNo)}; the courier collects the old one.`, d.cust.email || "guest", d.t);
  c.rows.exchanges.push({ id: exId, number: exNo, orderId: d.id, replacementId: repId, reason: pick(["Too tight on the shoulders", "Too long", "Size up please", "A size smaller fits better"]), requestedBy: d.cust.email || "guest", status: doneEx ? "DONE" : "OPEN", returnId, createdAt: d.t, closedAt: doneEx ? back : null });
  c.rows.exchangeItems.push({ exchangeId: exId, orderItemId: d.itemIds[0], quantity: 1, newVariantId: nv.id });
}

function shopReturn(c: Ctx, d: { orderId: string; number: number; cust: Customer; line: { p: P; v: V; q: number; unitPrice: number }; itemId: string; subtotal: number; discount: number; shop: { id: string; name: string; code: string }; t: Date; shiftAt: (storeId: string, t: Date) => { id: string; cashierId: string; cashIn: (n: number) => void } | null; pointsEarned: number; total: number; shippingFee: number }) {
  const sh = d.shiftAt(d.shop.id, d.t);
  if (!sh) return;
  const amount = Math.floor((d.line.unitPrice * (d.subtotal - d.discount)) / d.subtotal);
  const credit = chance(0.4);
  const damaged = chance(0.2);
  const id = newId("ret"), number = c.next.ret();
  const voucher = credit ? c.next.voucher() : null;
  const manager = c.shops.FLAGSHIP.id === d.shop.id ? c.people.manager : d.shop.code === "PKR" ? c.people.bimala : c.people.rojina;
  c.rows.returns.push({ id, number, orderId: d.orderId, shiftId: credit ? null : sh.id, storeId: d.shop.id, processedById: sh.cashierId, approvedById: manager.id, reason: damaged ? "Seam came open after one wash" : pick(["Didn't fit", "Bought two sizes, returning one", "Colour not as expected"]), refundMethod: credit ? "STORE_CREDIT" : "CASH", refundAmount: amount, voucherCode: voucher, createdAt: d.t });
  c.rows.returnItems.push({ returnId: id, orderItemId: d.itemId, quantity: 1, condition: damaged ? "DAMAGED" : "RESELLABLE", amount });
  if (damaged) {
    c.ledger.add(d.shop.id, d.line.v.id, 0, "DAMAGED", d.t, { orderId: d.orderId, actorId: sh.cashierId, note: `Return R${number}: 1 damaged, quarantined` });
    c.rows.damage.push({ storeId: d.shop.id, variantId: d.line.v.id, kind: "IN", quantity: 1, unitCost: d.line.v.costPrice, source: `Return R${number}`, note: "Seam open at the side", createdById: sh.cashierId, createdAt: d.t });
  } else c.ledger.add(d.shop.id, d.line.v.id, 1, "RETURN_RESTOCK", d.t, { orderId: d.orderId, actorId: sh.cashierId, note: `Return R${number}` });
  if (credit) c.rows.vouchers.push({ code: voucher!, description: `Store credit from return R${number}`, type: "FIXED", isCredit: true, value: amount, usageLimit: 1, createdAt: d.t, endsAt: new Date(d.t.getTime() + 365 * DAY) });
  else sh.cashIn(-amount);
  c.event(d.orderId, null, `Return R${number} at ${d.shop.name}: ${d.line.p.name} ×1, ${credit ? `store credit ${voucher}` : "cash refund"}`, c.people.manager.name, d.t);
  c.credits.push({ orderId: d.orderId, returnId: id, lines: [{ name: `${d.line.p.name} (${d.line.v.color}/${d.line.v.size})`, sku: d.line.v.sku, quantity: 1, amount }], reason: `Return R${number}`, storeId: d.shop.id, at: d.t, actorId: sh.cashierId });
  if (d.cust.id && d.pointsEarned) c.point(d.cust.id, -Math.min(d.pointsEarned, Math.ceil((d.pointsEarned * amount) / Math.max(1, d.total - d.shippingFee))), "RETURN_REVERSE", d.t, d.orderId);
}
