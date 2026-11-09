"use client";

import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";
import { updateProfile } from "@/actions/account";
import { changePassword } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function ProfileForms({ user }: { user: { name: string; email: string; phone: string; birthday: string } }) {
  const [name, setName] = useState(user.name);
  const [bMonth, setBMonth] = useState(user.birthday.slice(0, 2));
  const [bDay, setBDay] = useState(user.birthday.slice(3, 5));
  const [phone, setPhone] = useState(user.phone);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const [pw, pwAction, pwPending] = useActionState(async (s: unknown, fd: FormData) => {
    const r = await changePassword(undefined, fd);
    if (r?.ok) toast.success("Password updated. Other devices have been signed out.");
    return r;
  }, undefined);

  return (
    <div className="max-w-xl space-y-12">
      <form onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await updateProfile({ name, phone, birthday: bMonth && bDay ? `${bMonth}-${bDay}` : "" }); if (r.ok) { toast.success("Profile updated"); setErrors({}); } else setErrors(r.fieldErrors ?? {}); }); }} className="space-y-4">
        <h2 className="text-[18px] font-semibold">Personal details</h2>
        <Field label="Full name" error={errors.name}><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Email" hint="Contact support to change your email"><Input value={user.email} disabled /></Field>
        <Field label="Mobile number" error={errors.phone}><Input value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" /></Field>
        <fieldset>
          <legend className="mb-1.5 text-[13.5px] font-medium text-ink-soft">Birthday <span className="font-normal text-muted">(optional: we&apos;ll send you a treat)</span></legend>
          <div className="grid grid-cols-2 gap-3">
            <select value={bMonth} onChange={(e) => setBMonth(e.target.value)} aria-label="Birthday month" className="h-11 border border-line bg-white px-3 text-[15px] outline-none focus:border-ink">
              <option value="">Month</option>{MONTHS.map((m, i) => <option key={m} value={String(i + 1).padStart(2, "0")}>{m}</option>)}
            </select>
            <select value={bDay} onChange={(e) => setBDay(e.target.value)} aria-label="Birthday day" className="h-11 border border-line bg-white px-3 text-[15px] outline-none focus:border-ink">
              <option value="">Day</option>{Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0")).map((d) => <option key={d} value={d}>{Number(d)}</option>)}
            </select>
          </div>
          {errors.birthday && <p className="mt-1 text-[13px] text-danger">{errors.birthday}</p>}
        </fieldset>
        <Button type="submit" loading={pending}>Save changes</Button>
      </form>
      <form action={pwAction} className="space-y-4">
        <h2 className="text-[18px] font-semibold">Change password</h2>
        {pw?.error && <p role="alert" className="bg-[#fbe9e7] p-3 text-[14px] text-danger">{pw.error}</p>}
        <Field label="Current password"><Input name="current" type="password" autoComplete="current-password" required /></Field>
        <Field label="New password" hint="8+ characters with a letter and a number"><Input name="next" type="password" autoComplete="new-password" required /></Field>
        <Button type="submit" variant="secondary" loading={pwPending}>Update password</Button>
      </form>
    </div>
  );
}
