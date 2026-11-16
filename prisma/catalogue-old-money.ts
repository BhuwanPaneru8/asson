/**
 * The Old Money Edit: quiet, well-made classics (cable knits, camel coats, crisp linen, pleated trousers,
 * navy tailoring, tennis whites) as a featured collection with four styled looks for the Lookbook.
 * Safe to run on any database, as often as you like:
 *  - adds only the categories, products, collection and looks whose slug doesn't exist yet; never edits or deletes
 *  - opening stock is written to the inventory ledger ("RECEIVED · Old Money Edit")
 *  - needs the root categories (Men, Women) from prisma/bootstrap.ts or the dev seed
 *
 * Photos are free-licence Unsplash pictures (unsplash.com/license) as placeholders until the owner's own product
 * photos replace them; none shows another brand's logo (check that when swapping one); prices, fabrics and stock are a starting point to correct in Admin → Products.
 *
 *   deploy/with-db.sh production npx tsx prisma/catalogue-old-money.ts
 */
import { PrismaClient } from "@prisma/client";
import { CARE_COTTON, CARE_DRY, CARE_LINEN, CARE_WOOL, TOP, U, WAIST, WOMEN, WOMEN_WAIST, loadCatalogue, slugify, type CollectionSeed, type Item } from "./catalogue-starter";

const HERITAGE = "Asson Heritage";
const EDIT = "the-old-money-edit";

/** Categories the edit needs that the shop may not have yet, under an existing parent. */
export const OLD_MONEY_CATEGORIES = [
  { slug: "men-knitwear", name: "Knitwear", nameNe: "ऊनी", parent: "men" },
  { slug: "women-trousers", name: "Trousers", nameNe: "पाइन्ट", parent: "women" },
];

export const OLD_MONEY_COLLECTIONS: CollectionSeed[] = [
  { slug: EDIT, name: "The Old Money Edit", description: "Quiet, well-made classics: cable knits, camel coats, crisp linen, pleated trousers and navy tailoring. Nothing loud, everything lasting.", image: U("1618244972963-dbee1a7edc95"), featured: true },
];

const SKIRT_CARE = "Gentle wash cold. Hang to dry. Steam the pleats rather than pressing them flat.";

