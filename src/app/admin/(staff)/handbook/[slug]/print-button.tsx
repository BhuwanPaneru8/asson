"use client";

/** Print a page for a training binder or a shop's back-room wall. */
export function PrintButton({ children }: { children: React.ReactNode }) {
  return <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-3 py-1.5 text-[13px] hover:border-ink">{children}</button>;
}
