"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { createPosSale } from "@/actions/pos";
import { reportTillQueue, tillPriceList } from "@/actions/pos-offline";
import { tillDb } from "@/lib/till-db";
import { expired, queueStats, saleInput, syncQueue, unsent, type PriceList, type QueuedSale, type SendResult, type TillRow, type TillSession } from "@/lib/till-offline";

const REFRESH_MS = 10 * 60_000; // refresh the saved price list this often while online
const PROBE_MS = 15_000; // after a failed request, check the connection this often

const subscribe = (f: () => void) => { window.addEventListener("online", f); window.addEventListener("offline", f); return () => { window.removeEventListener("online", f); window.removeEventListener("offline", f); }; };

/**
 * The till's connection and its offline queue. `online` is false when the browser says so or when a request
 * to the server just failed (a shop router can be "connected" with no internet behind it). Coming back
 * online sends waiting sales, oldest first, then refreshes the price list.
 */
export function useTill(session: TillSession | null, opts: { standalone?: boolean } = {}) {
  const browserOnline = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  const [failedAt, setFailedAt] = useState<number | null>(null);
  const [queue, setQueue] = useState<QueuedSale[]>([]);
  const [priceList, setPriceList] = useState<PriceList | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [waitingForOthers, setWaitingForOthers] = useState(0);
  const busy = useRef(false);
  const online = browserOnline && failedAt == null;
  // the sale counts in the session change after every sale; sending and refreshing follow only who and which shift
  const current = useRef(session);
  useEffect(() => { current.current = session; }, [session]);
  const key = session ? `${session.cashierId}:${session.shift.id}` : null;

  const reload = useCallback(async () => {
    const all = await tillDb.sales();
    const old = expired(all);
    if (old.length) await tillDb.dropSales(old.map((s) => s.clientRef));
    setQueue(all.filter((s) => !old.includes(s)));
    return all.filter((s) => !old.includes(s));
  }, []);

  /** A server call failed with no answer: treat the till as offline until a check gets through. */
  const markOffline = useCallback(() => setFailedAt(Date.now()), []);

  const report = useCallback(async (all: QueuedSale[]) => {
    const session = current.current;
    if (!session) return;
    const deviceId = await tillDb.deviceId();
    const mine = unsent(all).filter((s) => s.cashierId === session.cashierId);
    const shifts = new Set([session.shift.id, ...mine.map((s) => s.shiftId)]);
    for (const shiftId of shifts) {
      const st = queueStats(mine, shiftId);
      await reportTillQueue({ deviceId, shiftId, pending: st.pending, oldestAt: st.oldestAt });
    }
  }, []);

  const refreshPriceList = useCallback(async () => {
    const savedAt = new Date().toISOString();
    const rows: TillRow[] = [];
    let cursor: string | null = null, storeId = "";
    for (let page = 0; page < 200; page++) {
      const r = await tillPriceList(cursor);
      if (!r.ok) return;
      storeId = r.storeId;
      rows.push(...r.rows);
      cursor = r.next;
      if (!cursor) break;
    }
    const list = { storeId, savedAt, rows };
    await tillDb.savePriceList(list);
    setPriceList(list);
  }, []);

  /** Send waiting sales. Returns how many went. Never runs twice at once (and the server records each once anyway). */
  const sync = useCallback(async () => {
    const session = current.current;
    if (!session || busy.current) return 0;
    busy.current = true;
    setSyncing(true);
    try {
      const all = await reload();
      if (!unsent(all).length) { await report(all); return 0; }
      await report(all); // the server learns what this till holds before anything is sent
      const send = async (s: QueuedSale): Promise<SendResult> => {
        try {
          const r = await createPosSale(saleInput(s));
          return r.ok ? { kind: "ok", orderId: r.orderId, number: r.number } : { kind: "rejected", error: r.error };
        } catch {
          return { kind: "network" };
        }
      };
      const res = await syncQueue({ queue: all, cashierId: session.cashierId, send, save: tillDb.saveSale });
      setWaitingForOthers(res.waitingForOthers);
      if (res.stopped) markOffline();
      const after = await reload();
      await report(after).catch(() => undefined);
      if (res.sent) toast.success(`${res.sent} offline sale${res.sent > 1 ? "s" : ""} sent to the server`);
      if (res.failed) toast.error(`${res.failed} offline sale${res.failed > 1 ? "s" : ""} couldn't be recorded. Call your manager.`);
      return res.sent;
    } catch {
      markOffline();
      return 0;
    } finally {
      busy.current = false;
      setSyncing(false);
    }
  }, [reload, report, markOffline]);

  // first load: what this device already holds
  useEffect(() => {
    tillDb.sales().then(setQueue).catch(() => undefined);
    tillDb.priceList().then(setPriceList).catch(() => undefined);
  }, []);

  // the page (online) knows the shift: keep it on the device so a reload with no internet can still sell
  useEffect(() => {
    if (!opts.standalone) void tillDb.saveSession(session).catch(() => undefined);
  }, [session, opts.standalone]);

  // online: send what's waiting, then refresh the price list, and keep it fresh
  useEffect(() => {
    if (!online || !key) return;
    let stop = false;
    const go = async () => {
      try { await sync(); if (!stop) await refreshPriceList(); } catch { if (!stop) markOffline(); }
    };
    void go();
    const t = setInterval(go, REFRESH_MS);
    return () => { stop = true; clearInterval(t); };
  }, [online, key, sync, refreshPriceList, markOffline]);

  // after a failed request: keep checking until the server answers again
  useEffect(() => {
    if (failedAt == null || !browserOnline) return;
    const probe = async () => {
      try {
        const r = await fetch("/api/health", { cache: "no-store" });
        if (r.ok) setFailedAt(null);
      } catch { /* still offline */ }
    };
    const first = setTimeout(probe, 1000); // the browser just said "online": check soon
    const t = setInterval(probe, PROBE_MS);
    return () => { clearTimeout(first); clearInterval(t); };
  }, [failedAt, browserOnline]);

  const saveOffline = useCallback(async (sale: QueuedSale) => {
    await tillDb.saveSale(sale);
    await reload();
  }, [reload]);

  return { online, queue, priceList, syncing, waitingForOthers, markOffline, saveOffline, sync };
}
