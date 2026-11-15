import type { Metadata } from "next";
import { TillShell } from "@/components/pos/till-shell";

// The till's offline copy. The service worker saves this page (it holds no data: no prices, no names) and
// shows it when /admin/pos can't load because the shop has no internet. Everything it shows comes from
// the till's own IndexedDB, saved while it was online.
export const metadata: Metadata = { title: "Till (offline)", robots: { index: false, follow: false } };

export default function TillOfflinePage() {
  return (
    <main className="flex-1 bg-paper p-4 md:p-8">
      <h1 className="sr-only">Point of sale (offline)</h1>
      <TillShell />
    </main>
  );
}
