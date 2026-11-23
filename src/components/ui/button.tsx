import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "link";
type Size = "sm" | "md" | "lg" | "icon";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-white hover:bg-ink-soft disabled:bg-ink/40",
  secondary: "border border-ink bg-white text-ink hover:bg-cloud disabled:opacity-40",
  ghost: "text-ink hover:bg-cloud disabled:opacity-40",
  danger: "bg-danger text-white hover:bg-danger/90 disabled:opacity-40",
  link: "text-ink underline underline-offset-4 hover:text-accent px-0 h-auto",
};
const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-13 px-7 text-[15px]",
  icon: "h-10 w-10 justify-center",
};

/** a light press on tap (not for people who asked for less motion) */
const base = "inline-flex items-center justify-center gap-2 font-medium tracking-wide transition-[background-color,border-color,color,opacity,transform] duration-200 active:scale-[0.985] motion-reduce:active:scale-100";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", loading, disabled, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        base, "select-none disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}
