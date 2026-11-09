"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { submitReview } from "@/actions/account";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export function ReviewForm({ productId, canReview }: { productId: string; canReview: boolean }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [fit, setFit] = useState<string>("True to size");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  if (!canReview) return <Link href="/login" className="text-[14px] font-medium underline underline-offset-4">Sign in to write a review</Link>;

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (!rating) { setErrors({ rating: "Choose a star rating" }); return; }
    start(async () => {
      const r = await submitReview({ productId, rating, title: fd.get("title"), body: fd.get("body"), fit });
      if (r.ok) { toast.success("Thanks! Your review is live."); setOpen(false); }
      else { setErrors(r.fieldErrors ?? {}); if (r.error) toast.error(r.error); }
    });
  };

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>Write a review</Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Write a review">
        <form onSubmit={submit} className="space-y-5 p-5">
          <div>
            <p className="mb-2 text-[13px] font-medium text-ink-soft">Your rating</p>
            <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
              {[1, 2, 3, 4, 5].map((i) => (
                <button type="button" key={i} onMouseEnter={() => setHover(i)} onClick={() => setRating(i)} aria-label={`${i} star${i > 1 ? "s" : ""}`}>
                  <Star className={cn("h-8 w-8", (hover || rating) >= i ? "fill-ink text-ink" : "text-line")} strokeWidth={1.2} />
                </button>
              ))}
            </div>
            {errors.rating && <p className="mt-1 text-[13px] text-danger">{errors.rating}</p>}
          </div>
          <div>
            <p className="mb-2 text-[13px] font-medium text-ink-soft">How did it fit?</p>
            <div className="flex gap-2">
              {["Runs small", "True to size", "Runs large"].map((f) => (
                <button type="button" key={f} onClick={() => setFit(f)} className={cn("flex-1 border py-2 text-[13px]", fit === f ? "border-ink bg-ink text-white" : "border-line bg-white")}>{f}</button>
              ))}
            </div>
          </div>
          <Field label="Title" error={errors.title}><Input name="title" maxLength={80} placeholder="Sum it up in a few words" /></Field>
          <Field label="Review" error={errors.body}><Textarea name="body" rows={5} maxLength={2000} placeholder="Fabric, fit, quality — what should other shoppers know?" /></Field>
          <Button type="submit" size="lg" className="w-full" loading={pending}>Submit review</Button>
        </form>
      </Sheet>
    </>
  );
}
