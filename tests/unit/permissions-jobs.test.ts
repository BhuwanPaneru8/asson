import { describe, expect, it } from "vitest";
import { can, effectivePermissions, homeFor, JOBS, jobOf, OWNER_ONLY, PERMISSION_INFO, PERMISSIONS } from "@/lib/permissions";

describe("jobs and access", () => {
  it("every permission is described for the team screen, and every job uses only real permissions", () => {
    for (const p of PERMISSIONS) expect(PERMISSION_INFO[p].label.length).toBeGreaterThan(3);
    for (const j of JOBS) for (const p of j.permissions) expect(PERMISSIONS).toContain(p);
  });

  it("only owners can ever manage the team or the system, whatever is added", () => {
    for (const j of JOBS.filter((x) => x.key !== "owner")) for (const p of OWNER_ONLY) expect(j.permissions).not.toContain(p);
    expect(effectivePermissions("MANAGER", "ops-manager", ["team.manage", "system"])).not.toContain("team.manage");
    expect(effectivePermissions("ADMIN", "owner")).toEqual(expect.arrayContaining(["team.manage", "system", "payroll"]));
  });

  it("a job decides what someone sees; the owner can add or take away single areas", () => {
    const buyer = effectivePermissions("MANAGER", "buyer");
    expect(buyer).toEqual(expect.arrayContaining(["catalog.edit", "purchasing", "insights"]));
    expect(buyer).not.toContain("pos.sell");
    expect(buyer).not.toContain("payroll");
    expect(effectivePermissions("MANAGER", "buyer", ["pos.sell"], ["insights"])).toEqual(expect.arrayContaining(["pos.sell", "purchasing"]));
    expect(effectivePermissions("MANAGER", "buyer", [], ["insights"])).not.toContain("insights");
    expect(effectivePermissions("STAFF", "warehouse", [], ["self.time"])).toContain("self.time"); // everyone keeps Today and their own time
    expect(effectivePermissions("STAFF", "warehouse", ["made.up"])).not.toContain("made.up");
    expect(effectivePermissions("CUSTOMER", "owner")).toEqual([]);
  });

  it("people without a job keep the classic set for their role (nobody loses access on upgrade)", () => {
    expect(effectivePermissions("MANAGER", null)).toEqual(PERMISSIONS.filter((p) => can("MANAGER", p)));
    expect(effectivePermissions("CASHIER", null)).toEqual(PERMISSIONS.filter((p) => can("CASHIER", p)));
  });

  it("checks use the person's own access, and they land somewhere they can use", () => {
    const cashier = { role: "CASHIER" as const, permissions: effectivePermissions("CASHIER", "cashier") };
    const care = { role: "STAFF" as const, permissions: effectivePermissions("STAFF", "care") };
    const accountant = { role: "MANAGER" as const, permissions: effectivePermissions("MANAGER", "accountant") };
    expect(can(accountant, "finance")).toBe(true);
    expect(can(accountant, "pos.sell")).toBe(false);
    expect(can(care, "care")).toBe(true);
    expect(can(care, "purchasing")).toBe(false);
    expect(homeFor(cashier)).toBe("/admin/pos");
    expect(homeFor(care)).toBe("/admin");
    expect(homeFor({ role: "STAFF", permissions: ["self.time"] })).toBe("/admin/today");
    expect(jobOf("shop-manager")!.role).toBe("MANAGER");
  });
});
