"use client";

import { useActionState } from "react";
import { trackOrder } from "@/actions/track";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

export function TrackForm() {
  const [state, action, pending] = useActionState(trackOrder, undefined);
  return (
    <form action={action} className="mt-8 space-y-4">
      {state?.error && <p role="alert" className="bg-[#fbe9e7] p-3 text-[14px] text-danger">{state.error}</p>}
      <Field label="Order number"><Input name="number" placeholder="e.g. AS000123" required /></Field>
      <Field label="Email"><Input name="email" type="email" autoComplete="email" required /></Field>
      <Button type="submit" size="lg" className="w-full" loading={pending}>Track order</Button>
    </form>
  );
}
