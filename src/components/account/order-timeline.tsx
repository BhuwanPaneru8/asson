import type { OrderStatus } from "@prisma/client";
import { Check } from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";

const STEPS: { status: OrderStatus; label: string }[] = [
  { status: "PENDING", label: "Placed" },
  { status: "CONFIRMED", label: "Confirmed" },
  { status: "PACKED", label: "Packed" },
  { status: "SHIPPED", label: "Shipped" },
  { status: "OUT_FOR_DELIVERY", label: "Out for delivery" },
  { status: "DELIVERED", label: "Delivered" },
];

export function OrderProgress({ status, events }: { status: OrderStatus; events: { status: OrderStatus | null; createdAt: Date | string }[] }) {
  if (status === "CANCELLED") return <p className="bg-[#fbe9e7] p-4 text-[14.5px] text-danger">This order was cancelled. Any payment made will be refunded to the original method within 5–7 business days.</p>;
  const idx = ["RETURN_REQUESTED", "RETURNED"].includes(status) ? STEPS.length - 1 : STEPS.findIndex((s) => s.status === status);
  return (
    <ol className="grid grid-cols-6 gap-1">
      {STEPS.map((s, i) => {
        const done = i <= idx;
        const at = events.find((e) => e.status === s.status)?.createdAt;
        return (
          <li key={s.status} className="flex flex-col items-center text-center">
            <div className="flex w-full items-center">
              <span className={cn("h-0.5 flex-1", i === 0 ? "bg-transparent" : i <= idx ? "bg-ink" : "bg-line")} />
              <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2", done ? "border-ink bg-ink text-white" : "border-line bg-white")}>{done && <Check className="h-3.5 w-3.5" strokeWidth={3} />}</span>
              <span className={cn("h-0.5 flex-1", i === STEPS.length - 1 ? "bg-transparent" : i < idx ? "bg-ink" : "bg-line")} />
            </div>
            <p className={cn("mt-2 text-[11.5px] leading-tight md:text-[13px]", done ? "font-medium" : "text-muted")}>{s.label}</p>
            {at && <p className="mt-0.5 hidden text-[11.5px] text-muted md:block">{formatDateTime(at)}</p>}
          </li>
        );
      })}
    </ol>
  );
}
