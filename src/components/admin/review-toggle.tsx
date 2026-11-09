"use client";

import { useTransition } from "react";
import { setReviewStatus } from "@/actions/admin/catalog";

export function ReviewToggle({ id, status }: { id: string; status: "PUBLISHED" | "HIDDEN" }) {
  const [pending, start] = useTransition();
  return <button disabled={pending} onClick={() => start(async () => { await setReviewStatus(id, status === "HIDDEN" ? "PUBLISHED" : "HIDDEN"); })} className="h-8 shrink-0 rounded-md border border-line bg-white px-3 text-[13px] hover:border-ink">{status === "HIDDEN" ? "Publish" : "Hide"}</button>;
}
