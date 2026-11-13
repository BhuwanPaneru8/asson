"use client";

import { useState, useTransition } from "react";
import { setPasswordFromReset } from "@/actions/invite";
import { PasswordField } from "@/components/account/password-field";
import { useT } from "@/components/site/i18n-provider";

export function ResetForm({ token }: { token: string }) {
  const { t } = useT();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form className="mt-6 space-y-4" onSubmit={(e) => { e.preventDefault(); setError(null); start(async () => { const r = await setPasswordFromReset({ token, password, confirm }); if (r && !r.ok) setError(r.error); }); }}>
      <PasswordField id="new-password" label={t("reset.new")} value={password} onChange={setPassword} meter autoComplete="new-password" />
      <PasswordField id="confirm-password" label={t("reset.again")} value={confirm} onChange={setConfirm} autoComplete="new-password" />
      {error && <p role="alert" className="text-[14px] text-danger">{error}</p>}
      <button className="h-12 w-full bg-ink text-[15px] font-medium text-white disabled:opacity-40" disabled={pending || password.length < 8 || !confirm}>{pending ? t("auth.wait") : t("reset.save")}</button>
    </form>
  );
}
