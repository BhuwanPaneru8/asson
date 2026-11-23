/**
 * Demo team: the classic demo logins plus a staff member for every job (shop managers and cashiers at each shop,
 * warehouse, accountant, customer care, buyer, marketing), where they work, their weekly rota, three months of
 * clock-ins, leave in every state, decided missed shifts, pay terms and two paid payroll months (built with the
 * app's own payroll code, so slips, SSF, TDS and the expense postings are exactly what the live system makes).
 *
 * Kept out of the E2E tests' way: Ram Cashier and Sita Manager have no shifts from tomorrow on at the Flagship
 * (the roster tests plan and swap them), nobody is clocked in as Ram, the only OPEN missed shift is Ram's last
 * month (the absences test decides it), and pending leave exists only outside the E2E database.
 */
import bcrypt from "bcryptjs";
import type { PrismaClient } from "@prisma/client";
import { type Actor, IS_E2E, NOW, TODAY, addDays, at, chance, inChunks, int, monthsBack, newId, pick, weekStartOf, weekday } from "./shared";

export type Shop = { id: string; code: string; name: string; kind: "SHOP" | "WAREHOUSE"; opened: string; closedOn: number[]; hours: [number, number] };
export type Person = Actor & { email: string; key: string; job: string | null; storeIds: string[]; till: boolean; basic: number; joinedOn: string };

type Spec = { key: string; email: string; name: string; role: "ADMIN" | "MANAGER" | "CASHIER" | "STAFF"; job: string | null; at: string[]; all?: boolean; till?: boolean; basic: number; joined: number; phone?: string; pin?: string; password?: string };

// `at`: location codes; basic salary in rupees; joined = months ago
const TEAM: Spec[] = [
  { key: "owner", email: "admin@asson.test", name: "Store Owner", role: "ADMIN", job: null, at: [], basic: 0, joined: 30, pin: "1357", password: "Admin@12345" },
  { key: "ops", email: "staff@asson.test", name: "Ops Staff", role: "STAFF", job: null, at: ["WH-KTM"], all: true, basic: 24000, joined: 14, password: "Staff@12345" },
  { key: "manager", email: "manager@asson.test", name: "Sita Manager", role: "MANAGER", job: null, at: ["FLAGSHIP"], all: true, basic: 45000, joined: 20, pin: "2580", password: "Manager@12345" },
  { key: "cashier", email: "cashier@asson.test", name: "Ram Cashier", role: "CASHIER", job: null, at: ["FLAGSHIP"], till: true, basic: 22000, joined: 13, password: "Cashier@12345" },
  { key: "anita", email: "anita.gurung@asson.test", name: "Anita Gurung", role: "CASHIER", job: "cashier", at: ["FLAGSHIP"], till: true, basic: 21000, joined: 10, phone: "9801000011" },
  { key: "kiran", email: "kiran.tamang@asson.test", name: "Kiran Tamang", role: "CASHIER", job: "cashier", at: ["FLAGSHIP"], till: true, basic: 19500, joined: 4, phone: "9801000012" },
  { key: "bimala", email: "bimala.thapa@asson.test", name: "Bimala Thapa", role: "MANAGER", job: "shop-manager", at: ["PKR"], basic: 38000, joined: 12, pin: "4711", phone: "9801000021" },
  { key: "sujan", email: "sujan.pun@asson.test", name: "Sujan Pun", role: "CASHIER", job: "cashier", at: ["PKR"], till: true, basic: 20000, joined: 12, phone: "9801000022" },
  { key: "laxmi", email: "laxmi.gurung@asson.test", name: "Laxmi Gurung", role: "CASHIER", job: "cashier", at: ["PKR"], till: true, basic: 19000, joined: 7, phone: "9801000023" },
  { key: "rojina", email: "rojina.maharjan@asson.test", name: "Rojina Maharjan", role: "MANAGER", job: "shop-manager", at: ["LTP"], basic: 36000, joined: 5, pin: "4712", phone: "9801000031" },
  { key: "prabin", email: "prabin.shakya@asson.test", name: "Prabin Shakya", role: "CASHIER", job: "cashier", at: ["LTP"], till: true, basic: 19500, joined: 5, phone: "9801000032" },
  { key: "sunita", email: "sunita.karki@asson.test", name: "Sunita Karki", role: "CASHIER", job: "cashier", at: ["LTP"], till: true, basic: 19000, joined: 5, phone: "9801000033" },
  { key: "dinesh", email: "dinesh.rai@asson.test", name: "Dinesh Rai", role: "STAFF", job: "warehouse", at: ["WH-KTM"], basic: 21000, joined: 11, phone: "9801000041" },
  { key: "hari", email: "hari.bhandari@asson.test", name: "Hari Bhandari", role: "STAFF", job: "warehouse", at: ["WH-KTM"], basic: 20000, joined: 9, phone: "9801000042" },
  { key: "sarita", email: "sarita.kc@asson.test", name: "Sarita KC", role: "MANAGER", job: "accountant", at: ["WH-KTM"], all: true, basic: 42000, joined: 15, phone: "9801000051" },
  { key: "nisha", email: "nisha.lama@asson.test", name: "Nisha Lama", role: "STAFF", job: "care", at: ["WH-KTM"], basic: 23000, joined: 8, phone: "9801000052" },
  { key: "anil", email: "anil.shrestha@asson.test", name: "Anil Shrestha", role: "MANAGER", job: "buyer", at: ["WH-KTM"], all: true, basic: 40000, joined: 16, phone: "9801000053" },
  { key: "pooja", email: "pooja.rai@asson.test", name: "Pooja Rai", role: "STAFF", job: "marketing", at: ["WH-KTM"], basic: 26000, joined: 6, phone: "9801000054" },
];

