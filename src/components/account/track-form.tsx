"use client";

import { useActionState, useState } from "react";
import { trackOrder } from "@/actions/track";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { useT } from "@/components/site/i18n-provider";

export function TrackForm() {
  const [state, action, pending] = useActionState(trackOrder, undefined);
  const { t } = useT();
  // controlled, so a lookup that finds nothing keeps what the shopper typed (forms reset after an action)
  const [number, setNumber] = useState("");
  const [contact, setContact] = useState("");
  return (
    <form action={action} className="mt-8 space-y-4">
      {state?.error && <p role="alert" className="bg-[#fbe9e7] p-3 text-[14px] text-danger">{state.error}</p>}
      <Field label={t("track.number")}><Input name="number" value={number} onChange={(e) => setNumber(e.target.value)} placeholder={t("track.ph")} required /></Field>
      <Field label={t("track.contact")}><Input name="contact" value={contact} onChange={(e) => setContact(e.target.value)} autoComplete="tel-national" inputMode="email" autoCapitalize="none" spellCheck={false} required /></Field>
      <Button type="submit" size="lg" className="w-full" loading={pending}>{t("track.submit")}</Button>
    </form>
  );
}
