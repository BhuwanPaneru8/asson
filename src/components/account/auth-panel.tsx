"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { createAccount, identify, resetWithCode, sendCode, signInWithCode, signInWithPassword } from "@/actions/auth";
import { parseIdentifier } from "@/lib/sign-in-shared";
import { PasswordField } from "./password-field";
import { useT } from "@/components/site/i18n-provider";
import { rich } from "@/lib/i18n/rich";
import { cn } from "@/lib/utils";

type Step = "identify" | "password" | "create" | "code" | "forgot" | "reset";
type Who = { identifier: string; kind: "phone" | "email"; exists: boolean; firstName: string | null; codes: boolean; staff: boolean };

const input = "h-12 w-full border border-line bg-white px-3.5 text-[15px] outline-none transition-colors focus:border-ink";
const primary = "flex h-12 w-full items-center justify-center bg-ink text-[15px] font-medium text-white transition-opacity disabled:opacity-40";
const linkBtn = "text-[14px] font-medium underline underline-offset-4 hover:text-accent";

/**
 * One-step sign-in, as fashion shops do it: one field takes a mobile number or an email, then the panel offers
 * what fits that person (a password, a code by SMS, a new account, or a reset). Used on /login and in the
 * header's side drawer. Every rule is enforced on the server; this only guides.
 */
