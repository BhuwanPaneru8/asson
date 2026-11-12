import { Star } from "lucide-react";
import { cn, discountPercent, formatPrice } from "@/lib/utils";

/** offWord: the translated word after the discount percentage ("off" / "छुट"). */
export function Price({ price, compareAt, className, size = "md", offWord = "off" }: { price: number; compareAt?: number | null; className?: string; size?: "sm" | "md" | "lg"; offWord?: string }) {
  const off = discountPercent(price, compareAt);
  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-2", className)}>
      <span className={cn("font-semibold text-ink", size === "lg" ? "text-2xl" : size === "sm" ? "text-sm" : "text-[15px]")}>{formatPrice(price)}</span>
      {off > 0 && (
        <>
          <span className={cn("text-muted line-through", size === "lg" ? "text-base" : "text-[13px]")}>{formatPrice(compareAt!)}</span>
          <span className={cn("font-medium text-accent", size === "lg" ? "text-base" : "text-[13px]")}>{off}% {offWord}</span>
        </>
      )}
    </div>
  );
}

export function Stars({ value, size = 14, className }: { value: number; size?: number; className?: string }) {
  return (
    <span role="img" className={cn("inline-flex items-center gap-0.5", className)} aria-label={`${value.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, value - (i - 1)));
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
            <Star className="absolute inset-0 text-line" fill="currentColor" strokeWidth={0} style={{ width: size, height: size }} />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className="text-ink" fill="currentColor" strokeWidth={0} style={{ width: size, height: size }} />
            </span>
          </span>
        );
      })}
    </span>
  );
}

export function Badge({ children, tone = "neutral", className }: { children: React.ReactNode; tone?: "neutral" | "accent" | "success" | "warn" | "danger" | "dark"; className?: string }) {
  const tones = {
    neutral: "bg-cloud text-ink-soft",
    accent: "bg-accent-soft text-accent",
    success: "bg-[#e6f1ea] text-success",
    warn: "bg-[#fbf1df] text-warn",
    danger: "bg-[#fbe9e7] text-danger",
    dark: "bg-ink text-white",
  };
  return <span className={cn("inline-flex items-center px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider", tones[tone], className)}>{children}</span>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse bg-cloud", className)} />;
}

/** `page`: the empty state is the whole page, so its title is the page's main heading. */
export function EmptyState({ icon, title, body, action, page = false }: { icon?: React.ReactNode; title: string; body?: string; action?: React.ReactNode; page?: boolean }) {
  const H = page ? "h1" : "h3";
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      {icon && <div className="text-muted">{icon}</div>}
      <H className="font-display text-2xl">{title}</H>
      {body && <p className="max-w-sm text-muted">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
