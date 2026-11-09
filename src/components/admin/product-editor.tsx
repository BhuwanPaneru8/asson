"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowUp, ArrowDown, Trash2, Plus, Wand2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { saveProduct, type ProductInput } from "@/actions/admin/catalog";
import { formatPrice, slugify } from "@/lib/utils";
import { Card } from "./ui";

type V = { id?: string; sku: string; color: string; colorHex: string; size: string; stock: number; costPrice?: number | null };
type Img = { url: string; alt: string; color: string | null };
type Initial = Omit<ProductInput, "variants" | "images" | "price" | "compareAtPrice"> & { id: string; price: string; compareAtPrice: string; images: Img[]; variants: V[] };

const SIZE_PRESETS: Record<string, string[]> = {
  "Tops (XS–XXL)": ["XS", "S", "M", "L", "XL", "XXL"],
  "Waist (28–38)": ["28", "30", "32", "34", "36", "38"],
  "Women waist (26–34)": ["26", "28", "30", "32", "34"],
  "Kids (2–11Y)": ["2-3Y", "4-5Y", "6-7Y", "8-9Y", "10-11Y"],
  "Free size": ["Free"],
};

const input = "h-10 w-full rounded-md border border-line bg-white px-3 text-[14px] outline-none focus:border-ink disabled:bg-cloud";
const label = "mb-1.5 block text-[13px] font-medium text-ink-soft";

