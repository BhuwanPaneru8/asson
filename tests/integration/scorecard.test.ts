import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { saveTemplate as saveChecklist, tick } from "@/lib/ops";
import { reportIssue } from "@/lib/issues";
import { openCase } from "@/lib/care";
import { createBrief, review, submit } from "@/lib/vm";
import { answer, saveTemplate as saveVisitTemplate, startVisit, submitVisit } from "@/lib/visits";
import { scorecard, sortRows } from "@/lib/scorecard";
import { ktmDate } from "@/lib/pos";
import { makeLocation, makeUser, resetDb } from "../support/db";

type U = Awaited<ReturnType<typeof makeUser>>;
type L = Awaited<ReturnType<typeof makeLocation>>;

const DAY = 86_400_000;
const ph = (c: string) => `/media/p/${c.repeat(32)}.webp`;

describe("shop scorecard", () => {
  let owner: U, ram: U, hari: U, ktm: L, pkr: L, now: Date;
  beforeEach(async () => {
    await resetDb();
    now = new Date();
    owner = await makeUser("ADMIN", { name: "Owner" });
    ktm = await makeLocation({ code: "KTM", name: "Kathmandu shop" });
    pkr = await makeLocation({ code: "PKR", name: "Pokhara shop" });
    await makeLocation({ code: "WH", name: "Warehouse", kind: "WAREHOUSE" });
    ram = await makeUser("CASHIER", { name: "Ram", locations: [ktm.id] });
    hari = await makeUser("CASHIER", { name: "Hari", locations: [pkr.id] });
  });

  it("brings checklists, displays, visits, issues and care together per shop, with flags and an operations score", async () => {
    // a checklist that has existed for 4 finished days; Kathmandu completed 3 of them, Pokhara 1
    const t = await db.$transaction((tx) => saveChecklist(tx, owner, { name: "Opening", items: ["Lights on"], kind: "SHOP", active: true }));
    await db.checklistTemplate.update({ where: { id: t.id }, data: { createdAt: new Date(now.getTime() - 4 * DAY) } });
    for (const [u, s, n] of [[ram, ktm, 3], [hari, pkr, 1]] as const) for (let d = 1; d <= n; d++) await db.$transaction((tx) => tick(tx, u, { templateId: t.id, storeId: s.id, index: 0, done: true }, ktmDate(new Date(now.getTime() - d * DAY))));
    await db.$transaction((tx) => tick(tx, ram, { templateId: t.id, storeId: ktm.id, index: 0, done: true })); // today doesn't count yet

    // display: Kathmandu approved at 100%; a brief already past due that Pokhara never sent
    const b = await db.$transaction((tx) => createBrief(tx, owner, { title: "Window", instructions: "", refPhotos: [], areas: [{ name: "Window" }], criteria: [{ text: "Matches" }], storeIds: [], dueAt: new Date(now.getTime() + DAY) }));
    const s = await db.$transaction((tx) => submit(tx, ram, { briefId: b.id, storeId: ktm.id, photos: [{ area: "Window", url: ph("a") }] }));
    await db.$transaction((tx) => review(tx, owner, { submissionId: s.id, round: 1, approve: true, scores: [2] }));
    await db.vmBrief.update({ where: { id: b.id }, data: { dueAt: new Date(now.getTime() - DAY) } });

    // visit: Kathmandu 50% with one critical fix, made late
    const vt = await db.$transaction((tx) => saveVisitTemplate(tx, owner, { name: "Visit", active: true, sections: [{ name: "Floor", items: [{ text: "Tidy" }, { text: "Extinguisher", critical: true }] }] }));
    const v = await db.$transaction((tx) => startVisit(tx, owner, { templateId: vt.id, storeId: ktm.id }));
    await db.$transaction((tx) => answer(tx, owner, v.id, 0, { result: "PASS" }));
    await db.$transaction((tx) => answer(tx, owner, v.id, 1, { result: "FAIL", note: "Expired" }));
    await db.$transaction((tx) => submitVisit(tx, owner, v.id, "", new Date(now.getTime() - 5 * DAY)));

    // an urgent issue past due at Pokhara; a customer about Pokhara waiting too long
    await db.$transaction((tx) => reportIssue(tx, hari, { storeId: pkr.id, category: "EQUIPMENT", priority: "URGENT", title: "Till dead", description: "", photos: [] }, new Date(now.getTime() - DAY)));
    await db.$transaction((tx) => openCase(tx, { channel: "SHOP", category: "SERVICE", subject: "Rude", message: "Staff were rude", name: "Maya", phone: "9841234567", storeId: pkr.id }, owner, new Date(now.getTime() - DAY)));

    const rows = await scorecard({ scope: { all: true }, now });
    expect(rows.map((r) => r.name)).toEqual(["Kathmandu shop", "Pokhara shop"]); // shops only
    const [k, p] = rows;
    expect(k).toMatchObject({ checklistsDue: 4, checklistsDone: 3, checklistPct: 75, displayAvg: 100, displaysLate: 0, visitScore: 50, daysSinceVisit: 5, fixesOpen: 1, fixesLate: 1, issuesOpen: 0, careCases: 0 });
    expect(k.opsScore).toBe(75); // (75 + 100 + 50) / 3
    expect(k.flags).toEqual(["1 visit fix late", "checklists 75% done"]);
    expect(p).toMatchObject({ checklistPct: 25, displayAvg: null, displaysLate: 1, visitScore: null, issuesOpen: 1, issuesLate: 1, careCases: 1, careLate: 1, opsScore: 25 });
    expect(p.flags).toEqual(["1 issue overdue", "1 customer waiting too long", "1 display brief late", "never visited", "checklists 25% done"]);

    expect(sortRows(rows, "ops").map((r) => r.name)).toEqual(["Pokhara shop", "Kathmandu shop"]); // worst first
    expect(sortRows(rows, "flags")[0].name).toBe("Pokhara shop");
    expect((await scorecard({ scope: { all: false, storeIds: [pkr.id] }, now })).map((r) => r.name)).toEqual(["Pokhara shop"]);
  });

  it("a shop with nothing yet has no score rather than zero", async () => {
    const [k] = await scorecard({ scope: { all: true }, now });
    expect(k).toMatchObject({ checklistPct: null, displayAvg: null, visitScore: null, opsScore: null, revenue: 0, growth: null });
    expect(k.flags).toEqual(["never visited"]);
  });
});
