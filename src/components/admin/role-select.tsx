"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { setUserRole } from "@/actions/admin/catalog";
import { ROLE_LABEL, type Role } from "@/lib/permissions";

export function RoleSelect({ userId, role }: { userId: string; role: Role }) {
  const [pending, start] = useTransition();
  return (
    <select disabled={pending} defaultValue={role} aria-label="Role" className="h-8 rounded border border-line bg-white px-1.5 text-[13px]"
      onChange={(e) => {
        const next = e.target.value as typeof role;
        if (next !== "CUSTOMER" && !confirm(`Give this account ${ROLE_LABEL[next]} access to the admin panel?`)) { e.target.value = role; return; }
        start(async () => { const r = await setUserRole(userId, next); if (r.ok) toast.success("Role updated"); else toast.error(r.error); });
      }}>
      {(["CUSTOMER", "CASHIER", "STAFF", "MANAGER", "ADMIN"] as const).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
    </select>
  );
}
