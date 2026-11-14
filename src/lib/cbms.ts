import "server-only";
import { after } from "next/server";
import type { CreditNote, TaxInvoice } from "@prisma/client";
import { db } from "./db";
import { store } from "./config";
import { reportError } from "./errors";

// The IRD's Central Billing Monitoring System (CBMS). Every invoice and credit note gets a CbmsSync row in the
// transaction that issues it (an outbox, like SMS); syncCbms() posts them. OFF by default: with CBMS_MODE unset
// nothing is sent and rows wait as QUEUED, so switching on later posts the backlog (isrealtime = false).
//
// API (IRD "Central Billing Monitoring System API Documentation", updated 2079 Ashoj 28 / 14 Oct 2022):
//   POST {CBMS_URL}/api/bill        sales invoice       POST {CBMS_URL}/api/billreturn   credit note
//   JSON body with username/password/seller_pan (the taxpayer portal login), BS dates "2083.07.29",
//   fiscal_year "2083.084", amounts in rupees. Reply is a bare code: 200 ok, 100 credentials don't match,
//   101 bill already exists (for /bill), 102 exception saving, 103 unknown exception, 104 model invalid,
//   105 bill does not exist (for /billreturn). docs/Tax-Invoices.md has the sources and open questions.
//
// Env (server only, never in code): CBMS_MODE=live (or unset = off), CBMS_USERNAME, CBMS_PASSWORD,
// CBMS_SELLER_PAN, CBMS_URL (default https://cbapi.ird.gov.np). Tests register a provider in `cbmsProviders`.

export type CbmsReply = { code: number; raw?: string };
export type CbmsProvider = { name: string; postBill: (body: BillPayload) => Promise<CbmsReply>; postReturn: (body: ReturnPayload) => Promise<CbmsReply> };

type Credentials = { username: string; password: string; seller_pan: string };
type Amounts = { total_sales: number; taxable_sales_vat: number; vat: number; excisable_amount: 0; excise: 0; taxable_sales_hst: 0; hst: 0; amount_for_esf: 0; esf: 0; export_sales: 0; tax_exempted_sales: 0; isrealtime: boolean; datetimeClient: string };
export type BillPayload = Credentials & Amounts & { buyer_pan: string; buyer_name: string; fiscal_year: string; invoice_number: string; invoice_date: string };
export type ReturnPayload = Credentials & Amounts & { buyer_pan: string; buyer_name: string; fiscal_year: string; ref_invoice_number: string; credit_note_number: string; credit_note_date: string; reason_for_return: string };

/** "2083/84" → "2083.084"; "2083-07-29" → "2083.07.29" (CBMS formats). */
export const cbmsFiscalYear = (fy: string) => `${fy.slice(0, 4)}.0${fy.slice(5, 7)}`;
export const cbmsDate = (bs: string) => bs.replaceAll("-", ".");
const rupees = (paisa: number) => Math.round(paisa) / 100;

function amounts(d: { total: number; taxable: number; vat: number }, realtime: boolean, now: Date): Amounts {
  return { total_sales: rupees(d.total), taxable_sales_vat: rupees(d.taxable), vat: rupees(d.vat), excisable_amount: 0, excise: 0, taxable_sales_hst: 0, hst: 0, amount_for_esf: 0, esf: 0, export_sales: 0, tax_exempted_sales: 0, isrealtime: realtime, datetimeClient: now.toISOString() };
}

export function billPayload(inv: TaxInvoice, cred: Credentials, realtime: boolean, now = new Date()): BillPayload {
  return { ...cred, buyer_pan: inv.buyerPan ?? "", buyer_name: inv.buyerName, fiscal_year: cbmsFiscalYear(inv.fiscalYear), invoice_number: inv.number, invoice_date: cbmsDate(inv.dateBs), ...amounts(inv, realtime, now) };
}

export function returnPayload(cn: CreditNote & { invoice: TaxInvoice }, cred: Credentials, realtime: boolean, now = new Date()): ReturnPayload {
  // fiscal_year is the original invoice's (the year the sale was declared in): to confirm with the accountant
  return { ...cred, buyer_pan: cn.buyerPan ?? "", buyer_name: cn.buyerName, fiscal_year: cbmsFiscalYear(cn.invoice.fiscalYear), ref_invoice_number: cn.invoice.number, credit_note_number: cn.number, credit_note_date: cbmsDate(cn.dateBs), reason_for_return: cn.reason, ...amounts(cn, realtime, now) };
}

async function post(url: string, body: object): Promise<CbmsReply> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(20_000) });
  const raw = (await res.text()).trim();
  // the reply is a bare number ("200"), sometimes JSON ({"message":"104"}) with HTTP 400 for an invalid model
  const m = /\d{3}/.exec(raw);
  return { code: m ? Number(m[0]) : res.status, raw: raw.slice(0, 200) };
}

/** Named providers; "live" talks to the IRD. Exported so tests can register a fake. */
export const cbmsProviders: Record<string, CbmsProvider> = {
  live: {
    name: "live",
    postBill: (b) => post(`${cbmsUrl()}/api/bill`, b),
    postReturn: (b) => post(`${cbmsUrl()}/api/billreturn`, b),
  },
};
const cbmsUrl = () => (process.env.CBMS_URL || "https://cbapi.ird.gov.np").replace(/\/$/, "");

