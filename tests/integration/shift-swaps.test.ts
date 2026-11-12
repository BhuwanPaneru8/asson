import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { addDays, publishWeek, saveWeek } from "@/lib/rosters";
import { cancelSwap, decideSwap, offerSwap, respondSwap, swapsFor, swapsToApprove } from "@/lib/shift-swaps";
import { makeLocation, makeUser, resetDb } from "../support/db";

type U = Awaited<ReturnType<typeof makeUser>>;
type L = Awaited<ReturnType<typeof makeLocation>>;
const tx = <T,>(f: (t: Parameters<Parameters<typeof db.$transaction>[0]>[0]) => Promise<T>) => db.$transaction(f);

const W = "2026-11-15"; // a Sunday
const day = (n: number) => addDays(W, n);
const NOW = new Date("2026-11-14T12:00:00+05:45"); // the Saturday before

describe("shift swaps", () => {
  let mgr: U, sita: U, ram: U, gita: U, hari: U, ktm: L, pkr: L;
  beforeEach(async () => {
    await resetDb();
    ktm = await makeLocation({ code: "KTM", name: "Kathmandu shop" });
    pkr = await makeLocation({ code: "PKR", name: "Pokhara shop" });
    mgr = await makeUser("MANAGER", { name: "Manager", locations: [ktm.id, pkr.id] });
    sita = await makeUser("CASHIER", { name: "Sita", locations: [ktm.id] });
    ram = await makeUser("CASHIER", { name: "Ram", locations: [ktm.id] });
    gita = await makeUser("CASHIER", { name: "Gita", locations: [ktm.id, pkr.id] });
    hari = await makeUser("CASHIER", { name: "Hari", locations: [pkr.id] });
    await tx((t) => saveWeek(t, mgr, ktm.id, W, [
      { userId: sita.id, date: day(1), value: "10-18" }, { userId: ram.id, date: day(2), value: "12-20" }, { userId: gita.id, date: day(3), value: "10-18" },
    ]));
  });
  const shiftOf = (u: U, d: number) => db.rosterShift.findFirstOrThrow({ where: { userId: u.id, date: day(d) } });

  it("only published, upcoming shifts of your own, to a colleague who works there, isn't on leave and is free that day", async () => {
    const s = await shiftOf(sita, 1);
    await expect(tx((t) => offerSwap(t, sita, { shiftId: s.id, toUserId: ram.id }, NOW))).rejects.toThrow(/published roster/);
    await tx((t) => publishWeek(t, mgr, ktm.id, W));
    await expect(tx((t) => offerSwap(t, ram, { shiftId: s.id, toUserId: gita.id }, NOW))).rejects.toThrow(/isn't one of your shifts/);
    await expect(tx((t) => offerSwap(t, sita, { shiftId: s.id, toUserId: hari.id }, NOW))).rejects.toThrow(/Hari doesn't work at that location/);
    await db.leaveRequest.create({ data: { userId: ram.id, type: "HOME", fromDate: day(1), toDate: day(1), days: 1, status: "APPROVED" } });
    await expect(tx((t) => offerSwap(t, sita, { shiftId: s.id, toUserId: ram.id }, NOW))).rejects.toThrow(/Ram is on leave on Mon/);
    await tx((t) => saveWeek(t, mgr, pkr.id, W, [{ userId: gita.id, date: day(1), value: "10-18" }]));
    await expect(tx((t) => offerSwap(t, sita, { shiftId: s.id, toUserId: gita.id }, NOW))).rejects.toThrow(/Gita already works Pokhara shop on Mon/);
    await expect(tx((t) => offerSwap(t, sita, { shiftId: s.id, toUserId: ram.id }, new Date(`${day(1)}T10:30:00+05:45`)))).rejects.toThrow(/already started/);
  });

  it("give away: offered, accepted, approved by a manager (not one of the two) — the shift changes hands, re-checked at approval", async () => {
    await tx((t) => publishWeek(t, mgr, ktm.id, W));
    const s = await shiftOf(sita, 1);
    const req = await tx((t) => offerSwap(t, sita, { shiftId: s.id, toUserId: ram.id, note: "family function" }, NOW));
    await expect(tx((t) => offerSwap(t, sita, { shiftId: s.id, toUserId: gita.id }, NOW))).rejects.toThrow(/already a request open/);
    expect((await swapsFor(ram.id, NOW)).forMe.map((r) => [r.from, r.shift, r.note])).toEqual([["Sita", "Kathmandu shop · Mon 11-16 10–18", "family function"]]);
    await expect(tx((t) => decideSwap(t, mgr, req.id, true, "", NOW))).rejects.toThrow(/Ram hasn't accepted yet/);
    await expect(tx((t) => respondSwap(t, gita, req.id, true, NOW))).rejects.toThrow(/isn't for you/);
    await tx((t) => respondSwap(t, ram, req.id, true, NOW));
    expect((await swapsToApprove({ all: false, storeIds: [ktm.id] }, NOW)).map((r) => r.id)).toEqual([req.id]);
    expect(await swapsToApprove({ all: false, storeIds: [pkr.id] }, NOW)).toEqual([]);
    await expect(tx((t) => decideSwap(t, ram, req.id, true, "", NOW))).rejects.toThrow(/not assigned to|Someone else has to approve/);
    await tx((t) => decideSwap(t, mgr, req.id, true, "", NOW));
    expect((await db.rosterShift.findUniqueOrThrow({ where: { id: s.id } })).userId).toBe(ram.id);
    expect(await db.auditLog.findFirst({ where: { action: "roster.swap-approve" } })).toMatchObject({ summary: "Shift swap approved: Mon 11-16 10–18: Sita → Ram" });
    await expect(tx((t) => decideSwap(t, mgr, req.id, true, "", NOW))).rejects.toThrow(/already approved/);
  });

  it("a swap trades the two shifts (different days); if the plan changed in between, approval refuses", async () => {
    await tx((t) => publishWeek(t, mgr, ktm.id, W));
    const a = await shiftOf(sita, 1), b = await shiftOf(ram, 2);
    const req = await tx((t) => offerSwap(t, sita, { shiftId: a.id, toUserId: ram.id, backShiftId: b.id }, NOW));
    await tx((t) => respondSwap(t, ram, req.id, true, NOW));
    await tx((t) => decideSwap(t, mgr, req.id, true, "ok", NOW));
    const after = await db.rosterShift.findMany({ where: { storeId: ktm.id, date: { in: [day(1), day(2)] } }, orderBy: { date: "asc" }, include: { user: { select: { name: true } } } });
    expect(after.map((s) => [s.user.name, s.date, s.start, s.end])).toEqual([["Ram", day(1), "10:00", "18:00"], ["Sita", day(2), "12:00", "20:00"]]);

    // Gita offers her Wednesday to Sita; meanwhile the manager rosters Sita on Wednesday too
    const g = await shiftOf(gita, 3);
    const r2 = await tx((t) => offerSwap(t, gita, { shiftId: g.id, toUserId: sita.id }, NOW));
    await tx((t) => respondSwap(t, sita, r2.id, true, NOW));
    await tx((t) => saveWeek(t, mgr, pkr.id, W, [{ userId: sita.id, date: day(3), value: "9-13" }]).catch(() => null)); // Sita isn't at Pokhara: refused
    await db.staffLocation.create({ data: { userId: sita.id, storeId: pkr.id } });
    await tx((t) => saveWeek(t, mgr, pkr.id, W, [{ userId: sita.id, date: day(3), value: "9-13" }]));
    await expect(tx((t) => decideSwap(t, mgr, r2.id, true, "", NOW))).rejects.toThrow(/Sita already works Pokhara shop on Wed/);
    expect((await db.rosterShift.findUniqueOrThrow({ where: { id: g.id } })).userId).toBe(gita.id);
  });

  it("declining, withdrawing, rejecting with a reason, and changing a shift's times cancels its open request", async () => {
    await tx((t) => publishWeek(t, mgr, ktm.id, W));
    const s = await shiftOf(sita, 1);
    const r1 = await tx((t) => offerSwap(t, sita, { shiftId: s.id, toUserId: ram.id }, NOW));
    await tx((t) => respondSwap(t, ram, r1.id, false, NOW));
    const r2 = await tx((t) => offerSwap(t, sita, { shiftId: s.id, toUserId: ram.id }, NOW)); // free again after a no
    await tx((t) => cancelSwap(t, sita, r2.id));
    const r3 = await tx((t) => offerSwap(t, sita, { shiftId: s.id, toUserId: gita.id }, NOW));
    await tx((t) => respondSwap(t, gita, r3.id, true, NOW));
    await tx((t) => decideSwap(t, mgr, r3.id, false, "short on Monday", NOW));
    expect((await swapsFor(sita.id, NOW)).recent.map((r) => [r.status, r.decisionNote])).toEqual([["REJECTED", "short on Monday"], ["DECLINED", ""]]);
    const r4 = await tx((t) => offerSwap(t, sita, { shiftId: s.id, toUserId: ram.id }, NOW));
    await tx((t) => saveWeek(t, mgr, ktm.id, W, [{ userId: sita.id, date: day(1), value: "11-19" }]));
    expect((await db.shiftSwap.findUniqueOrThrow({ where: { id: r4.id } })).status).toBe("CANCELLED");
    expect((await swapsFor(sita.id, NOW)).colleagues.map((c) => c.name)).toEqual(["Gita", "Manager", "Ram"]);
  });
});
