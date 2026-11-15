"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { tillDb } from "@/lib/till-db";
import type { TillSession } from "@/lib/till-offline";
import { PosTerminal } from "./pos-terminal";

/**
 * The till opened with no internet (the service worker serves this page instead of /admin/pos). The page
 * itself carries no data; the cashier, shift and price list come from this device's IndexedDB.
 */
export function TillShell() {
  const [session, setSession] = useState<TillSession | null | undefined>(undefined);
  useEffect(() => { tillDb.session().then(setSession).catch(() => setSession(null)); }, []);
  if (session === undefined) return <p className="py-16 text-center text-muted">Opening the till…</p>;
  if (!session) {
    return (
      <div className="mx-auto mt-10 max-w-md rounded-lg border border-line bg-white p-8 text-center">
        <p className="text-[18px] font-semibold">No open shift saved on this device</p>
        <p className="mt-2 text-[14px] text-muted">Open your shift on this till while it&apos;s online; after that it keeps selling when the internet drops. Until then, use the paper sales sheet.</p>
        <Link href="/admin/pos" className="mt-6 inline-flex h-11 items-center rounded-md bg-ink px-5 font-medium text-white">Try the till again</Link>
      </div>
    );
  }
  const s = session.shift;
  return (
    <PosTerminal
      standalone
      cashier={{ id: session.cashierId, name: session.cashierName, discountLimit: session.discountLimit, canApproveReturns: false }}
      shift={{ id: s.id, storeId: s.storeId, store: s.store, openedAt: s.openedAt, openingFloat: s.openingFloat, expectedCash: s.expectedCash, sales: s.sales, total: s.total }}
      shops={[]}
    />
  );
}
