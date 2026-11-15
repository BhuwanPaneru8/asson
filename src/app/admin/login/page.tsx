import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isStaffRole } from "@/lib/permissions";
import { Logo } from "@/components/site/logo";
import { StaffLoginForm } from "./staff-login-form";

export const metadata: Metadata = { title: "Staff sign in", robots: { index: false } };

/**
 * The staff side's own sign-in page. Only staff accounts can sign in here (customers use /login on the shop),
 * and staff can't sign in on the shop. Managers and owners go on to two-step sign-in (/admin/login/two-factor).
 */
export default async function StaffLoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const dest = next?.startsWith("/admin") && !next.startsWith("/admin/login") ? next : "/admin";
  const me = await getCurrentUser();
  if (me && isStaffRole(me.role)) redirect(dest);
  return (
    <main id="main" className="flex min-h-screen items-center justify-center bg-[#f6f5f2] px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Logo />
          <p className="mt-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-accent">Staff</p>
        </div>
        <div className="border border-line bg-white p-8">
          <h1 className="font-display text-3xl">Staff sign in</h1>
          <p className="mb-6 mt-2 text-[14.5px] text-muted">For Asson team members. Use the email or mobile number and password the owner set you up with.</p>
          <StaffLoginForm next={dest} />
        </div>
        <p className="mt-6 text-center text-[13px] text-muted">
          Shopping with us? <a href="/login" className="underline underline-offset-4">Customer sign in</a>
        </p>
      </div>
    </main>
  );
}
