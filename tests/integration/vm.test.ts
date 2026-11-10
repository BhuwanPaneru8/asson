import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { briefDetail, briefsFor, closeBrief, createBrief, leaderboard, review, submit, vmToDo } from "@/lib/vm";
import { makeLocation, makeUser, resetDb } from "../support/db";

type U = Awaited<ReturnType<typeof makeUser>>;
type L = Awaited<ReturnType<typeof makeLocation>>;

const ph = (c: string) => `/media/p/${c.repeat(32)}.webp`;
const t0 = new Date("2026-11-10T04:00:00Z");
const days = (n: number) => new Date(t0.getTime() + n * 86_400_000);

describe("visual merchandising audits", () => {
  let owner: U, mgr: U, ram: U, hari: U, ktm: L, pkr: L, wh: L;
  beforeEach(async () => {
    await resetDb();
    owner = await makeUser("ADMIN", { name: "Owner" });
    ktm = await makeLocation({ code: "KTM", name: "Kathmandu shop" });
    pkr = await makeLocation({ code: "PKR", name: "Pokhara shop" });
    wh = await makeLocation({ code: "WH", name: "Warehouse", kind: "WAREHOUSE" });
    mgr = await makeUser("MANAGER", { name: "Sita", locations: [ktm.id] });
    ram = await makeUser("CASHIER", { name: "Ram", locations: [ktm.id] });
    hari = await makeUser("CASHIER", { name: "Hari", locations: [pkr.id] });
  });

  const brief = (over: Partial<Parameters<typeof createBrief>[2]> = {}) => db.$transaction((tx) => createBrief(tx, owner, {
    title: "Dashain window", instructions: "Red and gold. Kurtas front left.", refPhotos: [ph("a")],
    areas: [{ name: "Window" }, { name: "Entrance table", hint: "from the door" }], criteria: [{ text: "Colours match" }, { text: "Price tags visible" }],
    storeIds: [], dueAt: days(3), ...over,
  }, t0));
  const both = [{ area: "Window", url: ph("b") }, { area: "Entrance table", url: ph("c") }];

  it("HQ only; shops only; needs shots and criteria", async () => {
    await expect(db.$transaction((tx) => createBrief(tx, mgr, { title: "x", instructions: "", refPhotos: [], areas: [{ name: "W" }], criteria: [{ text: "c" }], storeIds: [ktm.id], dueAt: days(1) }, t0))).rejects.toThrow(/come from HQ/);
    await expect(brief({ storeIds: [wh.id] })).rejects.toThrow(/active shops only/);
    await expect(brief({ areas: [] })).rejects.toThrow(/at least one shot/);
    await expect(brief({ areas: [{ name: "Window" }, { name: "window" }] })).rejects.toThrow(/different name/);
    await expect(brief({ criteria: [] })).rejects.toThrow(/scores/);
    await expect(brief({ dueAt: days(-1) })).rejects.toThrow(/future/);
    await expect(brief({ refPhotos: ["https://x.test/a.jpg"] })).rejects.toThrow(/photo button/);
  });

  it("send → redo → send again → approve with a score; reviewer rules; round guard", async () => {
    const b = await brief({ storeIds: [ktm.id] });
    await expect(db.$transaction((tx) => submit(tx, hari, { briefId: b.id, storeId: pkr.id, photos: both }, t0))).rejects.toThrow(/isn't for Pokhara/);
    await expect(db.$transaction((tx) => submit(tx, ram, { briefId: b.id, storeId: ktm.id, photos: [both[0]] }, t0))).rejects.toThrow(/Add a photo of: Entrance table/);
    await expect(db.$transaction((tx) => submit(tx, ram, { briefId: b.id, storeId: ktm.id, photos: [...both, { area: "Roof", url: ph("d") }] }, t0))).rejects.toThrow(/isn't one of the shots/);

    const s1 = await db.$transaction((tx) => submit(tx, ram, { briefId: b.id, storeId: ktm.id, photos: both, note: "Done before opening" }, days(1)));
    expect(s1).toMatchObject({ round: 1, late: false });
    await expect(db.$transaction((tx) => submit(tx, ram, { briefId: b.id, storeId: ktm.id, photos: both }, days(1)))).rejects.toThrow(/waiting for review/);
    expect(await vmToDo(ktm.id)).toEqual([]);

    await expect(db.$transaction((tx) => review(tx, ram, { submissionId: s1.id, round: 1, approve: false, feedback: "x" }))).rejects.toThrow(/Only HQ or the shop's manager/);
    await expect(db.$transaction((tx) => review(tx, mgr, { submissionId: s1.id, round: 1, approve: false }))).rejects.toThrow(/what to change/);
    await db.$transaction((tx) => review(tx, mgr, { submissionId: s1.id, round: 1, approve: false, feedback: "Tags hidden behind the dupatta" }, days(1)));
    expect((await vmToDo(ktm.id)).map((x) => x.redo)).toEqual([true]);

    const s2 = await db.$transaction((tx) => submit(tx, ram, { briefId: b.id, storeId: ktm.id, photos: both }, days(4)));
    expect(s2).toMatchObject({ id: s1.id, round: 2, late: true });
    await expect(db.$transaction((tx) => review(tx, owner, { submissionId: s1.id, round: 1, approve: true, scores: [2, 2] }))).rejects.toThrow(/sent new photos/);
    await expect(db.$transaction((tx) => review(tx, owner, { submissionId: s1.id, round: 2, approve: true, scores: [2, 3] }))).rejects.toThrow(/0, 1 or 2/);
    await expect(db.$transaction((tx) => review(tx, owner, { submissionId: s1.id, round: 2, approve: true, scores: [2] }))).rejects.toThrow(/0, 1 or 2/);
    expect(await db.$transaction((tx) => review(tx, owner, { submissionId: s1.id, round: 2, approve: true, scores: [2, 1] }, days(4)))).toEqual({ status: "APPROVED", score: 75 });
    await expect(db.$transaction((tx) => submit(tx, ram, { briefId: b.id, storeId: ktm.id, photos: both }))).rejects.toThrow(/Already approved/);

    const d = (await briefDetail(owner, b.number, days(5)))!;
    expect(d.rows.map((r) => [r.store.name, r.sub?.status, r.sub?.score, r.late])).toEqual([["Kathmandu shop", "APPROVED", 75, true]]);
    expect(d.rows[0].sub!.events.map((e) => [e.round, e.status])).toEqual([[1, "SUBMITTED"], [1, "REDO"], [2, "SUBMITTED"], [2, "APPROVED"]]);
  });

  it("nobody reviews their own photos; managers only their shops; database keeps the score honest", async () => {
    const b = await brief();
    const s = await db.$transaction((tx) => submit(tx, mgr, { briefId: b.id, storeId: ktm.id, photos: both }, t0));
    await expect(db.$transaction((tx) => review(tx, mgr, { submissionId: s.id, round: 1, approve: true, scores: [2, 2] }))).rejects.toThrow(/Someone else/);
    const p = await db.$transaction((tx) => submit(tx, hari, { briefId: b.id, storeId: pkr.id, photos: both }, t0));
    await expect(db.$transaction((tx) => review(tx, mgr, { submissionId: p.id, round: 1, approve: true, scores: [2, 2] }))).rejects.toThrow(/Only HQ or the shop's manager/);
    await expect(db.vmSubmission.update({ where: { id: s.id }, data: { status: "APPROVED" } })).rejects.toThrow(/VmSubmission_approved_scored/);
    await expect(db.vmSubmission.update({ where: { id: s.id }, data: { status: "APPROVED", score: 140 } })).rejects.toThrow(/VmSubmission_score_range/);
  });

  it("two people at one shop sending at the same moment: one round, one clear refusal", async () => {
    const b = await brief();
    const r = await Promise.allSettled([ram, mgr].map((u) => db.$transaction((tx) => submit(tx, u, { briefId: b.id, storeId: ktm.id, photos: both }, t0))));
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect((r.find((x) => x.status === "rejected") as PromiseRejectedResult).reason.message).toMatch(/waiting for review/);
    expect(await db.vmSubmission.count()).toBe(1);
  });

  it("who sees what, overview counts, leaderboard and closing", async () => {
    const all = await brief({ title: "Every shop" });
    await brief({ title: "Pokhara only", storeIds: [pkr.id] });
    expect((await briefsFor(ram)).map((b) => b.title)).toEqual(["Every shop"]);
    expect((await briefsFor(hari)).map((b) => b.title).sort()).toEqual(["Every shop", "Pokhara only"]);
    expect(await briefDetail(ram, (await db.vmBrief.findFirstOrThrow({ where: { title: "Pokhara only" } })).number)).toBeNull();

    const k = await db.$transaction((tx) => submit(tx, ram, { briefId: all.id, storeId: ktm.id, photos: both }, t0));
    const p = await db.$transaction((tx) => submit(tx, hari, { briefId: all.id, storeId: pkr.id, photos: both }, days(4)));
    await db.$transaction((tx) => review(tx, owner, { submissionId: k.id, round: 1, approve: true, scores: [2, 2] }, days(1)));
    await db.$transaction((tx) => review(tx, owner, { submissionId: p.id, round: 1, approve: true, scores: [1, 0] }, days(4)));
    const [o] = (await briefsFor(owner, days(5))).filter((b) => b.title === "Every shop");
    expect(o).toMatchObject({ shops: 2, approved: 2, notSent: 0, overdue: true });
    expect((await leaderboard({ all: true }, 90, days(5))).map((r) => [r.name, r.avg, r.late])).toEqual([["Kathmandu shop", 100, 0], ["Pokhara shop", 25, 1]]);
    expect((await leaderboard({ all: false, storeIds: [pkr.id] }, 90, days(5))).map((r) => r.name)).toEqual(["Pokhara shop"]);

    await db.$transaction((tx) => closeBrief(tx, owner, all.id));
    await expect(db.$transaction((tx) => submit(tx, ram, { briefId: all.id, storeId: ktm.id, photos: both }))).rejects.toThrow(/closed/);
    expect(await vmToDo(wh.id)).toEqual([]);
  });
});
