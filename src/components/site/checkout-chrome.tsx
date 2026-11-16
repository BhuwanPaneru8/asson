"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Checkout gets a quiet frame (logo, help number, a few policy links) instead of the shop's menus and footer, so
 * the last step has no exits that aren't on purpose. Everything else gets the full header and footer.
 */
export function CheckoutAware({ checkout, rest }: { checkout: React.ReactNode; rest: React.ReactNode }) {
  const onCheckout = usePathname().startsWith("/checkout");
  useEffect(() => {
    if (!onCheckout) return;
    // the checkout header doesn't stick, so sticky bars (the order summary) sit at the top of the window
    const root = document.documentElement.style;
    root.setProperty("--header-offset", "0px");
    return () => root.setProperty("--header-offset", "4rem");
  }, [onCheckout]);
  return <>{onCheckout ? checkout : rest}</>;
}
