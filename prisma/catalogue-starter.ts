/**
 * Starter catalogue for a live shop: classic, premium-fabric wardrobe basics under the Asson
 * labels, plus a festive edit. Safe on production:
 *  - adds products whose slug doesn't exist yet; never edits or deletes existing products
 *  - needs the categories from prisma/bootstrap.ts
 *  - every unit of starting stock is written to the inventory ledger ("RECEIVED · Starter catalogue")
 *
 * Prices, stock and fabric details are a starting point for the owner to correct in
 * Admin → Products. Photos are Unsplash placeholders until real product photos replace them.
 *
 *   deploy/with-db.sh production npx tsx prisma/catalogue-starter.ts
 */
import { PrismaClient, type Gender } from "@prisma/client";

const U = (id: string) => `https://images.unsplash.com/photo-${id}`;

const COLORS: Record<string, string> = {
  White: "#F5F5F2", Black: "#1C1C1C", Navy: "#1F2A44", Grey: "#9A9A9A", Charcoal: "#3C3C3C", Olive: "#5B6338",
  Beige: "#D9C7A7", Sand: "#C8B48F", Maroon: "#6B1E2C", "Sky Blue": "#8DB6D9", Indigo: "#2E3A6E",
  "Light Wash": "#9BB3CC", "Dark Wash": "#2C3A55", Blush: "#E8B9B0", Sage: "#A7B59A", Cream: "#F1E9D8",
  Emerald: "#1F6B4F", Lilac: "#B9A6D3", Red: "#B3262E", Brown: "#6B4A33", Khaki: "#B5A27A", Ivory: "#F4EFE3",
};

const TOP = ["S", "M", "L", "XL", "XXL"];
const WOMEN = ["XS", "S", "M", "L", "XL"];
const WAIST = ["28", "30", "32", "34", "36"];
const WOMEN_WAIST = ["26", "28", "30", "32", "34"];
const KIDS = ["2-3Y", "4-5Y", "6-7Y", "8-9Y", "10-11Y"];

const CORE = "Asson";
const STUDIO = "Asson Studio";

type Item = {
  name: string; cat: string; gender: Gender; brand: string; price: number; colors: string[]; sizes: string[];
  images: string[]; material: string; fit: string; care: string; desc: string; details: string[]; tags: string[];
  collections?: string[]; featured?: boolean; pairs?: string[];
};

const CARE_COTTON = "Machine wash cold, inside out, with like colours. Do not bleach. Line dry in shade. Warm iron.";
const CARE_LINEN = "Hand or gentle machine wash cold. Line dry. Iron while slightly damp; linen's soft creases are part of its character.";
const CARE_WOOL = "Hand wash cold with wool detergent or dry clean. Dry flat. Store folded, never on a hanger.";
const CARE_DRY = "Dry clean only. Store on a wide hanger in a breathable garment bag.";
const CARE_DENIM = "Wash rarely, cold and inside out. Line dry. Raw denim: wait at least a month before the first wash.";

