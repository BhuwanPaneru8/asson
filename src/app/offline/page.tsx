import type { Metadata } from "next";
import { store } from "@/lib/config";
import { RetryButton } from "./retry-button";

// Shown by the service worker when a page can't load because the phone has no connection. The worker
// saves it without cookies, so it can't know the shopper's language: it says everything in both.
export const metadata: Metadata = { title: "Offline", robots: { index: false, follow: false } };

export default function OfflinePage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <p className="font-display text-[34px] leading-none tracking-tight">
        {store.name.toLowerCase()}<span className="text-accent">.</span>
      </p>
      <h1 className="mt-8 text-[22px] font-semibold text-ink">You’re offline</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">Check your mobile data or Wi-Fi, then try again. Nothing in your bag is lost.</p>
      <p lang="ne" className="mt-5 text-[15px] leading-relaxed text-ink-soft">इन्टरनेट जडान छैन। मोबाइल डाटा वा Wi-Fi जाँच गरेर फेरि प्रयास गर्नुहोस्। तपाईंको झोलाका सामान हराउँदैनन्।</p>
      <RetryButton />
    </main>
  );
}
