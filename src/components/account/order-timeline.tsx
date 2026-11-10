import type { OrderStatus } from "@prisma/client";
import { Check } from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";
import { makeT, type MessageKey, type T } from "@/lib/i18n";

const DELIVERY_STEPS: { status: OrderStatus; label: MessageKey }[] = [
  { status: "PENDING", label: "status.placed" },
  { status: "CONFIRMED", label: "status.CONFIRMED" },
  { status: "PACKED", label: "status.PACKED" },
  { status: "SHIPPED", label: "status.SHIPPED" },
  { status: "OUT_FOR_DELIVERY", label: "status.OUT_FOR_DELIVERY" },
  { status: "DELIVERED", label: "status.DELIVERED" },
];

const PICKUP_STEPS: { status: OrderStatus; label: MessageKey }[] = [
  { status: "PENDING", label: "status.placed" },
  { status: "CONFIRMED", label: "status.CONFIRMED" },
  { status: "PACKED", label: "status.readyForPickup" },
  { status: "DELIVERED", label: "status.collected" },
];

export function OrderProgress({ status, events, pickup = false, t = makeT("en") }: { status: OrderStatus; events: { status: OrderStatus | null; createdAt: Date | string }[]; pickup?: boolean; t?: T }) {
  const STEPS = pickup ? PICKUP_STEPS : DELIVERY_STEPS;
  if (status === "CANCELLED") return <p className="bg-[#fbe9e7] p-4 text-[14.5px] text-danger">{t("ord.cancelledNote")}</p>;
  const idx = ["RETURN_REQUESTED", "RETURNED"].includes(status) ? STEPS.length - 1 : STEPS.findIndex((s) => s.status === status);
  return (
    <ol className={cn("grid gap-1", pickup ? "grid-cols-4" : "grid-cols-6")}>
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
            <p className={cn("mt-2 text-[11.5px] leading-tight md:text-[13px]", done ? "font-medium" : "text-muted")}>{t(s.label)}</p>
            {at && <p className="mt-0.5 hidden text-[11.5px] text-muted md:block">{formatDateTime(at)}</p>}
          </li>
        );
      })}
    </ol>
  );
}
