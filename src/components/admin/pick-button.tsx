"use client";

import { useTransition } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { pickOrder } from "@/actions/admin/locations";

export function PickButton({ orderId, storeId }: { orderId: string; storeId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => start(async () => {
        const r = await pickOrder(orderId, storeId);
        if (!r.ok) toast.error(r.error);
        else toast.success(r.remaining ? "Picked here — other items come from another location" : "Picked — ready to pack");
      })}
      className="flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-line bg-white px-3 text-[13.5px] hover:border-ink disabled:opacity-40 print:hidden"
    >
      <Check className="h-4 w-4" /> {pending ? "Saving…" : "Picked"}
    </button>
  );
}
