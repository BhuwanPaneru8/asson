/**
 * Running the shops and serving customers, as demo data: verified reviews from real deliveries, customer care
 * cases in every state and channel, shop issues, daily checklists, HQ announcements, store visits with fixes,
 * public holidays (festival weeks drive the demand forecast), what shoppers searched and viewed, back-in-stock
 * and price-drop alerts, wishlists and the message log. Written directly with backdated times.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import type { Ctx, Customer, P } from "./context";
import type { Shop } from "./people";
import { DAY, NOW, TODAY, addDays, at, chance, inChunks, int, ktm, newId, pick, rand } from "./shared";

export const HOLIDAYS: [string, string][] = [
  ["2025-12-25", "Christmas"], ["2026-01-15", "Maghe Sankranti"], ["2026-02-18", "Sonam Lhosar"], ["2026-03-03", "Holi (Fagu Purnima)"],
  ["2026-04-14", "Nepali New Year 2083"], ["2026-05-01", "Labour Day"], ["2026-05-29", "Republic Day"], ["2026-09-14", "Haritalika Teej"],
  ["2026-09-19", "Constitution Day"], ["2026-10-11", "Ghatasthapana (Dashain begins)"], ["2026-10-19", "Fulpati"], ["2026-10-20", "Maha Ashtami"],
  ["2026-10-21", "Vijaya Dashami"], ["2026-11-08", "Laxmi Puja (Tihar)"], ["2026-11-10", "Govardhan Puja"], ["2026-11-11", "Bhai Tika"],
  ["2026-11-15", "Chhath Parva"], ["2026-12-25", "Christmas"], ["2026-12-30", "Tamu Lhosar"],
];

const REVIEW_TEXT: Record<string, [string, number, string][]> = {
  good: [["Exactly as the photos", 5, "Colour is the same as on the site and the stitching is neat. Washed twice already, no shrinking."], ["Perfect for Dashain", 5, "Wore it for tika at my mama's house. Everyone asked where it was from."], ["Great quality for the price", 5, "Feels like the expensive brands in Durbar Marg at half the price."], ["Very comfortable", 4, "Soft fabric, good for the whole day. Delivery to Pokhara took 3 days."], ["Fits well", 4, "Ordered my usual size, fits as expected. Would buy another colour."], ["Good basic", 4, "Simple and well made. The neck hasn't stretched after a month."], ["Bought two more", 5, "Liked the first one so much I came back for two more colours."], ["Warm and light", 5, "Kept me warm on a foggy Kathmandu morning without being bulky."]],
  ok: [["Decent", 3, "Fine for the price, but the colour is a bit lighter than the photo."], ["Runs a bit small", 3, "Nice fabric but I should have taken one size up. Exchanged it easily though."], ["Okay", 3, "Good for daily wear. Nothing special."]],
  bad: [["Not for me", 2, "The fabric was thinner than I expected. Returned it and got my money back quickly."], ["Seam came open", 2, "Stitching came open after the second wash. The shop changed it without fuss."]],
};
const FITS = ["True to size", "True to size", "True to size", "True to size", "Runs small", "Runs large"];

export async function writeReviews(db: PrismaClient, c: Ctx) {
  // shoppers review some of what they received; a few reviews were hidden for being off-topic
  const delivered = new Map<string, { userId: string; productId: string; at: Date }>();
  const orders = new Map(c.rows.orders.map((o) => [o.id, o]));
  for (const it of c.rows.items) {
    const o = orders.get(it.orderId)!;
    if (!o.userId || o.status !== "DELIVERED" || o.total === 0) continue;
    const key = `${it.productId}|${o.userId}`;
    if (!delivered.has(key) && chance(0.22)) delivered.set(key, { userId: o.userId, productId: it.productId, at: new Date((o.updatedAt as Date).getTime() + int(2, 12) * DAY) });
  }
  const rows: Prisma.ReviewCreateManyInput[] = [];
  for (const r of delivered.values()) {
    if (r.at > NOW) continue;
    const x = rand();
    const [title, rating, body] = pick(x < 0.78 ? REVIEW_TEXT.good : x < 0.93 ? REVIEW_TEXT.ok : REVIEW_TEXT.bad);
    rows.push({ productId: r.productId, userId: r.userId, rating, title, body, fit: pick(FITS), verified: true, status: chance(0.03) ? "HIDDEN" : "PUBLISHED", createdAt: r.at });
  }
  rows.push(...hiddenSpam(c, rows));
  await inChunks(rows, 1000, (x) => db.review.createMany({ data: x, skipDuplicates: true }));
  await db.$executeRaw`UPDATE "Product" p SET "ratingAvg" = ROUND(s.a::numeric, 1), "ratingCount" = s.n FROM (SELECT "productId", AVG("rating") AS a, COUNT(*)::int AS n FROM "Review" WHERE "status" = 'PUBLISHED' GROUP BY "productId") s WHERE s."productId" = p."id"`;
}
function hiddenSpam(c: Ctx, existing: Prisma.ReviewCreateManyInput[]) {
  const users = [...new Set(existing.map((r) => r.userId))].slice(0, 3);
  return users.map((userId, i) => ({ productId: c.products[i + 3].id, userId, rating: 1, title: "Call me for cheap followers", body: "Best Instagram followers service, DM now", verified: false, status: "HIDDEN" as const, createdAt: new Date(NOW.getTime() - (i + 4) * DAY) }));
}

// ---------- customer care ----------

type CaseSpec = { back: number; channel: "WEB" | "PHONE" | "WHATSAPP" | "SHOP" | "EMAIL" | "SOCIAL"; category: "ORDER" | "DELIVERY" | "PAYMENT" | "QUALITY" | "EXCHANGE" | "SERVICE" | "OTHER"; priority?: "LOW" | "NORMAL" | "URGENT"; status: "NEW" | "OPEN" | "WAITING" | "RESOLVED"; subject: string; msgs: [("C" | "R" | "N"), string][]; shop?: string; order?: boolean; rating?: [number, string] };

const CASES: CaseSpec[] = [
  { back: 0.1, channel: "WEB", category: "DELIVERY", status: "NEW", subject: "Where is my parcel?", msgs: [["C", "Ordered 5 days ago to Dhangadhi and the tracking hasn't moved since it left Kathmandu."]], order: true },
  { back: 0.3, channel: "WHATSAPP", category: "EXCHANGE", status: "NEW", subject: "Need a bigger size", msgs: [["C", "The hoodie is too tight on the shoulders. Can I get XL instead? I still have the tags."]], order: true },
  { back: 0.6, channel: "SOCIAL", category: "OTHER", priority: "LOW", status: "NEW", subject: "Do you make school uniforms?", msgs: [["C", "Instagram DM: do you take bulk orders for school uniforms? 120 pieces for a school in Bhaktapur."]] },
  { back: 1.2, channel: "PHONE", category: "PAYMENT", priority: "URGENT", status: "OPEN", subject: "Charged twice on eSewa", msgs: [["C", "My eSewa shows two payments for the same order."], ["N", "eSewa statement shows one completed, one failed and reversed. Checking with eSewa merchant support."], ["R", "We can see one payment taken and one that eSewa reversed. The reversal can take 3 working days to show. We'll check again on Thursday."]], order: true },
  { back: 2, channel: "SHOP", category: "QUALITY", status: "WAITING", subject: "Colour ran in the first wash", msgs: [["C", "Customer came to the Flagship: the maroon kurta stained a white shirt."], ["N", "Kept the kurta for the supplier. Offered a replacement or refund."], ["R", "Sorry about this. We'd like to replace it with a new one from a different batch, or refund you. Which would you prefer?"]], shop: "FLAGSHIP", order: true },
  { back: 3, channel: "EMAIL", category: "ORDER", status: "WAITING", subject: "Wrong colour sent", msgs: [["C", "I ordered navy but received black."], ["R", "Sorry! We're sending navy today with the courier, who will collect the black one. Is someone home after 3 pm?"]], order: true },
  { back: 4, channel: "WEB", category: "SERVICE", status: "OPEN", subject: "Staff were rude at Lakeside", msgs: [["C", "The staff at the Pokhara shop ignored us for 10 minutes on Saturday."], ["N", "Asked Bimala for the CCTV and who was on shift."]], shop: "PKR" },
  { back: 6, channel: "PHONE", category: "DELIVERY", status: "RESOLVED", subject: "Rider didn't call before coming", msgs: [["C", "The rider came when I was at work and left."], ["R", "We've rescheduled for tomorrow after 5 pm and asked the rider to call first."], ["C", "Got it today, thank you."], ["R", "Glad it arrived. Thanks for your patience!"]], order: true, rating: [5, "Quick and polite"] },
  { back: 8, channel: "WHATSAPP", category: "EXCHANGE", status: "RESOLVED", subject: "Exchange for a smaller size", msgs: [["C", "Can I change my jeans from 34 to 32?"], ["R", "Yes: we've booked the exchange. The rider brings 32 and takes the 34 back."]], order: true, rating: [4, "Easy, but took 3 days"] },
  { back: 9, channel: "WEB", category: "QUALITY", status: "RESOLVED", subject: "Button fell off", msgs: [["C", "A button came off my Oxford shirt after a week."], ["R", "Sorry! Bring it to any of our shops and we'll fix it while you wait, free."], ["C", "Fixed at Labim in 10 minutes. Thanks."]], shop: "LTP", rating: [5, "Very good service at Labim"] },
  { back: 12, channel: "EMAIL", category: "PAYMENT", status: "RESOLVED", subject: "Refund not received", msgs: [["C", "I returned my order a week ago but haven't got the refund."], ["N", "Return R-received on the 3rd, refund to eSewa sent on the 5th, ref ES-RF-88123."], ["R", "Your refund was sent to your eSewa on the 5th (reference ES-RF-88123). Please check your statement."]], order: true, rating: [3, "Took a while"] },
  { back: 15, channel: "SOCIAL", category: "OTHER", priority: "LOW", status: "RESOLVED", subject: "Will the hoodie be restocked?", msgs: [["C", "Facebook: when will the black hoodie in M be back?"], ["R", "It's arriving next week. Tap 'Notify me' on the product page and we'll text you."]] },
  { back: 18, channel: "PHONE", category: "DELIVERY", priority: "URGENT", status: "RESOLVED", subject: "Parcel marked delivered but not received", msgs: [["C", "Tracking says delivered but I never got it."], ["N", "Courier says handed to the guard. Guard confirms. Customer found it."], ["R", "The courier left it with your building's guard at 2:10 pm. Could you check with them?"], ["C", "Found it, sorry for the trouble!"]], order: true, rating: [4, ""] },
  { back: 21, channel: "SHOP", category: "SERVICE", status: "RESOLVED", subject: "Wants to order a size the shop doesn't have", msgs: [["C", "Customer at Pokhara wanted the camel coat in L."], ["R", "Ordered from the warehouse for you: it arrives at the Lakeside shop on Thursday."]], shop: "PKR", rating: [5, "Shop staff were very helpful"] },
  { back: 26, channel: "WEB", category: "ORDER", status: "RESOLVED", subject: "Change delivery address", msgs: [["C", "Can you deliver to my office in Kupondole instead?"], ["R", "Done: updated before it left the warehouse."]], order: true },
  { back: 33, channel: "WHATSAPP", category: "QUALITY", status: "RESOLVED", subject: "Pilling after a month", msgs: [["C", "The sweater is pilling under the arms."], ["N", "Within 30 days: offered a replacement. Logged for the buyer: merino batch from Gandhi Nagar."], ["R", "We'll replace it. Our rider will bring the new one and collect the old one."]], order: true, rating: [4, "Fair"] },
  { back: 41, channel: "EMAIL", category: "OTHER", priority: "LOW", status: "RESOLVED", subject: "Invoice with our PAN", msgs: [["C", "We need a VAT invoice with our company PAN for 12 shirts."], ["R", "Attached the full tax invoice with your PAN. Thank you for the order."]] },
];

export async function writeCare(db: PrismaClient, c: Ctx, customers: Customer[]) {
  const agent = c.people.nisha;
  const orders = c.rows.orders.filter((o) => o.channel !== "STORE" && o.userId);
  for (const [i, s] of CASES.entries()) {
    const t = new Date(NOW.getTime() - s.back * DAY);
    const o = s.order ? orders[orders.length - 30 - i * 7] : null;
    const cust = (o && customers.find((x) => x.id === o.userId)) || customers[(i * 13) % customers.length];
    const hrs = { URGENT: 2, NORMAL: 8, LOW: 24 }[s.priority ?? "NORMAL"];
    const replies = s.msgs.map(([kind, body], k) => ({ kind, body, t: new Date(t.getTime() + k * (hrs / 2) * 3_600_000) })).filter((m) => m.t <= NOW);
    const firstReply = replies.find((m) => m.kind === "R");
    const lastCustomer = [...replies].reverse().find((m) => m.kind === "C")!;
    const resolvedAt = s.status === "RESOLVED" ? replies[replies.length - 1].t : null;
    const waitingOnUs = s.status === "NEW" || s.status === "OPEN";
    const id = newId("cc");
    await db.careCase.create({
      data: {
        id, number: 2001 + i, token: `demo${id.slice(-10)}${i}`, channel: s.channel, category: s.category, priority: s.priority ?? (s.category === "PAYMENT" ? "URGENT" : "NORMAL"), status: s.status,
        subject: s.subject, name: cust.name, phone: cust.phone, email: cust.email || null, userId: cust.id, orderId: o?.id ?? null, storeId: s.shop ? c.shops[s.shop].id : null,
        assigneeId: s.status === "NEW" ? null : agent.id, createdById: ["PHONE", "SHOP"].includes(s.channel) ? (s.shop === "PKR" ? c.people.bimala.id : agent.id) : null,
        respondBy: waitingOnUs ? new Date(lastCustomer.t.getTime() + hrs * 3_600_000) : null, firstReplyAt: firstReply?.t ?? null, lastCustomerAt: lastCustomer.t, resolvedAt,
        rating: s.rating?.[0] ?? null, ratingComment: s.rating?.[1] ?? "", ratedAt: s.rating && resolvedAt ? new Date(resolvedAt.getTime() + 6 * 3_600_000) : null,
        createdAt: t, updatedAt: replies[replies.length - 1].t,
        messages: { create: replies.map((m) => ({ kind: m.kind === "C" ? "CUSTOMER" as const : m.kind === "R" ? "REPLY" as const : "NOTE" as const, body: m.body, byId: m.kind === "C" ? null : agent.id, byName: m.kind === "C" ? cust.name : agent.name, createdAt: m.t })) },
      },
    });
  }
}

// ---------- shop issues ----------

export async function writeIssues(db: PrismaClient, c: Ctx) {
  const list: { shop: string; cat: "EQUIPMENT" | "BUILDING" | "IT" | "SAFETY" | "STOCK" | "OTHER"; pri: "LOW" | "NORMAL" | "URGENT"; status: "OPEN" | "IN_PROGRESS" | "ON_HOLD" | "RESOLVED"; title: string; desc: string; back: number; by: string; cost?: number; events?: string[] }[] = [
    { shop: "PKR", cat: "BUILDING", pri: "URGENT", status: "OPEN", title: "Roof leaking over the fitting room", desc: "Water dripping after last night's rain. Moved the stock out of the way.", back: 1.5, by: "sujan" },
    { shop: "LTP", cat: "IT", pri: "NORMAL", status: "IN_PROGRESS", title: "Wi-Fi drops every afternoon", desc: "The till goes offline around 3 pm most days. Mall Wi-Fi or our router?", back: 4, by: "prabin", events: ["Called the ISP: technician coming Thursday"] },
    { shop: "FLAGSHIP", cat: "EQUIPMENT", pri: "NORMAL", status: "ON_HOLD", title: "Second mirror cracked", desc: "Crack across the bottom of the mirror by the window.", back: 9, by: "anita", cost: 0, events: ["Glass shop in Bagbazar quoted Rs. 6,500. Waiting for the landlord to share the cost"] },
    { shop: "FLAGSHIP", cat: "EQUIPMENT", pri: "URGENT", status: "RESOLVED", title: "Barcode scanner not reading", desc: "Scanner beeps but nothing appears on the till.", back: 20, by: "kiran", cost: 450000, events: ["Cable replaced; still not working", "New scanner bought from New Road", "Working again"] },
    { shop: "PKR", cat: "SAFETY", pri: "URGENT", status: "RESOLVED", title: "Shutter lock jammed", desc: "Couldn't lock the shutter at closing. Bimala stayed until the locksmith came.", back: 34, by: "bimala", cost: 120000, events: ["Locksmith replaced the lock"] },
    { shop: "LTP", cat: "STOCK", pri: "LOW", status: "RESOLVED", title: "Hangers short", desc: "Need 100 more wooden hangers for the new display.", back: 40, by: "rojina", cost: 350000, events: ["Bought from Ason"] },
    { shop: "WH-KTM", cat: "BUILDING", pri: "NORMAL", status: "RESOLVED", title: "Tube lights out in aisle C", desc: "Two tube lights out: hard to read the bin labels.", back: 14, by: "dinesh", cost: 80000, events: ["Electrician replaced both"] },
    { shop: "FLAGSHIP", cat: "BUILDING", pri: "LOW", status: "OPEN", title: "Window display light flickering", desc: "The spotlight on the left mannequin flickers in the evening.", back: 3, by: "anita" },
  ];
  for (const [i, x] of list.entries()) {
    const t = new Date(NOW.getTime() - x.back * DAY);
    const by = c.people[x.by];
    const due = new Date(t.getTime() + (x.pri === "URGENT" ? 1 : x.pri === "NORMAL" ? 3 : 7) * DAY);
    const steps = (x.events ?? []).map((m, k) => ({ m, t: new Date(t.getTime() + (k + 1) * ((x.back * DAY) / ((x.events?.length ?? 0) + 2))) }));
    const resolvedAt = x.status === "RESOLVED" ? new Date(t.getTime() + x.back * DAY * 0.8) : null;
    await db.issue.create({
      data: {
        number: 501 + i, storeId: c.shops[x.shop].id, category: x.cat, priority: x.pri, status: x.status, title: x.title, description: x.desc, photos: [], createdById: by.id,
        assigneeId: x.status === "OPEN" ? null : c.people.manager.id, dueAt: due, respondedAt: steps[0]?.t ?? (x.status === "OPEN" ? null : new Date(t.getTime() + 3_600_000)),
        resolvedAt, escalatedAt: !resolvedAt && due < NOW ? due : null, cost: x.cost ?? 0, createdAt: t, updatedAt: resolvedAt ?? steps[steps.length - 1]?.t ?? t,
        events: { create: [{ byId: by.id, byName: by.name, status: "OPEN", message: "Reported", photos: [], createdAt: t }, ...steps.map((s) => ({ byId: c.people.manager.id, byName: c.people.manager.name, status: null, message: s.m, photos: [], createdAt: s.t })), ...(resolvedAt ? [{ byId: c.people.manager.id, byName: c.people.manager.name, status: "RESOLVED" as const, message: "Resolved", photos: [], createdAt: resolvedAt }] : [])] },
      },
    });
  }
}

// ---------- daily checklists and announcements ----------

export async function writeChecklists(db: PrismaClient, c: Ctx, shops: Shop[]) {
  const templates = [
    { name: "Opening the shop", kind: "SHOP" as const, dueBy: "10:30", items: ["Lights, music and AC on", "Till float counted and matches", "Floor swept, mirrors wiped", "Window display checked", "Yesterday's online pickups on the shelf"] },
    { name: "Closing the shop", kind: "SHOP" as const, dueBy: "20:30", items: ["Fitting rooms cleared", "Shift closed and cash in the safe", "Hangers and folds tidy", "Shutter locked, photo sent to the group"] },
    { name: "Warehouse morning", kind: "WAREHOUSE" as const, dueBy: "09:45", items: ["Yesterday's returns put away", "Pick wave started", "Courier bags ready by the door"] },
  ];
  const ids: { id: string; kind: "SHOP" | "WAREHOUSE"; dueBy: string; items: string[] }[] = [];
  for (const [i, t] of templates.entries()) {
    const row = await db.checklistTemplate.create({ data: { name: t.name, kind: t.kind, dueBy: t.dueBy, items: t.items.map((text) => ({ text })), sortOrder: i, createdAt: new Date(NOW.getTime() - 60 * DAY) } });
    ids.push({ id: row.id, kind: t.kind, dueBy: t.dueBy, items: t.items });
  }
  const runs: Prisma.ChecklistRunCreateManyInput[] = [];
  for (let back = 30; back >= 1; back--) {
    const day = addDays(TODAY, -back);
    for (const shop of [...shops, c.shops["WH-KTM"]]) {
      if (day < shop.opened || shop.closedOn.includes(new Date(`${day}T00:00:00Z`).getUTCDay())) continue;
      const who = shop.code === "FLAGSHIP" ? c.people.anita : shop.code === "PKR" ? c.people.sujan : shop.code === "LTP" ? c.people.prabin : c.people.dinesh;
      for (const t of ids.filter((x) => x.kind === shop.kind)) {
        const [h, m] = t.dueBy.split(":").map(Number);
        const late = chance(0.1), skipped = chance(0.06);
        const items = t.items.map((text, k) => (skipped && k === t.items.length - 1 ? { text } : { text, doneById: who.id, doneByName: who.name, doneAt: at(day, h, m - 40 + k * 5 + (late ? 50 : 0)).toISOString() }));
        runs.push({ templateId: t.id, storeId: shop.id, date: day, items, completedAt: skipped ? null : at(day, h, m - 15 + (late ? 50 : 0)), createdAt: at(day, h - 1) });
      }
    }
  }
  await inChunks(runs, 1000, (x) => db.checklistRun.createMany({ data: x }));

  const notes = [
    { title: "Tihar sale: last weekend", body: "Sale prices end on Bhai Tika night. Put the regular price tags back before opening on the 12th.", back: 16, ack: true, shops: [] as string[] },
    { title: "New winter stock this week", body: "Puffers, hand-knits and the pashmina shawls arrive Sunday. Front tables for knitwear.", back: 9, ack: true, shops: [] as string[] },
    { title: "Lakeside: early opening on Saturdays", body: "From this week the Pokhara shop opens at 9 am on Saturdays for the trekking crowd.", back: 5, ack: true, shops: ["PKR"] },
    { title: "Reminder: count the safe before depositing", body: "Count the safe and record it in Cash before every bank deposit. Finance checks each slip against the statement.", back: 2, ack: false, shops: [] as string[] },
  ];
  for (const n of notes) {
    const t = new Date(NOW.getTime() - n.back * DAY);
    const a = await db.announcement.create({ data: { title: n.title, body: n.body, storeIds: n.shops.map((s) => c.shops[s].id), requiresAck: n.ack, createdById: c.people.manager.id, createdAt: t, expiresAt: n.back > 10 ? new Date(t.getTime() + 20 * DAY) : null } });
    const readers = Object.values(c.people).filter((p) => p.key !== "owner" && (!n.shops.length || p.storeIds.some((s) => n.shops.map((x) => c.shops[x].id).includes(s))) && p.key !== "cashier" && chance(0.75));
    await db.announcementRead.createMany({ data: readers.map((p) => ({ announcementId: a.id, userId: p.id, readAt: new Date(t.getTime() + int(1, 30) * 3_600_000) })) });
  }
}

// ---------- store visits ----------

export async function writeVisits(db: PrismaClient, c: Ctx, shops: Shop[]) {
  const sections = [
    { name: "Shop floor", items: [{ text: "Window matches this month's brief" }, { text: "Every rail sized S to XXL, left to right" }, { text: "Price tags on every piece" }, { text: "Fitting rooms clean, hooks and mirror OK" }] },
    { name: "Stock", items: [{ text: "Back store tidy, nothing on the floor" }, { text: "Damaged items in the red box, logged" }, { text: "Spot count of 5 SKUs matches the system", critical: true }] },
    { name: "Cash and safety", items: [{ text: "Safe counted and matches the cash book", critical: true }, { text: "Fire extinguisher in date and reachable", critical: true }, { text: "First-aid box stocked" }] },
    { name: "People", items: [{ text: "Staff in uniform, name badges on" }, { text: "Greeting within 30 seconds" }] },
  ];
  const tpl = await db.visitTemplate.create({ data: { name: "Monthly shop visit", sections, createdAt: new Date(NOW.getTime() - 120 * DAY) } });
  const flat = sections.flatMap((s) => s.items.map((i) => ({ section: s.name, text: i.text, critical: !!(i as { critical?: boolean }).critical })));
  let number = 41;
  for (const shop of shops) {
    for (const back of [62, 31, 6]) {
      if (addDays(TODAY, -back) < shop.opened) continue;
      const t = at(addDays(TODAY, -back), 11);
      const fails = new Set<number>(back === 6 && shop.code === "PKR" ? [1, 8] : back === 31 ? [int(0, flat.length - 1)] : chance(0.5) ? [int(0, flat.length - 1)] : []);
      const items = flat.map((it, i) => ({ ...it, result: fails.has(i) ? "FAIL" : "PASS", ...(fails.has(i) ? { note: it.critical ? "Expired last month" : "Sizes mixed up on the denim wall" } : {}) }));
      const score = Math.round((items.filter((x) => x.result === "PASS").length / items.length) * 100);
      const ack = back > 6 || shop.code !== "PKR";
      const manager = shop.code === "FLAGSHIP" ? c.people.manager : shop.code === "PKR" ? c.people.bimala : c.people.rojina;
      const v = await db.storeVisit.create({ data: { number: number++, templateId: tpl.id, storeId: shop.id, auditorId: c.people.owner.id, auditorName: c.people.owner.name, status: ack ? "ACKNOWLEDGED" : "SUBMITTED", items, summary: fails.size ? "Good overall: fix the items below this week." : "Shop looks great. Keep it up.", score, criticalFails: [...fails].filter((i) => flat[i].critical).length, startedAt: t, submittedAt: new Date(t.getTime() + 2 * 3_600_000), ackById: ack ? manager.id : null, ackByName: ack ? manager.name : null, ackAt: ack ? new Date(t.getTime() + DAY) : null, ackNote: ack ? "Read with the team at the morning huddle" : "" } });
      for (const i of fails) {
        const critical = flat[i].critical;
        const fixed = back > 6;
        await db.visitAction.create({ data: { visitId: v.id, storeId: shop.id, itemIndex: i, text: flat[i].text, note: items[i].note ?? "", critical, dueAt: new Date(t.getTime() + (critical ? 2 : 7) * DAY), status: fixed ? (back > 30 ? "VERIFIED" : "DONE") : "OPEN", doneById: fixed ? manager.id : null, doneByName: fixed ? manager.name : null, doneAt: fixed ? new Date(t.getTime() + 2 * DAY) : null, doneNote: fixed ? "Sorted the same week" : "", donePhotos: [], verifiedAt: back > 30 ? new Date(t.getTime() + 4 * DAY) : null, createdAt: t } });
      }
    }
  }
}

// ---------- what shoppers searched and looked at ----------

export async function writeStats(db: PrismaClient, c: Ctx) {
  const terms: [string, number, boolean][] = [["kurta", 9, false], ["jeans", 12, false], ["hoodie", 10, false], ["daura suruwal", 5, false], ["pashmina", 6, false], ["linen shirt", 4, false], ["jacket", 9, false], ["puffer", 7, false], ["saree", 4, false], ["oxford", 3, false], ["polo", 4, false], ["cargo", 3, false], ["dhaka topi", 3, true], ["sneakers", 4, true], ["school uniform", 2, true], ["sweater", 6, false], ["gunyu cholo", 3, false], ["hodie", 2, false], ["leather jacket", 3, false], ["sandals", 2, true]];
  const search: Prisma.SearchStatCreateManyInput[] = [], funnel: Prisma.FunnelStatCreateManyInput[] = [], product: Prisma.ProductStatCreateManyInput[] = [];
  const ordersByDay = new Map<string, number>();
  for (const o of c.rows.orders) if (o.channel !== "STORE") { const d = ktm(o.createdAt as Date); ordersByDay.set(d, (ordersByDay.get(d) ?? 0) + 1); }
  for (let back = 90; back >= 0; back--) {
    const day = addDays(TODAY, -back);
    const orders = ordersByDay.get(day) ?? 0;
    // views ≈ 60× orders, adds ≈ 8×, checkout visits ≈ 2× (a typical fashion funnel), with noise
    const views = Math.round((orders * 55 + 120) * (0.85 + rand() * 0.3) * (back === 0 ? 0.6 : 1));
    funnel.push({ day, step: "view", count: views }, { day, step: "add", count: Math.round(views * (0.11 + rand() * 0.03)) }, { day, step: "checkout", count: Math.round(views * (0.035 + rand() * 0.01)) });
    for (const [term, w, zero] of terms) {
      const n = Math.max(0, Math.round(w * (0.5 + rand())));
      if (n) search.push({ day, term, searches: n, zeroResults: zero ? n : 0, lastResults: zero ? 0 : int(3, 24) });
    }
    if (back <= 35) {
      for (const p of c.products.filter((x) => x.status === "ACTIVE")) {
        const v = Math.round(p.popularity * (4 + rand() * 10));
        if (v) product.push({ day, productId: p.id, views: v, adds: Math.round(v * (0.08 + rand() * 0.08)) });
      }
    }
  }
  await db.funnelStat.createMany({ data: funnel });
  await inChunks(search, 2000, (x) => db.searchStat.createMany({ data: x }));
  await inChunks(product, 2000, (x) => db.productStat.createMany({ data: x }));
}

// ---------- alerts, wishlists, messages ----------

export async function writeAlerts(db: PrismaClient, c: Ctx, customers: Customer[]) {
  const sold = await db.variant.findMany({ where: { stock: 0, product: { status: "ACTIVE" } }, select: { id: true }, take: 14 });
  const alerts: Prisma.StockAlertCreateManyInput[] = [];
  for (const [k, v] of sold.entries()) for (let j = 0; j <= k % 3; j++) { const u = customers[(k * 7 + j * 3) % customers.length]; alerts.push({ variantId: v.id, phone: u.phone, userId: u.id, createdAt: new Date(NOW.getTime() - int(1, 20) * DAY) }); }
  // an older one already texted when stock came back
  const back = await db.variant.findFirst({ where: { stock: { gt: 5 } }, select: { id: true } });
  if (back) alerts.push({ variantId: back.id, phone: customers[5].phone, userId: customers[5].id, createdAt: new Date(NOW.getTime() - 30 * DAY), notifiedAt: new Date(NOW.getTime() - 12 * DAY) });
  await db.stockAlert.createMany({ data: alerts, skipDuplicates: true });

  const pricey = c.products.filter((p) => p.price >= 800_000 && p.slug !== "two-piece-wool-suit").slice(0, 4);
  await db.priceAlert.createMany({ data: pricey.flatMap((p, i) => [customers[i + 2], customers[i + 9]].map((u) => ({ productId: p.id, phone: u.phone, userId: u.id, price: p.price, createdAt: new Date(NOW.getTime() - int(2, 40) * DAY) }))), skipDuplicates: true });

  const wish: Prisma.WishlistItemCreateManyInput[] = [];
  for (const u of customers.slice(1, 60)) for (let j = 0; j < int(0, 4); j++) wish.push({ userId: u.id!, productId: pick(c.products.filter((p) => p.status === "ACTIVE")).id });
  await db.wishlistItem.createMany({ data: wish, skipDuplicates: true });

  // the message log for the last fortnight's online orders: no SMS gateway is connected yet, so they're skipped
  // (never QUEUED: the background worker would try to send them)
  const recent = c.rows.orders.filter((o) => o.channel !== "STORE" && (o.createdAt as Date) > new Date(NOW.getTime() - 14 * DAY) && o.phone);
  const notes: Prisma.NotificationCreateManyInput[] = recent.map((o) => ({ orderId: o.id, channel: "SMS" as const, template: "order_placed", to: o.phone, body: `Asson: thank you! Order ${c.ref(o.number)} is placed. We'll call to confirm it.`, status: "SKIPPED" as const, error: "No SMS gateway configured", attempts: 0, createdAt: o.createdAt as Date }));
  await inChunks(notes, 1000, (x) => db.notification.createMany({ data: x }));
}

export type { P };
