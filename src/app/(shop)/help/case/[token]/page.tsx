import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { caseForCustomer, careRef } from "@/lib/care";
import { store } from "@/lib/config";
import { getT } from "@/lib/i18n/server";
import { formatDateTime, formatOrderNumber, now } from "@/lib/utils";
import { CareRate, CareReply } from "@/components/account/care-form";

// Anyone with the link can read the case, so it's never indexed or cached.
export const metadata: Metadata = { title: "Your request", robots: { index: false, follow: false } };

export default async function CarePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const c = await caseForCustomer(token);
  if (!c) notFound();
  const { t } = await getT();
  const closed = c.status === "RESOLVED" && c.resolvedAt!.getTime() < now() - store.care.reopenDays * 86_400_000;
  return (
    <div className="container-page max-w-2xl py-12">
      <p className="text-[13px] uppercase tracking-wider text-muted">{t(`care.status.${c.status}`)}</p>
      <h1 className="mt-1 font-display text-4xl">{t("care.caseTitle", { ref: careRef(c.number) })}</h1>
      <p className="mt-2 text-[15px] text-ink-soft">{c.subject}{c.order && <> · <Link href={`/orders/${c.order.id}`} className="underline">{formatOrderNumber(c.order.number)}</Link></>}</p>
      <p className="mt-3 bg-cloud p-3 text-[13.5px] text-ink-soft">{t("care.keepLink")}</p>
      <ol className="mt-8 space-y-4">
        {c.messages.map((m) => (
          <li key={m.id} className={m.kind === "REPLY" ? "mr-8 border-l-2 border-ink bg-white p-4" : "ml-8 bg-cloud p-4"}>
            <p className="text-[12.5px] text-muted">{m.kind === "REPLY" ? `${m.byName} · ${t("care.us", { store: store.name })}` : t("care.you")} · {formatDateTime(m.createdAt)}</p>
            <p className="mt-1 whitespace-pre-line text-[15px]">{m.body}</p>
          </li>
        ))}
      </ol>
      {c.status === "RESOLVED" && !closed && (
        <div className="mt-8">{c.rating ? <p className="bg-cloud p-4 text-[14.5px]"><span className="text-accent">{"★".repeat(c.rating)}</span> {t("care.rate.thanks")}</p> : <CareRate token={token} />}</div>
      )}
      <div className="mt-8">
        {closed ? <p className="text-[14.5px] text-ink-soft">{t("care.closed")} <Link href="/help#write" className="underline">{t("nav.help")}</Link></p> : <>
          {c.status === "RESOLVED" && <p className="mb-3 text-[14px] text-ink-soft">{t("care.reopen")}</p>}
          <CareReply token={token} />
        </>}
      </div>
    </div>
  );
}