export function AuthPanel({ next = "/account", google = false, support }: { next?: string; google?: boolean; support: { phone: string; whatsapp: string } }) {
  const { t } = useT();
  const [step, setStep] = useState<Step>("identify");
  const [who, setWho] = useState<Who | null>(null);
  const [raw, setRaw] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [code, setCode] = useState("");
  const [testCode, setTestCode] = useState<string | null>(null);
  const [f, setF] = useState({ name: "", email: "", phone: "" });
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const [wait, setWait] = useState(0); // seconds before another code can be asked for
  const headingRef = useRef<HTMLHeadingElement>(null);

  // move focus to each new step's heading, so screen readers and keyboards follow along
  useEffect(() => { if (step !== "identify") headingRef.current?.focus(); }, [step]);
  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  const go = (s: Step) => { setError(null); setFieldErrors({}); setStep(s); };
  const fail = (r: { ok: false; error?: string; fieldErrors?: Record<string, string> }) => { setError(r.error ?? null); setFieldErrors(r.fieldErrors ?? {}); };

  const onIdentify = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!parseIdentifier(raw)) { setError(t("auth.badIdentifier")); return; }
    start(async () => {
      const r = await identify(raw);
      if (!r.ok) { setError(r.error); return; }
      setWho({ identifier: raw, kind: r.kind, exists: r.exists, firstName: r.firstName, codes: r.codes, staff: r.staff });
      go(r.exists ? "password" : "create");
    });
  };

  const askCode = (purpose: "LOGIN" | "RESET", then: Step) => start(async () => {
    const r = await sendCode({ identifier: who!.identifier, purpose });
    if (!r.ok) { setError(r.error); return; }
    setTestCode(r.testCode ?? null);
    setCode("");
    setWait(30);
    go(then);
  });

  const shown = who ? (who.kind === "phone" ? parseIdentifier(who.identifier)?.value ?? who.identifier : who.identifier) : "";
  const back = () => (
    <button type="button" onClick={() => { go("identify"); setPassword(""); }} className="mb-5 inline-flex items-center gap-1.5 text-[13.5px] text-muted hover:text-ink">
      <ArrowLeft className="h-4 w-4" /> {shown} · {t("auth.change")}
    </button>
  );
  const err = () => (error ? <p role="alert" className="text-[14px] text-danger">{error}</p> : null);
  const rememberBox = () => (
    <label className="flex items-center gap-2.5 text-[14px] text-ink-soft">
      <input type="checkbox" className="h-4 w-4 accent-ink" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> {t("auth.remember")}
    </label>
  );
  const testBox = () => (testCode ? <p className="border border-warn/40 bg-warn/10 px-3 py-2 text-[13px] text-ink-soft">{t("auth.testCode", { code: testCode })}</p> : null);
  const heading = "font-display text-[28px] leading-tight outline-none";

  return (
    <div className="w-full" aria-live="polite">
      {step === "identify" && (
        <form onSubmit={onIdentify} className="space-y-4" noValidate>
          <div>
            <label htmlFor="identifier" className="mb-1.5 block text-[13px] font-medium text-ink-soft">{t("auth.identifier")}</label>
            <input id="identifier" name="identifier" className={input} value={raw} onChange={(e) => setRaw(e.target.value)} autoComplete="username" inputMode="email" autoCapitalize="none" spellCheck={false} placeholder="98XXXXXXXX or you@example.com" autoFocus />
          </div>
          {err()}
          <button className={primary} disabled={pending || raw.trim().length < 5}>{pending ? t("auth.wait") : t("auth.continue")}</button>
          {google && (
            <>
              <div className="flex items-center gap-3 text-[12.5px] uppercase tracking-wider text-muted"><span className="h-px flex-1 bg-line" />{t("auth.or")}<span className="h-px flex-1 bg-line" /></div>
              <a href={`/api/auth/google?next=${encodeURIComponent(next)}`} className="flex h-12 w-full items-center justify-center gap-3 border border-line bg-white text-[15px] font-medium hover:border-ink">
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden><path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8z" /><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.8c-1 .7-2.2 1.1-3.7 1.1a6.4 6.4 0 0 1-6-4.4H2.3v2.8A11 11 0 0 0 12 23z" /><path fill="#FBBC05" d="M6 14.2a6.6 6.6 0 0 1 0-4.3V7H2.3a11 11 0 0 0 0 9.9L6 14.2z" /><path fill="#EA4335" d="M12 5.4c1.6 0 3 .6 4.2 1.6l3.1-3.1A11 11 0 0 0 2.3 7L6 9.9a6.4 6.4 0 0 1 6-4.5z" /></svg>
                {t("auth.google")}
              </a>
            </>
          )}
        </form>
      )}

      {step === "password" && who && (
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setError(null); start(async () => { const r = await signInWithPassword({ identifier: who.identifier, password, remember, next }); if (r && !r.ok) fail(r); }); }}>
          {back()}
          <h2 ref={headingRef} tabIndex={-1} className={heading}>{who.firstName ? t("auth.welcomeName", { name: who.firstName }) : t("auth.welcome")}</h2>
          <PasswordField id="password" label={t("auth.password")} value={password} onChange={setPassword} autoFocus />
          {rememberBox()}
          {err()}
          <button className={primary} disabled={pending || !password}>{pending ? t("auth.wait") : t("auth.signIn")}</button>
          <div className="flex flex-wrap justify-between gap-3 pt-1">
            {who.codes && <button type="button" className={linkBtn} disabled={pending} onClick={() => askCode("LOGIN", "code")}>{t("auth.useCode")}</button>}
            <button type="button" className={cn(linkBtn, "text-muted")} onClick={() => go("forgot")}>{t("auth.forgot")}</button>
          </div>
          {who.staff && <p className="text-[12.5px] text-muted">{t("auth.staffNote")}</p>}
        </form>
      )}

      {step === "create" && who && (
        <form className="space-y-4" noValidate onSubmit={(e) => { e.preventDefault(); setError(null); start(async () => { const r = await createAccount({ identifier: who.identifier, name: f.name, email: f.email, phone: f.phone, password, remember, next }); if (r && !r.ok) fail(r); }); }}>
          {back()}
          <h2 ref={headingRef} tabIndex={-1} className={heading}>{t("auth.createTitle")}</h2>
          <p className="-mt-2 text-[14px] text-muted">{t("auth.createBody")}</p>
          <Field id="name" label={t("auth.yourName")} value={f.name} onChange={(v) => setF({ ...f, name: v })} error={fieldErrors.name} autoComplete="name" autoFocus />
          {who.kind === "phone"
            ? <Field id="email" label={t("auth.emailLabel")} type="email" value={f.email} onChange={(v) => setF({ ...f, email: v })} error={fieldErrors.email} autoComplete="email" hint={t("auth.emailHint")} />
            : <Field id="phone" label={t("auth.mobileOptional")} inputMode="numeric" value={f.phone} onChange={(v) => setF({ ...f, phone: v.replace(/\D/g, "").slice(0, 10) })} error={fieldErrors.phone} autoComplete="tel-national" hint={t("auth.mobileHint")} />}
          <PasswordField id="new-password" label={t("auth.password")} value={password} onChange={setPassword} meter autoComplete="new-password" />
          {fieldErrors.password && <p className="-mt-2 text-[13px] text-danger">{fieldErrors.password}</p>}
          {rememberBox()}
          {err()}
          <button className={primary} disabled={pending || f.name.trim().length < 2 || password.length < 8}>{pending ? t("auth.wait") : t("auth.createButton")}</button>
          {who.codes && <button type="button" className={cn(linkBtn, "block")} disabled={pending} onClick={() => askCode("LOGIN", "code")}>{t("auth.codeInstead")}</button>}
          <p className="text-[12.5px] leading-relaxed text-muted">{rich(t("policies.agreeAccount"), { terms: <Link href="/policies/terms" className="underline underline-offset-2">{t("policies.terms")}</Link>, privacy: <Link href="/policies/privacy" className="underline underline-offset-2">{t("policies.privacy")}</Link> })}</p>
        </form>
      )}

      {(step === "code" || step === "reset") && who && (
        <form className="space-y-4" onSubmit={(e) => {
          e.preventDefault(); setError(null);
          start(async () => {
            const r = step === "code"
              ? await signInWithCode({ identifier: who.identifier, code, name: f.name, remember, next })
              : await resetWithCode({ identifier: who.identifier, code, password, next });
            if (r && !r.ok) fail(r);
          });
        }}>
          {back()}
          <h2 ref={headingRef} tabIndex={-1} className={heading}>{step === "code" ? t("auth.codeTitle") : t("auth.forgotTitle")}</h2>
          <p className="-mt-2 text-[14px] text-muted">{t("auth.codeSent", { phone: shown })}</p>
          {testBox()}
          <div>
            <label htmlFor="code" className="mb-1.5 block text-[13px] font-medium text-ink-soft">{t("auth.code")}</label>
            <input id="code" className={cn(input, "text-center text-[22px] tracking-[0.4em] tabular-nums")} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus />
          </div>
          {step === "code" && !who.exists && <Field id="code-name" label={t("auth.yourName")} value={f.name} onChange={(v) => setF({ ...f, name: v })} autoComplete="name" />}
          {step === "reset" && <PasswordField id="reset-password" label={t("reset.new")} value={password} onChange={setPassword} meter autoComplete="new-password" />}
          {step === "code" && rememberBox()}
          {err()}
          <button className={primary} disabled={pending || code.length !== 6 || (step === "reset" && password.length < 8)}>{pending ? t("auth.wait") : step === "code" ? t("auth.continue") : t("reset.save")}</button>
          <button type="button" className={cn(linkBtn, "text-muted disabled:no-underline disabled:opacity-60")} disabled={pending || wait > 0} onClick={() => askCode(step === "code" ? "LOGIN" : "RESET", step)}>
            {wait > 0 ? t("auth.resendIn", { s: wait }) : t("auth.resend")}
          </button>
        </form>
      )}

      {step === "forgot" && who && (
        <div className="space-y-4">
          {back()}
          <h2 ref={headingRef} tabIndex={-1} className={heading}>{t("auth.forgotTitle")}</h2>
          {who.codes ? (
            <>
              <p className="text-[14.5px] text-ink-soft">{t("auth.forgotByCode", { phone: shown })}</p>
              {err()}
              <button type="button" className={primary} disabled={pending} onClick={() => askCode("RESET", "reset")}>{pending ? t("auth.wait") : t("auth.sendCode")}</button>
            </>
          ) : (
            <>
              <p className="text-[14.5px] leading-relaxed text-ink-soft">{who.staff ? t("auth.forgotStaff") : t("auth.forgotCare")}</p>
              {!who.staff && (
                <ul className="space-y-2 text-[14.5px]">
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-success" /> <a href={`tel:+977${support.phone}`} className="font-medium underline underline-offset-4">{support.phone}</a> ({t("auth.callOrWhatsapp")})</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-success" /> <a href={support.whatsapp} target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-4">WhatsApp</a></li>
                </ul>
              )}
            </>
          )}
          <button type="button" className={cn(linkBtn, "text-muted")} onClick={() => go("password")}>{t("auth.backToPassword")}</button>
        </div>
      )}
    </div>
  );
}

function Field({ id, label, value, onChange, error, hint, type = "text", autoComplete, inputMode, autoFocus }: { id: string; label: string; value: string; onChange: (v: string) => void; error?: string; hint?: string; type?: string; autoComplete?: string; inputMode?: "numeric" | "email" | "text"; autoFocus?: boolean }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-ink-soft">{label}</label>
      <input id={id} type={type} className={cn(input, error && "border-danger")} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} inputMode={inputMode} autoFocus={autoFocus} aria-invalid={!!error} aria-describedby={error || hint ? `${id}-note` : undefined} />
      {(error || hint) && <p id={`${id}-note`} className={cn("mt-1.5 text-[12.5px]", error ? "text-danger" : "text-muted")}>{error ?? hint}</p>}
    </div>
  );
}
