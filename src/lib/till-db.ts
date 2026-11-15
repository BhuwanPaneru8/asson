// The till's offline store in the browser (IndexedDB "asson-till"): the shop's price list, the sales waiting
// to reach the server, and the shift the till is on. Nothing here is cached by the service worker; it lives
// only on this device and is refreshed from the server whenever the till is online. Browser only.
import type { PriceList, QueuedSale, TillSession } from "./till-offline";

const DB = "asson-till";
const SALES = "sales", KV = "kv";

let opening: Promise<IDBDatabase> | null = null;
function open(): Promise<IDBDatabase> {
  opening ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(SALES)) db.createObjectStore(SALES, { keyPath: "clientRef" });
      if (!db.objectStoreNames.contains(KV)) db.createObjectStore(KV);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { opening = null; reject(req.error); };
  });
  return opening;
}

async function run<T>(store: string, mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = f(tx.objectStore(store));
    // resolve when the transaction commits, so a saved sale is really on disk before the receipt shows
    tx.oncomplete = () => resolve(req ? req.result : undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export const tillDb = {
  sales: async () => ((await run<QueuedSale[]>(SALES, "readonly", (s) => s.getAll())) ?? []),
  saveSale: async (sale: QueuedSale) => { await run(SALES, "readwrite", (s) => { s.put(sale); }); },
  dropSales: async (refs: string[]) => { if (refs.length) await run(SALES, "readwrite", (s) => { for (const r of refs) s.delete(r); }); },
  priceList: async () => (await run<PriceList>(KV, "readonly", (s) => s.get("priceList"))) ?? null,
  savePriceList: async (list: PriceList) => { await run(KV, "readwrite", (s) => { s.put(list, "priceList"); }); },
  session: async () => (await run<TillSession>(KV, "readonly", (s) => s.get("session"))) ?? null,
  saveSession: async (session: TillSession | null) => { await run(KV, "readwrite", (s) => { if (session) s.put(session, "session"); else s.delete("session"); }); },
  /** A random id for this till (browser), kept for good. The server keeps how many sales each till holds. */
  deviceId: async () => {
    const have = await run<string>(KV, "readonly", (s) => s.get("deviceId"));
    if (have) return have;
    const id = `till-${crypto.randomUUID()}`;
    await run(KV, "readwrite", (s) => { s.put(id, "deviceId"); });
    return id;
  },
};
