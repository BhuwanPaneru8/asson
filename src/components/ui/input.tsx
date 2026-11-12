import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const inputClass =
  "h-11 w-full border border-line bg-white px-3 text-[15px] text-ink placeholder:text-muted transition-colors focus:border-ink focus:outline-none disabled:bg-cloud aria-[invalid=true]:border-danger";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <input ref={ref} className={cn(inputClass, className)} {...p} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...p }, ref) {
  return <textarea ref={ref} className={cn(inputClass, "h-auto min-h-24 py-2.5", className)} {...p} />;
});

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, ...p }, ref) {
  return <select ref={ref} className={cn(inputClass, "appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23141414%22 stroke-width=%222%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:12px] bg-[right_12px_center] bg-no-repeat pr-9", className)} {...p} />;
});

export function Field({ label, error, hint, children, className, htmlFor }: { label: string; error?: string; hint?: string; children: React.ReactNode; className?: string; htmlFor?: string }) {
  // Wrapping the control in <label> associates it implicitly, so every input gets an accessible name.
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-ink-soft">{label}</span>
        {children}
      </label>
      {error ? <p className="text-[13px] text-danger" role="alert">{error}</p> : hint ? <p className="text-[13px] text-muted">{hint}</p> : null}
    </div>
  );
}
