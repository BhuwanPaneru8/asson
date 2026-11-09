import type { Prisma } from "@prisma/client";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { formatDate, formatPrice } from "@/lib/utils";
import { AdminPager, Card, PageHeader, Pill, Td, Th } from "@/components/admin/ui";
import { RoleSelect } from "@/components/admin/role-select";
import { StaffLocations } from "@/components/admin/staff-locations";
import { getLocations } from "@/lib/stock";
import { can, ROLE_LABEL } from "@/lib/permissions";

export const metadata = { title: "Customers" };
const TAKE = 30;

export default async function Customers({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; role?: string }> }) {
  await requirePermission("customers");
  const sp = await searchParams;
  const me = await getCurrentUser();
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.UserWhereInput = {};
  if (sp.q) where.OR = [{ email: { contains: sp.q, mode: "insensitive" } }, { name: { contains: sp.q, mode: "insensitive" } }, { phone: { contains: sp.q } }];
  if (sp.role === "staff") where.role = { in: ["CASHIER", "STAFF", "MANAGER", "ADMIN"] };
  const [users, total] = await Promise.all([
    db.user.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * TAKE, take: TAKE, select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true, allLocations: true, locations: { select: { storeId: true } }, _count: { select: { orders: true } } } }),
    db.user.count({ where }),
  ]);
  const locations = users.some((u) => u.role !== "CUSTOMER") ? await getLocations({ includeInactive: true }) : [];
  const spend = await db.order.groupBy({ by: ["userId"], where: { userId: { in: users.map((u) => u.id) }, status: { notIn: ["CANCELLED", "RETURNED"] } }, _sum: { total: true }, _max: { createdAt: true } });
  return (
    <>
      <PageHeader title="Customers" description={`${total.toLocaleString("en-IN" /* lakh grouping, as used in Nepal */)} accounts`} />
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={sp.q} placeholder="Name, email or phone" className="h-10 w-full max-w-xs rounded-md border border-line bg-white px-3 text-[14px] outline-none focus:border-ink" />
        <select name="role" defaultValue={sp.role ?? ""} className="h-10 rounded-md border border-line bg-white px-3 text-[14px]"><option value="">Everyone</option><option value="staff">Team only</option></select>
        <button className="h-10 rounded-md bg-ink px-4 text-[14px] text-white">Search</button>
      </form>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-[14px]">
            <thead className="border-b border-line bg-cloud/40"><tr><Th>Customer</Th><Th>Joined</Th><Th className="text-right">Orders</Th><Th className="text-right">Lifetime spend</Th><Th>Last order</Th><Th>Role</Th><Th>Works at</Th></tr></thead>
            <tbody className="divide-y divide-line">
              {users.map((u) => {
                const s = spend.find((x) => x.userId === u.id);
                return (
                  <tr key={u.id} className="hover:bg-cloud/40">
                    <Td><p className="font-medium">{u.name}</p><p className="text-[12.5px] text-muted">{u.email}{u.phone ? ` · ${u.phone}` : ""}</p></Td>
                    <Td className="whitespace-nowrap text-muted">{formatDate(u.createdAt)}</Td>
                    <Td className="text-right tabular-nums"><a className="hover:underline" href={`/admin/orders?q=${encodeURIComponent(u.email)}`}>{u._count.orders}</a></Td>
                    <Td className="text-right tabular-nums">{formatPrice(s?._sum.total ?? 0)}</Td>
                    <Td className="whitespace-nowrap text-muted">{s?._max.createdAt ? formatDate(s._max.createdAt) : "—"}</Td>
                    <Td>{can(me?.role, "team.manage") && me?.id !== u.id ? <RoleSelect userId={u.id} role={u.role} /> : <Pill>{ROLE_LABEL[u.role]}</Pill>}</Td>
                    <Td>{u.role === "CUSTOMER" ? "" : u.role === "ADMIN" ? <span className="text-[13px] text-muted">Everywhere (owner)</span> : <StaffLocations userId={u.id} all={u.allLocations} assigned={u.locations.map((l) => l.storeId)} locations={locations.map((l) => ({ id: l.id, name: l.name }))} editable={can(me?.role, "team.manage")} />}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <AdminPager page={page} pages={Math.max(1, Math.ceil(total / TAKE))} href={(p) => `/admin/customers?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(sp.role ? { role: sp.role } : {}), page: String(p) })}`} />
      </Card>
    </>
  );
}
