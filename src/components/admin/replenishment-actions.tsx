"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { draftReplenishment } from "@/actions/admin/replenishment";

export function DraftRouteButton({ routes, label, primary }: { routes: { fromId: string; toId: string }[]; label: string; primary?: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button disabled={pending} onClick={() => start(async () => {
      const r = await draftReplenishment(routes);
      if (r.ok) toast.success(`Drafted ${r.drafted.join(", ")}. Open Transfers to pack and send.`); else toast.error(r.error);
    })} className={primary ? "h-10 rounded-md bg-ink px-4 text-[14px] text-white disabled:opacity-40" : "h-9 rounded-md border border-line bg-white px-3 text-[13.5px] hover:border-ink disabled:opacity-40"}>
      {pending ? "Drafting…" : label}
    </button>
  );
}
