import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { blocks, loadStarters, mySops, saveSop, signOff, trainingMatrix } from "@/lib/training";
import { STARTER_SOPS } from "@/lib/sop-starters";
import { makeLocation, makeUser, resetDb } from "../support/db";

type U = Awaited<ReturnType<typeof makeUser>>;
const tx = <T,>(f: (t: Parameters<Parameters<typeof db.$transaction>[0]>[0]) => Promise<T>) => db.$transaction(f);

describe("training: procedures with sign-off", () => {
  let owner: U, ram: U, sita: U, hari: U;
  let ktmId: string;
  beforeEach(async () => {
    await resetDb();
    const ktm = await makeLocation({ code: "KTM", name: "Kathmandu shop" });
    const pkr = await makeLocation({ code: "PKR", name: "Pokhara shop" });
    ktmId = ktm.id;
    owner = await makeUser("ADMIN", { name: "Owner" });
    ram = await makeUser("CASHIER", { name: "Ram", locations: [ktm.id] });
    sita = await makeUser("STAFF", { name: "Sita", locations: [ktm.id] });
    hari = await makeUser("CASHIER", { name: "Hari", locations: [pkr.id] });
  });

  it("reads plain text into headings, steps and points", () => {
    expect(blocks("## Before\n1. Count\n2. Open\n- never share logins\nThat's all")).toEqual([
      { kind: "h", text: "Before" }, { kind: "ol", items: ["Count", "Open"] }, { kind: "ul", items: ["never share logins"] }, { kind: "p", text: "That's all" },
    ]);
  });

  it("signing is per version: a real change asks everyone again, a typo fix doesn't", async () => {
    await expect(tx((t) => saveSop(t, owner, { title: "Till", area: "SALES", roles: [], body: "## Steps\n1. Scan everything you sell", major: false }))).rejects.toThrow(/who must sign/);
    const s = await tx((t) => saveSop(t, owner, { title: "Selling at the till", area: "SALES", roles: ["CASHIER"], body: "## Steps\n1. Scan everything you sell", major: false }));
    expect(s.slug).toBe("selling-at-the-till");
    expect((await mySops(ram)).map((x) => [x.title, x.required, x.state])).toEqual([["Selling at the till", true, "todo"]]);
    expect((await mySops(sita))[0].required).toBe(false); // not for fulfilment staff
    await tx((t) => signOff(t, ram, s.id));
    expect((await mySops(ram))[0].state).toBe("signed");
    await tx((t) => saveSop(t, owner, { id: s.id, title: s.title, area: "SALES", roles: ["CASHIER"], body: "## Steps\n1. Scan everything you sell.", major: false }));
    expect((await mySops(ram))[0]).toMatchObject({ state: "signed", version: 1 });
    await tx((t) => saveSop(t, owner, { id: s.id, title: s.title, area: "SALES", roles: ["CASHIER"], body: "## Steps\n1. Scan everything\n2. Ask for the phone number", major: true }));
    expect((await mySops(ram))[0]).toMatchObject({ state: "changed", version: 2 });
    await tx((t) => signOff(t, ram, s.id));
    expect((await mySops(ram))[0].state).toBe("signed");
    await tx((t) => saveSop(t, owner, { id: s.id, title: s.title, area: "SALES", roles: ["CASHIER"], body: "## Steps\n1. Scan everything you sell", major: false, active: false }));
    await expect(tx((t) => signOff(t, hari, s.id))).rejects.toThrow(/isn't in use/);
    expect(await mySops(ram)).toEqual([]);
  });

  it("the matrix shows each person against what their role must sign, scoped to locations", async () => {
    const a = await tx((t) => saveSop(t, owner, { title: "Opening the shop", area: "SALES", roles: ["CASHIER"], body: "1. Count the float and open the shift", major: false }));
    await tx((t) => saveSop(t, owner, { title: "Packing", area: "FULFILMENT", roles: ["STAFF"], body: "1. Scan every item before packing it", major: false }));
    await tx((t) => signOff(t, ram, a.id));
    const m = await trainingMatrix({ all: false, storeIds: [ktmId] });
    expect(m.rows.map((r) => [r.name, r.cells.map((c) => c.state), `${r.done}/${r.of}`])).toEqual([["Ram", ["signed", "n/a"], "1/1"], ["Sita", ["n/a", "todo"], "0/1"]]);
    expect(m.pct).toBe(50);
    expect((await trainingMatrix({ all: true })).rows.map((r) => r.name)).toEqual(["Hari", "Owner", "Ram", "Sita"]);
  });

  it("the starter procedures load once", async () => {
    expect(await tx((t) => loadStarters(t, owner))).toEqual({ added: STARTER_SOPS.length });
    expect(await tx((t) => loadStarters(t, owner))).toEqual({ added: 0 });
    expect((await mySops(ram)).filter((s) => s.required).length).toBeGreaterThanOrEqual(4);
  });
});