/** Demo staff password for every new account above (the four classic logins keep theirs). */
export const DEMO_STAFF_PASSWORD = "Demo@12345";

export async function createTeam(db: PrismaClient, shops: Record<string, Shop>) {
  const shared = await bcrypt.hash(DEMO_STAFF_PASSWORD, 10);
  const people: Record<string, Person> = {};
  for (const t of TEAM) {
    const joinedOn = monthsBack(t.joined) + "-01";
    const u = await db.user.create({
      data: {
        email: t.email, name: t.name, role: t.role, job: t.job, phone: t.phone ?? null, allLocations: !!t.all,
        passwordHash: t.password ? await bcrypt.hash(t.password, 12) : shared,
        approvalPinHash: t.pin ? await bcrypt.hash(t.pin, 10) : null,
        createdAt: new Date(`${joinedOn}T04:00:00Z`),
        locations: { create: t.at.map((code) => ({ storeId: shops[code].id })) },
      },
    });
    people[t.key] = { id: u.id, name: u.name, role: u.role, email: u.email, key: t.key, job: t.job, storeIds: t.at.map((c) => shops[c].id), till: !!t.till, basic: t.basic, joinedOn };
  }
  return people;
}

// ---------- the rota ----------

export type Shift = { userId: string; storeId: string; date: string; start: string; end: string };
type Rota = { shifts: Shift[]; leave: Map<string, Set<string>>; tillOf: (storeId: string, day: string) => Person | null };

const WORKERS: Record<string, string[]> = {
  FLAGSHIP: ["cashier", "anita", "kiran", "manager"], PKR: ["bimala", "sujan", "laxmi"], LTP: ["rojina", "prabin", "sunita"],
  "WH-KTM": ["ops", "dinesh", "hari", "sarita", "nisha", "anil", "pooja"],
};
const OFF_DAY: Record<string, number> = { bimala: 2, sujan: 3, laxmi: 0, rojina: 1, prabin: 4, sunita: 0 }; // shops open every day rotate days off

/**
 * Who works where on every day from `from` (shifts for the attendance window) and who runs each shop's till
 * (for the whole sales history, back to when the person joined). Leave days (decided below) are left off.
 */