export function ProductEditor({ initial, categories, collections, readOnly, showCost }: { initial?: Initial; categories: { id: string; label: string }[]; collections: { id: string; name: string }[]; readOnly?: boolean; showCost?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [f, setF] = useState({
    name: initial?.name ?? "", slug: initial?.slug ?? "", brand: initial?.brand ?? "Asson", description: initial?.description ?? "",
    details: (initial?.details ?? []).join("\n"), gender: initial?.gender ?? "UNISEX", status: initial?.status ?? "DRAFT", categoryId: initial?.categoryId ?? "",
    price: initial?.price ?? "", compareAtPrice: initial?.compareAtPrice ?? "", material: initial?.material ?? "", fit: initial?.fit ?? "", care: initial?.care ?? "",
    tags: (initial?.tags ?? []).join(", "), featured: initial?.featured ?? false, collectionIds: initial?.collectionIds ?? [],
  });
  const [images, setImages] = useState<Img[]>(initial?.images ?? []);
  const [variants, setVariants] = useState<V[]>(initial?.variants ?? []);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [newImg, setNewImg] = useState("");
  const [gen, setGen] = useState({ colors: "Black:#1C1C1C, White:#F5F5F2", preset: "Tops (XS–XXL)", stock: "20" });

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const colors = useMemo(() => [...new Set(variants.map((v) => v.color))], [variants]);
  const totalStock = variants.reduce((s, v) => s + (Number(v.stock) || 0), 0);

  const generate = () => {
    const cs = gen.colors.split(",").map((c) => c.trim()).filter(Boolean).map((c) => { const [name, hex] = c.split(":").map((x) => x.trim()); return { name, hex: /^#[0-9a-f]{6}$/i.test(hex ?? "") ? hex : "#999999" }; });
    const sizes = SIZE_PRESETS[gen.preset];
    const base = (slugify(f.name || "SKU").split("-").map((w) => w[0]).join("").toUpperCase() || "SKU").slice(0, 5);
    const next = [...variants];
    for (const c of cs) for (const s of sizes) {
      if (next.some((v) => v.color === c.name && v.size === s)) continue;
      next.push({ sku: `${base}-${c.name.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase()}-${s}`.replace(/[^A-Z0-9-]/gi, ""), color: c.name, colorHex: c.hex, size: s, stock: Number(gen.stock) || 0 });
    }
    setVariants(next);
  };

  const updV = (i: number, patch: Partial<V>) => setVariants((vs) => vs.map((v, j) => (j === i ? { ...v, ...patch } : v)));
  const moveImg = (i: number, d: -1 | 1) => setImages((im) => { const n = [...im]; const j = i + d; if (j < 0 || j >= n.length) return n; [n[i], n[j]] = [n[j], n[i]]; return n; });

  const save = () => start(async () => {
    const payload: ProductInput = {
      ...f,
      details: f.details.split("\n").map((d) => d.trim()).filter(Boolean),
      tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean),
      compareAtPrice: f.compareAtPrice || "",
      images, variants,
      gender: f.gender as ProductInput["gender"], status: f.status as ProductInput["status"],
    };
    const r = await saveProduct(payload, initial?.id);
    if (r.ok) { toast.success("Product saved"); setErrors({}); if (!initial) router.push(`/admin/products/${r.id}`); else router.refresh(); }
    else { setErrors(r.fieldErrors ?? {}); toast.error(r.error ?? "Please fix the highlighted fields."); }
  });

  const err = (k: string) => (errors[k] ? <p className="mt-1 text-[12.5px] text-danger">{errors[k]}</p> : null);

  return (
    <div className="pb-24">
      <Link href="/admin/products" className="mb-4 inline-flex items-center gap-1.5 text-[13.5px] text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> Products</Link>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[24px] font-semibold">{initial ? f.name || "Edit product" : "New product"}</h1>
        <div className="flex items-center gap-4">
          {initial && <Link href={`/admin/labels?product=${initial.id}`} className="text-[13.5px] underline">Print barcode labels</Link>}
          {initial && f.status === "ACTIVE" && <Link href={`/p/${f.slug}`} target="_blank" className="inline-flex items-center gap-1.5 text-[13.5px] underline">View in store <ExternalLink className="h-3.5 w-3.5" /></Link>}
        </div>
      </div>
      {readOnly && <p className="mb-4 rounded-md bg-[#fbf1df] px-4 py-3 text-[13.5px] text-warn">You have view-only access. Ask an admin to edit products; stock can be adjusted from Inventory.</p>}

      <fieldset disabled={readOnly || pending} className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card title="Details">
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <div className="sm:col-span-2"><label className={label}>Name<input className={input} value={f.name} onChange={(e) => set("name", e.target.value)} /></label>{err("name")}</div>
              <div><label className={label}>Brand<input className={input} value={f.brand} onChange={(e) => set("brand", e.target.value)} /></label>{err("brand")}</div>
              <div><label className={label}>URL slug<input className={input} value={f.slug} placeholder={slugify(f.name)} onChange={(e) => set("slug", e.target.value)} /></label>{err("slug")}</div>
              <div className="sm:col-span-2"><label className={label}>Description<textarea className={`${input} h-28 py-2`} value={f.description} onChange={(e) => set("description", e.target.value)} /></label>{err("description")}</div>
              <div className="sm:col-span-2"><label className={label}>Key features (one per line)<textarea className={`${input} h-24 py-2`} value={f.details} onChange={(e) => set("details", e.target.value)} /></label></div>
              <label className={label}>Fabric<input className={input} value={f.material} onChange={(e) => set("material", e.target.value)} placeholder="100% cotton" /></label>
              <label className={label}>Fit<input className={input} value={f.fit} onChange={(e) => set("fit", e.target.value)} placeholder="Regular fit" /></label>
              <label className={`${label} sm:col-span-2`}>Care<input className={input} value={f.care} onChange={(e) => set("care", e.target.value)} /></label>
            </div>
          </Card>

          <Card title={`Images (${images.length})`}>
            <div className="p-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {images.map((im, i) => (
                  <div key={im.url + i} className="rounded-md border border-line p-2">
                    <div className="relative aspect-[3/4] overflow-hidden rounded bg-cloud"><Image src={im.url} alt="" fill sizes="160px" className="object-cover" />{i === 0 && <span className="absolute left-1 top-1 rounded bg-ink px-1.5 text-[10.5px] text-white">Main</span>}</div>
                    <select value={im.color ?? ""} onChange={(e) => setImages((x) => x.map((y, j) => (j === i ? { ...y, color: e.target.value || null } : y)))} className="mt-2 h-8 w-full rounded border border-line text-[12px]" aria-label="Image colour">
                      <option value="">All colours</option>{colors.map((c) => <option key={c}>{c}</option>)}
                    </select>
                    <div className="mt-1.5 flex justify-between">
                      <button type="button" onClick={() => moveImg(i, -1)} aria-label="Move left" className="p-1 hover:bg-cloud"><ArrowUp className="h-3.5 w-3.5 -rotate-90" /></button>
                      <button type="button" onClick={() => moveImg(i, 1)} aria-label="Move right" className="p-1 hover:bg-cloud"><ArrowDown className="h-3.5 w-3.5 -rotate-90" /></button>
                      <button type="button" onClick={() => setImages((x) => x.filter((_, j) => j !== i))} aria-label="Remove image" className="p-1 text-danger hover:bg-cloud"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <input className={input} value={newImg} onChange={(e) => setNewImg(e.target.value)} placeholder="Paste image URL (https://…)" />
                <button type="button" onClick={() => { if (/^https:\/\//.test(newImg)) { setImages((x) => [...x, { url: newImg.trim(), alt: f.name, color: null }]); setNewImg(""); } else toast.error("Use an https:// image URL"); }} className="h-10 shrink-0 rounded-md border border-line bg-white px-4 text-[14px] hover:border-ink">Add</button>
              </div>
              <p className="mt-2 text-[12.5px] text-muted">Tip: use 3:4 portrait photos. Assign images to a colour so shoppers see the right shot when they switch swatches.</p>
              {errors["images.0.url"] && <p className="mt-1 text-[12.5px] text-danger">{errors["images.0.url"]}</p>}
            </div>
          </Card>

          <Card title={`Variants (${variants.length}) · ${totalStock} units`}>
            <div className="border-b border-line bg-cloud/40 p-5">
              <p className="mb-3 flex items-center gap-2 text-[13.5px] font-medium"><Wand2 className="h-4 w-4" /> Generate colour × size matrix</p>
              <div className="grid gap-2 sm:grid-cols-[1fr_180px_90px_auto]">
                <input className={input} value={gen.colors} onChange={(e) => setGen({ ...gen, colors: e.target.value })} aria-label="Colours" placeholder="Name:#hex, Name:#hex" />
                <select className={input} value={gen.preset} onChange={(e) => setGen({ ...gen, preset: e.target.value })} aria-label="Size run">{Object.keys(SIZE_PRESETS).map((k) => <option key={k}>{k}</option>)}</select>
                <input className={input} value={gen.stock} onChange={(e) => setGen({ ...gen, stock: e.target.value.replace(/\D/g, "") })} aria-label="Starting stock" placeholder="Stock" />
                <button type="button" onClick={generate} className="h-10 rounded-md bg-ink px-4 text-[14px] text-white">Generate</button>
              </div>
            </div>
            <div className="max-h-[480px] overflow-auto">
              <table className="w-full text-[13.5px]">
                <thead className="sticky top-0 bg-white shadow-[0_1px_0_var(--color-line)]"><tr className="text-left text-[12px] uppercase tracking-wider text-muted"><th className="px-4 py-2">Colour</th><th className="px-2 py-2">Size</th><th className="px-2 py-2">SKU</th><th className="px-2 py-2">Stock</th>{showCost && <th className="px-2 py-2">Cost (Rs)</th>}<th /></tr></thead>
                <tbody className="divide-y divide-line">
                  {variants.map((v, i) => (
                    <tr key={v.id ?? `${v.color}-${v.size}-${i}`}>
                      <td className="px-4 py-1.5"><div className="flex items-center gap-2"><input type="color" value={v.colorHex} onChange={(e) => updV(i, { colorHex: e.target.value })} className="h-6 w-6 cursor-pointer rounded border-0 p-0" aria-label="Colour swatch" /><input value={v.color} onChange={(e) => updV(i, { color: e.target.value })} className="h-8 w-28 rounded border border-line px-2" aria-label="Colour name" /></div></td>
                      <td className="px-2 py-1.5"><input value={v.size} onChange={(e) => updV(i, { size: e.target.value })} className="h-8 w-16 rounded border border-line px-2" aria-label="Size" /></td>
                      <td className="px-2 py-1.5"><input value={v.sku} onChange={(e) => updV(i, { sku: e.target.value.toUpperCase() })} className="h-8 w-40 rounded border border-line px-2 font-mono text-[12.5px]" aria-label="SKU" /></td>
                      <td className="px-2 py-1.5"><input value={v.stock} onChange={(e) => updV(i, { stock: Number(e.target.value.replace(/\D/g, "")) || 0 })} inputMode="numeric" className={`h-8 w-20 rounded border px-2 tabular-nums ${v.stock === 0 ? "border-danger/40 text-danger" : "border-line"}`} aria-label="Stock" /></td>
                      {showCost && <td className="px-2 py-1.5"><input value={v.costPrice == null ? "" : v.costPrice / 100} onChange={(e) => updV(i, { costPrice: e.target.value === "" ? null : Math.round(Number(e.target.value.replace(/[^\d.]/g, "")) * 100) })} inputMode="decimal" placeholder="—" className="h-8 w-20 rounded border border-line px-2 tabular-nums" aria-label="Cost" /></td>}
                      <td className="px-2"><button type="button" onClick={() => setVariants((x) => x.filter((_, j) => j !== i))} className="p-1.5 text-muted hover:text-danger" aria-label="Remove variant"><Trash2 className="h-4 w-4" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {variants.length === 0 && <p className="p-6 text-center text-[13.5px] text-muted">No variants yet — use the generator above.</p>}
            </div>
            <div className="border-t border-line p-3"><button type="button" onClick={() => setVariants((x) => [...x, { sku: "", color: x.at(-1)?.color ?? "", colorHex: x.at(-1)?.colorHex ?? "#999999", size: "", stock: 0 }])} className="inline-flex items-center gap-1.5 text-[13.5px] underline"><Plus className="h-3.5 w-3.5" /> Add single variant</button></div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Status">
            <div className="space-y-3 p-5">
              <select className={input} value={f.status} onChange={(e) => set("status", e.target.value as typeof f.status)} aria-label="Status"><option value="DRAFT">Draft — hidden</option><option value="ACTIVE">Active — live in store</option><option value="ARCHIVED">Archived</option></select>
              <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" checked={f.featured} onChange={(e) => set("featured", e.target.checked)} className="h-4 w-4 accent-ink" /> Featured (boosted in listings)</label>
            </div>
          </Card>
          <Card title="Pricing">
            <div className="grid grid-cols-2 gap-3 p-5">
              <div><label className={label}>Selling price (Rs)<input className={input} inputMode="decimal" value={f.price} onChange={(e) => set("price", e.target.value)} /></label>{err("price")}</div>
              <div><label className={label}>MRP (Rs, optional)<input className={input} inputMode="decimal" value={f.compareAtPrice} onChange={(e) => set("compareAtPrice", e.target.value)} /></label>{err("compareAtPrice")}</div>
              {Number(f.compareAtPrice) > Number(f.price) && Number(f.price) > 0 && <p className="col-span-2 text-[12.5px] text-success">Shows as {Math.round((1 - Number(f.price) / Number(f.compareAtPrice)) * 100)}% off</p>}
              {showCost && (() => { const costs = variants.map((v) => v.costPrice).filter((c): c is number => c != null); if (!costs.length || !Number(f.price)) return null; const avg = costs.reduce((a, b) => a + b, 0) / costs.length; const m = Math.round((1 - avg / (Number(f.price) * 100)) * 1000) / 10; return <p className={`col-span-2 text-[12.5px] ${m < 35 ? "text-warn" : "text-muted"}`}>Avg cost {formatPrice(Math.round(avg))} · gross margin {m}%</p>; })()}
            </div>
          </Card>
          <Card title="Organisation">
            <div className="space-y-3 p-5">
              <div><label className={label}>Category<select className={input} value={f.categoryId} onChange={(e) => set("categoryId", e.target.value)}><option value="">Select…</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>{err("categoryId")}</div>
              <label className={label}>Audience<select className={input} value={f.gender} onChange={(e) => set("gender", e.target.value as typeof f.gender)}><option value="MEN">Men</option><option value="WOMEN">Women</option><option value="KIDS">Kids</option><option value="UNISEX">Unisex</option></select></label>
              <label className={label}>Search tags (comma separated)<input className={input} value={f.tags} onChange={(e) => set("tags", e.target.value)} placeholder="tshirt, cotton, summer" /></label>
              <div>
                <p className={label}>Collections</p>
                <div className="space-y-1.5">{collections.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-[14px]"><input type="checkbox" className="h-4 w-4 accent-ink" checked={f.collectionIds.includes(c.id)} onChange={(e) => set("collectionIds", e.target.checked ? [...f.collectionIds, c.id] : f.collectionIds.filter((x) => x !== c.id))} />{c.name}</label>
                ))}</div>
              </div>
            </div>
          </Card>
        </div>
      </fieldset>

      {!readOnly && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 backdrop-blur lg:left-60">
          <div className="flex items-center justify-end gap-3 px-4 py-3 md:px-8">
            {Object.keys(errors).length > 0 && <p className="mr-auto text-[13px] text-danger">Some fields need attention.</p>}
            <Link href="/admin/products" className="rounded-md px-4 py-2 text-[14px] hover:bg-cloud">Discard</Link>
            <button onClick={save} disabled={pending} className="rounded-md bg-ink px-5 py-2 text-[14px] font-medium text-white disabled:opacity-50">{pending ? "Saving…" : initial ? "Save changes" : "Create product"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
