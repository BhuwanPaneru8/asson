import { beforeEach, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { acceptInvite, addTeamMember, inviteFor, reinvite, removeFromTeam, setAccess } from "@/lib/team";
import { addMember, changeAccess } from "@/actions/admin/team";
import { findApproverByPin } from "@/lib/approvals";
import { attention } from "@/lib/attention";
import { scopeFor } from "@/lib/scope";
import { requirePermission } from "@/lib/auth";
import { actAs, makeLocation, makeUser, resetDb } from "../support/db";

type U = Awaited<ReturnType<typeof makeUser>>;
const tx = <T,>(f: (t: Parameters<Parameters<typeof db.$transaction>[0]>[0]) => Promise<T>) => db.$transaction(f);

describe("team and access", () => {
  let owner: U, ktm: Awaited<ReturnType<typeof makeLocation>>;
  beforeEach(async () => {
    await resetDb();
    owner = await makeUser("ADMIN", { name: "Owner" });
    ktm = await makeLocation({ code: "KTM", name: "Kathmandu shop" });
  });

  it("adds a person with a job and shop; their one-time link sets their own password, once", async () => {
    const { userId, token } = await tx((t) => addTeamMember(t, owner, { name: "Sita Rai", email: "Sita@Asson.test", job: "shop-manager", storeIds: [ktm.id], all: false }));
    const u = await db.user.findUniqueOrThrow({ where: { id: userId }, include: { locations: true } });
    expect(u).toMatchObject({ email: "sita@asson.test", role: "MANAGER", job: "shop-manager", allLocations: false });
    expect(u.locations.map((l) => l.storeId)).toEqual([ktm.id]);
    expect(await inviteFor(token)).toMatchObject({ name: "Sita Rai", job: "Shop manager" });
    await tx((t) => acceptInvite(t, token, "Kathmandu2026"));
    expect(await bcrypt.compare("Kathmandu2026", (await db.user.findUniqueOrThrow({ where: { id: userId } })).passwordHash)).toBe(true);
    await expect(tx((t) => acceptInvite(t, token, "Another2026"))).rejects.toThrow(/expired or was already used/);
    expect(await inviteFor(token)).toBeNull();
    expect(await db.auditLog.count({ where: { action: { in: ["team.add", "team.password"] } } })).toBe(2);
  });

  it("a new link replaces the old one; links expire", async () => {
    const { userId, token } = await tx((t) => addTeamMember(t, owner, { name: "Hari", email: "hari@asson.test", job: "cashier", storeIds: [ktm.id], all: false }));
    const fresh = await tx((t) => reinvite(t, owner, userId));
    expect(await inviteFor(token)).toBeNull();
    expect(await inviteFor(fresh)).not.toBeNull();
    expect(await inviteFor(fresh, new Date(Date.now() + 8 * 86_400_000))).toBeNull();
  });

  it("only the owner manages the team; nobody adds an owner by invite or changes their own access", async () => {
    const manager = await makeUser("MANAGER");
    actAs(manager);
    await expect(addMember({ name: "X Y", email: "x@asson.test", job: "cashier", all: true, storeIds: [] })).rejects.toThrow(/REDIRECT|redirect/i);
    actAs(owner);
    expect(await addMember({ name: "X Y", email: "x@asson.test", job: "owner", all: true, storeIds: [] })).toMatchObject({ ok: false, error: expect.stringMatching(/one at a time/) });
    expect(await changeAccess({ userId: owner.id, job: "cashier", add: [], remove: [] })).toMatchObject({ ok: false, error: expect.stringMatching(/your own access/) });
  });

  it("a job decides what pages and actions someone can use; fine-tuning works per person and is audited", async () => {
    const staff = await makeUser("STAFF", { name: "Bina" });
    await tx((t) => setAccess(t, owner, staff.id, { job: "buyer", add: [], remove: [] }));
    actAs(staff);
    expect((await requirePermission("purchasing")).permissions).toContain("purchasing");
    await expect(requirePermission("pos.sell")).rejects.toThrow();
    await tx((t) => setAccess(t, owner, staff.id, { job: "buyer", add: ["pos.sell", "team.manage"], remove: ["insights"] }));
    expect((await requirePermission("pos.sell")).role).toBe("MANAGER"); // the buyer's level
    await expect(requirePermission("insights")).rejects.toThrow();
    await expect(requirePermission("team.manage")).rejects.toThrow(); // never granted to a non-owner
    const log = await db.auditLog.findFirstOrThrow({ where: { action: "team.access" }, orderBy: { at: "desc" } });
    expect(log.summary).toMatch(/Bina: Buyer \/ merchandiser, plus Sell at the till, without Insights/);
  });

  it("removing someone signs them out everywhere and takes their PIN and shops; the last owner stays", async () => {
    const { userId } = await tx((t) => addTeamMember(t, owner, { name: "Ram", email: "ram@asson.test", job: "cashier", storeIds: [ktm.id], all: false }));
    const before = (await db.user.findUniqueOrThrow({ where: { id: userId } })).tokenVersion;
    await db.user.update({ where: { id: userId }, data: { approvalPinHash: "x" } });
    await tx((t) => removeFromTeam(t, owner, userId, "left on 30 Nov"));
    const u = await db.user.findUniqueOrThrow({ where: { id: userId }, include: { locations: true } });
    expect(u).toMatchObject({ role: "CUSTOMER", job: null, approvalPinHash: null, tokenVersion: before + 1 });
    expect(u.locations).toHaveLength(0);
    await expect(tx((t) => removeFromTeam(t, owner, owner.id, "test"))).rejects.toThrow(/yourself/);
  });

  it("PIN approvals follow the approver's job, not just their level", async () => {
    const accountant = await makeUser("MANAGER", { name: "Accountant" });
    const shopMgr = await makeUser("MANAGER", { name: "Shop manager" });
    await tx((t) => setAccess(t, owner, accountant.id, { job: "accountant", add: [], remove: [] }));
    await tx((t) => setAccess(t, owner, shopMgr.id, { job: "shop-manager", add: [], remove: [] }));
    await db.user.update({ where: { id: accountant.id }, data: { approvalPinHash: await bcrypt.hash("1111", 4) } });
    await db.user.update({ where: { id: shopMgr.id }, data: { approvalPinHash: await bcrypt.hash("2222", 4) } });
    const cashier = await makeUser("CASHIER");
    expect(await findApproverByPin(cashier.id, "1111", "approve.discount")).toMatchObject({ ok: false });
    expect(await findApproverByPin(cashier.id, "2222", "approve.discount")).toMatchObject({ ok: true, approver: { name: "Shop manager" } });
  });

  it("Needs attention shows each person only their job's items", async () => {
    const care = await makeUser("STAFF");
    await tx((t) => setAccess(t, owner, care.id, { job: "care", add: [], remove: [] }));
    await db.statutoryDeposit.count(); // (finance items need finance; care has none)
    actAs(care);
    const me = await requirePermission("care");
    const items = await attention(me, await scopeFor(me));
    expect(items.every((i) => !["bills", "statutory", "vat", "close", "kpi-revenue"].includes(i.key))).toBe(true);
  });
});
