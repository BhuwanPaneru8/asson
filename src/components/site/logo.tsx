import Link from "next/link";
import { store } from "@/lib/config";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("font-display text-[26px] leading-none tracking-tight", className)} aria-label={`${store.name} home`}>
      {store.name.toLowerCase()}<span className="text-accent">.</span>
    </Link>
  );
}
