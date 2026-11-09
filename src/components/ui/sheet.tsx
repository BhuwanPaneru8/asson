"use client";

import { useEffect, useId } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Accessible slide-over panel (drawer). Locks scroll and closes on Escape / backdrop. */
export function Sheet({ open, onClose, side = "right", title, children, className, footer }: { open: boolean; onClose: () => void; side?: "right" | "left" | "bottom"; title: React.ReactNode; children: React.ReactNode; className?: string; footer?: React.ReactNode }) {
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="absolute inset-0 animate-fade-in bg-black/40" onClick={onClose} />
      <div
        className={cn(
          "absolute flex flex-col bg-paper shadow-2xl",
          side === "right" && "inset-y-0 right-0 w-full max-w-md animate-slide-in-right",
          side === "left" && "inset-y-0 left-0 w-[88%] max-w-sm animate-slide-in-left",
          side === "bottom" && "inset-x-0 bottom-0 max-h-[85vh] animate-slide-up",
          className,
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-5">
          <div id={titleId} className="text-[15px] font-semibold">{title}</div>
          <button onClick={onClose} className="-mr-2 p-2 hover:bg-cloud" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="shrink-0 border-t border-line">{footer}</div>}
      </div>
    </div>
  );
}
