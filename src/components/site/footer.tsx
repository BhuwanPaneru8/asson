import Link from "next/link";
import { store } from "@/lib/config";
import { Logo } from "./logo";
import { NewsletterForm } from "./newsletter";

const cols = [
  { title: "Shop", links: [["Men", "/c/men"], ["Women", "/c/women"], ["Kids", "/c/kids"], ["New in", "/shop?sort=new"], ["Sale", "/shop?sale=1"]] },
  { title: "Help", links: [["Track your order", "/track"], ["Shipping & delivery", "/help#shipping"], ["Returns & exchanges", "/help#returns"], ["Size guide", "/size-guide"], ["Contact us", "/help#contact"]] },
  { title: "Account", links: [["Sign in", "/login"], ["Create account", "/register"], ["Orders", "/account/orders"], ["Wishlist", "/account/wishlist"]] },
];

export function Footer() {
  return (
    <footer className="mt-24 border-t border-line bg-cloud/50">
      <div className="container-page grid gap-10 py-16 md:grid-cols-12 md:gap-8 [&>*]:min-w-0">
        <div className="md:col-span-4">
          <Logo />
          <p className="mt-4 max-w-xs text-[14.5px] text-ink-soft">{store.tagline} Delivering to all 77 districts of Nepal.</p>
          <div className="mt-6"><NewsletterForm /></div>
        </div>
        {cols.map((c) => (
          <div key={c.title} className="md:col-span-2">
            <p className="mb-4 text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">{c.title}</p>
            <ul className="space-y-2.5 text-[14.5px]">
              {c.links.map(([label, href]) => <li key={href}><Link href={href} className="text-ink-soft hover:text-accent">{label}</Link></li>)}
            </ul>
          </div>
        ))}
        <div className="md:col-span-2">
          <p className="mb-4 text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">Contact</p>
          <p className="text-[14.5px] text-ink-soft">{store.supportPhone}<br />WhatsApp {store.supportWhatsApp}<br />Sun–Fri, 10am–7pm</p>
          <p className="mt-2 break-all text-[14.5px] text-ink-soft">{store.supportEmail}</p>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="container-page flex flex-col gap-3 py-6 text-[13px] text-muted md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} {store.name}. All rights reserved.</p>
          <div className="flex gap-5"><Link href="/help#privacy">Privacy</Link><Link href="/help#terms">Terms</Link><span>eSewa · Khalti · Fonepay · Cards · COD</span></div>
        </div>
      </div>
    </footer>
  );
}
