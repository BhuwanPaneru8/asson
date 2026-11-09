"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Lock, Tag, X, Check, Plus, Sparkles, Store, Truck } from "lucide-react";
import { toast } from "sonner";
import { placeOrder, quoteCheckout, type Quote } from "@/actions/checkout";
import type { CartView } from "@/lib/cart";
import { provinceOf, store } from "@/lib/config";
import { deliveryFee, etaLabel, rateFor, type RateMap } from "@/lib/delivery-shared";
import { DistrictSelect } from "@/components/ui/district-select";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { addressLines, cn, formatPrice } from "@/lib/utils";

type PickupPoint = { id: string; name: string; address: string; hours: string | null; readyNow: boolean };
type Addr = { id: string; fullName: string; phone: string; line1: string; line2: string | null; city: string; district: string; state: string; postalCode: string | null; isDefault: boolean };

export function CheckoutForm({ cart, user, addresses, onlineEnabled, rates, pickupPoints, initialCode }: { cart: CartView; user: { name: string; email: string; phone: string | null } | null; addresses: Addr[]; onlineEnabled: boolean; rates: RateMap; pickupPoints: PickupPoint[]; initialCode?: string }) {
  const [fulfil, setFulfil] = useState<"delivery" | "pickup">("delivery");
  const [pickupId, setPickupId] = useState(pickupPoints.find((p) => p.readyNow)?.id ?? pickupPoints[0]?.id ?? "");
  const [pickupName, setPickupName] = useState(user?.name ?? "");
  const pickup = fulfil === "pickup";
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [addressId, setAddressId] = useState<string | "new">(addresses[0]?.id ?? "new");
  const [addr, setAddr] = useState({ fullName: user?.name ?? "", phone: user?.phone ?? "", line1: "", line2: "", city: "", district: "", postalCode: "" });
  const [saveAddress, setSaveAddress] = useState(true);
  const [method, setMethod] = useState<string>("standard");
  const [payment, setPayment] = useState<"COD" | "ONLINE">(onlineEnabled ? "ONLINE" : "COD");
  // a friend's code from a share link (/r/CODE) is tried automatically; the quote says if it doesn't apply
  const [couponInput, setCouponInput] = useState(initialCode ?? "");
  const [coupon, setCoupon] = useState<string | undefined>(initialCode);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [usePoints, setUsePoints] = useState(false);
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [placing, startPlacing] = useTransition();
  const [quoting, startQuote] = useTransition();

  // pre-fill the district the shopper already chose on a product page or in the bag
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { try { const d = localStorage.getItem("asson_district"); if (d) setAddr((x) => (x.district ? x : { ...x, district: d })); } catch {} }, []);

  const district = pickup ? "" : addressId === "new" ? addr.district : addresses.find((a) => a.id === addressId)?.district ?? "";
  const rate = pickup ? null : rateFor(rates, district);
  const expressOk = !!rate?.expressAvailable;
  const effectiveMethod = method === "express" && !expressOk ? "standard" : method;

  useEffect(() => {
    startQuote(async () => {
      const q = await quoteCheckout({ couponCode: coupon, shippingMethod: effectiveMethod, district, usePoints, pickup });
      setQuote(q);
      if (!q.ok && coupon) { toast.error(q.error); setCoupon(undefined); }
    });
  }, [coupon, effectiveMethod, district, usePoints, pickup]);

  const totals = quote?.totals;
  const codOverLimit = (totals?.total ?? 0) > store.codMaxOrder;
  const codBlocked = codOverLimit || (rate ? !rate.codAvailable : false);
  const notServiceable = rate ? !rate.serviceable : false;
  const ready = pickup ? !!pickupId : !!rate; // the total is final
  const itemsAfterDiscount = totals ? totals.subtotal - totals.discount : cart.subtotal;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    startPlacing(async () => {
      const res = await placeOrder({
        email, phone,
        ...(pickup
          ? { pickupStoreId: pickupId, pickupName }
          : { addressId: addressId !== "new" ? addressId : undefined, address: addressId === "new" ? addr : undefined, saveAddress: !!user && saveAddress }),
        shippingMethod: effectiveMethod as "standard",
        paymentMethod: payment,
        couponCode: coupon,
        usePoints: usePoints && (quote?.points.used ?? 0) > 0,
        note: note || undefined,
      });
      // success redirects; anything returned is an error
      if (res?.error) {
        setFormError(res.error);
        setErrors(res.fieldErrors ?? {});
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  };

  const set = (k: keyof typeof addr) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setAddr({ ...addr, [k]: e.target.value });

  return (
    <div className="container-page py-8 md:py-12">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-display text-4xl">Checkout</h1>
        <p className="flex items-center gap-1.5 text-[13px] text-muted"><Lock className="h-3.5 w-3.5" /> Secure checkout</p>
      </div>
      <form onSubmit={submit} className="grid gap-10 lg:grid-cols-12" noValidate>
        <div className="space-y-10 lg:col-span-7">
          {formError && <div role="alert" className="border border-danger/30 bg-[#fbe9e7] p-4 text-[14.5px] text-danger">{formError}</div>}

          <Step n={1} title="Contact">
            {!user && <p className="mb-4 text-[14px] text-muted">Have an account? <Link href="/login?next=/checkout" className="font-medium text-ink underline underline-offset-4">Sign in</Link> for faster checkout.</p>}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Email" error={errors.email}><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required aria-invalid={!!errors.email} /></Field>
              <Field label="Mobile number" error={errors.phone} hint={pickup ? "We'll text you when it's ready to collect" : "Our rider will call this number on delivery"}>
                <div className="flex"><span className="flex h-11 items-center border border-r-0 border-line bg-cloud px-3 text-[14px] text-muted">{store.phonePrefix}</span><Input value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" autoComplete="tel-national" required aria-invalid={!!errors.phone} /></div>
              </Field>
            </div>
          </Step>

          <Step n={2} title={pickupPoints.length ? "Delivery or pickup" : "Delivery address"}>
            {pickupPoints.length > 0 && (
              <div className="mb-5 grid grid-cols-2 gap-2" role="radiogroup" aria-label="How you get your order">
                {([["delivery", "Deliver to me", Truck], ["pickup", "Pick up in store · Free", Store]] as const).map(([id, label, Icon]) => (
                  <button type="button" role="radio" aria-checked={fulfil === id} key={id} onClick={() => setFulfil(id)} className={cn("flex items-center justify-center gap-2 border p-3 text-[14px] font-medium", fulfil === id ? "border-ink bg-white" : "border-line bg-white/50 hover:border-ink-soft")}>
                    <Icon className="h-4 w-4" aria-hidden /> {label}
                  </button>
                ))}
              </div>
            )}
            {pickup ? (
              <div className="space-y-3">
                {pickupPoints.map((p) => (
                  <label key={p.id} className={cn("flex cursor-pointer items-start gap-3 border p-4", pickupId === p.id ? "border-ink bg-white" : "border-line")}>
                    <input type="radio" name="pickup" checked={pickupId === p.id} onChange={() => setPickupId(p.id)} className="mt-1 h-4 w-4 accent-ink" />
                    <div className="flex-1 text-[14px]">
                      <p className="font-medium">{p.name}</p>
                      <p className="text-ink-soft">{p.address}{p.hours ? ` · ${p.hours}` : ""}</p>
                      <p className={cn("mt-1 text-[13px]", p.readyNow ? "text-success" : "text-muted")}>{p.readyNow ? store.pickup.readyNow : store.pickup.readyLater}</p>
                    </div>
                  </label>
                ))}
                <Field label="Name of the person collecting" error={errors.pickupName}><Input value={pickupName} onChange={(e) => setPickupName(e.target.value)} autoComplete="name" aria-invalid={!!errors.pickupName} /></Field>
                <p className="text-[13px] text-muted">We&apos;ll text you when it&apos;s ready. Show the SMS at the counter; we hold orders for {store.pickup.holdDays} days.</p>
              </div>
            ) : (<>
            {addresses.length > 0 && (
              <div className="mb-4 grid gap-3 sm:grid-cols-2">
                {addresses.map((a) => (
                  <button type="button" key={a.id} onClick={() => setAddressId(a.id)} className={cn("relative border p-4 text-left text-[14px] transition-colors", addressId === a.id ? "border-ink bg-white" : "border-line bg-white/50 hover:border-ink-soft")}>
                    {addressId === a.id && <Check className="absolute right-3 top-3 h-4 w-4" />}
                    <p className="font-semibold">{a.fullName}{a.isDefault && <span className="ml-2 text-[11px] font-medium uppercase tracking-wider text-muted">Default</span>}</p>
                    {addressLines(a).map((l) => <p key={l} className="text-ink-soft first:mt-1">{l}</p>)}
                    <p className="mt-1 text-muted">{a.phone}</p>
                  </button>
                ))}
                <button type="button" onClick={() => setAddressId("new")} className={cn("flex items-center justify-center gap-2 border border-dashed p-4 text-[14px] font-medium", addressId === "new" ? "border-ink" : "border-line hover:border-ink-soft")}>
                  <Plus className="h-4 w-4" /> New address
                </button>
              </div>
            )}
            {addressId === "new" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name" error={errors["address.fullName"]}><Input value={addr.fullName} onChange={set("fullName")} autoComplete="name" aria-invalid={!!errors["address.fullName"]} /></Field>
                <Field label="Phone" error={errors["address.phone"]}><Input value={addr.phone} onChange={(e) => setAddr({ ...addr, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })} inputMode="numeric" autoComplete="tel-national" aria-invalid={!!errors["address.phone"]} /></Field>
                <Field label="District" error={errors["address.district"]} hint={addr.district && rate ? `${provinceOf(addr.district)} Province · delivery ${etaLabel(rate)}` : undefined}>
                  <DistrictSelect value={addr.district} onChange={set("district")} aria-invalid={!!errors["address.district"]} />
                </Field>
                <Field label="City / municipality" error={errors["address.city"]}><Input value={addr.city} onChange={set("city")} autoComplete="address-level2" placeholder="e.g. Kathmandu Metropolitan City" aria-invalid={!!errors["address.city"]} /></Field>
                <Field label="Tole / street, house no." className="sm:col-span-2" error={errors["address.line1"]}><Input value={addr.line1} onChange={set("line1")} autoComplete="address-line1" placeholder="e.g. Baneshwor-10, House 24" aria-invalid={!!errors["address.line1"]} /></Field>
                <Field label="Nearest landmark (recommended)" hint="Helps riders find you faster"><Input value={addr.line2} onChange={set("line2")} autoComplete="address-line2" placeholder="e.g. Opposite Everest Bank" /></Field>
                <Field label="Postal code (optional)" error={errors["address.postalCode"]}><Input value={addr.postalCode} onChange={(e) => setAddr({ ...addr, postalCode: e.target.value.replace(/\D/g, "").slice(0, 5) })} inputMode="numeric" autoComplete="postal-code" aria-invalid={!!errors["address.postalCode"]} /></Field>
                {user && <label className="flex items-center gap-2 text-[14px] sm:col-span-2"><input type="checkbox" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} className="h-4 w-4 accent-ink" /> Save this address for next time</label>}
              </div>
            )}
            </>)}
          </Step>

          {!pickup && <Step n={3} title="Delivery method">
            <div className="space-y-2">
              {!rate ? (
                <p className="border border-dashed border-line p-4 text-[14px] text-muted">Choose your district above — we&apos;ll show the exact delivery fee and time for your location.</p>
              ) : notServiceable ? (
                <p className="border border-danger/30 bg-[#fbe9e7] p-4 text-[14px] text-danger">We don&apos;t deliver to {district} yet. Call {store.supportPhone} and we&apos;ll arrange it.</p>
              ) : (
                ([
                  { id: "standard", label: `Standard delivery to ${district}`, eta: etaLabel(rate, "standard"), ok: true },
                  { id: "express", label: store.shipping.express.label, eta: expressOk ? store.shipping.express.eta : `Not available in ${district}`, ok: expressOk },
                ] as const).map((m) => {
                  const fee = deliveryFee(m.id, rate, itemsAfterDiscount, false);
                  return (
                    <label key={m.id} className={cn("flex items-center gap-3 border p-4", m.ok ? "cursor-pointer" : "cursor-not-allowed opacity-50", effectiveMethod === m.id ? "border-ink bg-white" : "border-line")}>
                      <input type="radio" name="method" disabled={!m.ok} checked={effectiveMethod === m.id} onChange={() => setMethod(m.id)} className="h-4 w-4 accent-ink" />
                      <div className="flex-1"><p className="text-[14.5px] font-medium">{m.label}</p><p className="text-[13px] text-muted">{m.eta}</p></div>
                      <span className="text-[14.5px] font-medium">{fee === 0 ? "Free" : formatPrice(fee)}</span>
                    </label>
                  );
                })
              )}
              {rate && rate.fee > 0 && itemsAfterDiscount < store.shipping.freeThreshold && (
                <p className="text-[13px] text-muted">Add {formatPrice(store.shipping.freeThreshold - itemsAfterDiscount)} more for free standard delivery.</p>
              )}
            </div>
          </Step>}

          <Step n={pickup ? 3 : 4} title="Payment">
            <div className="space-y-2">
              {onlineEnabled && (
                <label className={cn("flex cursor-pointer items-center gap-3 border p-4", payment === "ONLINE" ? "border-ink bg-white" : "border-line")}>
                  <input type="radio" checked={payment === "ONLINE"} onChange={() => setPayment("ONLINE")} className="h-4 w-4 accent-ink" />
                  <div className="flex-1"><p className="text-[14.5px] font-medium">eSewa or Khalti</p><p className="text-[13px] text-muted">Pay securely online</p></div>
                </label>
              )}
              <label className={cn("flex items-center gap-3 border p-4", codBlocked ? "cursor-not-allowed opacity-50" : "cursor-pointer", payment === "COD" ? "border-ink bg-white" : "border-line")}>
                <input type="radio" disabled={codBlocked} checked={payment === "COD"} onChange={() => setPayment("COD")} className="h-4 w-4 accent-ink" />
                <div className="flex-1"><p className="text-[14.5px] font-medium">{pickup ? "Pay at the shop" : "Cash on delivery"}</p><p className="text-[13px] text-muted">{codOverLimit ? `Available for orders up to ${formatPrice(store.codMaxOrder)}` : codBlocked ? `Not available in ${district} yet` : pickup ? "Cash, card or eSewa/Khalti/Fonepay QR when you collect" : "Pay in cash or by eSewa/Khalti QR to the rider when your order arrives"}</p></div>
              </label>
            </div>
            <div className="mt-4">
              {!showNote ? <button type="button" onClick={() => setShowNote(true)} className="text-[14px] underline underline-offset-4">{pickup ? "Add a note for the shop" : "Add delivery instructions"}</button>
                : <Field label={pickup ? "Note for the shop (optional)" : "Delivery instructions (optional)"}><Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} placeholder="e.g. Call before arriving, leave at the shop downstairs" /></Field>}
            </div>
          </Step>
        </div>

        <aside className="lg:col-span-5">
          <div className="sticky top-24 border border-line bg-white p-6">
            <h2 className="text-[16px] font-semibold">Order summary <span className="font-normal text-muted">({cart.count})</span></h2>
            <ul className="mt-4 max-h-72 space-y-4 overflow-y-auto pr-1">
              {cart.lines.map((l) => (
                <li key={l.id} className="flex gap-3">
                  <div className="relative h-20 w-16 shrink-0 bg-cloud">
                    {l.image && <Image src={l.image} alt="" fill sizes="64px" className="object-cover" />}
                    <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 text-[11px] text-white">{l.quantity}</span>
                  </div>
                  <div className="min-w-0 flex-1 text-[13.5px]"><p className="line-clamp-1 font-medium">{l.name}</p><p className="text-muted">{l.color} · {l.size}</p></div>
                  <p className="text-[13.5px] font-medium">{formatPrice(l.unitPrice * l.quantity)}</p>
                </li>
              ))}
            </ul>

            <div className="mt-5 border-t border-line pt-5">
              {coupon && quote?.ok && quote.coupon ? (
                <div className="flex items-center justify-between bg-[#e6f1ea] px-3 py-2.5 text-[13.5px] text-success">
                  <span className="flex items-center gap-2"><Tag className="h-4 w-4" /><span><b>{quote.coupon.code}</b> applied{quote.coupon.description ? ` — ${quote.coupon.description}` : ""}</span></span>
                  <button type="button" onClick={() => { setCoupon(undefined); setCouponInput(""); }} aria-label="Remove coupon"><X className="h-4 w-4" /></button>
                </div>
              ) : (
                <div className="flex">
                  <Input value={couponInput} onChange={(e) => setCouponInput(e.target.value.toUpperCase())} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (couponInput.trim()) setCoupon(couponInput.trim()); } }} placeholder="Promo code" aria-label="Promo code" className="border-r-0 uppercase" />
                  <Button type="button" variant="secondary" onClick={() => couponInput.trim() && setCoupon(couponInput.trim())} loading={quoting && !!couponInput}>Apply</Button>
                </div>
              )}
            </div>

            {user && quote && quote.points.balance > 0 && (
              <div className="mt-4 border border-line p-3 text-[13.5px]">
                {quote.points.usable > 0 || usePoints ? (
                  <label className="flex cursor-pointer items-start gap-2.5">
                    <input type="checkbox" checked={usePoints} onChange={(e) => setUsePoints(e.target.checked)} className="mt-0.5 h-4 w-4 accent-ink" />
                    <span><span className="flex items-center gap-1.5 font-medium"><Sparkles className="h-3.5 w-3.5" /> Use {quote.points.usable} points — save {formatPrice(quote.points.usable * store.loyalty.pointValue)}</span>
                      <span className="text-muted">You have {quote.points.balance} points. Up to {store.loyalty.maxRedeemPercent}% of your bag can be paid with points.</span></span>
                  </label>
                ) : (
                  <p className="flex items-center gap-1.5 text-muted"><Sparkles className="h-3.5 w-3.5" /> You have {quote.points.balance} points — use them from {store.loyalty.minRedeem}.</p>
                )}
              </div>
            )}

            <dl className={cn("mt-5 space-y-2.5 text-[14.5px] transition-opacity", quoting && "opacity-50")}>
              <div className="flex justify-between"><dt>Subtotal</dt><dd>{totals ? formatPrice(totals.subtotal) : "—"}</dd></div>
              {totals && totals.discount > 0 && <div className="flex justify-between text-success"><dt>Discount</dt><dd>−{formatPrice(totals.discount)}</dd></div>}
              {totals && totals.pointsDiscount > 0 && <div className="flex justify-between text-success"><dt>Points</dt><dd>−{formatPrice(totals.pointsDiscount)}</dd></div>}
              {pickup
                ? <div className="flex justify-between"><dt>Pickup<span className="text-muted"> · {pickupPoints.find((p) => p.id === pickupId)?.name}</span></dt><dd>Free</dd></div>
                : <div className="flex justify-between"><dt>Delivery{rate && <span className="text-muted"> · {district}</span>}</dt><dd>{!rate ? <span className="text-muted">Choose district</span> : totals ? (totals.shippingFee === 0 ? "Free" : formatPrice(totals.shippingFee)) : "—"}</dd></div>}
            </dl>
            <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
              <span className="text-[16px] font-semibold">{ready ? "Total" : "Total before delivery"}</span>
              <span className="text-[22px] font-semibold">{totals ? formatPrice(totals.total) : "—"}</span>
            </div>
            <p className="text-[12.5px] text-muted">{store.vatLabel}</p>
            {totals && totals.total - totals.shippingFee >= store.loyalty.earnPer && (
              <p className="mt-1 text-[12.5px] text-muted">{user ? "You'll earn" : "Sign in to earn"} {Math.floor((totals.total - totals.shippingFee) / store.loyalty.earnPer)}+ Asson points on {pickup ? "collection" : "delivery"}.</p>
            )}
            <Button type="submit" size="lg" className="mt-5 w-full" loading={placing} disabled={!totals || (pickup ? !pickupId : notServiceable) || (payment === "COD" && codBlocked)}>
              {payment === "COD" ? "Place order" : "Continue to payment"}
            </Button>
            <p className="mt-3 text-center text-[12px] text-muted">By placing your order you agree to our <Link href="/help#terms" className="underline">terms</Link> and <Link href="/help#privacy" className="underline">privacy policy</Link>.</p>
          </div>
        </aside>
      </form>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-4 flex items-center gap-3 text-[18px] font-semibold"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-[13px] text-white">{n}</span>{title}</h2>
      {children}
    </section>
  );
}
