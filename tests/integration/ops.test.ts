import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { acknowledge, announcementsFor, checklistsAt, compliance, publishAnnouncement, readStats, saveTemplate, tick } from "@/lib/ops";
import { makeLocation, makeUser, resetDb } from "../support/db";

type U = Awaited<ReturnType<typeof makeUser>>;
type L = Awaited<ReturnType<typeof makeLocation>>;

describe("shop operations hub", () => {
  let owner: U, ram: U, hari: U, mgr: U, ktm: L, pkr: L, wh: L;
  beforeEach(async () => {
    await resetDb();
    owner = await makeUser("ADMIN");
    ktm = await makeLocation({ code: "KTM", name: "Kathmandu shop" });
    pkr = await makeLocation({ code: "PKR", name: "Pokhara shop" });
    wh = await makeLocation({ code: "WH", name: "Warehouse", kind: "WAREHOUSE" });
    ram = await makeUser("CASHIER", { name: "Ram", locations: [ktm.id] });
    hari = await makeUser("CASHIER", { name: "Hari", locations: [pkr.id] });
    mgr = await makeUser("MANAGER", { name: "Sita", locations: [ktm.id] });
  });

  it("announcements reach the right shops; read receipts; managers only send to their own shops", async () => {
    const all = await db.$transaction((tx) => publishAnnouncement(tx, owner, { title: "Dashain sale starts Friday", body: "20% off kurtas", storeIds: [], requiresAck: true }));
    const pk = await db.$transaction((tx) => publishAnnouncement(tx, owner, { title: "Pokhara: new rack arrives", body: "Tuesday", storeIds: [pkr.id], requiresAck: false }));
    expect((await announcementsFor(ram)).map((a) => a.title)).toEqual(["Dashain sale starts Friday"]);
    expect((await announcementsFor(hari)).map((a) => a.title).sort()).toEqual(["Dashain sale starts Friday", "Pokhara: new rack arrives"]);
    await db.$transaction((tx) => acknowledge(tx, ram, all.id));
    await expect(db.$transaction((tx) => acknowledge(tx, ram, pk.id))).rejects.toThrow(/isn't for your location/);
    expect(await readStats(all.id)).toMatchObject({ read: 1, notRead: expect.arrayContaining(["Hari", "Sita"]) });
    await expect(db.$transaction((tx) => publishAnnouncement(tx, mgr, { title: "x", body: "y", storeIds: [], requiresAck: false }))).rejects.toThrow(/Only HQ/);
    await expect(db.$transaction((tx) => publishAnnouncement(tx, mgr, { title: "x", body: "y", storeIds: [pkr.id], requiresAck: false }))).rejects.toThrow(/only send to locations you work at/);
  });

  it("checklists: shops only, tick at your own shop, two people at once, snapshot, complete", async () => {
    const t = await db.$transaction((tx) => saveTemplate(tx, owner, { name: "Opening", items: ["Lights and music on", "Till float counted", "Floor swept"], kind: "SHOP", dueBy: "10:30", active: true }));
    await expect(db.$transaction((tx) => saveTemplate(tx, mgr, { name: "x", items: ["a"], kind: null, active: true }))).rejects.toThrow(/HQ sets them/);
    expect(await checklistsAt(wh.id)).toEqual([]); // shop checklist doesn't apply to the warehouse
    await expect(db.$transaction((tx) => tick(tx, ram, { templateId: t.id, storeId: pkr.id, index: 0, done: true }))).rejects.toThrow(/not assigned to Pokhara shop/);
    await Promise.all([0, 1].map((i) => db.$transaction((tx) => tick(tx, ram, { templateId: t.id, storeId: ktm.id, index: i, done: true }, "2026-11-10"))));
    let [c] = await checklistsAt(ktm.id, "2026-11-10");
    expect(c).toMatchObject({ done: 2, completedAt: null });
    expect(c.items[0]).toMatchObject({ doneByName: "Ram" });
    // editing the template later doesn't rewrite today's run
    await db.$transaction((tx) => saveTemplate(tx, owner, { id: t.id, name: "Opening", items: ["Only one item now"], kind: "SHOP", dueBy: "10:30", active: true }));
    expect((await checklistsAt(ktm.id, "2026-11-10"))[0].items).toHaveLength(3);
    expect(await db.$transaction((tx) => tick(tx, mgr, { templateId: t.id, storeId: ktm.id, index: 2, done: true }, "2026-11-10"))).toEqual({ done: 3, total: 3, complete: true });
    [c] = await checklistsAt(ktm.id, "2026-11-10");
    expect(c.completedAt).toBeInstanceOf(Date);
  });

  it("compliance: done, not done, late past the due time", async () => {
    const t = await db.$transaction((tx) => saveTemplate(tx, owner, { name: "Opening", items: ["Doors open"], kind: "SHOP", dueBy: "10:30", active: true }));
    await db.checklistRun.create({ data: { templateId: t.id, storeId: ktm.id, date: "2026-11-10", items: [{ text: "Doors open", doneAt: "2026-11-10T04:00:00Z" }], completedAt: new Date("2026-11-10T04:00:00Z") } }); // 09:45 Nepal
    const at11 = new Date("2026-11-10T05:15:00Z"); // 11:00 Nepal
    const c = await compliance("2026-11-10", { all: true }, at11);
    const cell = (storeId: string) => c.rows.find((r) => r.storeId === storeId)!.cells[0];
    expect(cell(ktm.id)).toMatchObject({ done: 1, total: 1, late: false });
    expect(cell(pkr.id)).toMatchObject({ done: 0, late: true });
    expect(cell(wh.id)).toBeNull();
    expect((await compliance("2026-11-10", { all: false, storeIds: [pkr.id] }, at11)).rows.map((r) => r.name)).toEqual(["Pokhara shop"]);
  });
});
