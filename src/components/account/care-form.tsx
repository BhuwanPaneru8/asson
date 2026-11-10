"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { replyToCareCase, submitCareCase } from "@/actions/care";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { useT } from "@/components/site/i18n-provider";

const CATS = ["ORDER", "DELIVERY", "PAYMENT", "QUALITY", "EXCHANGE", "SERVICE", "OTHER"] as const;
type Cat = (typeof CATS)[number];

export function CareForm({ defaults }: { defaults: { name: string; phone: string; email: string; order: string; category: Cat } }) {
  const { t } = useT();
  const router = useRouter();
  const [f, setF] = useState({ ...defaults, subject: "", message: "", website: "" });
  const [err, setErr] = useState<{ error?: string; fields?: Record<string, string> }>({});
  const [pending, start] = useTransition();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <form
      className="mt-5 grid gap-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await submitCareCase(f);
          if (r.ok) { if (r.token) router.push(`/help/case/${r.token}`); }
          else setErr({ error: r.error, fields: r.fieldErrors });
        });
      }}
    >
      {err.error && !err.fields && <p role="alert" className="bg-[#fbe9e7] p-3 text-[14px] text-danger sm:col-span-2">{err.error}</p>}
      <Field label={t("care.name")} error={err.fields?.name}><Input value={f.name} onChange={set("name")} autoComplete="name" required /></Field>
      <Field label={t("care.phone")} error={err.fields?.phone}><Input value={f.phone} onChange={set("phone")} type="tel" inputMode="tel" autoComplete="tel" placeholder="98XXXXXXXX" required /></Field>
      <Field label={t("care.email")} error={err.fields?.email}><Input value={f.email} onChange={set("email")} type="email" autoComplete="email" /></Field>
      <Field label={t("care.order")} error={err.fields?.order}><Input value={f.order} onChange={set("order")} placeholder="AS000123" /></Field>
      <Field label={t("care.category")} className="sm:col-span-2"><Select value={f.category} onChange={set("category")}>{CATS.map((c) => <option key={c} value={c}>{t(`care.cat.${c}`)}</option>)}</Select></Field>
      <Field label={t("care.subject")} className="sm:col-span-2"><Input value={f.subject} onChange={set("subject")} maxLength={120} /></Field>
      <Field label={t("care.message")} error={err.fields?.message} className="sm:col-span-2"><Textarea value={f.message} onChange={set("message")} rows={5} required /></Field>
      {/* spam trap: hidden from people */}
      <input type="text" name="website" value={f.website} onChange={set("website")} tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      <div className="sm:col-span-2"><Button type="submit" size="lg" loading={pending}>{pending ? t("care.sending") : t("care.send")}</Button></div>
    </form>
  );
}

export function CareReply({ token }: { token: string }) {
  const { t } = useT();
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await replyToCareCase(token, body); if (r.ok) { setBody(""); setError(""); router.refresh(); } else setError(r.error); }); }}>
      {error && <p role="alert" className="bg-[#fbe9e7] p-3 text-[14px] text-danger">{error}</p>}
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder={t("care.replyPlaceholder")} aria-label={t("care.replyPlaceholder")} rows={3} />
      <Button type="submit" loading={pending} disabled={body.trim().length < 2}>{t("care.reply")}</Button>
    </form>
  );
}
