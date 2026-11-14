import type { Metadata, Viewport } from "next";
import { Inter, Fraunces, Noto_Sans_Devanagari, Noto_Serif_Devanagari } from "next/font/google";
import { Toaster } from "sonner";
import { preconnect } from "react-dom";
import { store } from "@/lib/config";
import "./globals.css";
import { getLocale } from "@/lib/i18n/server";
import { I18nProvider } from "@/components/site/i18n-provider";
import { AppSetup } from "@/components/site/app-install";
import { SHOP_MANIFEST } from "@/lib/app-manifest";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
// not preloaded: at 120 KB it would compete with the page's main photo on a phone; headings show a matched fallback
// for a moment instead (next/font sizes the fallback to the same metrics, so nothing jumps)
const display = Fraunces({ variable: "--font-display-serif", subsets: ["latin"], display: "swap", axes: ["opsz"], preload: false });
// Nepali (Devanagari) letters: Inter and Fraunces have none, so these fill in only for नेपाली text
const deva = Noto_Sans_Devanagari({ variable: "--font-deva", subsets: ["devanagari"], weight: ["400", "500", "600"], display: "swap", preload: false });
const devaSerif = Noto_Serif_Devanagari({ variable: "--font-deva-serif", subsets: ["devanagari"], weight: ["400"], display: "swap", preload: false });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: `${store.name} — ${store.tagline}`, template: `%s | ${store.name}` },
  description: "Shop men's, women's and kids' clothing online in Nepal — everyday essentials, denim, ethnic wear and more. Delivery to all 77 districts, cash on delivery, easy returns.",
  openGraph: { siteName: store.name, type: "website", locale: "en_NP" },
  // installable as a phone app (see src/lib/app-manifest.ts; /admin swaps in the staff app's)
  manifest: SHOP_MANIFEST,
  icons: { apple: "/icons/shop-apple-180.png" },
  appleWebApp: { capable: true, title: store.name, statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#fbfaf8", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  // the starter and demo photos are on Unsplash's image CDN: open that connection with the page, not after it
  // (our own uploads are same-origin and need nothing)
  preconnect("https://images.unsplash.com");
  return (
    <html lang={locale === "ne" ? "ne" : "en"} className={`${inter.variable} ${display.variable} ${deva.variable} ${devaSerif.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <I18nProvider locale={locale}>{children}<AppSetup /></I18nProvider>
        <Toaster position="top-center" toastOptions={{ className: "!rounded-none !border-ink !font-sans" }} />
      </body>
    </html>
  );
}
