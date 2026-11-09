"use client";

import { useEffect, useRef } from "react";

/** Posts a signed form to the payment gateway as soon as it renders (with a manual fallback button). */
export function AutoPostForm({ action, fields, label }: { action: string; fields: Record<string, string>; label: string }) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { ref.current?.submit(); }, []);
  return (
    <form ref={ref} action={action} method="POST" className="mt-6">
      {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <button className="text-[14px] underline underline-offset-4">{label}</button>
    </form>
  );
}
