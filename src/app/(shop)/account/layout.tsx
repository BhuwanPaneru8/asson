import { requireUser } from "@/lib/auth";
import { isStaffRole } from "@/lib/permissions";
import { AccountNav } from "@/components/account/account-nav";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="container-page py-8 md:py-12">
      <div className="mb-8">
        <p className="text-[13px] text-muted">My account</p>
        <h1 className="font-display text-4xl">Hi, {user.name.split(" ")[0]}</h1>
      </div>
      <div className="grid gap-8 md:grid-cols-12">
        <aside className="min-w-0 md:col-span-3"><AccountNav isStaff={isStaffRole(user.role)} /></aside>
        <div className="min-w-0 md:col-span-9">{children}</div>
      </div>
    </div>
  );
}
