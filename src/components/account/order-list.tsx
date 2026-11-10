import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { OrderStatus } from "@prisma/client";
import { Badge } from "@/components/ui/misc";
import { formatDate, formatOrderNumber, formatPrice } from "@/lib/utils";
import { makeT, type T } from "@/lib/i18n";

type O = { id: string; number: number; status: OrderStatus; total: number; createdAt: Date; items: { image: string; name: string; quantity: number }[] };

export function OrderList({ orders, t = makeT("en") }: { orders: O[]; t?: T }) {
  return (
    <ul className="space-y-3">
      {orders.map((o) => (
        <li key={o.id}>
          <Link href={`/orders/${o.id}`} className="flex items-center gap-4 border border-line bg-white p-4 transition-colors hover:border-ink">
            <div className="flex -space-x-6">
              {o.items.slice(0, 3).map((it, i) => (
                <div key={i} className="relative h-20 w-16 shrink-0 border-2 border-white bg-cloud">{it.image && <Image src={it.image} alt="" fill sizes="64px" className="object-cover" />}</div>
              ))}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{formatOrderNumber(o.number)}</p><Badge tone={o.status === "DELIVERED" ? "success" : o.status === "CANCELLED" ? "danger" : "neutral"}>{t(`status.${o.status}`)}</Badge></div>
              <p className="mt-1 truncate text-[13.5px] text-muted">{o.items.map((i) => i.name).join(", ")}</p>
              <p className="text-[13px] text-muted">{formatDate(o.createdAt)} · {formatPrice(o.total)}</p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-muted" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