export const OLD_MONEY: Item[] = [
  // ——— Men ———
  { name: "Cable-Knit Merino Crew", cat: "men-knitwear", gender: "MEN", brand: HERITAGE, price: 6490, colors: ["Navy", "Cream", "Forest"], sizes: TOP, images: ["1610901157620-340856d0a50f", "1614495039268-aa9a80429b66"], material: "100% extra-fine merino wool, 7-gauge cable", fit: "Regular fit", care: CARE_WOOL, desc: "A cable-knit crewneck in soft extra-fine merino, the kind of sweater that gets handed down. Wear it over an Oxford shirt with the collar out.", details: ["Hand-framed aran cables", "Extra-fine merino: warm without the itch", "Saddle shoulders for an easy fit"], tags: ["sweater", "cable knit", "merino", "wool", "old money", "winter", "classic"], collections: [EDIT], featured: true, pairs: ["pleated-cotton-twill-trousers", "camel-wool-overcoat"] },
  { name: "Merino Roll-Neck", cat: "men-knitwear", gender: "MEN", brand: HERITAGE, price: 5490, compareAt: 6990, colors: ["Cream", "Rust", "Charcoal"], sizes: TOP, images: ["1708299975598-46e65236fc23", "1608976328267-e673d3ec06ce"], material: "100% extra-fine merino wool, 12-gauge", fit: "Slim fit", care: CARE_WOOL, desc: "A fine-gauge roll-neck that sits neatly under a blazer or an overcoat. The cleanest way to dress up in winter.", details: ["Double-layer roll neck", "Fully fashioned seams", "Fine 12-gauge knit"], tags: ["turtleneck", "roll neck", "merino", "wool", "old money", "winter"], collections: [EDIT], pairs: ["camel-wool-overcoat", "navy-hopsack-blazer"] },
  { name: "Cashmere-Blend Quarter-Zip", cat: "men-knitwear", gender: "MEN", brand: HERITAGE, price: 7490, colors: ["Oatmeal", "Navy"], sizes: TOP, images: ["1616163106366-efdc98e1dd19", "1577120321615-6a748c007151", "1641839451594-e3293357422a"], material: "80% merino wool, 20% cashmere", fit: "Regular fit", care: CARE_WOOL, desc: "The weekend layer: a soft wool-cashmere quarter-zip over a polo or an Oxford shirt, with chinos and loafers.", details: ["20% cashmere", "Metal zip with a leather pull", "Ribbed mock neck, cuffs and hem"], tags: ["quarter zip", "sweater", "cashmere", "old money", "weekend"], collections: [EDIT], featured: true, pairs: ["pleated-cotton-twill-trousers", "knitted-cotton-polo"] },
  { name: "Knitted Cotton Polo", cat: "men-t-shirts", gender: "MEN", brand: HERITAGE, price: 3990, colors: ["Black", "Stone", "Navy"], sizes: TOP, images: ["1709746460139-92eca9f03a2b", "1625910513413-c23b8bb81cba", "1625910513394-ea511bed44ca"], material: "100% long-staple cotton, fine knit", fit: "Regular fit", care: CARE_COTTON, desc: "A knitted polo with a soft open collar: more relaxed than a shirt, sharper than a tee. Made for long lunches.", details: ["Fine-gauge knitted cotton", "Three-button placket", "Ribbed cuffs and hem"], tags: ["polo", "knit polo", "old money", "summer", "classic"], collections: [EDIT], pairs: ["pleated-cotton-twill-trousers"] },
  { name: "Washed Linen Band-Collar Shirt", cat: "men-shirts", gender: "MEN", brand: HERITAGE, price: 3790, colors: ["Cream", "Navy", "Sky Blue"], sizes: TOP, images: ["1627686011747-74adda3d2343", "1713881587420-113c1c43e28a", "1713881649391-a1c8ddaf83cd"], material: "100% European flax linen, garment-washed", fit: "Relaxed fit", care: CARE_LINEN, desc: "A band-collar linen shirt, washed soft and meant to be worn a little rumpled: sleeves pushed up, top button open.", details: ["Band collar", "Garment-washed linen", "Mother-of-pearl-effect buttons"], tags: ["shirt", "linen", "old money", "summer"], collections: [EDIT], featured: true, pairs: ["pleated-cotton-twill-trousers", "navy-hopsack-blazer"] },
  { name: "Striped Oxford Shirt", cat: "men-shirts", gender: "MEN", brand: HERITAGE, price: 3490, colors: ["Sky Blue", "Burgundy"], sizes: TOP, images: ["1791631064348-0337580f80d1", "1791631064276-af27e842af6a"], material: "100% cotton Oxford, university stripe", fit: "Tailored fit", care: CARE_COTTON, desc: "A university-stripe Oxford with a soft-roll button-down collar. Under a cable knit, it's the whole look.", details: ["Soft-roll button-down collar", "Back box pleat and locker loop", "Curved hem"], tags: ["shirt", "oxford", "stripe", "old money", "preppy"], collections: [EDIT], pairs: ["cable-knit-merino-crew"] },
  { name: "Pleated Cotton Twill Trousers", cat: "men-trousers", gender: "MEN", brand: HERITAGE, price: 4490, compareAt: 5490, colors: ["Cream", "Stone", "Navy"], sizes: WAIST, images: ["1626557981101-aae6f84aa6ff", "1660996702358-22f0377a3f36"], material: "100% cotton twill, peached", fit: "Relaxed tapered", care: CARE_COTTON, desc: "Cream trousers with a single pleat and a long, easy line. They make a polo look deliberate and a blazer look relaxed.", details: ["Single forward pleat", "Side adjusters, no belt needed", "Pressed crease"], tags: ["trousers", "pleated", "cream", "old money", "summer"], collections: [EDIT], featured: true, pairs: ["knitted-cotton-polo", "washed-linen-band-collar-shirt"] },
  { name: "Navy Hopsack Blazer", cat: "men-blazers", gender: "MEN", brand: HERITAGE, price: 11990, colors: ["Navy"], sizes: ["S", "M", "L", "XL"], images: ["1775680978532-fd71173a381a", "1775680978611-4bbc221f3944", "1617137968427-85924c800a22"], material: "100% wool hopsack, half-lined", fit: "Tailored fit", care: CARE_DRY, desc: "The navy blazer every wardrobe is built around. Breathable hopsack wool, soft shoulders and horn-effect buttons. Wear it with cream trousers or jeans.", details: ["Open-weave hopsack wool", "Half-lined, soft shoulders", "Patch pockets, functional cuffs"], tags: ["blazer", "navy blazer", "wool", "old money", "smart casual"], collections: [EDIT], featured: true, pairs: ["pleated-cotton-twill-trousers", "washed-linen-band-collar-shirt"] },
  { name: "Camel Wool Overcoat", cat: "men-jackets", gender: "MEN", brand: HERITAGE, price: 16990, compareAt: 19990, colors: ["Camel"], sizes: TOP, images: ["1619603364937-8d7af41ef206", "1611246539484-1f8e71d19ea5"], material: "70% wool, 30% polyamide, double-faced", fit: "Regular fit", care: CARE_DRY, desc: "A knee-length camel overcoat cut to go over a blazer or a chunky knit. The colour works with navy, grey, cream and denim.", details: ["Notch lapel, single-breasted", "Fully lined, inside pocket", "Back vent"], tags: ["coat", "overcoat", "camel", "wool", "old money", "winter"], collections: [EDIT], pairs: ["merino-roll-neck", "cable-knit-merino-crew"] },

  // ——— Women ———
  { name: "Aran Cable-Knit Sweater", cat: "women-knitwear", gender: "WOMEN", brand: HERITAGE, price: 5990, colors: ["Forest", "Cream", "Burgundy"], sizes: WOMEN, images: ["1580331451062-99ff652288d7", "1670603917227-3fd6882dbf97", "1612629779374-a8432d338af5"], material: "Wool-alpaca blend (80/20)", fit: "Relaxed fit", care: CARE_WOOL, desc: "A chunky cable knit with a little alpaca for softness. Over a crisp collar with a pleated skirt, it's the tennis-club look.", details: ["Traditional aran cables", "20% alpaca for warmth and softness", "Slightly cropped, roomy sleeves"], tags: ["sweater", "cable knit", "wool", "old money", "winter", "classic"], collections: [EDIT], featured: true, pairs: ["pleated-tennis-skirt", "crisp-cotton-poplin-shirt"] },
  { name: "Fine-Knit Turtleneck", cat: "women-knitwear", gender: "WOMEN", brand: HERITAGE, price: 4490, colors: ["Grey", "Cream", "Black"], sizes: WOMEN, images: ["1640786443594-408d1d5a6298", "1574201635302-388dd92a4c3f"], material: "Merino-cashmere blend (90/10)", fit: "Regular fit", care: CARE_WOOL, desc: "A soft, close turtleneck to wear under coats and blazers all winter. Simple on purpose.", details: ["10% cashmere", "Fold-over neck", "Ribbed cuffs"], tags: ["turtleneck", "knit", "cashmere", "old money", "winter"], collections: [EDIT], pairs: ["camel-wrap-coat", "wide-leg-pleated-trousers"] },
  { name: "Wool-Blend Cardigan", cat: "women-knitwear", gender: "WOMEN", brand: HERITAGE, price: 4990, colors: ["Rust", "Cream"], sizes: WOMEN, images: ["1631669991586-0465d15a41f5", "1633007400830-61a6f6fcbc40"], material: "Wool-cotton blend (60/40)", fit: "Relaxed fit", care: CARE_WOOL, desc: "A relaxed V-neck cardigan to throw over a slip dress or a white tee. Easy, warm and always right.", details: ["V-neck, five buttons", "Two patch pockets", "Dropped shoulders"], tags: ["cardigan", "knit", "old money", "layering"], collections: [EDIT], pairs: ["pleated-satin-midi-skirt"] },
  { name: "Classic Cotton Trench Coat", cat: "women-jackets", gender: "WOMEN", brand: HERITAGE, price: 12990, colors: ["Beige", "Stone"], sizes: WOMEN, images: ["1651491646869-3f18f4d30be0", "1723390926441-5840f12432fc", "1692180142575-c31fcd106b5b"], material: "Water-repellent cotton gabardine", fit: "Belted, relaxed", care: CARE_DRY, desc: "The trench: double-breasted, belted, and good for every monsoon and every decade. Wear it open over jeans or belted over a dress.", details: ["Water-repellent gabardine", "Storm flap, epaulettes, belted cuffs", "Removable belt"], tags: ["trench coat", "coat", "monsoon", "old money", "classic"], collections: [EDIT], featured: true, pairs: ["wide-leg-pleated-trousers", "crisp-cotton-poplin-shirt"] },
  { name: "Camel Wrap Coat", cat: "women-jackets", gender: "WOMEN", brand: HERITAGE, price: 15990, compareAt: 18990, colors: ["Camel"], sizes: WOMEN, images: ["1618244985759-a8a1dc26bce3", "1618244965061-1d27b208d6e8", "1777448067392-235aec6a10e4"], material: "Wool-cashmere blend (90/10)", fit: "Wrap, belted", care: CARE_DRY, desc: "A soft camel wrap coat with a self-tie belt. Over cream trousers and a turtleneck, nothing else is needed.", details: ["10% cashmere", "Self-tie belt", "Shawl collar, deep pockets"], tags: ["coat", "camel coat", "wool", "cashmere", "old money", "winter"], collections: [EDIT], featured: true, pairs: ["fine-knit-turtleneck", "wide-leg-pleated-trousers"] },
  { name: "Tailored Single-Breasted Blazer", cat: "women-jackets", gender: "WOMEN", brand: HERITAGE, price: 8990, colors: ["Beige", "Camel"], sizes: WOMEN, images: ["1697663426713-82f6bab7d84b", "1605017283705-d15cb0346bf2", "1602192937302-e35469228d35"], material: "Wool-blend suiting (55% wool)", fit: "Relaxed tailored", care: CARE_DRY, desc: "A softly tailored blazer in a warm neutral that goes over everything: denim, a slip dress, matching trousers.", details: ["Single-button front", "Half-lined", "Flap pockets"], tags: ["blazer", "tailoring", "old money", "office"], collections: [EDIT], pairs: ["wide-leg-pleated-trousers", "crisp-cotton-poplin-shirt"] },
  { name: "Wide-Leg Pleated Trousers", cat: "women-trousers", gender: "WOMEN", brand: HERITAGE, price: 4990, colors: ["Cream", "Grey", "Black"], sizes: WOMEN_WAIST, images: ["1673180608353-63292b332e84", "1536757287333-c4c67393e791", "1619470148547-0adbfc64b595"], material: "Fluid crepe suiting (viscose blend)", fit: "High-rise wide leg", care: "Gentle wash cold or dry clean. Hang to dry. Cool iron along the crease.", desc: "High-waisted, double-pleated and fluid all the way to the floor. They make flat shoes look elegant.", details: ["Double front pleats", "Pressed centre crease", "Side pockets, hook-and-bar closure"], tags: ["trousers", "wide leg", "pleated", "old money", "office"], collections: [EDIT], featured: true, pairs: ["camel-wrap-coat", "fine-knit-turtleneck"] },
  { name: "Crisp Cotton Poplin Shirt", cat: "women-tops", gender: "WOMEN", brand: HERITAGE, price: 3290, colors: ["White", "Sky Blue"], sizes: WOMEN, images: ["1609369350331-4f12b446d487", "1621773881532-fe65715b5137", "1583846783214-7229a91b20ed"], material: "100% cotton poplin, two-ply", fit: "Relaxed fit", care: CARE_COTTON, desc: "The white shirt, done properly: crisp two-ply poplin, a generous cut and a collar that stands up. Tuck it in, knot it, or wear it open.", details: ["Two-ply cotton poplin", "Curved hem", "Single chest pocket"], tags: ["shirt", "white shirt", "poplin", "old money", "classic"], collections: [EDIT], pairs: ["wide-leg-pleated-trousers", "aran-cable-knit-sweater"] },
  { name: "Pleated Tennis Skirt", cat: "women-skirts", gender: "WOMEN", brand: HERITAGE, price: 2990, colors: ["White", "Navy"], sizes: WOMEN, images: ["1677368744545-c5a4d7de7225"], material: "Cotton-polyester piqué with built-in shorts", fit: "A-line, mini", care: SKIRT_CARE, desc: "A pleated tennis skirt with built-in shorts, for the court or with a cable knit and loafers off it.", details: ["Knife pleats all round", "Built-in shorts", "Wide comfort waistband"], tags: ["skirt", "tennis", "pleated", "old money", "sport"], collections: [EDIT], pairs: ["aran-cable-knit-sweater"] },
  { name: "Pleated Satin Midi Skirt", cat: "women-skirts", gender: "WOMEN", brand: HERITAGE, price: 3990, compareAt: 4990, colors: ["Ivory", "Beige"], sizes: WOMEN, images: ["1786641982679-7bbcddad7c2a", "1557161622-5f50ca344787"], material: "Satin-finish crepe", fit: "A-line, midi", care: SKIRT_CARE, desc: "A softly pleated satin midi that catches the light as you walk. With a knit or a shirt, day to evening.", details: ["Sunray pleats", "Concealed side zip", "Lined"], tags: ["skirt", "midi", "satin", "pleated", "old money"], collections: [EDIT], pairs: ["wool-blend-cardigan", "crisp-cotton-poplin-shirt"] },
  { name: "Tailored Trouser Suit", cat: "women-jackets", gender: "WOMEN", brand: HERITAGE, price: 13990, colors: ["Beige", "Brown"], sizes: WOMEN, images: ["1590873802674-55bb8f947bc5", "1619914775880-73fc2dc96379"], material: "Wool-blend suiting (55% wool)", fit: "Relaxed tailored", care: CARE_DRY, desc: "A two-piece suit in a soft neutral: the blazer and wide trousers together for the office, apart for everything else.", details: ["Blazer and wide-leg trousers", "Half-lined jacket", "Trousers with pressed crease"], tags: ["suit", "trouser suit", "tailoring", "old money", "office"], collections: [EDIT], pairs: ["crisp-cotton-poplin-shirt", "fine-knit-turtleneck"] },
];