export const STARTER: Item[] = [
  // ——— Men: tees & polos ———
  { name: "Supima Cotton Crew Tee", cat: "men-t-shirts", gender: "MEN", brand: CORE, price: 1890, colors: ["White", "Black", "Navy", "Sand"], sizes: TOP, images: ["1521572163474-6864f9cf17ab", "1581655353564-df123a1eb820"], material: "100% Supima long-staple cotton, 200 GSM", fit: "Regular fit", care: CARE_COTTON, desc: "The everyday tee, done properly. Long-staple Supima cotton gives a smooth, cool hand and a gentle sheen, and it keeps its shape wash after wash.", details: ["Long-staple Supima cotton", "Taped neck seam that won't stretch out", "Pre-shrunk, so the size stays true"], tags: ["tshirt", "tee", "basics", "cotton", "supima", "classic"], collections: ["the-essentials"], featured: true, pairs: ["cotton-twill-chinos", "slim-tapered-jeans"] },
  { name: "Long-Staple Piqué Polo", cat: "men-t-shirts", gender: "MEN", brand: CORE, price: 2490, colors: ["Navy", "White", "Olive"], sizes: TOP, images: ["1586790170083-2f9ceadc732d", "1618354691373-d851c5c3a990"], material: "100% long-staple cotton piqué", fit: "Tailored fit", care: CARE_COTTON, desc: "A crisp piqué polo with a collar that keeps its shape. Smart enough for the office, easy enough for the weekend.", details: ["Two-button placket with mother-of-pearl-effect buttons", "Ribbed collar and cuffs", "Split side hem"], tags: ["polo", "collar", "classic", "cotton"], collections: ["the-essentials"], pairs: ["cotton-twill-chinos"] },

  // ——— Men: shirts ———
  { name: "Oxford Button-Down Shirt", cat: "men-shirts", gender: "MEN", brand: CORE, price: 3290, colors: ["Sky Blue", "White"], sizes: TOP, images: ["1596755094514-f87e34085b2c", "1602810318383-e386cc2a3ccf"], material: "100% cotton Oxford weave", fit: "Tailored fit", care: CARE_COTTON, desc: "The original button-down in a substantial Oxford weave that softens beautifully with age. Wear it with a blazer or rolled up with chinos.", details: ["Button-down collar", "Back box pleat", "Curved hem: tucked or untucked"], tags: ["shirt", "oxford", "office", "classic"], collections: ["the-essentials"], featured: true, pairs: ["cotton-twill-chinos", "unstructured-cotton-linen-blazer"] },
  { name: "Pure Linen Shirt", cat: "men-shirts", gender: "MEN", brand: STUDIO, price: 3990, colors: ["White", "Beige", "Sage"], sizes: TOP, images: ["1620012253295-c15cc3e65df4", "1598033129183-c4f50c736f10"], material: "100% European flax linen", fit: "Relaxed fit", care: CARE_LINEN, desc: "Breathable flax linen, garment-washed for softness from the first wear. Cool in the Terai heat, easy to layer in the Valley.", details: ["Garment-washed linen", "Corozo buttons", "Single chest pocket"], tags: ["shirt", "linen", "summer", "classic"], pairs: ["cotton-twill-chinos", "pleated-wool-trousers"] },
  { name: "Giza Cotton Poplin Shirt", cat: "men-shirts", gender: "MEN", brand: STUDIO, price: 3490, colors: ["White", "Sky Blue"], sizes: TOP, images: ["1598033129183-c4f50c736f10", "1596755094514-f87e34085b2c"], material: "100% Egyptian Giza cotton poplin, two-ply", fit: "Slim fit", care: CARE_COTTON, desc: "A dress shirt in fine two-ply Giza cotton: crisp, lightly lustrous and comfortable all day under a suit.", details: ["Two-ply Giza cotton", "Semi-spread collar", "Adjustable two-button cuffs"], tags: ["shirt", "formal", "dress shirt", "wedding"], pairs: ["two-piece-wool-suit", "pleated-wool-trousers"] },

  // ——— Men: jeans & trousers ———
  { name: "Selvedge Straight Jeans", cat: "men-jeans", gender: "MEN", brand: STUDIO, price: 5990, colors: ["Indigo"], sizes: WAIST, images: ["1541099649105-f69ad21f3246", "1604176354204-9268737828e4"], material: "100% cotton selvedge denim, 13.5 oz", fit: "Straight fit", care: CARE_DENIM, desc: "Rigid selvedge denim that fades to fit your life. A jean for a decade, not a season.", details: ["Selvedge outseam", "Copper rivets and button fly", "Unwashed raw denim: expect it to soften and fade"], tags: ["jeans", "selvedge", "raw denim", "classic"], pairs: ["oxford-button-down-shirt", "denim-trucker-jacket"] },
  { name: "Slim Tapered Jeans", cat: "men-jeans", gender: "MEN", brand: CORE, price: 3990, colors: ["Dark Wash", "Black"], sizes: WAIST, images: ["1542272604-787c3835535d", "1541099649105-f69ad21f3246"], material: "98% cotton, 2% elastane denim, 12 oz", fit: "Slim tapered", care: CARE_DENIM, desc: "Slim through the thigh, tapered to the ankle, with just enough stretch to move. The pair you'll wear most.", details: ["Five-pocket styling", "Comfort stretch", "YKK zip fly"], tags: ["jeans", "denim", "stretch", "basics"], collections: ["the-essentials"], featured: true, pairs: ["supima-cotton-crew-tee", "heavyweight-cotton-hoodie"] },
  { name: "Cotton Twill Chinos", cat: "men-trousers", gender: "MEN", brand: CORE, price: 3490, colors: ["Khaki", "Navy", "Olive"], sizes: WAIST, images: ["1624378439575-d8705ad7ae80", "1473966968600-fa801b869a1a"], material: "98% cotton twill, 2% elastane", fit: "Slim fit", care: CARE_COTTON, desc: "Smart enough for the office, comfortable enough for a long day out. Peached twill with a soft, matte finish.", details: ["Slant front pockets", "Hidden coin pocket", "Peach-finished twill"], tags: ["chinos", "trousers", "office", "basics"], collections: ["the-essentials"], featured: true, pairs: ["oxford-button-down-shirt", "long-staple-pique-polo"] },
  { name: "Pleated Wool Trousers", cat: "men-trousers", gender: "MEN", brand: STUDIO, price: 5490, colors: ["Charcoal", "Beige"], sizes: WAIST, images: ["1473966968600-fa801b869a1a", "1624378439575-d8705ad7ae80"], material: "Wool-blend suiting (60% wool)", fit: "Relaxed tapered", care: CARE_DRY, desc: "Single-pleat trousers with a generous drape and a clean taper. They lift a plain tee as easily as a crisp shirt.", details: ["Single forward pleat", "Extended tab with side adjusters", "Unhemmed for your length on request"], tags: ["trousers", "pleated", "formal", "wool", "classic"], pairs: ["giza-cotton-poplin-shirt", "pure-linen-shirt"] },

  // ——— Men: knit, jackets, tailoring ———
  { name: "Loopback Cotton Sweatshirt", cat: "men-hoodies", gender: "MEN", brand: CORE, price: 2990, colors: ["Grey", "Navy"], sizes: TOP, images: ["1578587018452-892bacefd3f2", "1556821840-3a63f95609a7"], material: "100% cotton loopback French terry, 360 GSM", fit: "Regular fit", care: CARE_COTTON, desc: "A clean crewneck in dense loopback cotton, with a vintage V-insert at the neck. Gets better every wash.", details: ["Loopback French terry", "V-stitch neckline", "Ribbed cuffs and hem"], tags: ["sweatshirt", "crew neck", "winter", "basics"], collections: ["the-essentials"], pairs: ["slim-tapered-jeans"] },
  { name: "Heavyweight Cotton Hoodie", cat: "men-hoodies", gender: "MEN", brand: CORE, price: 3490, colors: ["Grey", "Black"], sizes: TOP, images: ["1556821840-3a63f95609a7", "1620799140408-edc6dcb6d633"], material: "Cotton-rich brushed fleece, 380 GSM", fit: "Regular fit", care: CARE_COTTON, desc: "Thick, soft and built for Kathmandu winters. A hoodie with the weight to hang properly.", details: ["Double-layer hood", "Kangaroo pocket", "No drawcord: clean neckline"], tags: ["hoodie", "winter", "fleece", "basics"], pairs: ["slim-tapered-jeans"] },
  { name: "Wool-Blend Overcoat", cat: "men-jackets", gender: "MEN", brand: STUDIO, price: 12990, colors: ["Charcoal", "Beige"], sizes: TOP, images: ["1520975954732-35dd22299614"], material: "60% wool, 40% polyamide melton", fit: "Regular fit", care: CARE_DRY, desc: "A clean single-breasted overcoat that sits just above the knee. Cut to fit over a blazer or a chunky knit.", details: ["Notch lapel", "Fully lined", "Inside chest pocket"], tags: ["coat", "overcoat", "winter", "wool", "classic"], pairs: ["pleated-wool-trousers"] },
  { name: "Lambskin Leather Jacket", cat: "men-jackets", gender: "MEN", brand: STUDIO, price: 18990, colors: ["Black", "Brown"], sizes: TOP, images: ["1551028719-00167b16eac5", "1520975954732-35dd22299614"], material: "Full-grain lambskin leather, quilted lining", fit: "Slim fit", care: "Professional leather clean only. Condition twice a year. Keep away from direct heat.", desc: "A timeless leather jacket in soft full-grain lambskin that moulds to you over the years.", details: ["Full-grain lambskin", "Quilted lining", "Heavy-duty metal zips"], tags: ["jacket", "leather", "classic", "winter"], pairs: ["selvedge-straight-jeans"] },
  { name: "Denim Trucker Jacket", cat: "men-jackets", gender: "MEN", brand: CORE, price: 4990, colors: ["Light Wash", "Dark Wash"], sizes: TOP, images: ["1591047139829-d91aecb6caea", "1544022613-e87ca75a784a"], material: "100% cotton denim, 13 oz", fit: "Regular fit", care: CARE_DENIM, desc: "The classic trucker in sturdy denim. Layer it over a tee in spring, a hoodie in winter.", details: ["Button-flap chest pockets", "Adjustable waist tabs", "Bar-tacked stress points"], tags: ["jacket", "denim", "trucker", "classic"] },
  { name: "Unstructured Cotton-Linen Blazer", cat: "men-blazers", gender: "MEN", brand: STUDIO, price: 9490, colors: ["Navy", "Beige"], sizes: ["S", "M", "L", "XL"], images: ["1617137968427-85924c800a22", "1507679799987-c73779587ccf"], material: "55% linen, 45% cotton", fit: "Tailored fit", care: CARE_DRY, desc: "A soft-shouldered blazer that travels well and never looks stiff. Ideal over an Oxford shirt or a fine knit.", details: ["Unstructured, half-lined", "Patch pockets", "Two-button front, functional cuffs"], tags: ["blazer", "linen", "smart casual", "wedding"], featured: true, pairs: ["oxford-button-down-shirt", "cotton-twill-chinos"] },
  { name: "Two-Piece Wool Suit", cat: "men-blazers", gender: "MEN", brand: STUDIO, price: 22990, colors: ["Charcoal", "Navy"], sizes: ["S", "M", "L", "XL"], images: ["1594938298603-c8148c4dae35", "1617137968427-85924c800a22"], material: "Super 110s wool", fit: "Slim fit", care: CARE_DRY, desc: "A sharp two-piece in fine Super 110s wool, for weddings, receptions and the days that matter. Trousers come unhemmed for tailoring.", details: ["Half-canvas construction", "Unhemmed trousers", "Functional cuff buttons"], tags: ["suit", "formal", "wedding", "wool"], collections: ["festive-edit"], pairs: ["giza-cotton-poplin-shirt"] },

  // ——— Men: festive ———
  { name: "Handloom Cotton Kurta", cat: "men-ethnic", gender: "MEN", brand: STUDIO, price: 2990, colors: ["White", "Navy", "Maroon"], sizes: TOP, images: ["1583391733956-3750e0ff4e8b", "1617627143750-d86bc21e42bb"], material: "100% handloom cotton", fit: "Regular fit", care: "Gentle hand wash cold, separately. Dry in shade. Warm iron.", desc: "A hand-woven cotton kurta with a mandarin collar: festive, breathable and right for Tihar evenings and family pujas.", details: ["Handloom cotton: small slubs are part of the weave", "Mandarin collar", "Side slits and pocket"], tags: ["kurta", "ethnic", "festive", "tihar", "dashain"], collections: ["festive-edit"], featured: true, pairs: ["silk-blend-nehru-jacket"] },
  { name: "Silk-Blend Nehru Jacket", cat: "men-ethnic", gender: "MEN", brand: STUDIO, price: 5490, colors: ["Maroon", "Emerald", "Navy"], sizes: TOP, images: ["1617627143750-d86bc21e42bb", "1583391733956-3750e0ff4e8b"], material: "Silk-blend jacquard, fully lined", fit: "Tailored fit", care: CARE_DRY, desc: "A jacquard Nehru jacket that lifts a simple kurta for weddings, Tihar and Bhai Tika.", details: ["Silk-blend jacquard", "Fully lined", "Concealed inner pocket"], tags: ["nehru jacket", "ethnic", "festive", "wedding", "tihar"], collections: ["festive-edit"], pairs: ["handloom-cotton-kurta"] },

  // ——— Women: tops & shirts ———
  { name: "Ribbed Cotton-Modal Tee", cat: "women-tops", gender: "WOMEN", brand: CORE, price: 1490, colors: ["White", "Black", "Sage", "Blush"], sizes: WOMEN, images: ["1485968579580-b6d095142e6e", "1509631179647-0177331693ae"], material: "Cotton-modal rib (60/40)", fit: "Fitted", care: CARE_COTTON, desc: "A second-skin rib tee in silky cotton-modal. The base layer for everything.", details: ["Fine 2×1 rib", "Crew neck", "Holds its shape wash after wash"], tags: ["tshirt", "tee", "basics", "rib"], collections: ["the-essentials"], featured: true, pairs: ["wide-leg-jeans", "pleated-midi-skirt"] },
  { name: "Relaxed Linen Shirt", cat: "women-tops", gender: "WOMEN", brand: STUDIO, price: 3490, colors: ["White", "Sky Blue", "Sage"], sizes: WOMEN, images: ["1434389677669-e08b4cac3105", "1485968579580-b6d095142e6e"], material: "100% European flax linen", fit: "Relaxed fit", care: CARE_LINEN, desc: "An easy linen shirt to wear open over a tee, knotted at the waist, or tucked into trousers.", details: ["Dropped shoulder", "Curved hem", "Garment-washed for softness"], tags: ["shirt", "linen", "top", "classic"], collections: ["the-essentials"], pairs: ["high-rise-straight-jeans", "pleated-midi-skirt"] },

  // ——— Women: dresses & skirts ———
  { name: "Linen Shirt Dress", cat: "women-dresses", gender: "WOMEN", brand: STUDIO, price: 4490, colors: ["White", "Sage", "Beige"], sizes: WOMEN, images: ["1572804013309-59a88b7e92f1", "1539008835657-9e8e9680c956"], material: "100% linen", fit: "Relaxed fit", care: CARE_LINEN, desc: "A breathable linen shirt dress with a removable belt and deep pockets. Effortless from morning to evening.", details: ["Removable self-belt", "Side seam pockets", "Button front, midi length"], tags: ["dress", "linen", "shirt dress", "classic"], featured: true },
  { name: "Silk-Satin Slip Dress", cat: "women-dresses", gender: "WOMEN", brand: STUDIO, price: 5490, colors: ["Emerald", "Black"], sizes: WOMEN, images: ["1539008835657-9e8e9680c956", "1515372039744-b8f02a3ae446"], material: "Silk-blend satin (30% mulberry silk)", fit: "Bias cut", care: CARE_DRY, desc: "A bias-cut slip dress that skims rather than clings. Wear it with a knit by day, alone after dark.", details: ["Bias cut", "Cowl neckline", "Adjustable straps"], tags: ["dress", "satin", "silk", "evening"], collections: ["festive-edit"], pairs: ["cable-knit-cardigan"] },
  { name: "Floral Midi Wrap Dress", cat: "women-dresses", gender: "WOMEN", brand: CORE, price: 4990, colors: ["Blush", "Navy"], sizes: WOMEN, images: ["1595777457583-95e059d581b8", "1572804013309-59a88b7e92f1"], material: "100% viscose crepe", fit: "Wrap fit", care: "Gentle wash cold or dry clean. Line dry. Cool iron.", desc: "A flattering wrap silhouette in fluid crepe with a soft floral print.", details: ["Adjustable tie waist", "Flutter sleeves", "Midi length"], tags: ["dress", "midi", "floral", "wrap"] },
  { name: "Pleated Midi Skirt", cat: "women-skirts", gender: "WOMEN", brand: STUDIO, price: 3290, colors: ["Sage", "Black", "Beige"], sizes: WOMEN, images: ["1564859228273-274232fdb516", "1583496661160-fb5886a0aaaa"], material: "Satin-finish crepe", fit: "A-line", care: "Gentle wash cold. Hang to dry. Do not iron the pleats flat.", desc: "Knife pleats that move with every step and catch the light.", details: ["Permanent knife pleats", "Elasticated back waist", "Midi length"], tags: ["skirt", "midi", "pleated", "classic"], pairs: ["ribbed-cotton-modal-tee", "merino-crew-sweater"] },

  // ——— Women: denim ———
  { name: "High-Rise Straight Jeans", cat: "women-jeans", gender: "WOMEN", brand: CORE, price: 3990, colors: ["Light Wash", "Dark Wash"], sizes: WOMEN_WAIST, images: ["1541099649105-f69ad21f3246", "1604176354204-9268737828e4"], material: "100% cotton rigid denim, 12 oz", fit: "High-rise straight", care: CARE_DENIM, desc: "A high-rise straight jean in authentic rigid denim. Honest, structured, and it only gets better.", details: ["High rise", "Straight leg, ankle length", "Button fly"], tags: ["jeans", "denim", "straight", "high rise"], collections: ["the-essentials"], pairs: ["relaxed-linen-shirt", "ribbed-cotton-modal-tee"] },
  { name: "Wide-Leg Jeans", cat: "women-jeans", gender: "WOMEN", brand: CORE, price: 4290, colors: ["Light Wash", "Indigo"], sizes: WOMEN_WAIST, images: ["1604176354204-9268737828e4", "1542272604-787c3835535d"], material: "99% cotton, 1% elastane denim", fit: "Wide leg", care: CARE_DENIM, desc: "A floor-skimming wide leg that lengthens the silhouette. Pair with a fitted top.", details: ["High rise", "Full-length wide leg", "Five-pocket styling"], tags: ["jeans", "wide leg", "denim"], pairs: ["ribbed-cotton-modal-tee"] },

  // ——— Women: knitwear & coats ———
  { name: "Merino Crew Sweater", cat: "women-knitwear", gender: "WOMEN", brand: STUDIO, price: 5990, colors: ["Cream", "Grey", "Navy"], sizes: WOMEN, images: ["1525507119028-ed4c629a60a3", "1576871337622-98d48d1cf531"], material: "100% extra-fine merino wool, 18.5 micron", fit: "Regular fit", care: CARE_WOOL, desc: "Itch-free extra-fine merino: light, warm and naturally breathable. The knit you'll live in from Kartik to Falgun.", details: ["Extra-fine 18.5 micron merino", "Fully fashioned seams", "Ribbed trims"], tags: ["sweater", "merino", "wool", "winter", "knit", "classic"], collections: ["the-essentials"], featured: true, pairs: ["pleated-midi-skirt", "high-rise-straight-jeans"] },
  { name: "Cable-Knit Cardigan", cat: "women-knitwear", gender: "WOMEN", brand: STUDIO, price: 5490, colors: ["Cream", "Brown"], sizes: WOMEN, images: ["1576871337622-98d48d1cf531", "1525507119028-ed4c629a60a3"], material: "Wool-cashmere blend (90/10)", fit: "Relaxed fit", care: CARE_WOOL, desc: "A cosy cable-knit cardigan with a touch of cashmere and horn-effect buttons.", details: ["Classic cable knit", "10% cashmere for softness", "Deep patch pockets"], tags: ["cardigan", "cable knit", "winter", "cashmere"], pairs: ["silk-satin-slip-dress"] },
  { name: "Tailored Wool Coat", cat: "women-jackets", gender: "WOMEN", brand: STUDIO, price: 14990, colors: ["Beige", "Black"], sizes: WOMEN, images: ["1520975954732-35dd22299614", "1544022613-e87ca75a784a"], material: "70% wool, 30% polyamide", fit: "Tailored fit", care: CARE_DRY, desc: "A sharply tailored coat with a belted waist and wide lapels. A forever coat.", details: ["Removable belt", "Fully lined", "Wide notch lapels"], tags: ["coat", "wool", "winter", "classic"] },

  // ——— Women: festive ———
  { name: "Cotton Kurta Set", cat: "women-ethnic", gender: "WOMEN", brand: STUDIO, price: 4990, colors: ["White", "Blush", "Sage"], sizes: WOMEN, images: ["1583391733956-3750e0ff4e8b", "1610030469983-98e550d6193c"], material: "Cotton cambric with mulmul dupatta", fit: "Straight fit", care: "Gentle hand wash cold, separately. Dry in shade. Warm iron.", desc: "A three-piece kurta, pant and dupatta set with fine thread embroidery: everyday elegance with a festive touch.", details: ["Kurta, pant and dupatta", "Thread embroidery at the yoke", "Soft mulmul dupatta"], tags: ["kurta set", "ethnic", "cotton", "festive", "tihar"], collections: ["festive-edit"], featured: true },
  { name: "Silk-Blend Zari Saree", cat: "women-ethnic", gender: "WOMEN", brand: STUDIO, price: 11990, colors: ["Red", "Maroon", "Emerald"], sizes: ["Free"], images: ["1617627143750-d86bc21e42bb", "1610030469983-98e550d6193c"], material: "Silk blend with zari weave", fit: "Free size", care: CARE_DRY, desc: "A woven silk-blend saree with rich zari motifs, for Tihar, Bhai Tika and weddings. Comes with an unstitched blouse piece.", details: ["5.5 m saree + 0.8 m blouse piece", "Zari border and pallu", "Dry clean only"], tags: ["saree", "sari", "silk", "wedding", "festive", "tihar"], collections: ["festive-edit"] },

  // ——— Kids ———
  { name: "Kids Organic Cotton Tee", cat: "kids-boys", gender: "KIDS", brand: CORE, price: 1190, colors: ["Navy", "Grey"], sizes: KIDS, images: ["1519238263530-99bdd11df2ea", "1622290291468-a28f7a7dc6a8"], material: "100% organic cotton jersey", fit: "Regular fit", care: CARE_COTTON, desc: "A soft organic cotton tee that's gentle on skin and tough enough for the playground.", details: ["Organic cotton", "Shoulder snaps on small sizes", "Reinforced neck"], tags: ["kids", "tshirt", "boys", "organic"] },
  { name: "Girls Cotton Poplin Frock", cat: "kids-girls", gender: "KIDS", brand: STUDIO, price: 2290, colors: ["Blush", "Lilac"], sizes: KIDS, images: ["1506629082955-511b1aa562c8", "1503944583220-79d8926ad5e2"], material: "100% cotton poplin, cotton lining", fit: "Regular fit", care: CARE_COTTON, desc: "A twirly cotton frock with a soft lining and a bow at the back, made for Tihar visits and birthdays.", details: ["Fully lined", "Bow tie back", "Easy back buttons"], tags: ["kids", "dress", "girls", "frock", "festive"], collections: ["festive-edit"] },
];

