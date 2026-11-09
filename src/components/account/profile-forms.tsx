"use client";

import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";
import { updateProfile } from "@/actions/account";
import { changePassword } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

export function ProfileForms({ user }: { user: { name: string; email: string; phone: string } }) {
  const [name, setName] = useState(user.name);
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
      <form onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await updateProfile({ name, phone }); if (r.ok) { toast.success("Profile updated"); setErrors({}); } else setErrors(r.fieldErrors ?? {}); }); }} className="space-y-4">
        <h2 className="text-[18px] font-semibold">Personal details</h2>
        <Field label="Full name" error={errors.name}><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Email" hint="Contact support to change your email"><Input value={user.email} disabled /></Field>
        <Field label="Mobile number" error={errors.phone}><Input value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" /></Field>
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