/** The provider and credentials, or null while CBMS is off (the default) or not fully configured. */
export function cbmsConfig() {
  const provider = cbmsProviders[process.env.CBMS_MODE ?? ""];
  const cred = { username: process.env.CBMS_USERNAME ?? "", password: process.env.CBMS_PASSWORD ?? "", seller_pan: process.env.CBMS_SELLER_PAN ?? "" };
  if (!provider || !cred.username || !cred.password || !/^\d{9}$/.test(cred.seller_pan)) return null;
  return { provider, cred };
}

const MAX_ATTEMPTS = 8;
const CLAIM_TIMEOUT_MS = 10 * 60_000;
/** Codes that won't get better by retrying the same body. */
const PERMANENT = new Set([104]);

/** Post queued documents, oldest first; invoices before the credit notes that point at them. Safe to run concurrently. */
export async function syncCbms(limit = 50) {
  const cfg = cbmsConfig();
  const waiting = await db.cbmsSync.count({ where: { status: { in: ["QUEUED", "FAILED"] } } });
  if (!cfg) return { off: true, sent: 0, failed: 0, waiting };
  const now = Date.now();
  const due = await db.cbmsSync.findMany({
    where: { OR: [{ status: "QUEUED" }, { status: "FAILED", attempts: { lt: MAX_ATTEMPTS } }, { status: "SENDING", claimedAt: { lt: new Date(now - CLAIM_TIMEOUT_MS) }, attempts: { lt: MAX_ATTEMPTS } }] },
    include: { invoice: true, creditNote: { include: { invoice: { include: { cbms: { select: { status: true } } } } } } },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  let sent = 0, failed = 0;
  for (const s of due) {
    if (s.status === "FAILED" && s.claimedAt && now - s.claimedAt.getTime() < 60_000 * 2 ** Math.min(s.attempts - 1, 6)) continue; // backoff
    if (s.creditNote && s.creditNote.invoice.cbms && s.creditNote.invoice.cbms.status !== "SENT") continue; // its invoice first
    const claimed = await db.cbmsSync.updateMany({ where: { id: s.id, status: s.status, attempts: s.attempts }, data: { status: "SENDING", claimedAt: new Date(), attempts: { increment: 1 } } });
    if (!claimed.count) continue;
    const issuedAt = (s.invoice ?? s.creditNote)!.issuedAt;
    const realtime = Date.now() - issuedAt.getTime() <= store.invoices.cbmsRealtimeMinutes * 60_000;
    const reply = await (s.invoice ? cfg.provider.postBill(billPayload(s.invoice, cfg.cred, realtime)) : cfg.provider.postReturn(returnPayload(s.creditNote!, cfg.cred, realtime))).catch((e): CbmsReply => ({ code: 0, raw: String(e).slice(0, 200) }));
    // 101 on a bill = it's already there (a retry after a lost reply): that's a success
    const ok = reply.code === 200 || (s.invoice && reply.code === 101);
    if (ok) {
      sent++;
      await db.cbmsSync.update({ where: { id: s.id }, data: { status: "SENT", sentAt: new Date(), realtime, code: String(reply.code), error: null } });
    } else {
      failed++;
      await db.cbmsSync.update({ where: { id: s.id }, data: { status: "FAILED", code: String(reply.code || ""), error: describe(reply).slice(0, 300), ...(PERMANENT.has(reply.code) ? { attempts: MAX_ATTEMPTS } : {}) } });
    }
  }
  if (failed) void reportError("cbms.sync", new Error(`CBMS refused ${failed} document(s)`), { context: { failed } });
  return { off: false, sent, failed, waiting: waiting - sent };
}

const MEANING: Record<number, string> = { 100: "API credentials do not match", 101: "Bill already exists / does not exist", 102: "Exception while saving bill details", 103: "Unknown exception", 104: "Model invalid", 105: "Bill does not exist (for sales return)" };
const describe = (r: CbmsReply) => `${r.code ? `${r.code}: ${MEANING[r.code] ?? "unexpected reply"}` : "No reply"}${r.raw && !/^\d{3}$/.test(r.raw) ? ` (${r.raw})` : ""}`;

/** After a sale: post right away (the job retries anything left). No-op while CBMS is off. */
export function syncSoon() {
  if (!cbmsConfig()) return;
  try {
    after(() => syncCbms(20).then(() => undefined, (e) => reportError("cbms.syncSoon", e)));
  } catch {
    // outside a request (tests, scripts): the cbms.sync job picks it up
  }
}

/** For the finance page: what's waiting, refused and sent. */
export async function cbmsOverview() {
  const rows = await db.cbmsSync.groupBy({ by: ["status"], _count: { _all: true } });
  const count = (s: string) => rows.find((r) => r.status === s)?._count._all ?? 0;
  return { on: !!cbmsConfig(), queued: count("QUEUED") + count("SENDING"), failed: count("FAILED"), sent: count("SENT") };
}
