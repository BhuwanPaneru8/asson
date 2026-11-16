import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { rich } from "@/lib/i18n/rich";
import { SIZE_CHARTS } from "@/lib/size-charts";

export const metadata: Metadata = { title: "Size guide" };

// the same charts as the size panel on product pages
const TOPS = SIZE_CHARTS.tops.rows;
const BOTTOMS = SIZE_CHARTS.bottoms.rows;
const KIDS = SIZE_CHARTS.kids.rows;

function Table({ title, head, rows }: { title: string; head: string[]; rows: string[][] }) {
  return (
    <section className="mt-10">
      <h2 className="mb-3 text-[18px] font-semibold">{title}</h2>
      <div className="overflow-x-auto border border-line bg-white">
        <table className="w-full text-left text-[14px]">
          <thead className="bg-cloud"><tr>{head.map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-line">{rows.map((r) => <tr key={r[0]}>{r.map((c, i) => <td key={i} className={i === 0 ? "px-4 py-3 font-medium" : "px-4 py-3 text-ink-soft"}>{c}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}

export default async function SizeGuide() {
  const { t } = await getT();
  return (
    <div className="container-page max-w-3xl py-12">
      <h1 className="font-display text-5xl">{t("nav.sizeGuide")}</h1>
      <p className="mt-3 text-muted">{t("size.intro")}</p>
      <Table title={t("size.tops")} head={[t("f.size"), t("size.chestIn"), t("size.waistIn")]} rows={TOPS} />
      <Table title={t("size.bottoms")} head={[t("f.size"), t("size.waistIn"), t("size.hipIn")]} rows={BOTTOMS} />
      <Table title={t("g.kids")} head={[t("size.age"), t("size.heightCm"), t("size.chestCm")]} rows={KIDS} />
      <div className="mt-10 bg-cloud p-6 text-[14.5px] text-ink-soft"><p className="font-semibold text-ink">{t("size.how")}</p><p className="mt-2">{rich(t("size.howBody"), { chest: <b>{t("size.chest")}</b>, waist: <b>{t("size.waist")}</b>, hip: <b>{t("size.hip")}</b> })}</p></div>
    </div>
  );
}