export function planRota(people: Record<string, Person>, shops: Record<string, Shop>, from: string, leaveDays: Map<string, Set<string>>, away: Set<string>): Rota {
  const shifts: Shift[] = [];
  const until = addDays(TODAY, 13);
  for (const [code, keys] of Object.entries(WORKERS)) {
    const shop = shops[code];
    for (let day = from; day <= until; day = addDays(day, 1)) {
      if (day < shop.opened || shop.closedOn.includes(weekday(day))) continue;
      // the Flagship's future is left to the roster tests (and the owner); other places are planned two weeks ahead
      if (code === "FLAGSHIP" && day > TODAY) continue;
      for (const k of keys) {
        const p = people[k];
        if (day < p.joinedOn) continue;
        if (OFF_DAY[k] === weekday(day)) continue;
        if (leaveDays.get(p.id)?.has(day)) continue;
        const late = code !== "WH-KTM" && (k.charCodeAt(0) + Number(day.slice(8))) % 2 === 1;
        const [s, e] = code === "WH-KTM" ? [9, 17] : late ? [shop.hours[0] + 1, shop.hours[1]] : [shop.hours[0], shop.hours[1] - 1];
        shifts.push({ userId: p.id, storeId: shop.id, date: day, start: `${String(s).padStart(2, "0")}:00`, end: `${String(e).padStart(2, "0")}:00` });
      }
    }
  }
  const thisMonth = TODAY.slice(0, 7);
  const tillOf = (storeId: string, day: string) => {
    const code = Object.values(shops).find((s) => s.id === storeId)!.code;
    // Ram Cashier sells in past months only: the commissions test reads his sales this month
    const pool = (WORKERS[code] ?? []).map((k) => people[k]).filter((p) => p.till && day >= p.joinedOn && !leaveDays.get(p.id)?.has(day) && !away.has(`${p.id}|${day}`) && !(p.key === "cashier" && day.slice(0, 7) === thisMonth) && OFF_DAY[p.key] !== weekday(day));
    if (!pool.length) return null;
    return pool[(Number(day.slice(8)) + Number(day.slice(5, 7))) % pool.length];
  };
  return { shifts, leave: leaveDays, tillOf };
}

// ---------- leave (decided first: the rota leaves those days off) ----------

type Leave = { userId: string; type: string; fromDate: string; toDate: string; days: number; reason: string; status: "APPROVED" | "REJECTED" | "CANCELLED" | "PENDING"; decidedById: string | null; note?: string; createdAt: Date };

/** Working days in a range (Saturday, the weekly day off, isn't one). */
const workDays = (from: string, to: string) => { let n = 0; for (let d = from; d <= to; d = addDays(d, 1)) if (weekday(d) !== 6) n++; return n; };

export function planLeave(people: Record<string, Person>): Leave[] {
  const L: Leave[] = [];
  const add = (key: string, type: string, fromBack: number, len: number, reason: string, status: Leave["status"], decider: string | null, note?: string) => {
    const from = addDays(TODAY, -fromBack), to = addDays(from, len - 1);
    L.push({ userId: people[key].id, type, fromDate: from, toDate: to, days: workDays(from, to), reason, status, decidedById: decider ? people[decider].id : null, note, createdAt: at(addDays(from, -int(5, 15)), 11) });
  };
  add("anita", "HOME", 75, 3, "Going home to Lamjung for a family puja", "APPROVED", "manager");
  add("sujan", "SICK", 48, 2, "Fever", "APPROVED", "bimala");
  add("dinesh", "HOME", 40, 6, "Dashain at home in Dhankuta", "APPROVED", "manager", "Covered by Hari; back before the Tihar rush");
  add("laxmi", "HOME", 40, 4, "Dashain", "REJECTED", "bimala", "Peak week at Lakeside: please take it after Tihar");
  add("laxmi", "HOME", 12, 3, "Dashain visit, moved after the rush", "APPROVED", "bimala");
  add("prabin", "SICK", 27, 1, "Stomach bug", "APPROVED", "rojina");
  add("hari", "MOURNING", 60, 5, "Grandfather's kriya", "APPROVED", "manager");
  add("pooja", "UNPAID", 33, 2, "Sister's wedding in Biratnagar", "APPROVED", "owner");
  add("kiran", "HOME", 18, 2, "Exam at campus", "CANCELLED", null, "Exam moved; withdrawn");
  add("nisha", "SICK", 6, 1, "Migraine", "APPROVED", "manager");
  if (!IS_E2E) {
    // waiting for a decision (the E2E leave test approves "the" pending request, so none there)
    add("sunita", "HOME", -16, 3, "Lhosar at home in Dolakha", "PENDING", null);
    add("sujan", "SICK", -9, 1, "Dental surgery", "PENDING", null);
  }
  return L;
}

