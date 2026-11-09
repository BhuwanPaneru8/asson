import type { Metadata } from "next";

export const metadata: Metadata = { title: "Size guide" };

const TOPS = [["XS", "34–36", "28–30"], ["S", "36–38", "30–32"], ["M", "38–40", "32–34"], ["L", "40–42", "34–36"], ["XL", "42–44", "36–38"], ["XXL", "44–46", "38–40"]];
const BOTTOMS = [["26", "26", "35"], ["28", "28", "37"], ["30", "30", "39"], ["32", "32", "41"], ["34", "34", "43"], ["36", "36", "45"], ["38", "38", "47"]];
const KIDS = [["2-3Y", "92–98", "53"], ["4-5Y", "104–110", "56"], ["6-7Y", "116–122", "60"], ["8-9Y", "128–134", "64"], ["10-11Y", "140–146", "68"]];

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

export default function SizeGuide() {
  return (
    <div className="container-page max-w-3xl py-12">
      <h1 className="font-display text-5xl">Size guide</h1>
      <p className="mt-3 text-muted">Measurements are body measurements in inches unless noted. Between sizes? Size up for a relaxed fit.</p>
      <Table title="Tops, shirts & knitwear" head={["Size", "Chest (in)", "Waist (in)"]} rows={TOPS} />
      <Table title="Jeans & trousers" head={["Size", "Waist (in)", "Hip (in)"]} rows={BOTTOMS} />
      <Table title="Kids" head={["Age", "Height (cm)", "Chest (cm)"]} rows={KIDS} />
      <div className="mt-10 bg-cloud p-6 text-[14.5px] text-ink-soft"><p className="font-semibold text-ink">How to measure</p><p className="mt-2"><b>Chest:</b> around the fullest part, under the arms. <b>Waist:</b> around your natural waistline. <b>Hip:</b> around the fullest part of your hips.</p></div>
    </div>
  );
}