export const STARTER_COLLECTIONS = [
  { slug: "the-essentials", name: "The Essentials", description: "Classic wardrobe foundations in premium fabrics.", image: U("1490481651871-ab68de25d43d"), featured: true },
  { slug: "festive-edit", name: "Tihar & Festive Edit", description: "Kurtas, silk and tailoring for Tihar, Bhai Tika and the wedding season.", image: U("1610030469983-98e550d6193c"), featured: true },
];

const slugify = (x: string) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/** Starting stock per size: deeper in the core sizes. */
function startStock(size: string) {
  if (["M", "L", "30", "32", "28", "Free", "6-7Y", "8-9Y"].includes(size)) return 6;
  if (["XS", "XXL", "26", "36", "34", "2-3Y", "10-11Y"].includes(size)) return 2;
  return 4;
}

export async function loadStarterCatalogue(db: PrismaClient) {
  const result = { productsCreated: 0, productsSkipped: 0, variantsCreated: 0, unitsStocked: 0, collectionsCreated: 0 };

  for (const [i, c] of STARTER_COLLECTIONS.entries()) {
    if (await db.collection.findUnique({ where: { slug: c.slug } })) continue;
    await db.collection.create({ data: { ...c, sortOrder: i } });
    result.collectionsCreated++;
  }

  // continue the shop's AS-00001 SKU sequence
  const skus = await db.variant.findMany({ where: { sku: { startsWith: "AS-" } }, select: { sku: true } });
  let next = Math.max(0, ...skus.map((v) => Number(v.sku.slice(3))).filter(Number.isFinite)) + 1;

  for (const item of STARTER) {
    const slug = slugify(item.name);
    if (await db.product.findUnique({ where: { slug } })) { result.productsSkipped++; continue; }
    const category = await db.category.findUnique({ where: { slug: item.cat } });
    if (!category) throw new Error(`Category ${item.cat} is missing: run prisma/bootstrap.ts first.`);
    for (const c of item.colors) if (!COLORS[c]) throw new Error(`Unknown colour ${c}`);

    await db.$transaction(async (tx) => {
      const p = await tx.product.create({
        data: {
          name: item.name, slug, brand: item.brand, gender: item.gender, status: "ACTIVE",
          description: item.desc, details: item.details, material: item.material, fit: item.fit, care: item.care,
          tags: item.tags, featured: !!item.featured, price: item.price * 100,
          categoryId: category.id,
          collections: { connect: (item.collections ?? []).map((s) => ({ slug: s })) },
          images: { create: item.images.map((id, pos) => ({ url: U(id), alt: pos ? `${item.name}, alternate view` : item.name, position: pos })) },
          variants: {
            create: item.colors.flatMap((color, ci) =>
              item.sizes.map((size, si) => ({
                sku: `AS-${String(next++).padStart(5, "0")}`, color, colorHex: COLORS[color], size,
                stock: startStock(size), lowStockThreshold: 2, position: ci * 100 + si,
              })),
            ),
          },
        },
        include: { variants: true },
      });
      await tx.inventoryLog.createMany({
        data: p.variants.map((v) => ({ variantId: v.id, delta: v.stock, reason: "RECEIVED", note: "Starter catalogue" })),
      });
      result.productsCreated++;
      result.variantsCreated += p.variants.length;
      result.unitsStocked += p.variants.reduce((n, v) => n + v.stock, 0);
    });
  }

  // "Complete the look" pairings, both ways, only between products that exist
  for (const item of STARTER) {
    if (!item.pairs?.length) continue;
    const p = await db.product.findUnique({ where: { slug: slugify(item.name) }, select: { id: true } });
    const others = await db.product.findMany({ where: { slug: { in: item.pairs } }, select: { id: true } });
    if (p && others.length) {
      await db.product.update({ where: { id: p.id }, data: { pairsWith: { connect: others }, pairedBy: { connect: others } } });
    }
  }
  return result;
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL first.");
  const db = new PrismaClient();
  try {
    console.log("Created:", await loadStarterCatalogue(db));
    console.log("Now in the database:", {
      products: await db.product.count({ where: { status: "ACTIVE" } }),
      variants: await db.variant.count(),
      unitsInStock: (await db.variant.aggregate({ _sum: { stock: true } }))._sum.stock ?? 0,
    });
  } finally {
    await db.$disconnect();
  }
}

if (process.argv[1]?.endsWith("catalogue-starter.ts")) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
