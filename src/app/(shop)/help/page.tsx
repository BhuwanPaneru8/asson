import type { Metadata } from "next";
import Link from "next/link";
import { store } from "@/lib/config";
import { formatPrice } from "@/lib/utils";

export const metadata: Metadata = { title: "Help & FAQs" };

const Z = store.shipping.zones;
const FAQ = [
  { id: "shipping", title: "Shipping & delivery", items: [
    ["Do you deliver all over Nepal?", "Yes — to all 77 districts. Choose your district at checkout and we'll show the delivery fee and estimated time."],
    ["How long will delivery take?", `${Z.VALLEY.label}: ${Z.VALLEY.etaMinDays}–${Z.VALLEY.etaMaxDays} days. ${Z.OUTSIDE.label}: ${Z.OUTSIDE.etaMinDays}–${Z.OUTSIDE.etaMaxDays} days. ${Z.REMOTE.label} (e.g. Humla, Dolpa, Mustang): ${Z.REMOTE.etaMinDays}–${Z.REMOTE.etaMaxDays} days. Same/next-day express is available inside the Valley.`],
    ["How much does delivery cost?", `It depends on your district — choose it on any product page or in your bag to see the exact fee. Free on orders over ${formatPrice(store.shipping.freeThreshold)} anywhere in Nepal. Typical fees: ${formatPrice(Z.VALLEY.fee)} inside Kathmandu Valley, ${formatPrice(Z.OUTSIDE.fee)} outside the Valley and ${formatPrice(Z.REMOTE.fee)} for remote districts. Express (Valley only) is ${formatPrice(store.shipping.express.fee)}.`],
  ]},
  { id: "returns", title: "Returns & exchanges", items: [
    ["What is your return policy?", `You can return unworn items with tags attached within ${store.returnWindowDays} days of delivery.`],
    ["How do I start a return?", "Go to Account → Orders, open the order and choose “Return items”. We’ll arrange a pickup or you can drop it at our partner courier branch."],
    ["When will I get my refund?", "Online payments are refunded to the same wallet or card. Cash on delivery orders are refunded to your eSewa/Khalti wallet or bank account within 3–5 working days of the return reaching us."],
  ]},
  { id: "payments", title: "Payments", items: [
    ["Which payment methods do you accept?", "Cash on delivery, eSewa, Khalti, Fonepay QR and cards."],
    ["Is Cash on Delivery available?", `Yes, everywhere we deliver, for orders up to ${formatPrice(store.codMaxOrder)}. You can also pay the rider by QR.`],
    ["Are prices inclusive of VAT?", "Yes, all prices include 13% VAT."],
  ]},
];

export default function HelpPage() {
  return (
    <div className="container-page max-w-3xl py-12">
      <h1 className="font-display text-5xl">How can we help?</h1>
      <p className="mt-3 text-muted">Quick answers to common questions. Can&apos;t find what you need? <a href="#contact" className="underline">Contact us</a>.</p>
      <div className="mt-6 flex flex-wrap gap-2"><Link href="/track" className="border border-ink px-4 py-2 text-[14px] font-medium">Track an order</Link><Link href="/account/orders" className="border border-line bg-white px-4 py-2 text-[14px]">Start a return</Link><Link href="/size-guide" className="border border-line bg-white px-4 py-2 text-[14px]">Size guide</Link></div>
      {FAQ.map((s) => (
        <section key={s.id} id={s.id} className="mt-12 scroll-mt-24">
          <h2 className="mb-4 text-[20px] font-semibold">{s.title}</h2>
          <div className="divide-y divide-line border-y border-line">
            {s.items.map(([q, a]) => (
              <details key={q} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between text-[15px] font-medium">{q}<span className="text-muted transition-transform group-open:rotate-45">+</span></summary>
                <p className="mt-2 text-[14.5px] leading-relaxed text-ink-soft">{a}</p>
              </details>
            ))}
          </div>
        </section>
      ))}
      <section id="contact" className="mt-12 scroll-mt-24 bg-cloud p-6">
        <h2 className="text-[20px] font-semibold">Contact us</h2>
        <p className="mt-2 text-[14.5px] text-ink-soft">Call {store.supportPhone}, WhatsApp {store.supportWhatsApp} (Sun–Fri, 10am–7pm) or email {store.supportEmail}. We reply within 24 hours.</p>
      </section>
      <section id="privacy" className="mt-12 scroll-mt-24"><h2 className="text-[20px] font-semibold">Privacy</h2><p className="mt-2 text-[14.5px] text-ink-soft">We only use your details to fulfil orders and, if you opt in, to send offers. We never sell your data. Replace this with your full privacy policy.</p></section>
      <section id="terms" className="mt-8 scroll-mt-24"><h2 className="text-[20px] font-semibold">Terms</h2><p className="mt-2 text-[14.5px] text-ink-soft">Replace this with your terms of sale.</p></section>
    </div>
  );
}