/** Styled outfits for the Lookbook: title, line, story, hero photo and the pieces in order. */
export const OLD_MONEY_LOOKS = [
  { title: "Sunday at the Club", subtitle: "Tennis whites, a cable knit over the shoulders", story: "Pleated whites on court, a cable knit over a crisp collar after. The point is that nothing tries too hard.", hero: "1677368744545-c5a4d7de7225", pieces: ["pleated-tennis-skirt", "aran-cable-knit-sweater", "crisp-cotton-poplin-shirt"] },
  { title: "The Camel Coat", subtitle: "Camel, cream and a soft roll neck", story: "One good coat changes everything under it. Keep the rest quiet: a fine turtleneck and fluid cream trousers.", hero: "1618244972963-dbee1a7edc95", pieces: ["camel-wrap-coat", "fine-knit-turtleneck", "wide-leg-pleated-trousers"] },
  { title: "Linen, Pressed", subtitle: "Navy blazer, cream trousers, a linen shirt left open", story: "The summer uniform: a navy hopsack blazer, pleated cream trousers and a linen shirt with the sleeves pushed up.", hero: "1775680978611-4bbc221f3944", pieces: ["navy-hopsack-blazer", "washed-linen-band-collar-shirt", "pleated-cotton-twill-trousers"] },
  { title: "Country Weekend", subtitle: "Cable knit, camel overcoat, a striped Oxford", story: "Layers for a cold morning out of the city: a striped Oxford under a cable crew, with the camel overcoat on top.", hero: "1619603364937-8d7af41ef206", pieces: ["camel-wool-overcoat", "cable-knit-merino-crew", "striped-oxford-shirt"] },
];

