"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, ExternalLink, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { deleteLook, lookProductSearch, saveLook } from "@/actions/admin/lookbook";
import { PhotoUploader } from "./photo-uploader";
import { cn, formatPrice } from "@/lib/utils";

type Piece = { productId: string; name: string; price: number; image: string | null; note: string };
type Look = { id?: string; title: string; slug: string; subtitle: string; story: string; heroImage: string; published: boolean; position: number; items: Piece[] };
type Hit = Awaited<ReturnType<typeof lookProductSearch>>[number];
const input = "mt-1 h-10 w-full rounded-md border border-line bg-white px-3 text-[14px] outline-none focus:border-ink";
const label = "block text-[13px] font-medium text-ink-soft";

export function LookEditor({ look: initial }: { look: Look }) {
  const [look, setLook] = useState(initial);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const set = <K extends keyof Look>(k: K, v: Look[K]) => setLook((x) => ({ ...x, [k]: v }));
  const move = (i: number, d: -1 | 1) => setLook((x) => {
    const items = [...x.items];
    [items[i], items[i + d]] = [items[i + d], items[i]];
    return { ...x, items };
  });
  const search = (e: React.FormEvent) => { e.preventDefault(); start(async () => { const h = await lookProductSearch(q); setHits(h); if (!h.length) toast("No products on sale match that"); }); };
  const add = (h: Hit) => {
    if (look.items.some((i) => i.productId === h.id)) return void toast("Already in this look");
    set("items", [...look.items, { productId: h.id, name: h.name, price: h.price, image: h.image, note: "" }]);
  };
  const save = (published: boolean) => start(async () => {
    const r = await saveLook({ ...look, published, items: look.items.map((i) => ({ productId: i.productId, note: i.note })) }, look.id);
    if (r && !r.ok) { setErrors(r.fieldErrors ?? {}); toast.error(r.error); return; }
    setErrors({}); set("published", published);
    toast.success(published ? "Published to the lookbook" : "Saved as draft");
  });
  const remove = () => { if (look.id && confirm("Delete this look? The products themselves aren't touched.")) start(async () => { await deleteLook(look.id!); }); };
  const total = look.items.reduce((s, i) => s + i.price, 0);
  const hero = look.heroImage || look.items[0]?.image;

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        <section className="space-y-3 rounded-lg border border-line bg-white p-5">
          <label className={label}>Title<input className={input} value={look.title} onChange={(e) => set("title", e.target.value)} placeholder="Weekend in Pokhara" />{errors.title && <span className="text-[12px] text-danger">{errors.title}</span>}</label>
          <label className={label}>One line under the title<input className={input} value={look.subtitle} onChange={(e) => set("subtitle", e.target.value)} placeholder="Linen, sandals and a long lunch by Phewa" /></label>
          <label className={label}>The story <span className="font-normal text-muted">(a few sentences: when you&apos;d wear it, how it feels)</span>
            <textarea className={cn(input, "h-28 py-2")} value={look.story} onChange={(e) => set("story", e.target.value)} maxLength={1200} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={label}>Web address<input className={input} value={look.slug} onChange={(e) => set("slug", e.target.value)} placeholder="weekend-in-pokhara" />{errors.slug && <span className="text-[12px] text-danger">{errors.slug}</span>}</label>
            <label className={label}>Order <span className="font-normal text-muted">(lower shows first)</span><input className={input} value={look.position} onChange={(e) => set("position", Number(e.target.value.replace(/\D/g, "")) || 0)} inputMode="numeric" /></label>
          </div>
        </section>

        <section className="rounded-lg border border-line bg-white">
          <div className="flex items-center justify-between border-b border-line px-5 py-3"><h2 className="text-[15px] font-semibold">Pieces ({look.items.length})</h2><span className="text-[13px] text-muted">Whole look {formatPrice(total)}</span></div>
          <form onSubmit={search} className="flex gap-2 border-b border-line p-3">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products on sale by name, tag or SKU" aria-label="Search products" className="h-10 flex-1 rounded-md border border-line px-3 text-[14px] outline-none focus:border-ink" />
            <button className="flex h-10 items-center gap-1.5 rounded-md border border-line px-3 text-[14px] hover:border-ink"><Search className="h-4 w-4" /> Find</button>
          </form>
          {hits.length > 0 && (
            <ul className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto border-b border-line p-3 sm:grid-cols-3">
              {hits.map((h) => (
                <li key={h.id}><button type="button" onClick={() => add(h)} className="flex w-full items-center gap-2 rounded-md border border-line p-1.5 text-left text-[12.5px] hover:border-ink">
                  <span className="relative h-12 w-9 shrink-0 bg-cloud">{h.image && <Image src={h.image} alt="" fill sizes="36px" className="object-cover" />}</span>
                  <span className="min-w-0"><span className="line-clamp-2">{h.name}</span><span className="text-muted">{formatPrice(h.price)}</span></span>
                </button></li>
              ))}
            </ul>
          )}
          <ol className="divide-y divide-line">
            {look.items.map((it, i) => (
              <li key={it.productId} className="flex items-center gap-3 px-4 py-2.5">
                <span className="relative h-16 w-12 shrink-0 bg-cloud">{it.image && <Image src={it.image} alt="" fill sizes="48px" className="object-cover" />}</span>
                <div className="min-w-0 flex-1 text-[13.5px]">
                  <p className="truncate font-medium">{it.name} <span className="font-normal text-muted">· {formatPrice(it.price)}</span></p>
                  <input value={it.note} onChange={(e) => set("items", look.items.map((x) => (x.productId === it.productId ? { ...x, note: e.target.value } : x)))} maxLength={120} placeholder="Styling tip (optional), e.g. sleeves rolled twice" aria-label={`Styling tip for ${it.name}`} className="mt-1 h-8 w-full rounded border border-line px-2 text-[13px]" />
                </div>
                <div className="flex shrink-0 items-center">
                  <button type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${it.name} up`} className="p-1.5 text-muted hover:text-ink disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                  <button type="button" disabled={i === look.items.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${it.name} down`} className="p-1.5 text-muted hover:text-ink disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                  <button type="button" onClick={() => set("items", look.items.filter((x) => x.productId !== it.productId))} aria-label={`Remove ${it.name}`} className="p-1.5 text-muted hover:text-danger"><X className="h-4 w-4" /></button>
                </div>
              </li>
            ))}
            {!look.items.length && <li className="p-8 text-center text-[14px] text-muted">Search above and add 2–6 pieces that are worn together.</li>}
          </ol>
        </section>
      </div>

      <aside className="space-y-4">
        <section className="rounded-lg border border-line bg-white p-4">
          <h2 className="mb-2 text-[15px] font-semibold">Hero photo</h2>
          <div className="relative mb-3 aspect-[4/5] overflow-hidden bg-cloud">
            {hero ? <Image src={hero} alt="" fill sizes="380px" className="object-cover" /> : <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-[13px] text-muted">Upload a styled photo of the whole outfit. Until then the first piece&apos;s photo is used.</p>}
          </div>
          <PhotoUploader slotsLeft={1} disabled={pending} onUploaded={(url) => set("heroImage", url)} />
          {look.heroImage && <button type="button" onClick={() => set("heroImage", "")} className="mt-2 text-[12.5px] text-muted underline">Use the first piece&apos;s photo instead</button>}
          {errors.heroImage && <p className="mt-1 text-[12px] text-danger">{errors.heroImage}</p>}
          <p className="mt-2 text-[12px] text-muted">Use your own photos (or ones you have the rights to). Portrait works best.</p>
        </section>
        <section className="space-y-2 rounded-lg border border-line bg-white p-4">
          <p className="text-[13.5px]">{look.published ? <span className="text-success">● Published</span> : <span className="text-muted">○ Draft: only staff can see it here</span>}</p>
          <button type="button" disabled={pending} onClick={() => save(true)} className="h-10 w-full rounded-md bg-ink text-[14px] font-medium text-white disabled:opacity-40">{look.published ? "Save changes" : "Publish"}</button>
          <button type="button" disabled={pending} onClick={() => save(false)} className="h-10 w-full rounded-md border border-line bg-white text-[14px] hover:border-ink disabled:opacity-40">{look.published ? "Unpublish" : "Save draft"}</button>
          {look.published && look.slug && <Link href={`/lookbook/${look.slug}`} target="_blank" className="flex h-10 items-center justify-center gap-1.5 text-[13.5px] underline">View on the shop <ExternalLink className="h-3.5 w-3.5" /></Link>}
          {look.id && <button type="button" disabled={pending} onClick={remove} className="flex h-9 w-full items-center justify-center gap-1.5 text-[13px] text-muted hover:text-danger"><Trash2 className="h-4 w-4" /> Delete look</button>}
        </section>
      </aside>
    </div>
  );
}
