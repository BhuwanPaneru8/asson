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
import { useT } from "@/components/site/i18n-provider";

export function ReviewForm({ productId, canReview }: { productId: string; canReview: boolean }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [fit, setFit] = useState<string>("True to size");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const { t, l } = useT();

  if (!canReview) return <Link href="/login" className="text-[14px] font-medium underline underline-offset-4">{t("rev.signIn")}</Link>;

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (!rating) { setErrors({ rating: t("rev.chooseStars") }); return; }
    start(async () => {
      const r = await submitReview({ productId, rating, title: fd.get("title"), body: fd.get("body"), fit });
      if (r.ok) { toast.success(t("rev.thanks")); setOpen(false); }
      else { setErrors(r.fieldErrors ?? {}); if (r.error) toast.error(r.error); }
    });
  };

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>{t("ord.review")}</Button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t("ord.review")}>
        <form onSubmit={submit} className="space-y-5 p-5">
          <div>
            <p className="mb-2 text-[13px] font-medium text-ink-soft">{t("rev.yourRating")}</p>
            <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
              {[1, 2, 3, 4, 5].map((i) => (
                <button type="button" key={i} onMouseEnter={() => setHover(i)} onClick={() => setRating(i)} aria-label={t(i > 1 ? "rev.starsN" : "rev.stars1", { n: i })}>
                  <Star className={cn("h-8 w-8", (hover || rating) >= i ? "fill-ink text-ink" : "text-line")} strokeWidth={1.2} />
                </button>
              ))}
            </div>
            {errors.rating && <p className="mt-1 text-[13px] text-danger">{errors.rating}</p>}
          </div>
          <div>
            <p className="mb-2 text-[13px] font-medium text-ink-soft">{t("rev.howFit")}</p>
            <div className="flex gap-2">
              {["Runs small", "True to size", "Runs large"].map((f) => (
                <button type="button" key={f} onClick={() => setFit(f)} className={cn("flex-1 border py-2 text-[13px]", fit === f ? "border-ink bg-ink text-white" : "border-line bg-white")}>{l(f)}</button>
              ))}
            </div>
          </div>
          <Field label={t("rev.titleLabel")} error={errors.title}><Input name="title" maxLength={80} placeholder={t("rev.titlePh")} /></Field>
          <Field label={t("rev.review")} error={errors.body}><Textarea name="body" rows={5} maxLength={2000} placeholder={t("rev.reviewPh")} /></Field>
          <Button type="submit" size="lg" className="w-full" loading={pending}>{t("rev.submit")}</Button>
        </form>
      </Sheet>
    </>
  );
}
