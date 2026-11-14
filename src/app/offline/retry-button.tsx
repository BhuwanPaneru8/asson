"use client";

import { useEffect } from "react";

/** Reloads the page the shopper was trying to open, and does so by itself once the connection is back. */
export function RetryButton() {
  useEffect(() => {
    const back = () => location.reload();
    window.addEventListener("online", back);
    return () => window.removeEventListener("online", back);
  }, []);
  return (
    <button type="button" onClick={() => location.reload()} className="mt-8 h-12 w-full max-w-xs bg-ink px-6 text-[15px] font-medium text-white hover:bg-ink/90">
      Try again · फेरि प्रयास
    </button>
  );
}