export async function loadOldMoneyEdit(db: PrismaClient) {
  let categoriesCreated = 0;
  for (const [i, c] of OLD_MONEY_CATEGORIES.entries()) {
    if (await db.category.findUnique({ where: { slug: c.slug } })) continue;
    const parent = await db.category.findUnique({ where: { slug: c.parent } });
    if (!parent) throw new Error(`Category ${c.parent} is missing: run prisma/bootstrap.ts first.`);
    const last = await db.category.aggregate({ where: { parentId: parent.id }, _max: { sortOrder: true } });
    await db.category.create({ data: { name: c.name, nameNe: c.nameNe, slug: c.slug, parentId: parent.id, sortOrder: (last._max.sortOrder ?? 0) + 1 + i } });
    categoriesCreated++;
  }

  const result = await loadCatalogue(db, { items: OLD_MONEY, collections: OLD_MONEY_COLLECTIONS, note: "Old Money Edit", collectionsFirst: true });

  // the looks go first in the Lookbook; only ones whose pieces all exist
  let looksCreated = 0;
  const firstLook = await db.look.aggregate({ _min: { position: true } });
  for (const [i, l] of OLD_MONEY_LOOKS.entries()) {
    const slug = slugify(l.title);
    if (await db.look.findUnique({ where: { slug } })) continue;
    const pieces = await db.product.findMany({ where: { slug: { in: l.pieces } }, select: { id: true, slug: true } });
    if (pieces.length !== l.pieces.length) continue;
    const ordered = l.pieces.map((s) => pieces.find((p) => p.slug === s)!);
    await db.look.create({
      data: {
        slug, title: l.title, subtitle: l.subtitle, story: l.story, heroImage: U(l.hero), published: true,
        position: (firstLook._min.position ?? 0) - OLD_MONEY_LOOKS.length + i,
        items: { create: ordered.map((p, n) => ({ productId: p.id, position: n })) },
      },
    });
    looksCreated++;
  }
  return { ...result, categoriesCreated, looksCreated };
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL first.");
  const db = new PrismaClient();
  try {
    console.log("Old Money Edit:", await loadOldMoneyEdit(db));
  } finally {
    await db.$disconnect();
  }
}

if (process.argv[1]?.endsWith("catalogue-old-money.ts")) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
