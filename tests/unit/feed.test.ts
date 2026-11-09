import { describe, expect, it } from "vitest";
import { renderFeed, type FeedProduct } from "@/lib/feed";

const p: FeedProduct = {
  id: "p1", slug: "oxford-shirt", name: "Oxford Shirt & Co", brand: "Asson", description: "Crisp <cotton>.", gender: "MEN",
  price: 199_900, compareAtPrice: 249_900, material: "Cotton", category: "Men > Shirts",
  images: [{ url: "/a.jpg", color: "White" }, { url: "https://cdn/b.jpg", color: "Blue" }],
  variants: [{ sku: "AS-1", color: "White", size: "M", stock: 3 }, { sku: "AS-2", color: "Blue", size: "L", stock: 0 }],
};

describe("product feed", () => {
  const xml = renderFeed([p], { siteUrl: "https://asson.com.np/", storeName: "Asson" });
  it("one item per variant, grouped, with sale price and availability", () => {
    expect(xml.match(/<item>/g)).toHaveLength(2);
    expect(xml).toContain("<g:id>AS-1</g:id><g:item_group_id>p1</g:item_group_id>");
    expect(xml).toContain("<g:price>2499.00 NPR</g:price><g:sale_price>1999.00 NPR</g:sale_price>");
    expect(xml).toContain("<g:availability>out_of_stock</g:availability>");
    expect(xml).toContain("<g:image_link>https://asson.com.np/a.jpg</g:image_link>");
    expect(xml).toContain("<g:image_link>https://cdn/b.jpg</g:image_link>"); // colour-matched image
  });
  it("escapes XML", () => {
    expect(xml).toContain("Oxford Shirt &amp; Co — White, M");
    expect(xml).toContain("Crisp &lt;cotton&gt;.");
    expect(xml).not.toMatch(/<cotton>/);
  });
});
