import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { acknowledge, answer, checkAction, completeAction, discardDraft, saveTemplate, startVisit, submitVisit, visitDetail, visitOverview, visitToDo } from "@/lib/visits";
import { makeLocation, makeUser, resetDb } from "../support/db";

type U = Awaited<ReturnType<typeof makeUser>>;
type L = Awaited<ReturnType<typeof makeLocation>>;

const t0 = new Date("2026-11-10T04:00:00Z");
const days = (n: number) => new Date(t0.getTime() + n * 86_400_000);
const ph = `/media/p/${"e".repeat(32)}.jpg`;

describe("store visit audits", () => {
  let owner: U, area: U, sita: U, ram: U, hari: U, ktm: L, pkr: L, wh: L, tplId: string;
  beforeEach(async () => {
    await resetDb();
    owner = await makeUser("ADMIN", { name: "Owner" });
    ktm = await makeLocation({ code: "KTM", name: "Kathmandu shop" });
    pkr = await makeLocation({ code: "PKR", name: "Pokhara shop" });
    wh = await makeLocation({ code: "WH", name: "Warehouse", kind: "WAREHOUSE" });
    area = await makeUser("MANAGER", { name: "Area Manager", locations: [ktm.id, pkr.id] });
    sita = await makeUser("MANAGER", { name: "Sita", locations: [ktm.id] });
    ram = await makeUser("CASHIER", { name: "Ram", locations: [ktm.id] });
    hari = await makeUser("CASHIER", { name: "Hari", locations: [pkr.id] });
    tplId = (await db.$transaction((tx) => saveTemplate(tx, owner, { name: "Monthly visit", active: true, sections: [
      { name: "Sales floor", items: [{ text: "Rails full, sizes in order" }, { text: "Price tags on every item" }] },
      { name: "Safety", items: [{ text: "Fire extinguisher in date", critical: true }, { text: "" }] },
      { name: "Empty", items: [] },
    ] }))).id;
  });

  const walk = async (u: U, storeId: string, results: ("PASS" | "FAIL" | "NA")[], at = t0) => {
    const v = await db.$transaction((tx) => startVisit(tx, u, { templateId: tplId, storeId }, at));
    for (const [i, r] of results.entries()) await db.$transaction((tx) => answer(tx, u, v.id, i, { result: r, note: r === "FAIL" ? `Problem ${i}` : "" }));
    return v;
  };

  it("templates are HQ's; blank items and empty sections are dropped; items are snapshotted", async () => {
    await expect(db.$transaction((tx) => saveTemplate(tx, area, { name: "x", sections: [{ name: "a", items: [{ text: "b" }] }], active: true }))).rejects.toThrow(/set by HQ/);
    const t = await db.visitTemplate.findUniqueOrThrow({ where: { id: tplId } });
    expect(t.sections).toEqual([{ name: "Sales floor", items: [{ text: "Rails full, sizes in order" }, { text: "Price tags on every item" }] }, { name: "Safety", items: [{ text: "Fire extinguisher in date", critical: true }] }]);
    const v = await db.$transaction((tx) => startVisit(tx, area, { templateId: tplId, storeId: ktm.id }));
    await db.$transaction((tx) => saveTemplate(tx, owner, { id: tplId, name: "Monthly visit", active: true, sections: [{ name: "New", items: [{ text: "Changed" }] }] }));
    expect(((await db.storeVisit.findUniqueOrThrow({ where: { id: v.id } })).items as unknown[]).length).toBe(3);
  });

  it("who can visit; one draft per shop; only the auditor fills it in", async () => {
    await expect(db.$transaction((tx) => startVisit(tx, ram, { templateId: tplId, storeId: ktm.id }))).rejects.toThrow(/Only HQ or an area manager/);
    await expect(db.$transaction((tx) => startVisit(tx, sita, { templateId: tplId, storeId: pkr.id }))).rejects.toThrow(/Only HQ or an area manager/);
    await expect(db.$transaction((tx) => startVisit(tx, owner, { templateId: tplId, storeId: wh.id }))).rejects.toThrow(/active shops/);
    const v = await db.$transaction((tx) => startVisit(tx, area, { templateId: tplId, storeId: ktm.id }));
    await expect(db.$transaction((tx) => startVisit(tx, owner, { templateId: tplId, storeId: ktm.id }))).rejects.toThrow(/Area Manager already has a visit in progress/);
    await expect(db.$transaction((tx) => answer(tx, owner, v.id, 0, { result: "PASS" }))).rejects.toThrow(/Only the person doing the visit/);
    await expect(db.$transaction((tx) => answer(tx, area, v.id, 9, { result: "PASS" }))).rejects.toThrow(/isn't on this visit/);
    await expect(db.$transaction((tx) => answer(tx, area, v.id, 0, { result: "FAIL", photos: ["http://x/y.jpg"] }))).rejects.toThrow(/photo button/);
    await db.$transaction((tx) => discardDraft(tx, area, v.id));
    // the database also refuses a second draft (two taps at once)
    const r = await Promise.allSettled([area, owner].map((u) => db.$transaction((tx) => startVisit(tx, u, { templateId: tplId, storeId: ktm.id }))));
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(await db.storeVisit.count({ where: { status: "DRAFT" } })).toBe(1);
  });

  it("submit needs every answer and a note per fail; score leaves out n/a; fails become actions with deadlines", async () => {
    const v = await db.$transaction((tx) => startVisit(tx, area, { templateId: tplId, storeId: ktm.id }, t0));
    await db.$transaction((tx) => answer(tx, area, v.id, 0, { result: "PASS" }));
    await expect(db.$transaction((tx) => submitVisit(tx, area, v.id, ""))).rejects.toThrow(/2 item\(s\) still to answer/);
    await db.$transaction((tx) => answer(tx, area, v.id, 1, { result: "NA" }));
    await db.$transaction((tx) => answer(tx, area, v.id, 2, { result: "FAIL", photos: [ph] }));
    await expect(db.$transaction((tx) => submitVisit(tx, area, v.id, ""))).rejects.toThrow(/Say what's wrong for 1/);
    await db.$transaction((tx) => answer(tx, area, v.id, 2, { result: "FAIL", note: "Expired in August" }));
    expect((await db.storeVisit.findUniqueOrThrow({ where: { id: v.id } })).items).toMatchObject([{}, {}, { result: "FAIL", note: "Expired in August", photos: [ph] }]); // photo kept
    expect(await db.$transaction((tx) => submitVisit(tx, area, v.id, "Good floor; extinguisher urgent", days(0)))).toEqual({ score: 50, actions: 1 });
    await expect(db.$transaction((tx) => answer(tx, area, v.id, 0, { result: "FAIL" }))).rejects.toThrow(/been submitted/);
    await expect(db.$transaction((tx) => discardDraft(tx, owner, v.id))).rejects.toThrow(/kept/);
    const [a] = await db.visitAction.findMany();
    expect(a).toMatchObject({ text: "Safety: Fire extinguisher in date", note: "Expired in August", critical: true, dueAt: days(2), status: "OPEN" });
    expect(await db.storeVisit.findUniqueOrThrow({ where: { id: v.id } })).toMatchObject({ status: "SUBMITTED", score: 50, criticalFails: 1 });
  });

  it("the shop acknowledges (not the auditor), fixes with proof; someone else verifies or sends it back", async () => {
    const v = await walk(area, ktm.id, ["PASS", "FAIL", "FAIL"]);
    await db.$transaction((tx) => submitVisit(tx, area, v.id, "", t0));
    await expect(db.$transaction((tx) => acknowledge(tx, hari, v.id, ""))).rejects.toThrow(/not assigned to Kathmandu/);
    await expect(db.$transaction((tx) => acknowledge(tx, area, v.id, ""))).rejects.toThrow(/not the auditor/);
    await db.$transaction((tx) => acknowledge(tx, sita, v.id, "Will fix this week", days(0.1)));
    await expect(db.$transaction((tx) => acknowledge(tx, ram, v.id, ""))).rejects.toThrow(/Already acknowledged/);

    const [tags, ext] = await db.visitAction.findMany({ orderBy: { itemIndex: "asc" } });
    expect(tags.dueAt).toEqual(days(7));
    expect((await visitToDo(ktm.id, days(3))).actions.map((x) => [x.text, x.overdue])).toEqual([["Safety: Fire extinguisher in date", true], ["Sales floor: Price tags on every item", false]]);
    await expect(db.$transaction((tx) => completeAction(tx, ram, ext.id, { note: " ", photos: [] }))).rejects.toThrow(/what was done/);
    await db.$transaction((tx) => completeAction(tx, ram, ext.id, { note: "New one installed", photos: [ph] }, days(1)));
    await db.$transaction((tx) => completeAction(tx, sita, tags.id, { note: "Tagged", photos: [] }, days(1)));
    await expect(db.$transaction((tx) => checkAction(tx, ram, ext.id, true))).rejects.toThrow(/Only the auditor, an area manager or HQ/);
    await expect(db.$transaction((tx) => checkAction(tx, sita, tags.id, true))).rejects.toThrow(/Someone else checks a fix you made/);
    await db.$transaction((tx) => checkAction(tx, area, ext.id, true, days(2)));
    await db.$transaction((tx) => checkAction(tx, area, tags.id, false, days(2)));
    expect(await db.visitAction.findUniqueOrThrow({ where: { id: ext.id } })).toMatchObject({ status: "VERIFIED", verifiedAt: days(2) });
    expect(await db.visitAction.findUniqueOrThrow({ where: { id: tags.id } })).toMatchObject({ status: "OPEN", doneAt: null, dueAt: days(9) });
    await expect(db.visitAction.update({ where: { id: tags.id }, data: { status: "DONE" } })).rejects.toThrow(/VisitAction_done/);
  });

  it("overview: last score and trend, open/overdue actions, visit due; who sees a visit", async () => {
    const first = await walk(area, ktm.id, ["PASS", "FAIL", "PASS"], days(-40));
    await db.$transaction((tx) => submitVisit(tx, area, first.id, "", days(-40)));
    const second = await walk(area, ktm.id, ["PASS", "PASS", "PASS"], days(-1));
    await db.$transaction((tx) => submitVisit(tx, area, second.id, "", days(-1)));
    const rows = await visitOverview({ all: true }, t0);
    expect(rows.map((r) => [r.name, r.lastScore, r.prevScore, r.open, r.overdue, r.due])).toEqual([
      ["Kathmandu shop", 100, 67, 1, 1, false], // overdue action sorts first
      ["Pokhara shop", null, null, 0, 0, true], // never visited
    ]);
    expect((await visitOverview({ all: false, storeIds: [pkr.id] }, t0)).map((r) => r.name)).toEqual(["Pokhara shop"]);
    expect(await visitDetail(hari, second.number)).toBeNull();
    expect((await visitDetail(ram, second.number))!).toMatchObject({ isAuditor: false, manages: false, atShop: true });
  });
});
