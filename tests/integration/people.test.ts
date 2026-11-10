import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { autoCloseForgotten, balances, cancelLeave, clockIn, clockOut, correctEntry, decideLeave, leaveDays, requestLeave, timesheet } from "@/lib/people";
import { makeLocation, makeUser, resetDb } from "../support/db";

type U = Awaited<ReturnType<typeof makeUser>>;
type L = Awaited<ReturnType<typeof makeLocation>>;
const HOUR = 3_600_000;

describe("attendance and leave", () => {
  let ktm: L, pkr: L, ram: U, sita: U;
  beforeEach(async () => {
    await resetDb();
    ktm = await makeLocation({ code: "KTM", name: "Kathmandu shop" });
    pkr = await makeLocation({ code: "PKR", name: "Pokhara shop" });
    ram = await makeUser("CASHIER", { name: "Ram", locations: [ktm.id] });
    sita = await makeUser("MANAGER", { name: "Sita", locations: [ktm.id] });
  });

  it("clocks in only at your own locations, once at a time, even from two devices", async () => {
    await expect(db.$transaction((tx) => clockIn(tx, ram, pkr.id))).rejects.toThrow(/not assigned to Pokhara shop/);
    const twice = await Promise.allSettled(Array.from({ length: 8 }, () => db.$transaction((tx) => clockIn(tx, ram, ktm.id))));
    expect(twice.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await db.attendance.count({ where: { userId: ram.id, clockOut: null } })).toBe(1);
    // and the database itself refuses a second open entry, even from code that skips the checks
    await expect(db.attendance.create({ data: { userId: ram.id, storeId: ktm.id, clockIn: new Date() } })).rejects.toThrow();
    await db.$transaction((tx) => clockOut(tx, ram));
    await expect(db.$transaction((tx) => clockOut(tx, ram))).rejects.toThrow(/not clocked in/);
  });

  it("forgotten clock-outs are closed at zero and a manager (never you) fixes them, with a reason", async () => {
    const a = await db.attendance.create({ data: { userId: ram.id, storeId: ktm.id, clockIn: new Date(Date.now() - 20 * HOUR) } });
    expect(await autoCloseForgotten()).toEqual({ closed: 1 });
    expect(await db.attendance.findUniqueOrThrow({ where: { id: a.id } })).toMatchObject({ autoClosed: true, clockOut: a.clockIn });
    const fixed = { clockIn: a.clockIn, clockOut: new Date(a.clockIn.getTime() + 8 * HOUR), reason: "forgot, confirmed with CCTV" };
    await expect(db.$transaction((tx) => correctEntry(tx, ram, a.id, fixed))).rejects.toThrow(/Someone else/);
    await db.$transaction((tx) => correctEntry(tx, sita, a.id, fixed));
    expect(await db.attendance.findUniqueOrThrow({ where: { id: a.id } })).toMatchObject({ autoClosed: false, editedById: sita.id });
    expect((await db.auditLog.findFirstOrThrow({ where: { action: "attendance.correct" } })).summary).toMatch(/Ram's hours corrected.*CCTV/);
  });

  it("counts leave days without the weekly day off, and home leave builds up from days worked", async () => {
    expect(leaveDays("2026-11-16", "2026-11-22")).toBe(6); // Mon–Sun, Saturday off
    // 40 working days of 8 h → 2 days of home leave
    const start = new Date("2026-08-01T03:00:00Z").getTime();
    await db.attendance.createMany({ data: Array.from({ length: 40 }, (_, i) => ({ userId: ram.id, storeId: ktm.id, clockIn: new Date(start + i * 24 * HOUR), clockOut: new Date(start + i * 24 * HOUR + 8 * HOUR) })) });
    const b = await balances(db, ram.id, "2026-11-10");
    expect(b.find((x) => x.key === "HOME")).toMatchObject({ entitled: 2, left: 2 });
    expect(b.find((x) => x.key === "SICK")).toMatchObject({ entitled: 12, left: 12 });
    await expect(db.$transaction((tx) => requestLeave(tx, ram, { type: "HOME", from: "2026-11-16", to: "2026-11-18" }, "2026-11-10"))).rejects.toThrow(/Only 2 day\(s\) of home leave left/);
  });

  it("a manager at the same location decides; not your own; the person is texted; overlaps refused", async () => {
    await db.user.update({ where: { id: ram.id }, data: { phone: "9841000001" } });
    const r = await db.$transaction((tx) => requestLeave(tx, ram, { type: "SICK", from: "2026-11-11", to: "2026-11-12", reason: "fever" }, "2026-11-10"));
    expect(r.days).toBe(2);
    await expect(db.$transaction((tx) => requestLeave(tx, ram, { type: "SICK", from: "2026-11-12", to: "2026-11-13" }, "2026-11-10"))).rejects.toThrow(/already have LV-/);

    const far = await makeUser("MANAGER", { name: "Far", locations: [pkr.id] });
    await expect(db.$transaction((tx) => decideLeave(tx, far, r.id, true))).rejects.toThrow(/doesn't work at any of your locations/);
    await db.$transaction((tx) => decideLeave(tx, sita, r.id, true, "get well"));
    expect(await db.leaveRequest.findUniqueOrThrow({ where: { id: r.id } })).toMatchObject({ status: "APPROVED", decidedById: sita.id });
    expect((await db.notification.findFirstOrThrow({ where: { template: "leave_decided" } })).body).toMatch(/sick leave 2026-11-11 to 2026-11-12 was approved/);
    await expect(db.$transaction((tx) => decideLeave(tx, sita, r.id, false))).rejects.toThrow(/already approved/);

    const own = await db.$transaction((tx) => requestLeave(tx, sita, { type: "SICK", from: "2026-11-20", to: "2026-11-20" }, "2026-11-10"));
    await expect(db.$transaction((tx) => decideLeave(tx, sita, own.id, true))).rejects.toThrow(/Someone else/);
    await db.$transaction((tx) => cancelLeave(tx, sita, own.id, "2026-11-10"));
    expect((await db.leaveRequest.findUniqueOrThrow({ where: { id: own.id } })).status).toBe("CANCELLED");
  });

  it("the monthly timesheet: hours, days worked, entries to fix, leave (paid and unpaid)", async () => {
    const d = (s: string) => new Date(s);
    await db.attendance.createMany({ data: [
      { userId: ram.id, storeId: ktm.id, clockIn: d("2026-11-02T03:15:00Z"), clockOut: d("2026-11-02T11:15:00Z") }, // 8 h
      { userId: ram.id, storeId: ktm.id, clockIn: d("2026-11-03T03:15:00Z"), clockOut: d("2026-11-03T05:15:00Z") }, // 2 h: not a full day
      { userId: ram.id, storeId: ktm.id, clockIn: d("2026-11-04T03:15:00Z"), clockOut: d("2026-11-04T03:15:00Z"), autoClosed: true },
    ] });
    await db.leaveRequest.create({ data: { userId: ram.id, type: "UNPAID", fromDate: "2026-11-09", toDate: "2026-11-10", days: 2, status: "APPROVED" } });
    expect(await timesheet("2026-11", { all: true })).toEqual([expect.objectContaining({ name: "Ram", days: 1, minutes: 600, entries: 3, toFix: 1, leaveDays: 2, unpaidLeaveDays: 2 })]);
    expect(await timesheet("2026-11", { all: false, storeIds: [pkr.id] })).toEqual([]);
  });
});