export const leaveDayMap = (leave: Leave[]) => {
  const m = new Map<string, Set<string>>();
  for (const l of leave.filter((x) => x.status === "APPROVED")) {
    const set = m.get(l.userId) ?? new Set<string>();
    for (let d = l.fromDate; d <= l.toDate; d = addDays(d, 1)) set.add(d);
    m.set(l.userId, set);
  }
  return m;
};

// ---------- missed shifts ----------

const firstWeekday = (d: string) => { while (weekday(d) === 6) d = addDays(d, 1); return d; };

/** Ram's missed shift last month (the absences test decides it) and decided no-shows of others in earlier weeks. */
export function planAbsences(people: Record<string, Person>) {
  const missed = firstWeekday(`${monthsBack(1)}-10`);
  const decided = [
    { key: "kiran", back: 52, status: "WORKED" as const, note: "Was here: the tablet was off, clocked in on paper" },
    { key: "sunita", back: 37, status: "UNPAID" as const, note: "No call, no show" },
    { key: "hari", back: 23, status: "WORKED" as const, note: "Forgot to clock in; CCTV shows him at 9:05" },
  ].map((a) => ({ ...a, date: firstWeekday(addDays(TODAY, -a.back)) }));
  // nobody runs a till on a day they weren't clocked in
  const away = new Set([`${people.cashier.id}|${missed}`, ...decided.filter((a) => a.status === "UNPAID").map((a) => `${people[a.key].id}|${a.date}`)]);
  return { missed, decided, away };
}

// ---------- writing it all ----------

