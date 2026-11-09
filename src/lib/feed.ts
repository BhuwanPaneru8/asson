// Product catalogue feed for Google Merchant Center and Meta (Facebook/Instagram) Commerce.
// One <item> per variant (colour × size), grouped by item_group_id — the format both accept.
import type { Gender } from "@prisma/client";

export type FeedProduct = {
  id: string; slug: string; name: string; brand: string; description: string; gender: Gender;
  price: number; compareAtPrice: number | null; material: string | null;
  category: string; images: { url: string; color: string | null }[];
  variants: { sku: string; color: string; size: string; stock: number }[];
};

const esc = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
const money = (paisa: number) => `${(paisa / 100).toFixed(2)} NPR`;
const GENDER: Record<Gender, string> = { MEN: "male", WOMEN: "female", UNISEX: "unisex", KIDS: "unisex" };

export function renderFeed(products: FeedProduct[], opts: { siteUrl: string; storeName: string }) {
  const base = opts.siteUrl.replace(/\/$/, "");
  const abs = (u: string) => (u.startsWith("http") ? u : `${base}${u}`);
  const items: string[] = [];
  for (const p of products) {
    const onSale = p.compareAtPrice != null && p.compareAtPrice > p.price;
    for (const v of p.variants) {
      const imgs = p.images.filter((i) => i.color === v.color);
      const pics = (imgs.length ? imgs : p.images).map((i) => abs(i.url));
      if (!pics.length) continue; // both platforms reject items without an image
      const tag = (k: string, val: string | null | undefined) => (val ? `<g:${k}>${esc(val)}</g:${k}>` : "");
      items.push([
        "<item>",
        tag("id", v.sku),
        tag("item_group_id", p.id),
        `<title>${esc(`${p.name} — ${v.color}, ${v.size}`.slice(0, 150))}</title>`,
        `<description>${esc(p.description.slice(0, 5000))}</description>`,
        `<link>${esc(`${base}/p/${p.slug}?color=${encodeURIComponent(v.color)}`)}</link>`,
        tag("image_link", pics[0]),
        ...pics.slice(1, 10).map((u) => tag("additional_image_link", u)),
        tag("availability", v.stock > 0 ? "in_stock" : "out_of_stock"),
        tag("quantity_to_sell_on_facebook", String(Math.max(0, v.stock))),
        tag("price", money(onSale ? p.compareAtPrice! : p.price)),
        onSale ? tag("sale_price", money(p.price)) : "",
        tag("brand", p.brand),
        tag("condition", "new"),
        tag("identifier_exists", "no"),
        tag("google_product_category", "1604"), // Apparel & Accessories > Clothing
        tag("product_type", p.category),
        tag("gender", GENDER[p.gender]),
        tag("age_group", p.gender === "KIDS" ? "kids" : "adult"),
        tag("color", v.color),
        tag("size", v.size),
        tag("material", p.material),
        tag("shipping_label", "standard"),
        "</item>",
      ].filter(Boolean).join(""));
    }
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel><title>${esc(opts.storeName)}</title><link>${esc(base)}</link><description>${esc(`${opts.storeName} product catalogue`)}</description>
${items.join("\n")}
</channel></rss>
`;
}
