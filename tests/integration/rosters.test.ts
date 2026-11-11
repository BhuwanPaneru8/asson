import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { addDays, copyPreviousWeek, myShifts, parseShift, publishWeek, rosterOverview, rosterVsActual, rosterWeek, saveHoliday, saveWeek, setMinStaff, weekStartOf } from "@/lib/rosters";
import { makeLocation, makeUser, resetDb } from "../support/db";

type U = Awaited<ReturnType<typeof makeUser>>;
type L = Awaited<ReturnType<typeof makeLocation>>;

const W = "2026-11-15"; // a Sunday
const day = (n: number) => addDays(W, n);
const tx = <T,>(f: (t: Parameters<Parameters<typeof db.$transaction>[0]>[0]) => Promise<T>) => db.$transaction(f);

describe("rosters", () => {
  let mgr: U, sita: U, ram: U, hari: U, ktm: L, pkr: L;
  beforeEach(async () => {
    await resetDb();
    ktm = await makeLocation({ code: "KTM", name: "Kathmandu shop" });
    pkr = await makeLocation({ code: "PKR", name: "Pokhara shop" });
    mgr = await makeUser("MANAGER", { name: "Manager", locations: [ktm.id, pkr.id] });
    sita = await makeUser("CASHIER", { name: "Sita", locations: [ktm.id, pkr.id] });
    ram = await makeUser("CASHIER", { name: "Ram", locations: [ktm.id] });
    hari = await makeUser("CASHIER", { name: "Hari", locations: [pkr.id] });
  });

  it("reads shifts the way people type them", () => {
    expect(parseShift("10-18")).toEqual({ start: "10:00", end: "18:00" });
    expect(parseShift(" 9:30 – 17.45 ")).toEqual({ start: "09:30", end: "17:45" });
    expect(parseShift("10 to 18")).toEqual({ start: "10:00", end: "18:00" });
    expect(parseShift("")).toBeNull();
    expect(parseShift("off")).toBeNull();
    expect(() => parseShift("18-10")).toThrow(/ends before it starts/);
    expect(() => parseShift("10-25")).toThrow(/isn't a shift/);
    expect(() => parseShift("ten")).toThrow(/isn't a shift/);
    expect(weekStartOf("2026-11-19")).toBe(W);
    expect(weekStartOf(W)).toBe(W);
  });

  it("saves a week all-or-nothing: only people assigned here, never on approved leave or at two shops in a day", async () => {
    await db.leaveRequest.create({ data: { userId: ram.id, type: "HOME", fromDate: day(3), toDate: day(3), days: 1, status: "APPROVED" } });
    await tx((t) => saveWeek(t, mgr, pkr.id, W, [{ userId: sita.id, date: day(1), value: "10-18" }]));
    const bad = [
      { userId: ram.id, date: day(0), value: "10-18" },
      { userId: hari.id, date: day(0), value: "10-18" }, // not assigned to Kathmandu
      { userId: ram.id, date: day(3), value: "10-18" }, // approved leave
      { userId: sita.id, date: day(1), value: "10-18" }, // already at Pokhara
      { userId: sita.id, date: day(2), value: "18-10" },
    ];
    await expect(tx((t) => saveWeek(t, mgr, ktm.id, W, bad))).rejects.toThrow(/Nothing saved\. Hari isn't assigned to this location; Ram is on leave on Wed; Sita works at Pokhara shop on Mon; Sita, Tue: 18-10: the shift ends before it starts/);
    expect(await db.rosterShift.count({ where: { storeId: ktm.id } })).toBe(0);
    await expect(tx((t) => saveWeek(t, mgr, ktm.id, "2026-11-16", []))).rejects.toThrow(/starts on a Sunday/);
    await expect(tx((t) => saveWeek(t, hari, ktm.id, W, []))).rejects.toThrow(/not assigned to Kathmandu/);

    expect(await tx((t) => saveWeek(t, mgr, ktm.id, W, [{ userId: ram.id, date: day(0), value: "10-18" }, { userId: sita.id, date: day(0), value: "9-17" }, { userId: sita.id, date: day(1), value: "" }]))).toEqual({ set: 2, removed: 0 });
    expect(await db.rosterShift.count({ where: { userId: sita.id, date: day(1), storeId: pkr.id } })).toBe(1); // an empty cell never removes another shop's shift
    expect(await tx((t) => saveWeek(t, mgr, ktm.id, W, [{ userId: ram.id, date: day(0), value: "10-18" }, { userId: sita.id, date: day(0), value: "" }]))).toEqual({ set: 0, removed: 1 });
    await expect(db.rosterShift.create({ data: { storeId: ktm.id, userId: ram.id, date: day(5), start: "18:00", end: "10:00", createdById: mgr.id } })).rejects.toThrow(/RosterShift_times/);
  });

  it("checks the week: hours, no day off, long days, pending leave, short-staffed days (not holidays); shows shifts elsewhere and leave", async () => {
    await tx((t) => setMinStaff(t, mgr, ktm.id, 2));
    await tx((t) => saveHoliday(t, mgr, { date: day(6), name: "Tihar" }));
    await db.leaveRequest.create({ data: { userId: sita.id, type: "HOME", fromDate: day(4), toDate: day(4), days: 1, status: "PENDING" } });
    await tx((t) => saveWeek(t, mgr, pkr.id, W, [{ userId: sita.id, date: day(5), value: "10-18" }]));
    await tx((t) => saveWeek(t, mgr, ktm.id, W, [
      ...[0, 1, 2, 3, 4, 5, 6].map((d) => ({ userId: ram.id, date: day(d), value: "8-17" })), // 63 h, 9 h days, no day off
      ...[0, 1, 2, 3, 4].map((d) => ({ userId: sita.id, date: day(d), value: "10-18" })),
    ]));
    const w = await rosterWeek(ktm.id, W);
    expect(w.rows.map((r) => [r.name, r.minutes / 60])).toEqual([["Manager", 0], ["Ram", 63], ["Sita", 48]]); // Sita: 5 × 8 here + 8 at Pokhara
    expect(w.rows.find((r) => r.name === "Sita")!.days[5]).toMatchObject({ shift: null, elsewhere: "Pokhara shop 10–18" });
    expect(w.rows.find((r) => r.name === "Sita")!.days[4].leave).toBe("leave asked");
    const kinds = w.warnings.map((x) => x.kind);
    expect(kinds.filter((k) => k === "hours")).toHaveLength(1);
    expect(kinds.filter((k) => k === "dayoff")).toHaveLength(1);
    expect(kinds.filter((k) => k === "day")).toHaveLength(7);
    expect(w.warnings.find((x) => x.kind === "pending-leave")!.text).toBe("Sita has asked for leave on Thu");
    expect(w.warnings.filter((x) => x.kind === "short").map((x) => x.text)).toEqual([`Fri ${day(5).slice(5)}: 1 rostered, Kathmandu shop needs 2`]); // Saturday is a holiday
    expect(w.dates[6].holiday).toBe("Tihar");
  });

  it("copy last week, publish, staff see published shifts only, and the overview", async () => {
    const prev = addDays(W, -7);
    await tx((t) => saveWeek(t, mgr, ktm.id, prev, [{ userId: ram.id, date: addDays(prev, 1), value: "10-18" }, { userId: sita.id, date: addDays(prev, 2), value: "12-20" }]));
    await db.leaveRequest.create({ data: { userId: sita.id, type: "HOME", fromDate: day(2), toDate: day(2), days: 1, status: "APPROVED" } });
    expect(await tx((t) => copyPreviousWeek(t, mgr, ktm.id, W))).toEqual({ set: 1, skipped: 1 }); // Sita is on leave that day
    await expect(tx((t) => copyPreviousWeek(t, mgr, pkr.id, W))).rejects.toThrow(/no shifts here to copy/);
    expect(await myShifts(ram.id, W)).toEqual([]); // not published yet
    await expect(tx((t) => publishWeek(t, mgr, pkr.id, W))).rejects.toThrow(/no shifts to publish/);
    await tx((t) => publishWeek(t, mgr, ktm.id, W));
    expect(await myShifts(ram.id, W)).toEqual([{ date: day(1), weekday: "Mon", store: "Kathmandu shop", label: "10–18", holiday: null }]);
    expect((await rosterWeek(ktm.id, W)).changedSincePublish).toBe(false);
    await new Promise((r) => setTimeout(r, 10));
    await tx((t) => saveWeek(t, mgr, ktm.id, W, [{ userId: ram.id, date: day(1), value: "11-19" }]));
    expect((await rosterWeek(ktm.id, W)).changedSincePublish).toBe(true);
    await tx((t) => publishWeek(t, mgr, ktm.id, W));
    expect((await rosterWeek(ktm.id, W)).changedSincePublish).toBe(false);
    await new Promise((r) => setTimeout(r, 10));
    await tx((t) => saveWeek(t, mgr, ktm.id, W, [{ userId: ram.id, date: day(1), value: "" }])); // removing counts too
    expect((await rosterWeek(ktm.id, W)).changedSincePublish).toBe(true);
    await tx((t) => saveWeek(t, mgr, ktm.id, W, [{ userId: ram.id, date: day(1), value: "11-19" }]));
    const ov = await rosterOverview({ all: true }, W);
    expect(ov.map((o) => [o.name, o.shifts, o.published, o.short])).toEqual([["Kathmandu shop", 1, true, 7], ["Pokhara shop", 0, false, 7]]);
  });

  it("compares published shifts with clock-ins: on time, late, left early, no-show, to come", async () => {
    await tx((t) => saveWeek(t, mgr, ktm.id, W, [
      { userId: ram.id, date: day(0), value: "10-18" }, { userId: ram.id, date: day(1), value: "10-18" }, { userId: ram.id, date: day(2), value: "10-18" },
      { userId: sita.id, date: day(0), value: "10-18" }, { userId: sita.id, date: day(4), value: "10-18" },
    ]));
    const t = (date: string, hm: string) => new Date(`${date}T${hm}:00+05:45`);
    await db.attendance.createMany({ data: [
      { userId: ram.id, storeId: ktm.id, clockIn: t(day(0), "09:55"), clockOut: t(day(0), "18:05") },
      { userId: ram.id, storeId: ktm.id, clockIn: t(day(1), "10:25"), clockOut: t(day(1), "18:00") },
      { userId: sita.id, storeId: ktm.id, clockIn: t(day(0), "10:05"), clockOut: t(day(0), "16:00") },
    ] });
    const now = t(day(3), "12:00");
    expect((await rosterVsActual([ktm.id], W, day(6), now)).rows).toHaveLength(0); // not published: nothing to compare
    await tx((x) => publishWeek(x, mgr, ktm.id, W));
    const r = await rosterVsActual([ktm.id], W, day(6), now);
    expect(r.rows.map((x) => [x.name, x.date, x.result, x.lateBy])).toEqual([
      ["Ram", day(0), "on time", 0], ["Sita", day(0), "left early", 5], ["Ram", day(1), "late", 25], ["Ram", day(2), "no-show", null], ["Sita", day(4), "to come", null],
    ]);
    expect(r.people).toEqual([
      { name: "Ram", shifts: 3, onTime: 1, late: 1, early: 0, noShow: 1 },
      { name: "Sita", shifts: 1, onTime: 0, late: 0, early: 1, noShow: 0 },
    ]);
    expect(r.onTimePct).toBe(25);
  });
});
