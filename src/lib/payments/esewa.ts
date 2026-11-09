import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * eSewa ePay v2 — https://developer.esewa.com.np/pages/Epay
 * Flow: browser POSTs a signed form to eSewa → customer pays → eSewa redirects to our success URL
 * with `?data=<base64 JSON>` (signed with our secret). The status API is used to reconcile
 * attempts whose redirect never reached us.
 */

const ENV = process.env.ESEWA_ENV === "live" ? "live" : "test";
const URLS = {
  test: { form: "https://rc-epay.esewa.com.np/api/epay/main/v2/form", status: "https://rc.esewa.com.np/api/epay/transaction/status/" },
  live: { form: "https://epay.esewa.com.np/api/epay/main/v2/form", status: "https://esewa.com.np/api/epay/transaction/status/" },
}[ENV];

const productCode = () => process.env.ESEWA_PRODUCT_CODE ?? "";
const secret = () => process.env.ESEWA_SECRET_KEY ?? "";

export const esewaEnabled = () => Boolean(productCode() && secret());

function sign(message: string) {
  return createHmac("sha256", secret()).update(message).digest("base64");
}

/** eSewa amounts are rupees as plain decimals ("2549" or "2549.5"). */
export function toRupeeString(paisa: number) {
  return paisa % 100 === 0 ? String(paisa / 100) : (paisa / 100).toFixed(2);
}
/** eSewa returns values like "1,000.0" — normalise to paisa. */
export function fromRupeeString(v: string | number) {
  return Math.round(Number(String(v).replace(/,/g, "")) * 100);
}

export function buildEsewaForm(opts: { reference: string; total: number; deliveryCharge: number; successUrl: string; failureUrl: string }) {
  const fields: Record<string, string> = {
    amount: toRupeeString(opts.total - opts.deliveryCharge),
    tax_amount: "0", // prices are VAT-inclusive
    product_service_charge: "0",
    product_delivery_charge: toRupeeString(opts.deliveryCharge),
    total_amount: toRupeeString(opts.total),
    transaction_uuid: opts.reference,
    product_code: productCode(),
    success_url: opts.successUrl,
    failure_url: opts.failureUrl,
    signed_field_names: "total_amount,transaction_uuid,product_code",
  };
  fields.signature = sign(`total_amount=${fields.total_amount},transaction_uuid=${fields.transaction_uuid},product_code=${fields.product_code}`);
  return { action: URLS.form, fields };
}

export type EsewaCallback = { transaction_code: string; status: string; total_amount: string; transaction_uuid: string; product_code: string; signed_field_names: string; signature: string };

/** Decode and authenticate the `data` param eSewa sends to the success URL. Returns null if tampered. */
export function verifyEsewaCallback(data: string): EsewaCallback | null {
  let payload: Record<string, string>;
  try {
    payload = JSON.parse(Buffer.from(data, "base64").toString("utf8"));
  } catch {
    return null;
  }
  const names = String(payload.signed_field_names ?? "").split(",").filter(Boolean);
  if (!names.includes("total_amount") || !names.includes("transaction_uuid") || !payload.signature) return null;
  const expected = Buffer.from(sign(names.map((n) => `${n}=${payload[n] ?? ""}`).join(",")));
  const got = Buffer.from(String(payload.signature));
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) return null;
  if (payload.product_code !== productCode()) return null;
  return payload as unknown as EsewaCallback;
}

export type EsewaStatus = "COMPLETE" | "PENDING" | "FULL_REFUND" | "PARTIAL_REFUND" | "AMBIGUOUS" | "NOT_FOUND" | "CANCELED" | "UNKNOWN";

/** Server-to-server status check. Never throws; network trouble returns UNKNOWN. */
export async function esewaStatus(reference: string, total: number): Promise<{ status: EsewaStatus; refId: string | null; amount: number | null }> {
  const url = `${URLS.status}?${new URLSearchParams({ product_code: productCode(), total_amount: toRupeeString(total), transaction_uuid: reference })}`;
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
    const body = await res.json();
    if (!body?.status) return { status: "UNKNOWN", refId: null, amount: null };
    return { status: body.status, refId: body.ref_id ?? null, amount: body.total_amount != null ? fromRupeeString(body.total_amount) : null };
  } catch {
    return { status: "UNKNOWN", refId: null, amount: null };
  }
}