export async function writePeople(db: PrismaClient, people: Record<string, Person>, shops: Record<string, Shop>, rota: Rota, leave: Leave[]) {
  const owner = people.owner;
  const ram = people.cashier;

  const { missed, decided } = planAbsences(people);
  const skipAttendance = new Set([`${ram.id}|${missed}`, ...decided.map((a) => `${people[a.key].id}|${a.date}`)]);
  const shiftFor = new Map<string, Shift>();
  for (const s of rota.shifts) shiftFor.set(`${s.userId}|${s.date}`, s);
  // Ram is rostered on the missed day (that's what makes it a missed shift)
  if (!shiftFor.has(`${ram.id}|${missed}`)) {
    const s = { userId: ram.id, storeId: shops.FLAGSHIP.id, date: missed, start: "10:00", end: "18:00" };
    rota.shifts.push(s); shiftFor.set(`${ram.id}|${missed}`, s);
  }

  // roster weeks: the last ten weeks (and two ahead, not the Flagship's) are published
  const firstWeek = weekStartOf(addDays(TODAY, -70));
  const rosterRows = rota.shifts.filter((s) => s.date >= firstWeek).map((s) => ({ id: newId("rs"), ...s, createdById: s.storeId === shops["WH-KTM"].id ? people.ops.id : people.manager.id, createdAt: at(addDays(weekStartOf(s.date), -4), 16) }));
  await inChunks(rosterRows, 1000, (c) => db.rosterShift.createMany({ data: c }));
  const weeks = new Set(rosterRows.map((r) => `${r.storeId}|${weekStartOf(r.date)}`));
  await db.rosterWeek.createMany({ data: [...weeks].map((k) => { const [storeId, weekStart] = k.split("|"); return { storeId, weekStart, publishedAt: at(addDays(weekStart, -3), 17), publishedById: people.manager.id }; }) });
  const rosterId = new Map(rosterRows.map((r) => [`${r.userId}|${r.date}`, r.id]));

  // clock-ins for every shift worked (late now and then, one forgotten clock-out left for a manager to fix)
  const nowMs = NOW.getTime();
  const att: { id: string; userId: string; storeId: string; clockIn: Date; clockOut: Date | null; autoClosed: boolean; note: string | null; editedById: string | null; editReason: string | null; createdAt: Date }[] = [];
  for (const s of rota.shifts) {
    if (s.date > TODAY || skipAttendance.has(`${s.userId}|${s.date}`)) continue;
    const [sh, sm] = s.start.split(":").map(Number), [eh] = s.end.split(":").map(Number);
    const lateBy = chance(0.07) ? int(12, 35) : int(-12, 6);
    const clockIn = at(s.date, sh, sm + lateBy);
    if (clockIn.getTime() > nowMs) continue; // hasn't started yet today
    let clockOut: Date | null = at(s.date, eh, int(-5, 25));
    let autoClosed = false, editedById: string | null = null, editReason: string | null = null;
    if (clockOut.getTime() > nowMs) { if (s.userId === ram.id) continue; clockOut = null; } // working now (never Ram: the people test clocks him in)
    else if (chance(0.012)) {
      if (s.date >= addDays(TODAY, -6) && !IS_E2E) { clockOut = clockIn; autoClosed = true; } // still to fix
      else { editedById = people.manager.id; editReason = "Forgot to clock out; left at closing time"; }
    }
    att.push({ id: newId("at"), userId: s.userId, storeId: s.storeId, clockIn, clockOut, autoClosed, note: null, editedById, editReason, createdAt: clockIn });
  }
  await inChunks(att, 1000, (c) => db.attendance.createMany({ data: c }));

  // leave requests in every state
  for (const [i, l] of leave.entries()) {
    await db.leaveRequest.create({ data: { number: 10001 + i, userId: l.userId, type: l.type, fromDate: l.fromDate, toDate: l.toDate, days: l.days, reason: l.reason, status: l.status, decidedById: l.decidedById, decidedAt: l.decidedById ? new Date(l.createdAt.getTime() + 20 * 3_600_000) : null, decisionNote: l.note ?? null, createdAt: l.createdAt } });
  }

  // missed shifts: Ram's to decide (the E2E test does), the others decided
  await db.absence.create({ data: { userId: ram.id, storeId: shops.FLAGSHIP.id, date: missed, start: "10:00", end: "18:00", shiftId: rosterId.get(`${ram.id}|${missed}`) ?? null, createdAt: at(missed, 19) } });
  for (const a of decided) {
    const p = people[a.key], s = shiftFor.get(`${p.id}|${a.date}`);
    await db.absence.create({ data: { userId: p.id, storeId: s?.storeId ?? p.storeIds[0], date: a.date, start: s?.start ?? "10:00", end: s?.end ?? "18:00", shiftId: rosterId.get(`${p.id}|${a.date}`) ?? null, status: a.status, decidedById: people.manager.id, decidedAt: at(addDays(a.date, 1), 11), note: a.note, createdAt: at(a.date, 19) } });
    if (a.status === "WORKED" && s) {
      const [sh] = s.start.split(":").map(Number), [eh] = s.end.split(":").map(Number);
      await db.attendance.create({ data: { userId: p.id, storeId: s.storeId, clockIn: at(a.date, sh), clockOut: at(a.date, eh), note: "Added from a missed shift: they were working", editedById: people.manager.id, editReason: a.note, createdAt: at(addDays(a.date, 1), 11) } });
    }
  }

  // a shift swap that went through last month, and one declined
  const swapPairs: [string, string, number, "APPROVED" | "DECLINED"][] = [["prabin", "sunita", 20, "APPROVED"], ["laxmi", "sujan", 9, "DECLINED"]];
  for (const [from, to, back, status] of swapPairs) {
    const s = rota.shifts.find((x) => x.userId === people[from].id && x.date >= addDays(TODAY, -back) && rosterId.has(`${x.userId}|${x.date}`));
    if (!s) continue;
    await db.shiftSwap.create({ data: { shiftId: rosterId.get(`${s.userId}|${s.date}`)!, fromUserId: people[from].id, toUserId: people[to].id, note: "Family function in the evening", status, decidedById: status === "APPROVED" ? people[from === "prabin" ? "rojina" : "bimala"].id : null, decidedAt: at(addDays(s.date, -2), 15), createdAt: at(addDays(s.date, -4), 12) } });
  }

  // pay terms for everyone (the owner is paid from profit, not payroll); Ram has no allowance: the payroll test
  // reads his basic as his pay
  for (const p of Object.values(people)) {
    if (p.key === "owner") continue;
    await db.employment.create({ data: { userId: p.id, basic: p.basic * 100, allowance: p.key === "cashier" ? 0 : (p.role === "MANAGER" ? 4000 : 2500) * 100, inSsf: p.key !== "kiran", married: ["manager", "bimala", "sarita", "anil", "hari"].includes(p.key), pan: `6${String(10000000 + int(0, 89999999)).slice(0, 8)}`, bankAccount: `${pick(["NIC Asia", "Global IME", "Nabil", "Himalayan"])} ·· ${int(1000, 9999)}`, joinedOn: p.joinedOn } });
  }
  await db.commissionRule.create({ data: { storeId: null, rateBp: 100, threshold: 0 } });
  await db.commissionRule.create({ data: { storeId: shops.PKR.id, rateBp: 150, threshold: 60_000_000 } });
  void owner;
  return { missed };
}

