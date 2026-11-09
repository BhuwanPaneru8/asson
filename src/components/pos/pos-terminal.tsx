"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Minus, Plus, ScanBarcode, Trash2, X, Printer, Search, Percent, LogOut } from "lucide-react";
import { toast } from "sonner";
import { closeShift, createPosSale, openShift, posLookup, type PosItem } from "@/actions/pos";
import { ReturnPanel } from "./return-panel";
import { PickupPanel } from "./pickup-panel";
import { cn, formatDateTime, formatPrice } from "@/lib/utils";

type Line = PosItem & { quantity: number };
type TenderMethod = "CASH" | "ESEWA_QR" | "KHALTI_QR" | "FONEPAY_QR" | "CARD" | "BANK" | "VOUCHER";
type Tender = { method: TenderMethod; amount: number; tendered?: number; reference?: string };
type Shift = { store: string; openedAt: string; openingFloat: number; expectedCash: number; sales: number; total: number } | null;

const METHODS: { id: TenderMethod; label: string }[] = [
  { id: "CASH", label: "Cash" }, { id: "ESEWA_QR", label: "eSewa QR" }, { id: "KHALTI_QR", label: "Khalti QR" },
  { id: "FONEPAY_QR", label: "Fonepay QR" }, { id: "CARD", label: "Card" }, { id: "BANK", label: "Bank" },
  { id: "VOUCHER", label: "Store credit" },
];
const REASONS = ["Loyal customer", "Damaged / display piece", "Staff purchase", "Bulk purchase", "Price match", "Festival offer", "Other"];
const rupees = (s: string) => Math.round((Number(s.replace(/[^\d.]/g, "")) || 0) * 100);
const newRef = () => `pos-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export function PosTerminal({ cashier, shift, shops }: { cashier: { name: string; discountLimit: number; canApproveReturns: boolean }; shift: Shift; shops: { id: string; name: string }[] }) {
  const [mode, setMode] = useState<"sale" | "return" | "pickup">("sale");
  if (!shift) return <OpenShift name={cashier.name} shops={shops} />;
  return (
    <div>
      <div className="-mx-4 -mt-4 mb-4 flex gap-1 border-b border-line bg-white px-4 md:-mx-8 md:-mt-8 md:px-8">
        {(["sale", "return", "pickup"] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)} className={cn("-mb-px border-b-2 px-4 py-3 text-[14px] font-medium", mode === m ? "border-ink" : "border-transparent text-muted hover:text-ink")}>
            {m === "sale" ? "Sale" : m === "return" ? "Return / exchange" : "Pickups"}
          </button>
        ))}
      </div>
      {mode === "sale" ? <Terminal cashier={cashier} shift={shift} /> : mode === "return" ? <ReturnPanel canApprove={cashier.canApproveReturns} /> : <PickupPanel shop={shift.store} />}
    </div>
  );
}

function OpenShift({ name, shops }: { name: string; shops: { id: string; name: string }[] }) {
  const [float, setFloat] = useState("");
  const [shop, setShop] = useState(shops[0]?.id ?? "");
  const [pending, start] = useTransition();
  return (
    <div className="mx-auto mt-10 max-w-md rounded-lg border border-line bg-white p-8">
      <h1 className="text-[22px] font-semibold">Open your shift</h1>
      <p className="mt-1 text-[14px] text-muted">Hi {name.split(" ")[0]}. Count the cash in the drawer before your first sale.</p>
      <form className="mt-6 space-y-3" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await openShift(Number(float || 0), shop || undefined); if (!r.ok) toast.error(r.error); else toast.success("Shift opened"); }); }}>
        {shops.length > 1 && (
          <label className="block text-[13px] font-medium text-ink-soft">Shop
            <select value={shop} onChange={(e) => setShop(e.target.value)} className="mt-1.5 h-12 w-full rounded-md border border-line bg-white px-3 text-[15px] outline-none focus:border-ink">
              {shops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
        )}
        <label className="block text-[13px] font-medium text-ink-soft">Opening cash (Rs.)
          <input autoFocus value={float} onChange={(e) => setFloat(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder="e.g. 5000" className="mt-1.5 h-12 w-full rounded-md border border-line px-3 text-[18px] tabular-nums outline-none focus:border-ink" />
        </label>
        <button disabled={pending} className="h-12 w-full rounded-md bg-ink text-[15px] font-medium text-white disabled:opacity-50">{pending ? "Opening…" : "Open shift"}</button>
      </form>
    </div>
  );
}

function Terminal({ cashier, shift }: { cashier: { name: string; discountLimit: number; canApproveReturns: boolean }; shift: NonNullable<Shift> }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PosItem[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [discount, setDiscount] = useState<{ type: "PERCENT" | "AMOUNT"; value: string; reason: string } | null>(null);
  const [pin, setPin] = useState("");
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [customer, setCustomer] = useState({ name: "", phone: "" });
  const [receipt, setReceipt] = useState<{ orderId: string; number: string; change: number } | null>(null);
  const [closing, setClosing] = useState(false);
  const [searching, startSearch] = useTransition();
  const [paying, startPay] = useTransition();
  const clientRef = useRef(newRef());
  const scanRef = useRef<HTMLInputElement>(null);

  const subtotal = lines.reduce((s, l) => s + l.price * l.quantity, 0);
  const discountAmount = useMemo(() => {
    if (!discount || !discount.value) return 0;
    const v = Number(discount.value) || 0;
    return discount.type === "PERCENT" ? Math.floor((subtotal * Math.min(v, 100)) / 100 / 100) * 100 : Math.min(Math.round(v * 100), subtotal);
  }, [discount, subtotal]);
  const total = subtotal - discountAmount;
  const discountPct = subtotal ? (discountAmount / subtotal) * 100 : 0;
  const needsPin = discountPct > cashier.discountLimit;
  const paid = tenders.reduce((s, t) => s + t.amount, 0);
  const remaining = total - paid;
  const change = tenders.reduce((s, t) => s + (t.method === "CASH" && t.tendered ? t.tendered - t.amount : 0), 0);

  // keep the scanner input focused so the barcode gun always works
  useEffect(() => { if (!receipt && !closing) scanRef.current?.focus(); }, [receipt, closing, lines.length]);

  const add = (item: PosItem) => {
    if (item.stock <= 0) { toast.error(`${item.name} ${item.size} shows 0 in stock`); return; }
    setLines((ls) => {
      const found = ls.find((l) => l.variantId === item.variantId);
      if (found) {
        if (found.quantity >= item.stock) { toast.error(`Only ${item.stock} in stock`); return ls; }
        return ls.map((l) => (l.variantId === item.variantId ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...ls, { ...item, quantity: 1 }];
    });
    setTenders([]);
  };

  const scan = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    // clear at once so a fast second scan from the barcode gun isn't swallowed by this lookup
    setQuery("");
    startSearch(async () => {
      const found = await posLookup(q);
      if (found.length === 1 && found[0].sku.toLowerCase() === q.toLowerCase()) { add(found[0]); setResults([]); return; }
      if (!found.length) toast.error(`Nothing found for “${q}”`);
      setResults(found);
      setQuery((cur) => cur || q); // name search: keep the words so staff can refine them
    });
  };

  const setQty = (id: string, q: number) => {
    setLines((ls) => ls.flatMap((l) => (l.variantId !== id ? [l] : q <= 0 ? [] : [{ ...l, quantity: Math.min(q, l.stock) }])));
    setTenders([]);
  };

  const addTender = (method: TenderMethod) => {
    if (remaining <= 0) return;
    setTenders((ts) => [...ts, { method, amount: remaining, tendered: method === "CASH" ? remaining : undefined, reference: method === "VOUCHER" ? "" : undefined }]);
  };

  const reset = () => { setLines([]); setDiscount(null); setPin(""); setTenders([]); setCustomer({ name: "", phone: "" }); setResults([]); setQuery(""); clientRef.current = newRef(); };

  const complete = () => startPay(async () => {
    const r = await createPosSale({
      clientRef: clientRef.current,
      lines: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
      discount: discount && discountAmount > 0 ? { type: discount.type, value: Number(discount.value), reason: discount.reason } : null,
      approverPin: needsPin ? pin : undefined,
      tenders: tenders.map((t) => ({ method: t.method, amount: t.amount, tendered: t.tendered, reference: t.reference || undefined })),
      customer: customer.phone || customer.name ? { name: customer.name || undefined, phone: customer.phone } : undefined,
    });
    if (!r.ok) { toast.error(r.error); return; }
    setReceipt({ orderId: r.orderId, number: r.number, change: r.change });
    reset();
  });

  const canComplete = lines.length > 0 && remaining === 0 && tenders.every((t) => t.method !== "VOUCHER" || !!t.reference?.trim()) && (!discountAmount || (discount?.reason && (!needsPin || /^\d{4,6}$/.test(pin)))) && tenders.every((t) => t.method !== "CASH" || (t.tendered ?? 0) >= t.amount);

  return (
    <div className="-mx-4 -mb-4 flex min-h-[calc(100vh-110px)] flex-col md:-mx-8 md:-mb-8 lg:flex-row">
      {/* Left: scan & search */}
      <section className="flex min-w-0 flex-1 flex-col border-line bg-white lg:border-r">
        <div className="flex items-center justify-between border-b border-line px-5 py-3 text-[13px]">
          <span className="text-muted">{shift.store} · shift opened {formatDateTime(shift.openedAt)} · {shift.sales} sales · {formatPrice(shift.total)}</span>
          <button onClick={() => setClosing(true)} className="flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 hover:border-ink"><LogOut className="h-3.5 w-3.5" /> Close shift</button>
        </div>
        <form onSubmit={scan} className="flex gap-2 border-b border-line p-4">
          <div className="relative flex-1">
            <ScanBarcode className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
            <input ref={scanRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Scan barcode or type SKU / product name" aria-label="Scan or search" className="h-12 w-full rounded-md border border-line pl-11 pr-3 text-[16px] outline-none focus:border-ink" autoComplete="off" />
          </div>
          {/* never disable: browsers ignore Enter when the form's submit button is disabled, which would drop fast barcode scans */}
          <button className="flex h-12 items-center gap-2 rounded-md bg-ink px-5 text-[14px] font-medium text-white" aria-busy={searching}><Search className="h-4 w-4" /> Find</button>
        </form>
        <div className="flex-1 overflow-y-auto p-4">
          {results.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center py-16 text-center text-muted">
              <ScanBarcode className="h-12 w-12" strokeWidth={1.2} />
              <p className="mt-3 text-[15px]">Scan an item, or search by name.</p>
              <p className="text-[13px]">Scanned SKUs are added instantly.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
              {results.map((r) => (
                <button key={r.variantId} onClick={() => add(r)} disabled={r.stock <= 0} className="flex gap-3 rounded-md border border-line p-2.5 text-left hover:border-ink disabled:opacity-40">
                  <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded bg-cloud">{r.image && <Image src={r.image} alt="" fill sizes="48px" className="object-cover" />}</div>
                  <div className="min-w-0 text-[13px]">
                    <p className="line-clamp-2 font-medium leading-snug">{r.name}</p>
                    <p className="text-muted">{r.color} · {r.size}</p>
                    <p className="mt-0.5 flex gap-2"><b className="tabular-nums">{formatPrice(r.price)}</b><span className={cn("tabular-nums", r.stock <= 3 ? "text-warn" : "text-muted")}>{r.stock} in stock</span></p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Right: current sale */}
      <section className="flex w-full flex-col bg-paper lg:w-[440px]">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="text-[15px] font-semibold">Current sale</h2>
          {lines.length > 0 && <button onClick={reset} className="text-[13px] text-muted hover:text-danger">Clear</button>}
        </div>
        <ul className="flex-1 divide-y divide-line overflow-y-auto px-5">
          {lines.length === 0 && <li className="py-10 text-center text-[14px] text-muted">No items yet</li>}
          {lines.map((l) => (
            <li key={l.variantId} className="py-3">
              <div className="flex justify-between gap-3 text-[14px]"><p className="font-medium">{l.name}</p><p className="tabular-nums">{formatPrice(l.price * l.quantity)}</p></div>
              <div className="mt-1 flex items-center justify-between text-[12.5px] text-muted">
                <span>{l.color} · {l.size} · {l.sku}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setQty(l.variantId, l.quantity - 1)} className="flex h-7 w-7 items-center justify-center rounded border border-line bg-white" aria-label="Decrease"><Minus className="h-3 w-3" /></button>
                  <span className="w-6 text-center tabular-nums text-ink">{l.quantity}</span>
                  <button onClick={() => setQty(l.variantId, l.quantity + 1)} className="flex h-7 w-7 items-center justify-center rounded border border-line bg-white" aria-label="Increase"><Plus className="h-3 w-3" /></button>
                  <button onClick={() => setQty(l.variantId, 0)} className="ml-1 flex h-7 w-7 items-center justify-center text-muted hover:text-danger" aria-label={`Remove ${l.name}`}><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <div className="space-y-3 border-t border-line p-5">
          {/* Discount */}
          {!discount ? (
            <button onClick={() => setDiscount({ type: "PERCENT", value: "", reason: "" })} disabled={!lines.length} className="flex items-center gap-1.5 text-[13px] underline underline-offset-4 disabled:opacity-40"><Percent className="h-3.5 w-3.5" /> Add discount</button>
          ) : (
            <div className="space-y-2 rounded-md border border-line bg-white p-3">
              <div className="flex items-center gap-2">
                <select value={discount.type} onChange={(e) => { setDiscount({ ...discount, type: e.target.value as "PERCENT" | "AMOUNT" }); setTenders([]); }} className="h-9 rounded border border-line px-2 text-[13px]" aria-label="Discount type"><option value="PERCENT">%</option><option value="AMOUNT">Rs.</option></select>
                <input value={discount.value} onChange={(e) => { setDiscount({ ...discount, value: e.target.value.replace(/[^\d.]/g, "") }); setTenders([]); }} inputMode="decimal" placeholder="0" aria-label="Discount value" className="h-9 w-20 rounded border border-line px-2 text-[13px] tabular-nums" />
                <select value={discount.reason} onChange={(e) => setDiscount({ ...discount, reason: e.target.value })} className="h-9 flex-1 rounded border border-line px-2 text-[13px]" aria-label="Discount reason"><option value="">Reason…</option>{REASONS.map((r) => <option key={r}>{r}</option>)}</select>
                <button onClick={() => { setDiscount(null); setPin(""); setTenders([]); }} aria-label="Remove discount" className="p-1 text-muted hover:text-ink"><X className="h-4 w-4" /></button>
              </div>
              {needsPin && (
                <div className="flex items-center gap-2 text-[12.5px]">
                  <span className="text-warn">{discountPct.toFixed(1)}% is over your {cashier.discountLimit}% limit — {discountPct > 15 ? "owner" : "manager"} PIN:</span>
                  <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} type="password" inputMode="numeric" aria-label="Approver PIN" className="h-8 w-20 rounded border border-line px-2 tracking-widest" />
                </div>
              )}
            </div>
          )}

          <dl className="space-y-1 text-[14px]">
            <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd className="tabular-nums">{formatPrice(subtotal)}</dd></div>
            {discountAmount > 0 && <div className="flex justify-between text-success"><dt>Discount ({discountPct.toFixed(1)}%)</dt><dd className="tabular-nums">−{formatPrice(discountAmount)}</dd></div>}
            <div className="flex items-baseline justify-between pt-1"><dt className="text-[16px] font-semibold">Total</dt><dd className="text-[26px] font-semibold tabular-nums">{formatPrice(total)}</dd></div>
          </dl>

          {/* Payments */}
          <div className="grid grid-cols-3 gap-1.5">
            {METHODS.map((m) => <button key={m.id} onClick={() => addTender(m.id)} disabled={!lines.length || remaining <= 0} className="h-10 rounded-md border border-line bg-white text-[13px] font-medium hover:border-ink disabled:opacity-40">{m.label}</button>)}
          </div>
          {tenders.length > 0 && (
            <ul className="space-y-1.5">
              {tenders.map((t, i) => (
                <li key={i} className="flex items-center gap-2 rounded-md bg-white p-2 text-[13px]">
                  <span className="w-20 font-medium">{METHODS.find((m) => m.id === t.method)?.label}</span>
                  <input value={t.amount / 100} onChange={(e) => setTenders((ts) => ts.map((x, j) => (j === i ? { ...x, amount: rupees(e.target.value), tendered: x.method === "CASH" ? Math.max(x.tendered ?? 0, rupees(e.target.value)) : undefined } : x)))} inputMode="decimal" aria-label="Amount" className="h-8 w-20 rounded border border-line px-2 tabular-nums" />
                  {t.method === "CASH" ? (
                    <label className="flex items-center gap-1 text-muted">received<input value={(t.tendered ?? 0) / 100} onChange={(e) => setTenders((ts) => ts.map((x, j) => (j === i ? { ...x, tendered: rupees(e.target.value) } : x)))} inputMode="decimal" aria-label="Cash received" className="h-8 w-20 rounded border border-line px-2 tabular-nums text-ink" /></label>
                  ) : (
                    <input value={t.reference ?? ""} onChange={(e) => setTenders((ts) => ts.map((x, j) => (j === i ? { ...x, reference: e.target.value } : x)))} placeholder={t.method === "VOUCHER" ? "Voucher code CR-…" : "Txn ID (optional)"} aria-label="Transaction reference" className="h-8 min-w-0 flex-1 rounded border border-line px-2" />
                  )}
                  <button onClick={() => setTenders((ts) => ts.filter((_, j) => j !== i))} className="ml-auto p-1 text-muted hover:text-danger" aria-label="Remove payment"><X className="h-3.5 w-3.5" /></button>
                </li>
              ))}
            </ul>
          )}
          {lines.length > 0 && (
            <p className={cn("text-[13px] font-medium", remaining === 0 ? "text-success" : "text-warn")}>
              {remaining > 0 ? `Remaining ${formatPrice(remaining)}` : remaining < 0 ? `Over by ${formatPrice(-remaining)} — adjust amounts` : change > 0 ? `Paid · give change ${formatPrice(change)}` : "Paid in full"}
            </p>
          )}

          <details className="text-[13px]">
            <summary className="cursor-pointer text-muted">Customer (optional)</summary>
            <div className="mt-2 flex gap-2">
              <input value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} placeholder="Name" aria-label="Customer name" className="h-9 flex-1 rounded border border-line px-2" />
              <input value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })} placeholder="98XXXXXXXX" inputMode="numeric" aria-label="Customer mobile" className="h-9 w-32 rounded border border-line px-2" />
            </div>
          </details>

          <button onClick={complete} disabled={!canComplete || paying} className="h-14 w-full rounded-md bg-ink text-[16px] font-semibold text-white disabled:opacity-40">
            {paying ? "Completing…" : `Complete sale${total ? ` · ${formatPrice(total)}` : ""}`}
          </button>
        </div>
      </section>

      {receipt && (
        <Modal onClose={() => setReceipt(null)}>
          <p className="text-[13px] uppercase tracking-wider text-success">Sale complete</p>
          <p className="mt-1 text-[26px] font-semibold">{receipt.number}</p>
          {receipt.change > 0 && <p className="mt-3 rounded-md bg-[#fbf1df] p-3 text-[18px] font-semibold text-warn">Give change: {formatPrice(receipt.change)}</p>}
          <div className="mt-6 flex gap-2">
            <a href={`/admin/pos/receipt/${receipt.orderId}`} target="_blank" rel="noreferrer" className="flex h-11 flex-1 items-center justify-center gap-2 rounded-md border border-line hover:border-ink"><Printer className="h-4 w-4" /> Print receipt</a>
            <button autoFocus onClick={() => setReceipt(null)} className="h-11 flex-1 rounded-md bg-ink font-medium text-white">New sale</button>
          </div>
        </Modal>
      )}
      {closing && <CloseShift shift={shift} onClose={() => setClosing(false)} />}
    </div>
  );
}

function CloseShift({ shift, onClose }: { shift: NonNullable<Shift>; onClose: () => void }) {
  const [counted, setCounted] = useState("");
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const diff = counted === "" ? null : rupees(counted) - shift.expectedCash;
  return (
    <Modal onClose={onClose}>
      <h2 className="text-[20px] font-semibold">Close shift</h2>
      <dl className="mt-4 space-y-1.5 text-[14px]">
        <div className="flex justify-between"><dt className="text-muted">Opening cash</dt><dd className="tabular-nums">{formatPrice(shift.openingFloat)}</dd></div>
        <div className="flex justify-between"><dt className="text-muted">Cash sales</dt><dd className="tabular-nums">{formatPrice(shift.expectedCash - shift.openingFloat)}</dd></div>
        <div className="flex justify-between font-semibold"><dt>Expected in drawer</dt><dd className="tabular-nums">{formatPrice(shift.expectedCash)}</dd></div>
      </dl>
      <label className="mt-4 block text-[13px] font-medium text-ink-soft">Cash counted (Rs.)
        <input autoFocus value={counted} onChange={(e) => setCounted(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" className="mt-1.5 h-12 w-full rounded-md border border-line px-3 text-[18px] tabular-nums outline-none focus:border-ink" />
      </label>
      {diff !== null && <p className={cn("mt-2 text-[14px] font-medium", diff === 0 ? "text-success" : "text-danger")}>{diff === 0 ? "✓ Balanced" : `${diff > 0 ? "Over" : "Short"} by ${formatPrice(Math.abs(diff))}`}</p>}
      {diff !== null && diff !== 0 && <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Explain the difference (required)" aria-label="Difference note" className="mt-2 w-full rounded-md border border-line p-2.5 text-[14px]" />}
      <button disabled={pending || counted === ""} onClick={() => start(async () => { const r = await closeShift(Number(counted), note); if (!r.ok) toast.error(r.error); else { toast.success("Shift closed"); onClose(); } })} className="mt-5 h-12 w-full rounded-md bg-ink font-medium text-white disabled:opacity-40">{pending ? "Closing…" : "Close shift"}</button>
    </Modal>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="relative w-full max-w-sm rounded-lg bg-white p-6 shadow-2xl">
        <button onClick={onClose} className="absolute right-3 top-3 p-1 text-muted hover:text-ink" aria-label="Close"><X className="h-5 w-5" /></button>
        {children}
      </div>
    </div>
  );
}
