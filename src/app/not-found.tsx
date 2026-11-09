import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-muted">404</p>
      <h1 className="mt-3 font-display text-5xl">We can&apos;t find that page</h1>
      <p className="mt-3 max-w-md text-muted">It may have moved or sold out. Try searching, or head back to the homepage.</p>
      <div className="mt-8 flex gap-3"><Link href="/" className="bg-ink px-6 py-3 text-[14px] font-medium text-white">Go home</Link><Link href="/shop" className="border border-ink px-6 py-3 text-[14px] font-medium">Shop all</Link></div>
    </div>
  );
}
