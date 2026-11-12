import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { addDays, publishWeek, rosterVsActual, saveWeek } from "@/lib/rosters";
import { absenceList, decideAbsence, findNoShows, reopenAbsence } from "@/lib/absences";
import { decideLeave, requestLeave } from "@/lib/people";
import { approveRun, buildRun, confirmTaxYear, saveEmployment, saveTaxYear } from "@/lib/payroll";
import { TEMPLATE_2082 } from "@/lib/payroll-rules";
import { attention } from "@/lib/attention";
import { scopeFor } from "@/lib/scope";
import { makeLocation, makeUser, resetDb } from "../support/db";

type U = Awaited<ReturnType<typeof makeUser>>;
type L = Awaited<ReturnType<typeof makeLocation>>;

const W = "2026-11-15"; // a Sunday; Saturday (day 6) is the weekly day off
const day = (n: number) => addDays(W, n);
const t = (date: string, hm: string) => new Date(`${date}T${hm}:00+05:45`);
const tx = <T,>(f: (t: Parameters<Parameters<typeof db.$transaction>[0]>[0]) => Promise<T>) => db.$transaction(f);
const rs = (n: number) => n * 100;

describe("missed shifts (absences)", () => {
  let owner: U, sita: U, ram: U, gopal: U, ktm: L, pkr: L;
  beforeEach(async () => {
    await resetDb();
    ktm = await makeLocation({ code: "KTM", name: "Kathmandu shop" });
    pkr = await makeLocation({ code: "PKR", name: "Pokhara shop" });
    owner = await makeUser("ADMIN", { name: "Owner" });
    sita = await makeUser("MANAGER", { name: "Sita", locations: [ktm.id] });
    gopal = await makeUser("MANAGER", { name: "Gopal", locations: [pkr.id] });
    ram = await makeUser("CASHIER", { name: "Ram", locations: [ktm.id] });
    await db.user.update({ where: { id: ram.id }, data: { phone: "9800000001" } });
    await tx((x) => saveWeek(x, sita, ktm.id, W, [0, 1, 2, 3, 6].map((d) => ({ userId: ram.id, date: day(d), value: "10-18" }))));
    await tx((x) => publishWeek(x, sita, ktm.id, W));
    await db.attendance.create({ data: { userId: ram.id, storeId: ktm.id, clockIn: t(day(3), "09:58"), clockOut: t(day(3), "18:02") } });
  });

  it("finds each missed shift once, never a shift on approved leave or one still to come", async () => {
    // sick leave approved after the roster was published: not an absence
    await db.leaveRequest.create({ data: { userId: ram.id, type: "SICK", fromDate: day(1), toDate: day(1), days: 1, status: "APPROVED" } });
    expect(await findNoShows(t(day(2), "12:00"))).toEqual({ found: 1 }); // day 0 only: day 2 isn't over yet
    expect(await findNoShows(t(day(6), "20:00"))).toEqual({ found: 2 }); // day 2 and day 6
    expect(await findNoShows(t(day(6), "21:00"))).toEqual({ found: 0 }); // running again changes nothing
    const all = await db.absence.findMany({ orderBy: { date: "asc" } });
    expect(all.map((a) => [a.date, a.start, a.end, a.status])).toEqual([[day(0), "10:00", "18:00", "OPEN"], [day(2), "10:00", "18:00", "OPEN"], [day(6), "10:00", "18:00", "OPEN"]]);
    expect((await absenceList({ all: false, storeIds: [pkr.id] }, day(7))).open).toHaveLength(0); // Pokhara doesn't see Kathmandu's
    expect((await absenceList({ all: false, storeIds: [ktm.id] }, day(7))).open.map((a) => a.day)).toEqual(["Sun 15 Nov", "Tue 17 Nov", "Sat 21 Nov"]);
    const items = await attention(sita, await scopeFor(sita), t(day(7), "09:00"));
    expect(items.find((i) => i.key === "noshow")).toMatchObject({ tone: "danger", text: "3 missed shifts to decide: unpaid, leave or worked", href: "/admin/people/absences" });
  });

  it("a manager decides: unpaid (with an SMS), leave from the balance, or worked (attendance added); only at their own shops", async () => {
    await findNoShows(t(day(6), "20:00"));
    const at = async (d: number) => (await db.absence.findFirstOrThrow({ where: { date: day(d) } })).id;
    const [a0, a1, a2, a6] = [await at(0), await at(1), await at(2), await at(6)];

    await expect(tx((x) => decideAbsence(x, gopal, a0, { decision: "UNPAID" }))).rejects.toThrow(/don't manage Kathmandu shop/);
    await expect(tx((x) => decideAbsence(x, ram, a0, { decision: "WORKED", note: "I was there" }))).rejects.toThrow(/Someone else has to decide your own/);

    await tx((x) => decideAbsence(x, sita, a0, { decision: "UNPAID", note: "no call, no show" }));
    expect(await db.notification.findFirst({ where: { template: "absence_unpaid" } })).toMatchObject({ to: "9800000001", body: expect.stringContaining("Sun 15 Nov at Kathmandu shop. It is recorded as an unpaid day") });
    await expect(tx((x) => decideAbsence(x, sita, a0, { decision: "WORKED", note: "actually" }))).rejects.toThrow(/already decided: unpaid/);

    await tx((x) => decideAbsence(x, sita, a1, { decision: "LEAVE", leaveType: "SICK", note: "phoned in sick" }, day(7)));
    const sick = await db.leaveRequest.findFirstOrThrow({ where: { userId: ram.id, fromDate: day(1) } });
    expect(sick).toMatchObject({ type: "SICK", status: "APPROVED", days: 1, decidedById: sita.id });
    expect(await db.absence.findUniqueOrThrow({ where: { id: a1 } })).toMatchObject({ status: "LEAVE", leaveRequestId: sick.id });

    await expect(tx((x) => decideAbsence(x, sita, a6, { decision: "LEAVE", leaveType: "HOME" }))).rejects.toThrow(/weekly day off/);
    await expect(tx((x) => decideAbsence(x, sita, a6, { decision: "WORKED" }))).rejects.toThrow(/Say how you know/);
    await tx((x) => decideAbsence(x, sita, a6, { decision: "WORKED", note: "covered the till, sales under his name" }));
    expect(await db.attendance.findFirst({ where: { userId: ram.id, clockIn: t(day(6), "10:00") } })).toMatchObject({ clockOut: t(day(6), "18:00"), editedById: sita.id });
    const vs = await rosterVsActual([ktm.id], day(6), day(6), t(day(6), "20:00"));
    expect(vs.rows[0].result).toBe("on time"); // the record now shows the day as worked

    // taking decisions back: unpaid and leave can be, worked can't (fix the entry instead)
    await expect(tx((x) => reopenAbsence(x, sita, a6, "mistake"))).rejects.toThrow(/Correct that entry/);
    await tx((x) => reopenAbsence(x, sita, a1, "the doctor's note was for another day"));
    expect(await db.leaveRequest.findUniqueOrThrow({ where: { id: sick.id } })).toMatchObject({ status: "CANCELLED" });
    expect(await db.absence.findUniqueOrThrow({ where: { id: a1 } })).toMatchObject({ status: "OPEN", leaveRequestId: null });
    await tx((x) => decideAbsence(x, sita, a1, { decision: "UNPAID" }));
    await tx((x) => decideAbsence(x, sita, a2, { decision: "UNPAID" }));
    expect(await db.auditLog.count({ where: { entityType: "Absence" } })).toBe(6);
  });

  it("sick leave asked for afterwards settles the missed day when it's approved", async () => {
    await findNoShows(t(day(6), "20:00"));
    const lr = await tx((x) => requestLeave(x, ram, { type: "SICK", from: day(2), to: day(2), reason: "fever" }, day(3)));
    await tx((x) => decideLeave(x, sita, lr.id, true));
    expect(await db.absence.findFirstOrThrow({ where: { date: day(2) } })).toMatchObject({ status: "LEAVE", leaveRequestId: lr.id });
    expect(await db.absence.count({ where: { status: "OPEN" } })).toBe(3); // the other days are still to decide
  });

  it("payroll counts unpaid absences, waits for every one to be decided, and locks them once approved", async () => {
    await tx((x) => saveEmployment(x, owner, ram.id, { basic: rs(26_000), allowance: 0, inSsf: false, married: false, active: true }));
    await tx((x) => saveTaxYear(x, owner, "2083/84", TEMPLATE_2082));
    await tx((x) => confirmTaxYear(x, owner, "2083/84"));
    await findNoShows(t(day(6), "20:00"));
    const id = async (d: number) => (await db.absence.findFirstOrThrow({ where: { date: day(d) } })).id;

    await tx((x) => buildRun(x, owner, "2026-11", "2026-11-30"));
    await expect(tx((x) => approveRun(x, owner, "2026-11"))).rejects.toThrow(/4 missed shift\(s\) in 2026-11 still to decide/);

    await tx(async (x) => decideAbsence(x, sita, (await id(0)), { decision: "UNPAID" }));
    await tx(async (x) => decideAbsence(x, sita, (await id(1)), { decision: "UNPAID" }));
    await tx(async (x) => decideAbsence(x, sita, (await id(2)), { decision: "LEAVE", leaveType: "SICK" }, day(7)));
    await tx(async (x) => decideAbsence(x, sita, (await id(6)), { decision: "WORKED", note: "on the till" }));
    await expect(tx((x) => approveRun(x, owner, "2026-11"))).rejects.toThrow(/Rebuild it first/); // the draft predates the decisions

    await tx((x) => buildRun(x, owner, "2026-11", "2026-11-30"));
    const slip = await db.payslip.findFirstOrThrow({ where: { userId: ram.id } });
    expect(slip).toMatchObject({ workingDays: 26, absenceDays: 2, unpaidDays: 2, earnedBasic: rs(24_000), gross: rs(24_000) }); // sick leave is paid
    await tx((x) => approveRun(x, owner, "2026-11"));
    await expect(tx(async (x) => reopenAbsence(x, sita, await id(0), "wrong"))).rejects.toThrow(/2026-11 payroll is approved/);
  });
});