/**
 * Two paid payroll months (three and two months back), built with the app's own payroll code from the
 * timesheet above. Last month is left for the owner: Ram's missed shift must be decided before it can be approved.
 */
export async function runPayroll(db: PrismaClient, people: Record<string, Person>) {
  const { buildRun, approveRun, markPaid } = await import("../../src/lib/payroll");
  const { TEMPLATE_2082, fiscalYearOf } = await import("../../src/lib/payroll-rules");
  const owner = people.owner;
  const months = [monthsBack(3), monthsBack(2)];
  for (const fy of new Set([...months, monthsBack(0)].map(fiscalYearOf))) {
    await db.payrollTaxYear.create({ data: { fiscalYear: fy, single: TEMPLATE_2082.single, married: TEMPLATE_2082.married, ssfFirstBandZero: true, source: "IRD income tax slabs (demo values: check with the accountant)", confirmedById: owner.id, confirmedAt: new Date(`${monthsBack(3)}-02T05:00:00Z`) } });
  }
  for (const m of months) {
    const next = new Date(`${m}-01T00:00:00Z`); next.setUTCMonth(next.getUTCMonth() + 1);
    const paidOn = new Date(next.getTime() + 2 * 86_400_000).toISOString().slice(0, 10);
    await db.$transaction(async (tx) => {
      await buildRun(tx, owner, m, paidOn);
      await approveRun(tx, owner, m);
      await markPaid(tx, owner, m, "Bank transfer (salary batch)", paidOn);
    }, { timeout: 60_000 });
    const run = await db.payrollRun.findUniqueOrThrow({ where: { month: m } });
    await db.payrollRun.update({ where: { id: run.id }, data: { createdAt: at(addDays(paidOn, -2), 15), approvedAt: at(addDays(paidOn, -1), 16), paidAt: at(paidOn, 11) } });
    // the older month's TDS and SSF are deposited; the newer one's SSF is still due
    for (const d of await db.statutoryDeposit.findMany({ where: { runId: run.id } })) {
      if (m === months[1] && d.kind === "SSF") continue;
      const on = addDays(paidOn, int(8, 18));
      await db.statutoryDeposit.update({ where: { id: d.id }, data: { paidOn: on, paidAmount: d.amount, reference: d.kind === "TDS" ? `IRD-${int(100000, 999999)}` : `SSF-${int(100000, 999999)}`, paidById: people.sarita.id } });
    }
  }
}
