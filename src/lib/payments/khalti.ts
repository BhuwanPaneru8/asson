import "server-only";

/**
 * Khalti Web Checkout (KPG-2) — https://docs.khalti.com/khalti-epayment/
 * Flow: server initiates → customer pays on Khalti → Khalti redirects to return_url with ?pidx=…
 * The redirect is never trusted: we always confirm with the lookup API. Only "Completed" is paid.
 */

const BASE = process.env.KHALTI_ENV === "live" ? "https://khalti.com/api/v2" : "https://dev.khalti.com/api/v2";
const key = () => process.env.KHALTI_SECRET_KEY ?? "";

export const khaltiEnabled = () => Boolean(key());

async function call<T>(path: string, body: unknown): Promise<{ ok: true; data: T } | { ok: false; status: number; error: unknown }> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { Authorization: `Key ${key()}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const data = await res.json().catch(() => null);
    return res.ok ? { ok: true, data: data as T } : { ok: false, status: res.status, error: data };
  } catch (e) {
    return { ok: false, status: 0, error: String(e) };
  }
}

export async function khaltiInitiate(opts: {
  reference: string;
  orderName: string;
  amount: number; // paisa
  returnUrl: string;
  websiteUrl: string;
  customer: { name: string; email: string; phone: string };
}) {
  return call<{ pidx: string; payment_url: string; expires_at: string; expires_in: number }>("/epayment/initiate/", {
    return_url: opts.returnUrl,
    website_url: opts.websiteUrl,
    amount: opts.amount,
    purchase_order_id: opts.reference,
    purchase_order_name: opts.orderName,
    customer_info: opts.customer,
  });
}

export type KhaltiStatus = "Completed" | "Pending" | "Initiated" | "Refunded" | "Expired" | "User canceled" | "Partially Refunded" | "UNKNOWN";

/** Lookup never throws. Expired / User canceled come back as HTTP 400 with a status body. */
export async function khaltiLookup(pidx: string): Promise<{ status: KhaltiStatus; transactionId: string | null; amount: number | null; raw: unknown }> {
  const r = await call<{ status: KhaltiStatus; transaction_id: string | null; total_amount: number }>("/epayment/lookup/", { pidx });
  const body = (r.ok ? r.data : r.error) as { status?: KhaltiStatus; transaction_id?: string | null; total_amount?: number } | null;
  if (!body?.status) return { status: "UNKNOWN", transactionId: null, amount: null, raw: body };
  return { status: body.status, transactionId: body.transaction_id ?? null, amount: body.total_amount ?? null, raw: body };
}
