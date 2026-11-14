"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { markReadAction, submitQuizAction } from "@/actions/admin/handbook";
import { cn } from "@/lib/utils";

const btn = "h-10 rounded-md bg-ink px-4 text-[14px] font-medium text-white hover:bg-ink/90 disabled:opacity-40";

export function MarkRead({ slug, state }: { slug: string; state: "done" | "read" | "changed" | "todo" }) {
  const [pending, start] = useTransition();
  if (state === "done" || state === "read") {
    return <p className="flex items-center gap-2 text-[14px] font-medium text-success"><Check className="h-4 w-4" />You’ve read this page</p>;
  }
  return (
    <button className={btn} disabled={pending} onClick={() => start(async () => {
      const r = await markReadAction(slug);
      if (r.ok) toast.success("Marked as read"); else toast.error(r.error);
    })}>{pending ? "Saving…" : state === "changed" ? "I’ve read the new version" : "I’ve read and understood this"}</button>
  );
}

type Result = { score: number; passed: boolean; results: { right: boolean; answer: number; why: string }[] };

/** "Check yourself": the right answers only come back from the server after submitting. */
export function Quiz({ slug, questions, best }: { slug: string; questions: { q: string; options: string[] }[]; best: number | null }) {
  const [answers, setAnswers] = useState<(number | null)[]>(questions.map(() => null));
  const [result, setResult] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  const ready = answers.every((a) => a !== null);

  return (
    <div className="space-y-5">
      {questions.map((q, i) => {
        const r = result?.results[i];
        return (
          <fieldset key={i} className="space-y-2">
            <legend className="mb-1 text-[14.5px] font-semibold text-ink">{i + 1}. {q.q}</legend>
            {q.options.map((o, j) => {
              const picked = answers[i] === j;
              const tone = r ? (j === r.answer ? "border-success bg-[#f1f8f3]" : picked ? "border-danger bg-[#fdf3f1]" : "border-line") : picked ? "border-ink bg-cloud/60" : "border-line hover:border-ink/40";
              return (
                <label key={j} className={cn("flex cursor-pointer items-start gap-2.5 rounded-md border bg-white px-3 py-2 text-[14px]", tone)}>
                  <input type="radio" name={`q${i}`} className="mt-1 accent-ink" checked={picked} disabled={!!result} onChange={() => setAnswers((a) => a.map((x, k) => (k === i ? j : x)))} />
                  <span>{o}</span>
                </label>
              );
            })}
            {r && <p className={cn("text-[13.5px]", r.right ? "text-success" : "text-danger")}>{r.right ? "Right. " : "Not quite. "}<span className="text-ink-soft">{r.why}</span></p>}
          </fieldset>
        );
      })}
      <div className="flex flex-wrap items-center gap-3">
        {!result && <button className={btn} disabled={!ready || pending} onClick={() => start(async () => {
          const r = await submitQuizAction({ slug, answers: answers as number[] });
          if (r.ok) setResult(r.result); else toast.error(r.error);
        })}>{pending ? "Checking…" : "Check my answers"}</button>}
        {result && (
          <>
            <p className={cn("text-[14.5px] font-semibold", result.passed ? "text-success" : "text-warn")}>{result.score}%: {result.passed ? "passed" : "read the page again and have another go (80% passes)"}</p>
            <button className="h-10 rounded-md border border-line bg-white px-4 text-[14px] hover:border-ink" onClick={() => { setResult(null); setAnswers(questions.map(() => null)); }}>Try again</button>
          </>
        )}
        {!result && best != null && <span className="text-[13px] text-muted">Your best so far: {best}%</span>}
      </div>
    </div>
  );
}
