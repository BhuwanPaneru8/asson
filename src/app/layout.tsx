import type { Metadata, Viewport } from "next";
import { Inter, Fraunces } from "next/font/google";
import { Toaster } from "sonner";
import { store } from "@/lib/config";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const display = Fraunces({ variable: "--font-display-serif", subsets: ["latin"], display: "swap", axes: ["opsz"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: `${store.name} — ${store.tagline}`, template: `%s | ${store.name}` },
  description: "Shop men's, women's and kids' clothing online in Nepal — everyday essentials, denim, ethnic wear and more. Delivery to all 77 districts, cash on delivery, easy returns.",
  openGraph: { siteName: store.name, type: "website", locale: "en_NP" },
};

export const viewport: Viewport = { themeColor: "#fbfaf8", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${display.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <Toaster position="top-center" toastOptions={{ className: "!rounded-none !border-ink !font-sans" }} />
      </body>
    </html>
  );
}
