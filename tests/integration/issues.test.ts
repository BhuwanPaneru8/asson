import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { comment, escalateOverdue, issueDetail, issueStats, listIssues, reopenIssue, reportIssue, updateIssue } from "@/lib/issues";
import { makeLocation, makeUser, resetDb } from "../support/db";

type U = Awaited<ReturnType<typeof makeUser>>;
type L = Awaited<ReturnType<typeof makeLocation>>;

const PHOTO = `/media/p/${"a".repeat(32)}.webp`;
const t0 = new Date("2026-11-10T04:00:00Z");
const hours = (h: number) => new Date(t0.getTime() + h * 3_600_000);

describe("shop issue reports", () => {
  let owner: U, ram: U, hari: U, mgr: U, fixer: U, ktm: L, pkr: L;
  beforeEach(async () => {
    await resetDb();
    owner = await makeUser("ADMIN", { name: "Owner" });
    ktm = await makeLocation({ code: "KTM", name: "Kathmandu shop" });
    pkr = await makeLocation({ code: "PKR", name: "Pokhara shop" });
    ram = await makeUser("CASHIER", { name: "Ram", locations: [ktm.id] });
    hari = await makeUser("CASHIER", { name: "Hari", locations: [pkr.id] });
    mgr = await makeUser("MANAGER", { name: "Sita", locations: [ktm.id] });
    fixer = await makeUser("STAFF", { name: "Bikash Maintenance", locations: [pkr.id] });
  });

  const report = (u: U, storeId: string, over: Partial<Parameters<typeof reportIssue>[2]> = {}, at = t0) =>
    db.$transaction((tx) => reportIssue(tx, u, { storeId, category: "EQUIPMENT", priority: "NORMAL", title: "Receipt printer not printing", description: "Since opening", photos: [PHOTO], ...over }, at));

  it("staff report at their own location only; due time from priority; others can't see it", async () => {
    await expect(report(ram, pkr.id)).rejects.toThrow(/not assigned to Pokhara shop/);
    await expect(report(ram, ktm.id, { photos: ["https://evil.example/x.jpg"] })).rejects.toThrow(/photo button/);
    const urgent = await report(ram, ktm.id, { priority: "URGENT", title: "Shutter stuck closed" });
    const normal = await report(ram, ktm.id);
    expect(urgent.dueAt).toEqual(hours(4));
    expect(normal.dueAt).toEqual(hours(48));
    expect(urgent.number).toBeLessThan(normal.number);

    expect((await listIssues(hari)).length).toBe(0);
    expect(await issueDetail(hari, urgent.number)).toBeNull();
    await expect(db.$transaction((tx) => comment(tx, hari, urgent.id, { message: "hi", photos: [] }))).rejects.toThrow(/isn't at your location/);
    // urgent first, for the shop, its manager and HQ
    for (const u of [ram, mgr, owner]) expect((await listIssues(u, {}, hours(1))).map((i) => i.title)).toEqual(["Shutter stuck closed", "Receipt printer not printing"]);
  });

  it("only the manager/HQ assign; the assignee sees it and moves status; resolving needs a note; staff can reopen", async () => {
    const i = await report(hari, pkr.id, { priority: "URGENT" });
    await expect(db.$transaction((tx) => updateIssue(tx, hari, i.id, { status: "IN_PROGRESS" }))).rejects.toThrow(/Only the location's manager/);
    await expect(db.$transaction((tx) => updateIssue(tx, mgr, i.id, { status: "IN_PROGRESS" }))).rejects.toThrow(/isn't at your location/); // Sita manages Kathmandu, not Pokhara
    const shopper = await db.user.create({ data: { email: "shopper@test.local", name: "Shopper", role: "CUSTOMER", passwordHash: "x" } });
    await expect(db.$transaction((tx) => updateIssue(tx, owner, i.id, { assigneeId: shopper.id }))).rejects.toThrow(/active staff/);
    await db.$transaction((tx) => updateIssue(tx, owner, i.id, { assigneeId: fixer.id, status: "IN_PROGRESS", note: "Bikash will come at 2pm" }, hours(1)));

    let d = (await issueDetail(owner, i.number))!;
    expect(d.issue).toMatchObject({ status: "IN_PROGRESS", assigneeId: fixer.id, respondedAt: hours(1) });
    expect(d.issue.events.map((e) => e.message)).toEqual(["Reported", "Being fixed · Assigned to Bikash Maintenance: Bikash will come at 2pm"]);

    await expect(db.$transaction((tx) => updateIssue(tx, fixer, i.id, { cost: 150000 }))).rejects.toThrow(/Only a manager or HQ/);
    await expect(db.$transaction((tx) => updateIssue(tx, fixer, i.id, { status: "RESOLVED" }))).rejects.toThrow(/Say what was done/);
    await db.$transaction((tx) => updateIssue(tx, fixer, i.id, { status: "RESOLVED", note: "Replaced the spring" }, hours(3)));
    await db.$transaction((tx) => updateIssue(tx, owner, i.id, { cost: 150000 }, hours(3)));
    d = (await issueDetail(owner, i.number))!;
    expect(d.issue).toMatchObject({ status: "RESOLVED", resolvedAt: hours(3), cost: 150000 });

    await expect(db.$transaction((tx) => reopenIssue(tx, ram, i.id, "x"))).rejects.toThrow(/isn't at your location/);
    await expect(db.$transaction((tx) => reopenIssue(tx, hari, i.id, " "))).rejects.toThrow(/Say what's still wrong/);
    await db.$transaction((tx) => reopenIssue(tx, hari, i.id, "Stuck again this morning", hours(20)));
    d = (await issueDetail(hari, i.number))!;
    expect(d.issue).toMatchObject({ status: "OPEN", resolvedAt: null, dueAt: hours(24) });
  });

  it("a resolved issue must have a time, and cost can't be negative (database rules)", async () => {
    const i = await report(ram, ktm.id);
    await expect(db.issue.update({ where: { id: i.id }, data: { status: "RESOLVED" } })).rejects.toThrow(/Issue_resolved_has_time/);
    await expect(db.issue.update({ where: { id: i.id }, data: { cost: -1 } })).rejects.toThrow(/Issue_cost_nonneg/);
  });

  it("escalates overdue issues once; changing priority moves the due time", async () => {
    const a = await report(ram, ktm.id, { priority: "URGENT" });
    const b = await report(ram, ktm.id, { priority: "LOW" });
    expect(await escalateOverdue(hours(3))).toEqual({ escalated: 0 });
    expect(await escalateOverdue(hours(5))).toEqual({ escalated: 1 });
    expect(await escalateOverdue(hours(6))).toEqual({ escalated: 0 }); // once
    expect((await db.issue.findUniqueOrThrow({ where: { id: a.id } })).escalatedAt).toEqual(hours(5));
    expect((await listIssues(owner, { overdue: true }, hours(6))).map((i) => i.id)).toEqual([a.id]);

    await db.$transaction((tx) => updateIssue(tx, mgr, b.id, { priority: "URGENT" }, hours(6)));
    expect((await db.issue.findUniqueOrThrow({ where: { id: b.id } })).dueAt).toEqual(hours(4)); // from when it was reported
    expect(await escalateOverdue(hours(7))).toEqual({ escalated: 1 });
  });

  it("two managers changing one issue at once both land on the timeline", async () => {
    const i = await report(ram, ktm.id);
    await Promise.all([
      db.$transaction((tx) => updateIssue(tx, mgr, i.id, { assigneeId: fixer.id })),
      db.$transaction((tx) => updateIssue(tx, owner, i.id, { priority: "URGENT" })),
    ]);
    const d = (await issueDetail(owner, i.number))!;
    expect(d.issue).toMatchObject({ assigneeId: fixer.id, priority: "URGENT" });
    expect(d.issue.events).toHaveLength(3);
  });

  it("comments add photos and count as HQ's response; repeats and per-shop stats", async () => {
    const i = await report(ram, ktm.id, {}, hours(-24 * 3));
    await db.$transaction((tx) => comment(tx, ram, i.id, { message: "Still not printing", photos: [] }));
    expect((await db.issue.findUniqueOrThrow({ where: { id: i.id } })).respondedAt).toBeNull(); // the reporter's own note isn't a response
    await db.$transaction((tx) => comment(tx, mgr, i.id, { message: "Ordered a new one", photos: [`/media/p/${"b".repeat(32)}.jpg`] }, hours(-24 * 2)));
    expect((await db.issue.findUniqueOrThrow({ where: { id: i.id } }))).toMatchObject({ respondedAt: hours(-48), photos: [PHOTO, `/media/p/${"b".repeat(32)}.jpg`] });
    await expect(db.$transaction((tx) => comment(tx, mgr, i.id, { message: " ", photos: [] }))).rejects.toThrow(/Write something/);

    await db.$transaction((tx) => updateIssue(tx, mgr, i.id, { status: "RESOLVED", note: "New printer", cost: 850000 }, hours(-24)));
    const again = await report(ram, ktm.id, { title: "Barcode scanner dead" });
    expect((await issueDetail(ram, again.number))!.repeats).toBe(1);
    await report(hari, pkr.id, { category: "BUILDING", title: "Light flickering" });

    const stats = await issueStats({ all: true }, 30, hours(1));
    expect(stats.find((s) => s.storeId === ktm.id)).toMatchObject({ open: 1, overdue: 0, resolved: 1, medianHours: 48, cost: 850000 });
    expect(stats.find((s) => s.storeId === pkr.id)).toMatchObject({ open: 1, resolved: 0, medianHours: null, cost: 0 });
    expect((await issueStats({ all: false, storeIds: [pkr.id] }, 30, hours(1))).map((s) => s.storeId)).toEqual([pkr.id]);
  });
});
