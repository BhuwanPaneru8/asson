"use client";

import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
    // tell the owner (Admin → System); the digest links it to the server-side error when there is one
    fetch("/api/errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: error.message?.slice(0, 500) ?? "", digest: error.digest, path: window.location.pathname }),
      keepalive: true,
    }).catch(() => {});
  }, [error]);
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <h1 className="font-display text-4xl">Something went wrong</h1>
      <p className="mt-3 max-w-md text-muted">We&apos;ve been notified. Please try again — your bag is safe.</p>
      <button onClick={reset} className="mt-8 bg-ink px-6 py-3 text-[14px] font-medium text-white">Try again</button>
    </div>
  );
}
