import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PageState } from "@/lib/handbook";

const LABEL: Record<PageState, string> = { done: "done", read: "read, questions to pass", changed: "changed since you read it", todo: "not read yet" };

/** A page's state as a small mark: ✓ done, half-filled read (questions to pass), ! changed, empty to read. */
export function StateMark({ state }: { state: PageState }) {
  return (
    <span title={LABEL[state]} className={cn("inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold",
      state === "done" ? "border-success bg-success text-white" : state === "read" ? "border-success bg-[linear-gradient(90deg,var(--color-success)_50%,white_50%)]" : state === "changed" ? "border-warn text-warn" : "border-ink/30")}>
      {state === "done" ? <Check className="h-3 w-3" strokeWidth={3} /> : state === "changed" ? "!" : null}
      <span className="sr-only">{LABEL[state]}</span>
    </span>
  );
}

export function PathBar({ done, of }: { done: number; of: number }) {
  const pct = of ? Math.round((done / of) * 100) : 100;
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-[13px]"><span className="font-medium">{done} of {of} done</span><span className="tabular-nums text-muted">{pct}%</span></div>
      <div className="h-2 overflow-hidden rounded-full bg-cloud" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Reading path progress">
        <div className="h-full rounded-full bg-success" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
