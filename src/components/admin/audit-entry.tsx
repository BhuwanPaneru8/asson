import Link from "next/link";
import type { AuditLog } from "@prisma/client";
import { ShieldAlert } from "lucide-react";
import { auditShow, fieldLabel, redactChanges } from "@/lib/audit";
import { entityHref, SECURITY_ACTIONS } from "@/lib/audit-query";
import { formatDateTime } from "@/lib/utils";

const ROLE: Record<string, string> = { ADMIN: "Owner", MANAGER: "Manager", CASHIER: "Cashier", STAFF: "Staff", CUSTOMER: "Customer", SYSTEM: "System" };

/** Field-by-field detail for an entry's `changes` (before → after pairs, or plain values). */
function Changes({ changes }: { changes: unknown }) {
  if (!changes || typeof changes !== "object") return null;
  const entries = Object.entries(changes as Record<string, unknown>);
  if (!entries.length) return null;
  return (
    <dl className="mt-2 grid gap-x-4 gap-y-1 text-[12.5px] sm:grid-cols-[max-content_1fr]">
      {entries.slice(0, 40).map(([k, v]) => {
        const pair = Array.isArray(v) && v.length === 2 && !Array.isArray(v[0]) && typeof v[0] !== "object";
        return (
          <div key={k} className="contents">
            <dt className="text-muted">{fieldLabel(k)}</dt>
            <dd className="min-w-0 break-words">
              {v === "hidden" ? <span className="text-muted">hidden</span>
                : pair ? <>{auditShow(k, (v as unknown[])[0])} <span className="text-muted">→</span> {auditShow(k, (v as unknown[])[1])}</>
                : typeof v === "object" ? <code className="text-[11.5px]">{JSON.stringify(v).slice(0, 400)}</code>
                : auditShow(k, v)}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

export function AuditRow({ e, canSeeCost, showEntity = true }: { e: AuditLog; canSeeCost: boolean; showEntity?: boolean }) {
  const alert = SECURITY_ACTIONS.includes(e.action);
  const href = showEntity ? entityHref(e.entityType, e.entityId) : null;
  const changes = redactChanges(e.changes, canSeeCost);
  return (
    <li className={`px-5 py-3 ${alert ? "bg-[#fbe9e7]/60" : ""}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="min-w-0 text-[14px]">
          {alert && <ShieldAlert className="mr-1.5 inline h-4 w-4 -translate-y-px text-danger" aria-label="Security alert" />}
          <span className="font-medium">{e.actorName || "System"}</span>
          <span className="text-[12.5px] text-muted"> · {ROLE[e.actorRole] ?? e.actorRole}</span>
        </p>
        <p className="shrink-0 text-[12.5px] tabular-nums text-muted">
          <time dateTime={e.at.toISOString()}>{formatDateTime(e.at)}</time>{e.ip ? ` · ${e.ip}` : ""}
        </p>
      </div>
      <p className="mt-0.5 break-words text-[14px] text-ink-soft">
        {e.summary}
        {href && <> · <Link href={href} className="underline">open</Link></>}
      </p>
      {changes != null && (
        <details className="mt-1 text-[12.5px]">
          <summary className="cursor-pointer text-muted">Details <span className="font-mono">{e.action}</span></summary>
          <Changes changes={changes} />
        </details>
      )}
    </li>
  );
}
