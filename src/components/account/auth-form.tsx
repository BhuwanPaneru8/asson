"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { login, register, type AuthState } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

export function AuthForm({ mode, next }: { mode: "login" | "register"; next?: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(mode === "login" ? login : register, undefined);
  const [show, setShow] = useState(false);
  const fe = state?.fieldErrors ?? {};
  const q = next ? `?next=${encodeURIComponent(next)}` : "";

  return (
    <div className="container-page flex justify-center py-12 md:py-20">
      <div className="w-full max-w-[420px]">
        <h1 className="text-center font-display text-4xl">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
        <p className="mt-2 text-center text-[14.5px] text-muted">
          {mode === "login" ? "Sign in to track orders, save favourites and check out faster." : "Faster checkout, order tracking and early access to sales."}
        </p>
        <form action={action} className="mt-8 space-y-4" noValidate>
          <input type="hidden" name="next" value={next ?? ""} />
          {state?.error && <p role="alert" className="bg-[#fbe9e7] p-3 text-[14px] text-danger">{state.error}</p>}
          {mode === "register" && (
            <Field label="Full name" error={fe.name} htmlFor="name"><Input id="name" name="name" autoComplete="name" required aria-invalid={!!fe.name} /></Field>
          )}
          <Field label="Email" error={fe.email} htmlFor="email"><Input id="email" name="email" type="email" autoComplete="email" required aria-invalid={!!fe.email} /></Field>
          {mode === "register" && (
            <Field label="Mobile number (optional)" error={fe.phone} hint="For delivery updates" htmlFor="phone">
              <div className="flex"><span className="flex h-11 items-center border border-r-0 border-line bg-cloud px-3 text-[14px] text-muted">+977</span><Input id="phone" name="phone" inputMode="numeric" maxLength={10} autoComplete="tel-national" aria-invalid={!!fe.phone} /></div>
            </Field>
          )}
          <Field label="Password" error={fe.password} hint={mode === "register" ? "8+ characters, with a letter and a number" : undefined} htmlFor="password">
            <div className="relative">
              <Input id="password" name="password" type={show ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} required aria-invalid={!!fe.password} className="pr-11" />
              <button type="button" onClick={() => setShow(!show)} className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-muted hover:text-ink" aria-label={show ? "Hide password" : "Show password"}>{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
            </div>
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={pending}>{mode === "login" ? "Sign in" : "Create account"}</Button>
        </form>
        <p className="mt-6 text-center text-[14px] text-muted">
          {mode === "login" ? <>New here? <Link href={`/register${q}`} className="font-medium text-ink underline underline-offset-4">Create an account</Link></> : <>Already have an account? <Link href={`/login${q}`} className="font-medium text-ink underline underline-offset-4">Sign in</Link></>}
        </p>
        {mode === "login" && <p className="mt-3 text-center text-[13px] text-muted">Checking out? You can also <Link href="/checkout" className="underline underline-offset-4">continue as a guest</Link>.</p>}
      </div>
    </div>
  );
}
