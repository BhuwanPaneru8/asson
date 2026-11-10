/**
 * Development seed. Creates a realistic catalogue, demo accounts, coupons, reviews and order history.
 *
 * Demo accounts (development only — change or delete before going live):
 *   admin@asson.test    / Admin@12345     (ADMIN)
 *   manager@asson.test  / Manager@12345   (MANAGER — approval PIN 2580)
 *   cashier@asson.test  / Cashier@12345   (CASHIER — store POS only)
 *   staff@asson.test    / Staff@12345     (STAFF — online order fulfilment)
 *   (owner approval PIN: 1357)
 *   customer@asson.test / Customer@12345  (CUSTOMER)
 */
import { PrismaClient, type Gender, type OrderStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { CATEGORIES, SUPPLIERS, deliveryRates } from "./reference-data";

const db = new PrismaClient();

// Deterministic PRNG so the seed is reproducible
let s = 42;
const rand = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T,>(a: readonly T[]) => a[Math.floor(rand() * a.length)];
const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;

const U = (id: string) => `https://images.unsplash.com/photo-${id}`;

const slugify = (x: string) => x.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const COLORS = {
  White: "#F5F5F2", Black: "#1C1C1C", Navy: "#1F2A44", Grey: "#9A9A9A", Charcoal: "#3C3C3C",
  Olive: "#5B6338", Beige: "#D9C7A7", Sand: "#C8B48F", Rust: "#A0482B", Maroon: "#6B1E2C",
  "Sky Blue": "#8DB6D9", Indigo: "#2E3A6E", "Light Wash": "#9BB3CC", "Dark Wash": "#2C3A55",
  Blush: "#E8B9B0", Sage: "#A7B59A", Mustard: "#C99A2E", Cream: "#F1E9D8", Emerald: "#1F6B4F",
  Lilac: "#B9A6D3", Red: "#B3262E", Teal: "#1E6F73", Brown: "#6B4A33", Khaki: "#B5A27A",
} as const;
type ColorName = keyof typeof COLORS;

const TOP = ["XS", "S", "M", "L", "XL", "XXL"];
const WAIST = ["28", "30", "32", "34", "36", "38"];
const WOMEN_TOP = ["XS", "S", "M", "L", "XL"];
const KIDS = ["2-3Y", "4-5Y", "6-7Y", "8-9Y", "10-11Y"];

type T = {
  name: string;
  cat: string;
  gender: Gender;
  brand: string;
  price: number; // rupees
  mrp?: number;
  colors: ColorName[];
  sizes: string[];
  images: string[];
  material: string;
  fit: string;
  tags: string[];
  desc: string;
  details: string[];
  featured?: boolean;
  collections?: string[];
};

const CATS = CATEGORIES;

const B = { core: "Asson", studio: "Asson Studio", north: "Northpeak", indigo: "Indigo & Co", loom: "Loom Craft", urban: "Urban Theory" };

const TEMPLATES: T[] = [
  // ---------- Men: tees ----------
  { name: "Essential Crew Tee", cat: "men-t-shirts", gender: "MEN", brand: B.core, price: 599, mrp: 799, colors: ["White", "Black", "Navy", "Olive", "Grey"], sizes: TOP, images: ["1521572163474-6864f9cf17ab", "1581655353564-df123a1eb820"], material: "100% combed cotton, 180 GSM", fit: "Regular fit", tags: ["tshirt", "tee", "basics", "cotton"], desc: "The tee you'll reach for every morning. Mid-weight combed cotton that softens with every wash and holds its shape.", details: ["Ribbed crew neck that won't stretch out", "Pre-shrunk — size stays true after washing", "Side-seamed for a clean drape"], featured: true, collections: ["essentials"] },
  { name: "Heavyweight Boxy Tee", cat: "men-t-shirts", gender: "MEN", brand: B.urban, price: 899, colors: ["Black", "Cream", "Charcoal"], sizes: TOP, images: ["1583743814966-8936f5b7be1a", "1503341504253-dff4815485f1"], material: "100% cotton, 240 GSM", fit: "Relaxed boxy fit", tags: ["tshirt", "oversized", "streetwear"], desc: "A dense 240 GSM jersey cut short and wide for that structured streetwear silhouette.", details: ["Dropped shoulders", "Thick ribbed collar", "Garment dyed for depth of colour"], collections: ["streetwear"] },
  { name: "Graphic Print Tee", cat: "men-t-shirts", gender: "MEN", brand: B.urban, price: 699, mrp: 999, colors: ["White", "Black"], sizes: TOP, images: ["1576566588028-4147f3842f27", "1622445275463-afa2ab738c34"], material: "100% cotton", fit: "Regular fit", tags: ["tshirt", "graphic", "print"], desc: "Soft-hand water-based print on our classic cotton jersey.", details: ["Crack-resistant print", "Breathable everyday cotton"], collections: ["streetwear"] },
  { name: "Pique Polo", cat: "men-t-shirts", gender: "MEN", brand: B.core, price: 999, mrp: 1299, colors: ["Navy", "White", "Maroon", "Olive"], sizes: TOP, images: ["1586790170083-2f9ceadc732d", "1618354691373-d851c5c3a990"], material: "Cotton pique", fit: "Slim fit", tags: ["polo", "collar"], desc: "A textured cotton pique polo that works at the office and the weekend.", details: ["Two-button placket", "Ribbed cuffs and collar", "Split side hem"], featured: true, collections: ["workwear"] },
  { name: "Supima Pocket Tee", cat: "men-t-shirts", gender: "MEN", brand: B.studio, price: 1199, colors: ["Sand", "Sage", "Navy"], sizes: TOP, images: ["1618354691373-d851c5c3a990", "1521572163474-6864f9cf17ab"], material: "100% Supima cotton", fit: "Regular fit", tags: ["tshirt", "premium", "pocket"], desc: "Extra-long staple Supima cotton for a tee with a subtle sheen and remarkable softness.", details: ["Chest patch pocket", "Twin-needle hems"] },

  // ---------- Men: shirts ----------
  { name: "Oxford Button-Down Shirt", cat: "men-shirts", gender: "MEN", brand: B.core, price: 1499, mrp: 1999, colors: ["Sky Blue", "White"], sizes: TOP, images: ["1596755094514-f87e34085b2c", "1602810318383-e386cc2a3ccf"], material: "100% cotton oxford", fit: "Tailored fit", tags: ["shirt", "formal", "office"], desc: "The original button-down, in a substantial oxford weave that only gets better with age.", details: ["Button-down collar", "Back box pleat", "Curved hem — wear tucked or untucked"], featured: true, collections: ["workwear", "essentials"] },
  { name: "Linen Resort Shirt", cat: "men-shirts", gender: "MEN", brand: B.studio, price: 1799, colors: ["Beige", "White", "Sage"], sizes: TOP, images: ["1620012253295-c15cc3e65df4", "1598033129183-c4f50c736f10"], material: "100% European linen", fit: "Relaxed fit", tags: ["shirt", "linen", "summer", "camp collar"], desc: "Breezy, breathable linen with a camp collar — made for hot Indian summers.", details: ["Camp collar", "Coconut-shell buttons", "Enzyme-washed for softness"], collections: ["summer-edit"] },
  { name: "Stretch Formal Shirt", cat: "men-shirts", gender: "MEN", brand: B.core, price: 1299, colors: ["White", "Sky Blue", "Charcoal"], sizes: TOP, images: ["1598033129183-c4f50c736f10", "1596755094514-f87e34085b2c"], material: "Cotton blend with 2% elastane", fit: "Slim fit", tags: ["shirt", "formal", "wrinkle-free"], desc: "A crisp, wrinkle-resistant shirt with a little stretch for long days.", details: ["Non-iron finish", "Spread collar", "Adjustable cuffs"], collections: ["workwear"] },
  { name: "Flannel Check Overshirt", cat: "men-shirts", gender: "MEN", brand: B.north, price: 1999, mrp: 2499, colors: ["Red", "Olive", "Navy"], sizes: TOP, images: ["1602810318383-e386cc2a3ccf", "1620012253295-c15cc3e65df4"], material: "Brushed cotton flannel", fit: "Regular fit", tags: ["shirt", "flannel", "check", "winter"], desc: "Brushed on both sides for warmth, cut roomy enough to layer.", details: ["Twin chest pockets", "Brushed for warmth"], collections: ["winter-layers"] },

  // ---------- Men: jeans ----------
  { name: "Slim Tapered Jeans", cat: "men-jeans", gender: "MEN", brand: B.indigo, price: 1999, mrp: 2799, colors: ["Dark Wash", "Light Wash", "Black"], sizes: WAIST, images: ["1542272604-787c3835535d", "1541099649105-f69ad21f3246"], material: "98% cotton, 2% elastane denim", fit: "Slim tapered", tags: ["jeans", "denim", "stretch"], desc: "Our best-selling jean: slim through the thigh, tapered to the ankle, with just enough stretch.", details: ["5-pocket styling", "Stretch denim — moves with you", "YKK zip fly"], featured: true, collections: ["essentials", "denim-shop"] },
  { name: "Straight Fit Selvedge Jeans", cat: "men-jeans", gender: "MEN", brand: B.indigo, price: 3499, colors: ["Indigo"], sizes: WAIST, images: ["1541099649105-f69ad21f3246", "1604176354204-9268737828e4"], material: "100% cotton selvedge denim, 13.5 oz", fit: "Straight fit", tags: ["jeans", "selvedge", "raw denim"], desc: "Rigid selvedge denim that fades to your story. A jean for a decade, not a season.", details: ["Red-line selvedge", "Copper rivets", "Unwashed raw denim"], collections: ["denim-shop"] },
  { name: "Relaxed Carpenter Jeans", cat: "men-jeans", gender: "MEN", brand: B.urban, price: 2299, colors: ["Light Wash", "Black"], sizes: WAIST, images: ["1604176354204-9268737828e4", "1542272604-787c3835535d"], material: "100% cotton denim", fit: "Relaxed fit", tags: ["jeans", "baggy", "carpenter", "streetwear"], desc: "A roomy carpenter jean with a hammer loop and utility pocket.", details: ["Hammer loop", "Utility pocket", "Wide leg"], collections: ["streetwear", "denim-shop"] },

  // ---------- Men: trousers ----------
  { name: "Stretch Chinos", cat: "men-trousers", gender: "MEN", brand: B.core, price: 1599, mrp: 1999, colors: ["Khaki", "Navy", "Olive", "Black"], sizes: WAIST, images: ["1624378439575-d8705ad7ae80", "1473966968600-fa801b869a1a"], material: "97% cotton, 3% elastane twill", fit: "Slim fit", tags: ["chinos", "trousers", "pants"], desc: "Smart enough for the office, comfortable enough for the weekend.", details: ["Slant front pockets", "Hidden coin pocket", "Comfort-stretch waistband"], featured: true, collections: ["workwear", "essentials"] },
  { name: "Pleated Wide Trousers", cat: "men-trousers", gender: "MEN", brand: B.studio, price: 2499, colors: ["Charcoal", "Beige"], sizes: WAIST, images: ["1473966968600-fa801b869a1a", "1624378439575-d8705ad7ae80"], material: "Wool-blend suiting", fit: "Relaxed fit", tags: ["trousers", "pleated", "formal"], desc: "Single-pleat trousers with a generous leg and fluid drape.", details: ["Single front pleat", "Extended tab closure"], collections: ["workwear"] },
  { name: "Everyday Joggers", cat: "men-trousers", gender: "MEN", brand: B.north, price: 1199, mrp: 1499, colors: ["Grey", "Black", "Navy"], sizes: TOP, images: ["1473966968600-fa801b869a1a", "1556821840-3a63f95609a7"], material: "Cotton-rich fleece", fit: "Tapered fit", tags: ["joggers", "trackpants", "lounge"], desc: "Brushed-back fleece joggers for travel days and lazy Sundays.", details: ["Zip side pockets", "Elastic drawcord waist", "Ribbed cuffs"], collections: ["essentials"] },

  // ---------- Men: jackets ----------
  { name: "Leather Biker Jacket", cat: "men-jackets", gender: "MEN", brand: B.urban, price: 8999, mrp: 11999, colors: ["Black", "Brown"], sizes: TOP, images: ["1551028719-00167b16eac5", "1520975954732-35dd22299614"], material: "Genuine lambskin leather", fit: "Slim fit", tags: ["jacket", "leather", "biker"], desc: "A timeless biker in buttery lambskin, with heavy-duty hardware.", details: ["Asymmetric zip", "Quilted lining", "Snap lapels"], featured: true, collections: ["winter-layers"] },
  { name: "Denim Trucker Jacket", cat: "men-jackets", gender: "MEN", brand: B.indigo, price: 2999, colors: ["Light Wash", "Dark Wash"], sizes: TOP, images: ["1591047139829-d91aecb6caea", "1544022613-e87ca75a784a"], material: "100% cotton denim", fit: "Regular fit", tags: ["jacket", "denim", "trucker"], desc: "The classic trucker in rigid denim. Layer it over everything.", details: ["Button chest pockets", "Adjustable waist tabs"], collections: ["denim-shop"] },
  { name: "Quilted Puffer Jacket", cat: "men-jackets", gender: "MEN", brand: B.north, price: 4499, mrp: 5999, colors: ["Black", "Olive", "Navy"], sizes: TOP, images: ["1544022613-e87ca75a784a", "1591047139829-d91aecb6caea"], material: "Recycled nylon shell, synthetic down fill", fit: "Regular fit", tags: ["jacket", "puffer", "winter", "warm"], desc: "Lightweight warmth that packs into its own pocket.", details: ["Water-repellent finish", "Packs into chest pocket", "Rated to 0°C"], collections: ["winter-layers"] },
  { name: "Wool Blend Overcoat", cat: "men-jackets", gender: "MEN", brand: B.studio, price: 6999, colors: ["Charcoal", "Beige"], sizes: TOP, images: ["1520975954732-35dd22299614", "1551028719-00167b16eac5"], material: "60% wool, 40% polyester", fit: "Regular fit", tags: ["coat", "overcoat", "winter", "formal"], desc: "A clean, single-breasted overcoat that sits just above the knee.", details: ["Notch lapel", "Fully lined", "Interior pocket"], collections: ["winter-layers", "workwear"] },

  // ---------- Men: hoodies ----------
  { name: "Classic Pullover Hoodie", cat: "men-hoodies", gender: "MEN", brand: B.core, price: 1499, mrp: 1999, colors: ["Grey", "Black", "Navy", "Olive"], sizes: TOP, images: ["1556821840-3a63f95609a7", "1620799140408-edc6dcb6d633"], material: "Cotton-rich brushed fleece, 320 GSM", fit: "Regular fit", tags: ["hoodie", "sweatshirt", "winter"], desc: "Thick, soft and endlessly wearable — our signature hoodie.", details: ["Double-layer hood", "Kangaroo pocket", "Ribbed cuffs and hem"], featured: true, collections: ["essentials", "winter-layers"] },
  { name: "Oversized Zip Hoodie", cat: "men-hoodies", gender: "MEN", brand: B.urban, price: 1999, colors: ["Black", "Charcoal", "Cream"], sizes: TOP, images: ["1620799140408-edc6dcb6d633", "1578587018452-892bacefd3f2"], material: "100% cotton French terry", fit: "Oversized fit", tags: ["hoodie", "zip", "oversized", "streetwear"], desc: "Boxy, dropped-shoulder zip hoodie in loopback French terry.", details: ["Two-way metal zip", "Dropped shoulders"], collections: ["streetwear"] },
  { name: "Crew Neck Sweatshirt", cat: "men-hoodies", gender: "MEN", brand: B.north, price: 1299, colors: ["Grey", "Maroon", "Navy"], sizes: TOP, images: ["1578587018452-892bacefd3f2", "1556821840-3a63f95609a7"], material: "Cotton fleece", fit: "Regular fit", tags: ["sweatshirt", "crew neck"], desc: "A clean crew sweatshirt with a vintage-inspired V insert.", details: ["V-stitch neckline", "Brushed interior"] },

  // ---------- Men: blazers ----------
  { name: "Unstructured Cotton Blazer", cat: "men-blazers", gender: "MEN", brand: B.studio, price: 4999, mrp: 6499, colors: ["Navy", "Beige"], sizes: ["S", "M", "L", "XL", "XXL"], images: ["1617137968427-85924c800a22", "1507679799987-c73779587ccf"], material: "Cotton-linen blend", fit: "Tailored fit", tags: ["blazer", "formal", "wedding"], desc: "A soft-shouldered blazer that travels well and never looks stuffy.", details: ["Half-lined", "Patch pockets", "Two-button front"], collections: ["workwear"] },
  { name: "Two-Piece Wool Suit", cat: "men-blazers", gender: "MEN", brand: B.studio, price: 12999, colors: ["Charcoal", "Navy"], sizes: ["S", "M", "L", "XL"], images: ["1594938298603-c8148c4dae35", "1617137968427-85924c800a22"], material: "Super 110s wool", fit: "Slim fit", tags: ["suit", "formal", "wedding"], desc: "A sharp two-piece in fine Italian-milled wool. Trousers come unhemmed for tailoring.", details: ["Half-canvas construction", "Unhemmed trousers", "Functional cuff buttons"], featured: true },

  // ---------- Men: ethnic ----------
  { name: "Cotton Straight Kurta", cat: "men-ethnic", gender: "MEN", brand: B.loom, price: 1299, mrp: 1799, colors: ["White", "Navy", "Mustard", "Maroon"], sizes: TOP, images: ["1583391733956-3750e0ff4e8b", "1617627143750-d86bc21e42bb"], material: "Handloom cotton", fit: "Regular fit", tags: ["kurta", "ethnic", "festive", "dashain", "tihar"], desc: "Hand-woven cotton kurta with a mandarin collar — festive yet breathable.", details: ["Mandarin collar", "Side slits", "Handloom fabric"], collections: ["festive"] },
  { name: "Silk Blend Nehru Jacket", cat: "men-ethnic", gender: "MEN", brand: B.loom, price: 2499, colors: ["Maroon", "Emerald", "Navy"], sizes: TOP, images: ["1617627143750-d86bc21e42bb", "1583391733956-3750e0ff4e8b"], material: "Silk blend jacquard", fit: "Tailored fit", tags: ["nehru jacket", "ethnic", "festive", "wedding"], desc: "A jacquard Nehru jacket to lift any kurta for weddings and festivals.", details: ["Jacquard weave", "Fully lined"], collections: ["festive"] },

  // ---------- Women: dresses ----------
  { name: "Floral Midi Wrap Dress", cat: "women-dresses", gender: "WOMEN", brand: B.studio, price: 2499, mrp: 3299, colors: ["Blush", "Navy"], sizes: WOMEN_TOP, images: ["1595777457583-95e059d581b8", "1572804013309-59a88b7e92f1"], material: "100% viscose crepe", fit: "Wrap fit", tags: ["dress", "midi", "floral", "wrap"], desc: "A flattering wrap silhouette in fluid crepe with a hand-drawn floral print.", details: ["Adjustable tie waist", "Flutter sleeves", "Midi length"], featured: true, collections: ["summer-edit"] },
  { name: "Linen Shirt Dress", cat: "women-dresses", gender: "WOMEN", brand: B.core, price: 1999, colors: ["White", "Sage", "Beige"], sizes: WOMEN_TOP, images: ["1572804013309-59a88b7e92f1", "1539008835657-9e8e9680c956"], material: "100% linen", fit: "Relaxed fit", tags: ["dress", "linen", "shirt dress", "summer"], desc: "Easy, breathable linen shirt dress with a removable belt.", details: ["Removable belt", "Side pockets", "Button front"], collections: ["summer-edit", "essentials"] },
  { name: "Satin Slip Dress", cat: "women-dresses", gender: "WOMEN", brand: B.studio, price: 2799, colors: ["Emerald", "Black", "Champagne" as ColorName].filter((c) => c in COLORS) as ColorName[], sizes: WOMEN_TOP, images: ["1539008835657-9e8e9680c956", "1515372039744-b8f02a3ae446"], material: "Recycled satin", fit: "Bias cut", tags: ["dress", "satin", "party", "slip"], desc: "A bias-cut slip dress that skims the body. Party-ready.", details: ["Adjustable straps", "Bias cut", "Cowl neck"], collections: ["party-edit"] },
  { name: "Tiered Maxi Dress", cat: "women-dresses", gender: "WOMEN", brand: B.core, price: 2199, mrp: 2999, colors: ["Rust", "Mustard", "Black"], sizes: WOMEN_TOP, images: ["1515372039744-b8f02a3ae446", "1496747611176-843222e1e57c"], material: "Cotton voile", fit: "Relaxed fit", tags: ["dress", "maxi", "tiered", "boho"], desc: "Floaty tiers of cotton voile — fully lined, endlessly twirlable.", details: ["Fully lined", "Smocked back", "Maxi length"], collections: ["summer-edit"] },
  { name: "Knit Bodycon Dress", cat: "women-dresses", gender: "WOMEN", brand: B.urban, price: 1799, colors: ["Black", "Brown", "Cream"], sizes: WOMEN_TOP, images: ["1496747611176-843222e1e57c", "1595777457583-95e059d581b8"], material: "Rib knit viscose blend", fit: "Bodycon fit", tags: ["dress", "bodycon", "knit", "party"], desc: "Sculpting rib-knit midi with a square neckline.", details: ["Square neck", "Stretch rib knit"], collections: ["party-edit"] },

  // ---------- Women: tops ----------
  { name: "Relaxed Linen Shirt", cat: "women-tops", gender: "WOMEN", brand: B.core, price: 1599, colors: ["White", "Sky Blue", "Sage"], sizes: WOMEN_TOP, images: ["1434389677669-e08b4cac3105", "1485968579580-b6d095142e6e"], material: "100% linen", fit: "Relaxed fit", tags: ["shirt", "linen", "top"], desc: "An oversized linen shirt to wear open, tied, or tucked.", details: ["Dropped shoulder", "Curved hem"], featured: true, collections: ["essentials", "summer-edit"] },
  { name: "Ribbed Fitted Tee", cat: "women-tops", gender: "WOMEN", brand: B.core, price: 549, mrp: 699, colors: ["White", "Black", "Blush", "Sage", "Grey"], sizes: WOMEN_TOP, images: ["1485968579580-b6d095142e6e", "1509631179647-0177331693ae"], material: "Cotton modal rib", fit: "Fitted", tags: ["tshirt", "tee", "basics", "rib"], desc: "A second-skin rib tee in soft cotton-modal. Buy it in every colour.", details: ["Crew neck", "Stretch rib"], collections: ["essentials"] },
  { name: "Puff Sleeve Blouse", cat: "women-tops", gender: "WOMEN", brand: B.studio, price: 1499, colors: ["White", "Lilac", "Black"], sizes: WOMEN_TOP, images: ["1509631179647-0177331693ae", "1469334031218-e382a71b716b"], material: "Cotton poplin", fit: "Regular fit", tags: ["blouse", "top", "puff sleeve"], desc: "Crisp poplin with romantic puff sleeves and a sweetheart neckline.", details: ["Elasticated cuffs", "Back zip"], collections: ["party-edit"] },
  { name: "Oversized Graphic Tee", cat: "women-tops", gender: "WOMEN", brand: B.urban, price: 799, mrp: 999, colors: ["White", "Black", "Lilac"], sizes: WOMEN_TOP, images: ["1469334031218-e382a71b716b", "1487222477894-8943e31ef7b2"], material: "100% cotton", fit: "Oversized fit", tags: ["tshirt", "oversized", "graphic", "streetwear"], desc: "A slouchy, boyfriend-fit tee with a vintage-washed graphic.", details: ["Vintage wash", "Dropped shoulders"], collections: ["streetwear"] },
  { name: "Cropped Cardigan Top", cat: "women-tops", gender: "WOMEN", brand: B.studio, price: 1299, colors: ["Cream", "Blush", "Black"], sizes: WOMEN_TOP, images: ["1487222477894-8943e31ef7b2", "1434389677669-e08b4cac3105"], material: "Viscose-nylon knit", fit: "Cropped fit", tags: ["cardigan", "knit", "top", "crop"], desc: "A soft, cropped cardigan with pearl buttons — wear it alone or layered.", details: ["Pearl-effect buttons", "Cropped length"] },

  // ---------- Women: jeans ----------
  { name: "High-Rise Mom Jeans", cat: "women-jeans", gender: "WOMEN", brand: B.indigo, price: 1999, mrp: 2599, colors: ["Light Wash", "Dark Wash", "Black"], sizes: ["26", "28", "30", "32", "34"], images: ["1541099649105-f69ad21f3246", "1604176354204-9268737828e4"], material: "100% cotton rigid denim", fit: "Mom fit", tags: ["jeans", "denim", "mom jeans", "high rise"], desc: "A high-rise, tapered mom jean in authentic rigid denim.", details: ["High rise", "Tapered leg", "Button fly"], featured: true, collections: ["denim-shop", "essentials"] },
  { name: "Wide Leg Jeans", cat: "women-jeans", gender: "WOMEN", brand: B.indigo, price: 2299, colors: ["Light Wash", "Indigo"], sizes: ["26", "28", "30", "32", "34"], images: ["1604176354204-9268737828e4", "1542272604-787c3835535d"], material: "99% cotton, 1% elastane", fit: "Wide leg", tags: ["jeans", "wide leg", "denim"], desc: "A floor-skimming wide leg that elongates the silhouette.", details: ["High rise", "Full-length wide leg"], collections: ["denim-shop"] },
  { name: "Skinny Stretch Jeans", cat: "women-jeans", gender: "WOMEN", brand: B.core, price: 1599, mrp: 1999, colors: ["Dark Wash", "Black"], sizes: ["26", "28", "30", "32", "34"], images: ["1542272604-787c3835535d", "1541099649105-f69ad21f3246"], material: "Power-stretch denim", fit: "Skinny fit", tags: ["jeans", "skinny", "stretch"], desc: "Super-stretch skinny jeans that hold their shape all day.", details: ["4-way stretch", "Mid rise"], collections: ["denim-shop"] },

  // ---------- Women: skirts ----------
  { name: "Pleated Midi Skirt", cat: "women-skirts", gender: "WOMEN", brand: B.studio, price: 1799, colors: ["Sage", "Black", "Beige"], sizes: WOMEN_TOP, images: ["1564859228273-274232fdb516", "1583496661160-fb5886a0aaaa"], material: "Recycled polyester satin", fit: "A-line", tags: ["skirt", "midi", "pleated"], desc: "Knife pleats that catch the light with every step.", details: ["Elasticated back waist", "Midi length"], collections: ["party-edit"] },
  { name: "Denim Mini Skirt", cat: "women-skirts", gender: "WOMEN", brand: B.indigo, price: 1299, mrp: 1599, colors: ["Light Wash", "Black"], sizes: ["26", "28", "30", "32"], images: ["1583496661160-fb5886a0aaaa", "1564859228273-274232fdb516"], material: "100% cotton denim", fit: "A-line", tags: ["skirt", "mini", "denim"], desc: "A classic A-line denim mini with raw hem.", details: ["Raw hem", "5-pocket"], collections: ["denim-shop"] },

  // ---------- Women: knitwear ----------
  { name: "Merino Crew Sweater", cat: "women-knitwear", gender: "WOMEN", brand: B.north, price: 2999, mrp: 3999, colors: ["Cream", "Grey", "Navy", "Rust"], sizes: WOMEN_TOP, images: ["1525507119028-ed4c629a60a3", "1576871337622-98d48d1cf531"], material: "100% extra-fine merino wool", fit: "Regular fit", tags: ["sweater", "merino", "wool", "winter", "knit"], desc: "Itch-free extra-fine merino. Warm, light, and naturally temperature regulating.", details: ["Fully fashioned", "Ribbed trims"], featured: true, collections: ["winter-layers"] },
  { name: "Chunky Cable Cardigan", cat: "women-knitwear", gender: "WOMEN", brand: B.north, price: 2499, colors: ["Cream", "Mustard", "Brown"], sizes: WOMEN_TOP, images: ["1576871337622-98d48d1cf531", "1525507119028-ed4c629a60a3"], material: "Wool-acrylic blend", fit: "Oversized fit", tags: ["cardigan", "cable knit", "winter", "knit"], desc: "Cosy cable-knit cardigan with horn-effect buttons.", details: ["Cable knit", "Deep pockets"], collections: ["winter-layers"] },

  // ---------- Women: jackets ----------
  { name: "Tailored Wool Coat", cat: "women-jackets", gender: "WOMEN", brand: B.studio, price: 7499, mrp: 9999, colors: ["Beige", "Black", "Grey"], sizes: WOMEN_TOP, images: ["1520975954732-35dd22299614", "1544022613-e87ca75a784a"], material: "70% wool, 30% polyamide", fit: "Tailored fit", tags: ["coat", "wool", "winter"], desc: "A sharply tailored coat with a belted waist and wide lapels.", details: ["Removable belt", "Fully lined"], collections: ["winter-layers"] },
  { name: "Cropped Denim Jacket", cat: "women-jackets", gender: "WOMEN", brand: B.indigo, price: 2499, colors: ["Light Wash", "Black"], sizes: WOMEN_TOP, images: ["1591047139829-d91aecb6caea", "1551028719-00167b16eac5"], material: "100% cotton denim", fit: "Cropped fit", tags: ["jacket", "denim", "crop"], desc: "A cropped denim jacket that hits right at the waist.", details: ["Cropped length", "Chest flap pockets"], collections: ["denim-shop"] },

  // ---------- Women: ethnic ----------
  { name: "Printed Anarkali Kurta", cat: "women-ethnic", gender: "WOMEN", brand: B.loom, price: 1999, mrp: 2799, colors: ["Teal", "Maroon", "Mustard"], sizes: WOMEN_TOP, images: ["1610030469983-98e550d6193c", "1617627143750-d86bc21e42bb"], material: "Rayon", fit: "Flared fit", tags: ["kurta", "anarkali", "ethnic", "festive"], desc: "A flowing Anarkali with hand-block inspired prints and gota detailing.", details: ["Gota lace trim", "Flared hem", "Three-quarter sleeves"], featured: true, collections: ["festive"] },
  { name: "Silk Blend Saree", cat: "women-ethnic", gender: "WOMEN", brand: B.loom, price: 5999, mrp: 7999, colors: ["Red", "Emerald", "Maroon"], sizes: ["Free"], images: ["1617627143750-d86bc21e42bb", "1610030469983-98e550d6193c"], material: "Silk blend with zari", fit: "Free size", tags: ["saree", "sari", "silk", "wedding", "festive", "dashain", "tihar"], desc: "Woven silk blend with rich zari motifs — made for Dashain, Tihar and weddings. Comes with unstitched blouse piece.", details: ["5.5m saree + 0.8m blouse piece", "Zari weave", "Dry clean only"], collections: ["festive"] },
  { name: "Cotton Kurta Set", cat: "women-ethnic", gender: "WOMEN", brand: B.loom, price: 2299, colors: ["White", "Blush", "Sage"], sizes: WOMEN_TOP, images: ["1583391733956-3750e0ff4e8b", "1610030469983-98e550d6193c"], material: "Cotton cambric", fit: "Straight fit", tags: ["kurta set", "ethnic", "cotton", "daily wear"], desc: "A three-piece kurta, pant and dupatta set for everyday elegance.", details: ["Kurta + pant + dupatta", "Thread embroidery"], collections: ["festive"] },

  // ---------- Kids ----------
  { name: "Kids Dino Print Tee", cat: "kids-boys", gender: "KIDS", brand: B.core, price: 449, mrp: 599, colors: ["Navy", "Grey", "Olive"], sizes: KIDS, images: ["1519238263530-99bdd11df2ea", "1622290291468-a28f7a7dc6a8"], material: "100% organic cotton", fit: "Regular fit", tags: ["kids", "tshirt", "boys"], desc: "Soft organic cotton tee with a playful print. Tough enough for the playground.", details: ["Organic cotton", "Nickel-free snaps"], collections: ["essentials"] },
  { name: "Kids Pull-On Jeans", cat: "kids-boys", gender: "KIDS", brand: B.indigo, price: 899, colors: ["Light Wash", "Dark Wash"], sizes: KIDS, images: ["1622290291468-a28f7a7dc6a8", "1506629082955-511b1aa562c8"], material: "Stretch denim", fit: "Regular fit", tags: ["kids", "jeans", "boys"], desc: "Elastic-waist jeans that are easy to put on and built to last.", details: ["Adjustable inner waistband", "Reinforced knees"] },
  { name: "Kids Hooded Sweatshirt", cat: "kids-boys", gender: "KIDS", brand: B.north, price: 999, mrp: 1299, colors: ["Red", "Navy", "Grey"], sizes: KIDS, images: ["1503944583220-79d8926ad5e2", "1519238263530-99bdd11df2ea"], material: "Cotton fleece", fit: "Regular fit", tags: ["kids", "hoodie", "winter"], desc: "A cosy fleece hoodie for chilly mornings.", details: ["Kangaroo pocket", "Ribbed cuffs"], collections: ["winter-layers"] },
  { name: "Girls Floral Frock", cat: "kids-girls", gender: "KIDS", brand: B.studio, price: 1099, mrp: 1399, colors: ["Blush", "Lilac"], sizes: KIDS, images: ["1506629082955-511b1aa562c8", "1503944583220-79d8926ad5e2"], material: "Cotton poplin", fit: "Regular fit", tags: ["kids", "dress", "girls", "frock"], desc: "A twirly cotton frock with a soft lining and bow back.", details: ["Fully lined", "Bow tie back"] },
  { name: "Girls Leggings Pack of 2", cat: "kids-girls", gender: "KIDS", brand: B.core, price: 599, colors: ["Black", "Navy", "Blush"], sizes: KIDS, images: ["1622290291468-a28f7a7dc6a8", "1519238263530-99bdd11df2ea"], material: "Cotton-elastane jersey", fit: "Fitted", tags: ["kids", "leggings", "girls", "pack"], desc: "Two pairs of stretchy, durable leggings for everyday play.", details: ["Pack of 2", "Soft elastic waist"] },
];

// Colourway variants extend the catalogue so listing/filters behave like a real store.
const EXTRA_LINES: { suffix: string; brand: string; priceDelta: number }[] = [
  { suffix: "— Organic", brand: B.core, priceDelta: 200 },
];

/** Template prices were authored as base numbers; map them to Nepali price points ending in 99. */
const npr = (base: number) => Math.round((base * 1.6) / 100) * 100 - 1;

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.SEED_FORCE !== "1") {
    throw new Error("Refusing to seed: this wipes all data. Set SEED_FORCE=1 to override.");
  }
  console.log("Resetting data…");
  await db.$transaction([
    // own production first: it points at products, suppliers and locations
    db.productionReceipt.deleteMany(), db.materialLog.deleteMany(), db.productionLine.deleteMany(), db.productionOrder.deleteMany(),
    db.bomLine.deleteMany(), db.materialStock.deleteMany(), db.material.deleteMany(),
    db.paymentAllocation.deleteMany(), db.supplierPayment.deleteMany(), db.supplierBill.deleteMany(),
    db.attendance.deleteMany(), db.leaveRequest.deleteMany(),
    db.stockAlert.deleteMany(), db.pointsEntry.deleteMany(),
    db.returnItem.deleteMany(), db.return.deleteMany(), db.goodsReceiptItem.deleteMany(), db.goodsReceipt.deleteMany(),
    db.purchaseOrderItem.deleteMany(), db.purchaseOrder.deleteMany(), db.supplier.deleteMany(), db.expense.deleteMany(),
    db.orderEvent.deleteMany(), db.orderItem.deleteMany(), db.tender.deleteMany(), db.payment.deleteMany(), db.order.deleteMany(),
    db.staffLocation.deleteMany(), db.look.deleteMany(), db.dayClose.deleteMany(), db.shift.deleteMany(), db.stockTransfer.deleteMany(),
    db.inventoryLog.deleteMany(), db.cartItem.deleteMany(), db.cart.deleteMany(),
    db.wishlistItem.deleteMany(), db.review.deleteMany(), db.productImage.deleteMany(),
    db.variant.deleteMany(), db.store.deleteMany(), db.product.deleteMany(), db.collection.deleteMany(),
    db.category.deleteMany(), db.address.deleteMany(), db.coupon.deleteMany(), db.user.deleteMany(),
  ]);

  console.log("Users…");
  const [admin, staff, customer] = await Promise.all([
    db.user.create({ data: { email: "admin@asson.test", name: "Store Owner", role: "ADMIN", passwordHash: await bcrypt.hash("Admin@12345", 12), approvalPinHash: await bcrypt.hash("1357", 10) } }),
    db.user.create({ data: { email: "staff@asson.test", name: "Ops Staff", role: "STAFF", passwordHash: await bcrypt.hash("Staff@12345", 12) } }),
    db.user.create({
      data: {
        email: "customer@asson.test", name: "Aarav Shrestha", phone: "9841234567", passwordHash: await bcrypt.hash("Customer@12345", 12),
        addresses: { create: { fullName: "Aarav Shrestha", phone: "9841234567", line1: "Naya Baneshwor-10, House 24", line2: "Behind Everest Bank", city: "Kathmandu Metropolitan City", district: "Kathmandu", state: "Bagmati", postalCode: "44600", isDefault: true } },
      },
    }),
  ]);
  void admin; void staff;
  await db.user.create({ data: { email: "manager@asson.test", name: "Sita Manager", role: "MANAGER", passwordHash: await bcrypt.hash("Manager@12345", 12), approvalPinHash: await bcrypt.hash("2580", 10) } });
  await db.user.create({ data: { email: "cashier@asson.test", name: "Ram Cashier", role: "CASHIER", passwordHash: await bcrypt.hash("Cashier@12345", 12) } });
  // Locations: online orders are filled from the warehouse first, then the shops
  const [warehouse, flagship, pokhara] = await Promise.all([
    db.store.create({ data: { code: "WH-KTM", name: "Main warehouse", kind: "WAREHOUSE", district: "Kathmandu", address: "Balaju Industrial Area, Kathmandu", priority: 10 } }),
    db.store.create({ data: { code: "FLAGSHIP", name: "Asson Flagship", kind: "SHOP", district: "Kathmandu", address: "Durbar Marg, Kathmandu", phone: "9761452270", hours: "10am – 7pm, Sun–Fri", pickup: true, priority: 20 } }),
    db.store.create({ data: { code: "PKR", name: "Asson Pokhara", kind: "SHOP", district: "Kaski", address: "Lakeside, Pokhara", hours: "10am – 8pm, every day", pickup: true, priority: 30 } }),
  ]);
  // where demo staff work: ops staff and the manager across the business (HQ), the cashier at the Flagship
  await db.user.updateMany({ where: { email: { in: ["staff@asson.test", "manager@asson.test"] } }, data: { allLocations: true } });
  await db.staffLocation.create({ data: { user: { connect: { email: "cashier@asson.test" } }, store: { connect: { id: flagship.id } } } });

  const FIRST = ["Sita", "Bikash", "Anjali", "Prakash", "Sunita", "Rohan", "Pooja", "Nabin", "Srijana", "Suman", "Kritika", "Bibek", "Asmita", "Ramesh", "Manisha", "Sagar", "Pratiksha", "Aayush", "Sabina", "Dipesh"];
  const LAST = ["Shrestha", "Maharjan", "Thapa", "Gurung", "Adhikari", "Rai", "Karki", "Tamang", "Bhandari", "Poudel", "KC", "Joshi", "Sharma", "Lama", "Yadav", "Magar", "Limbu", "Basnet"];
  // [city, district, province, postal code, tole] — weighted toward the Valley like real demand
  const CITIES = [
    ["Kathmandu Metropolitan City", "Kathmandu", "Bagmati", "44600", "Baneshwor"], ["Kathmandu Metropolitan City", "Kathmandu", "Bagmati", "44600", "Maharajgunj"],
    ["Budhanilkantha", "Kathmandu", "Bagmati", "44600", "Narayanthan"], ["Lalitpur Metropolitan City", "Lalitpur", "Bagmati", "44700", "Jhamsikhel"],
    ["Lalitpur Metropolitan City", "Lalitpur", "Bagmati", "44700", "Kupondole"], ["Bhaktapur", "Bhaktapur", "Bagmati", "44800", "Suryabinayak"],
    ["Pokhara Metropolitan City", "Kaski", "Gandaki", "33700", "Lakeside"], ["Biratnagar", "Morang", "Koshi", "56613", "Traffic Chowk"],
    ["Butwal", "Rupandehi", "Lumbini", "32907", "Traffic Chowk"], ["Bharatpur", "Chitwan", "Bagmati", "44200", "Narayangadh"],
    ["Dharan", "Sunsari", "Koshi", "56700", "Bhanu Chowk"], ["Birgunj", "Parsa", "Madhesh", "44300", "Ghantaghar"],
    ["Janakpur", "Dhanusha", "Madhesh", "45600", "Bhanu Chowk"], ["Nepalgunj", "Banke", "Lumbini", "21900", "Dhamboji"],
    ["Dhangadhi", "Kailali", "Sudurpashchim", "10900", "Chauraha"], ["Birendranagar", "Surkhet", "Karnali", "21700", "Birendra Chowk"],
    ["Jomsom", "Mustang", "Gandaki", "33100", "Jomsom Bazaar"],
  ];
  const pwHash = await bcrypt.hash("Customer@12345", 10);
  const shoppers = [customer];
  for (let i = 0; i < 40; i++) {
    const name = `${pick(FIRST)} ${pick(LAST)}`;
    const c = pick(CITIES);
    shoppers.push(
      await db.user.create({
        data: {
          email: `${slugify(name).replace("-", ".")}${i}@example.com`, name, phone: `98${int(10000000, 99999999)}`, passwordHash: pwHash,
          createdAt: new Date(Date.now() - int(1, 180) * 86400000),
          addresses: { create: { fullName: name, phone: `98${int(10000000, 99999999)}`, line1: `${c[4]}, House ${int(1, 300)}`, line2: pick(["Near the temple", "Opposite the bank", "Behind the school", null]), city: c[0], district: c[1], state: c[2], postalCode: c[3], isDefault: true } },
        },
      }),
    );
  }

  console.log("Categories & collections…");
  const catIds = new Map<string, string>();
  for (const [i, root] of CATS.entries()) {
    const r = await db.category.create({ data: { name: root.name, slug: root.slug, image: root.image, description: root.desc, sortOrder: i } });
    catIds.set(root.slug, r.id);
    for (const [j, ch] of root.children.entries()) {
      const c = await db.category.create({ data: { name: ch.name, slug: ch.slug, parentId: r.id, sortOrder: j } });
      catIds.set(ch.slug, c.id);
    }
  }
  const COLLS = [
    { slug: "essentials", name: "The Essentials", description: "Wardrobe foundations, priced for every day.", image: U("1490481651871-ab68de25d43d"), featured: true },
    { slug: "festive", name: "Dashain & Tihar Edit", description: "Kurtas, silk sarees and celebration-ready pieces for the festive season.", image: U("1610030469983-98e550d6193c"), featured: true },
    { slug: "winter-layers", name: "Winter Layers", description: "Puffers, merino and fleece for the cold months.", image: U("1520975954732-35dd22299614"), featured: true },
    { slug: "denim-shop", name: "The Denim Shop", description: "Every fit, every wash.", image: U("1542272604-787c3835535d"), featured: true },
    { slug: "workwear", name: "Modern Workwear", description: "Sharp, comfortable pieces for the office.", image: U("1507679799987-c73779587ccf"), featured: false },
    { slug: "streetwear", name: "Streetwear", description: "Boxy fits and heavyweight cotton.", image: U("1529374255404-311a2a4f1fd9"), featured: false },
    { slug: "summer-edit", name: "Summer Edit", description: "Linen, voile and breathable cottons.", image: U("1469334031218-e382a71b716b"), featured: false },
    { slug: "party-edit", name: "Party Edit", description: "Satin, sparkle and statement silhouettes.", image: U("1515372039744-b8f02a3ae446"), featured: false },
  ];
  for (const [i, c] of COLLS.entries()) await db.collection.create({ data: { ...c, sortOrder: i } });

  console.log("Products…");
  const all = [...TEMPLATES];
  // a handful of "organic" line extensions on staples
  for (const t of TEMPLATES.filter((x) => ["Essential Crew Tee", "Ribbed Fitted Tee", "Classic Pullover Hoodie", "Stretch Chinos"].includes(x.name))) {
    for (const e of EXTRA_LINES) {
      all.push({ ...t, name: `${t.name} ${e.suffix}`, brand: e.brand, price: t.price + e.priceDelta, mrp: undefined, featured: false, tags: [...t.tags, "organic"], material: "100% GOTS-certified organic cotton" });
    }
  }

  const productIds: { id: string; cat: string; price: number; name: string; slug: string; images: string[]; variants: { id: string; sku: string; color: string; size: string; costPrice: number | null }[] }[] = [];
  let skuN = 1000;
  for (const [i, t] of all.entries()) {
    const slug = slugify(t.name);
    const created = new Date(Date.now() - int(0, 120) * 86400000);
    // purchase cost ≈ 42–54% of the selling price (typical for a brand buying from wholesalers)
    const unitCost = Math.round((npr(t.price) * (0.42 + rand() * 0.12))) * 100;
    const variantsData = t.colors.flatMap((color, ci) =>
      t.sizes.map((size, si) => {
        // realistic stock curve: middle sizes deeper, some sold out, some low
        const mid = Math.abs(si - (t.sizes.length - 1) / 2);
        let stock = Math.max(0, Math.round(int(15, 60) - mid * 10));
        const r = rand();
        if (r < 0.08) stock = 0;
        else if (r < 0.16) stock = int(1, 4);
        return { sku: `AS-${String(skuN++).padStart(5, "0")}`, color, colorHex: COLORS[color], size, stock, position: ci * 100 + si, costPrice: unitCost };
      }),
    );
    const p = await db.product.create({
      data: {
        name: t.name, slug, brand: t.brand, gender: t.gender, status: "ACTIVE",
        description: t.desc, details: t.details, material: t.material, fit: t.fit,
        care: "Machine wash cold with like colours. Do not bleach. Tumble dry low. Warm iron if needed.",
        tags: t.tags, featured: !!t.featured,
        price: npr(t.price) * 100, compareAtPrice: t.mrp ? npr(t.mrp) * 100 : null,
        soldCount: int(5, 900), createdAt: created,
        categoryId: catIds.get(t.cat)!,
        collections: { connect: (t.collections ?? []).map((slug) => ({ slug })) },
        images: { create: t.images.map((id, pos) => ({ url: U(id), alt: `${t.name}${pos ? " — alternate view" : ""}`, position: pos })) },
        // stock is added per location below (Variant.stock is derived from it)
        variants: { create: variantsData.map((v) => ({ ...v, stock: 0 })) },
      },
      include: { variants: true },
    });
    const split = p.variants.flatMap((v) => {
      const total = variantsData.find((x) => x.sku === v.sku)!.stock;
      const wh = Math.ceil(total * 0.6), shop = Math.floor((total - wh) * 0.6);
      return ([[warehouse.id, wh], [flagship.id, shop], [pokhara.id, total - wh - shop]] as const).filter(([, q]) => q > 0).map(([storeId, quantity]) => ({ variantId: v.id, storeId, quantity }));
    });
    await db.storeStock.createMany({ data: split });
    await db.inventoryLog.createMany({ data: split.map(({ variantId, storeId, quantity }) => ({ variantId, storeId, delta: quantity, reason: "RECEIVED", note: "Opening stock", createdAt: created })) });
    p.variants = await db.variant.findMany({ where: { productId: p.id } });
    productIds.push({ id: p.id, cat: t.cat, price: p.price, name: p.name, slug: p.slug, images: t.images.map(U), variants: p.variants });
    void i;
  }

  console.log("Complete-the-look pairings…");
  const LOOKS: [string, string[]][] = [
    ["men-t-shirts", ["men-jeans", "men-trousers", "men-jackets"]],
    ["men-shirts", ["men-trousers", "men-blazers"]],
    ["men-hoodies", ["men-jeans"]],
    ["women-tops", ["women-jeans", "women-skirts", "women-jackets"]],
    ["women-knitwear", ["women-skirts", "women-jeans"]],
  ];
  for (const [top, bottoms] of LOOKS) {
    const pool = productIds.filter((p) => bottoms.includes(p.cat));
    for (const [k, p] of productIds.filter((x) => x.cat === top).entries()) {
      const picks = [...new Set([pool[k % pool.length], pool[(k + 1) % pool.length], pool[(k + 3) % pool.length]].filter(Boolean).map((x) => x.id))];
      await db.product.update({ where: { id: p.id }, data: { pairsWith: { connect: picks.map((id) => ({ id })) } } });
    }
  }

  console.log("Lookbook…");
  // demo looks from seeded products (their own photos as heroes); the owner curates real ones in Admin → Lookbook
  const LOOKBOOK: { title: string; subtitle: string; story: string; cats: string[] }[] = [
    { title: "Weekend in Pokhara", subtitle: "Soft cotton, broken-in denim and a light layer for the lakeside breeze", story: "Easy pieces for a slow Saturday: a tee you can live in, jeans that only get better, and a jacket for when the evening turns cool by Phewa.", cats: ["men-t-shirts", "men-jeans", "men-jackets"] },
    { title: "Monday, sorted", subtitle: "A crisp shirt, sharp trousers and a blazer that works with both", story: "The office uniform, done properly. Iron the shirt once, roll the sleeves after lunch, keep the blazer on the chair for the meeting that runs late.", cats: ["men-shirts", "men-trousers", "men-blazers"] },
    { title: "City errands", subtitle: "Relaxed denim, a soft top and a jacket with pockets that matter", story: "From Jhamsikhel coffee to New Road shopping: comfortable enough to walk all day, put-together enough for lunch.", cats: ["women-tops", "women-jeans", "women-jackets"] },
    { title: "Winter in the valley", subtitle: "Warm knits over a swishy skirt", story: "Kathmandu mornings ask for wool. Layer a knit over a skirt with boots and you are ready from the first cup of tea to the last.", cats: ["women-knitwear", "women-skirts"] },
  ];
  for (const [i, l] of LOOKBOOK.entries()) {
    const picks = l.cats.map((c) => productIds.find((p) => p.cat === c)).filter((p): p is (typeof productIds)[number] => !!p);
    if (picks.length < 2) continue;
    await db.look.create({ data: { title: l.title, slug: slugify(l.title), subtitle: l.subtitle, story: l.story, published: true, position: i, items: { create: picks.map((p, n) => ({ productId: p.id, position: n })) } } });
  }

  console.log("Delivery rates…");
  await db.deliveryRate.deleteMany();
  await db.deliveryRate.createMany({ data: deliveryRates() });


  console.log("Suppliers, purchasing & expenses…");
  const ownerId = (await db.user.findUniqueOrThrow({ where: { email: "admin@asson.test" } })).id;
  const suppliers = [];
  for (const sp of SUPPLIERS) suppliers.push(await db.supplier.create({ data: sp }));
  const shirtVariants = productIds.filter((p) => /Shirt|Tee|Polo/.test(p.name)).flatMap((p) => p.variants).slice(0, 6);
  const jeanVariants = productIds.filter((p) => /Jeans/.test(p.name)).flatMap((p) => p.variants).slice(0, 6);
  // a fully received PO (history) and an open one awaiting delivery
  const received = await db.purchaseOrder.create({
    data: {
      supplierId: suppliers[0].id, status: "RECEIVED", landedCost: 150000, createdById: ownerId, orderedAt: new Date(Date.now() - 20 * 86400000), createdAt: new Date(Date.now() - 21 * 86400000),
      items: { create: shirtVariants.map((v) => ({ variantId: v.id, quantityOrdered: 20, quantityReceived: v === shirtVariants[0] ? 18 : 20, quantityDamaged: v === shirtVariants[0] ? 2 : 0, unitCost: v.costPrice ?? 50000 })) },
    },
    include: { items: true },
  });
  await db.goodsReceipt.create({ data: { purchaseOrderId: received.id, receivedById: ownerId, note: "Invoice RT-2211 · 2 shirts with stains returned", createdAt: new Date(Date.now() - 18 * 86400000), items: { create: received.items.map((i) => ({ poItemId: i.id, variantId: i.variantId, quantity: i.quantityReceived, damaged: i.quantityDamaged, landedUnitCost: i.unitCost + 1250 })) } } });
  await db.purchaseOrder.create({
    data: {
      supplierId: suppliers[3].id, status: "ORDERED", landedCost: 800000, notes: "Cargo via Birgunj, ~10 days", createdById: ownerId, orderedAt: new Date(Date.now() - 3 * 86400000), expectedAt: new Date(Date.now() + 7 * 86400000),
      items: { create: jeanVariants.map((v) => ({ variantId: v.id, quantityOrdered: 30, unitCost: v.costPrice ?? 90000 })) },
    },
  });
  const ym = (offset: number) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - offset); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
  for (const [offset, day] of [[1, "02"], [0, "02"]] as const) {
    const m = ym(offset);
    await db.expense.createMany({
      data: [
        { date: `${m}-${day}`, category: "RENT", amount: 1000000, description: "Shop rent", paidVia: "Bank", createdById: ownerId },
        { date: `${m}-${day}`, category: "SALARIES", amount: 3000000, description: "Staff salaries (3)", paidVia: "Bank", createdById: ownerId },
        { date: `${m}-0${Number(day) + 2}`, category: "UTILITIES", amount: 450000, description: "Electricity, water, internet", paidVia: "eSewa", createdById: ownerId },
        { date: `${m}-0${Number(day) + 3}`, category: "MARKETING", amount: 800000, description: "Instagram & TikTok ads", paidVia: "Card", createdById: ownerId },
        { date: `${m}-0${Number(day) + 4}`, category: "PACKAGING", amount: 250000, description: "Mailer bags, tissue, stickers", paidVia: "Cash", createdById: ownerId },
      ],
    });
  }

  console.log("Coupons…");
  await db.coupon.createMany({
    data: [
      { code: "WELCOME10", description: "10% off your first order (up to Rs. 500)", type: "PERCENT", value: 10, maxDiscount: 50000, minSubtotal: 0, showOnHome: true },
      { code: "FLAT300", description: "Rs. 300 off orders above Rs. 2,499", type: "FIXED", value: 30000, minSubtotal: 249900 },
      { code: "FREESHIP", description: "Free standard delivery anywhere in Nepal", type: "FREE_SHIPPING", value: 0 },
      { code: "DASHAIN25", description: "Dashain offer: 25% off above Rs. 4,999 (max Rs. 1,500)", type: "PERCENT", value: 25, maxDiscount: 150000, minSubtotal: 499900, usageLimit: 1000 },
    ],
  });

  console.log("Reviews…");
  const TITLES = [["Love it", 5], ["Perfect fit", 5], ["Great quality for the price", 5], ["Very comfortable", 4], ["Nice, but runs a bit small", 4], ["Good basic", 4], ["Decent", 3], ["Colour slightly different", 3], ["Not for me", 2]] as const;
  const BODIES = ["Fabric feels premium and it washed really well.", "Ordered my usual size and it fits exactly as expected.", "Delivery was quick and packaging was neat.", "Bought a second colour after the first one.", "Stitching is solid. Would recommend.", "Comfortable enough to wear all day.", "Good value, though I'd size up next time."];
  const FITS = ["True to size", "True to size", "True to size", "Runs small", "Runs large"];
  for (const p of productIds) {
    const n = int(0, 9);
    const used = new Set<string>();
    let sum = 0, count = 0;
    for (let k = 0; k < n; k++) {
      const u = pick(shoppers);
      if (used.has(u.id)) continue;
      used.add(u.id);
      const [title, rating] = pick(TITLES);
      await db.review.create({ data: { productId: p.id, userId: u.id, rating, title, body: pick(BODIES), fit: pick(FITS), verified: rand() > 0.3, createdAt: new Date(Date.now() - int(1, 90) * 86400000) } });
      sum += rating; count++;
    }
    if (count) await db.product.update({ where: { id: p.id }, data: { ratingAvg: Math.round((sum / count) * 10) / 10, ratingCount: count } });
  }

  console.log("Order history…");
  const STATUS_MIX: OrderStatus[] = ["DELIVERED", "DELIVERED", "DELIVERED", "DELIVERED", "SHIPPED", "OUT_FOR_DELIVERY", "PACKED", "CONFIRMED", "PENDING", "PENDING", "CANCELLED", "RETURNED"];
  const FLOW: OrderStatus[] = ["PENDING", "CONFIRMED", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"];
  for (let n = 0; n < 160; n++) {
    const u = pick(shoppers);
    const addr = await db.address.findFirst({ where: { userId: u.id } });
    const daysAgo = Math.floor(Math.pow(rand(), 1.4) * 60);
    const created = new Date(Date.now() - daysAgo * 86400000 - int(0, 86000) * 1000);
    let status = pick(STATUS_MIX);
    if (daysAgo > 7 && ["PENDING", "CONFIRMED", "PACKED"].includes(status)) status = "DELIVERED";
    if (daysAgo < 1 && status === "DELIVERED") status = "CONFIRMED";
    const lines = Array.from({ length: int(1, 3) }, () => {
      const p = pick(productIds);
      const v = pick(p.variants);
      return { p, v, q: rand() > 0.8 ? 2 : 1 };
    });
    const subtotal = lines.reduce((s, l) => s + l.p.price * l.q, 0);
    const zone = ["Kathmandu", "Lalitpur", "Bhaktapur"].includes(addr?.district ?? "") ? "VALLEY" : addr?.district === "Mustang" ? "REMOTE" : "OUTSIDE";
    const shippingFee = subtotal >= 250000 ? 0 : { VALLEY: 10000, OUTSIDE: 15000, REMOTE: 25000 }[zone];
    const paymentMethod = rand() > 0.7 ? "ONLINE" : "COD"; // COD dominates in Nepal
    const paid = paymentMethod === "ONLINE" ? status !== "CANCELLED" || rand() > 0.5 : status === "DELIVERED";
    const flowIdx = FLOW.indexOf(status === "RETURNED" ? "DELIVERED" : status);
    const events =
      status === "CANCELLED"
        ? [{ status: "PENDING" as OrderStatus, message: "Order placed", actor: "customer", createdAt: created }, { status: "CANCELLED" as OrderStatus, message: "Cancelled by customer", actor: "customer", createdAt: new Date(created.getTime() + 3600000) }]
        : FLOW.slice(0, flowIdx + 1).map((st, k) => ({ status: st, message: k === 0 ? "Order placed" : `Status changed to ${st.replace(/_/g, " ").toLowerCase()}`, actor: k === 0 ? "customer" : "staff@asson.test", createdAt: new Date(created.getTime() + k * 20 * 3600000) }));
    if (status === "RETURNED") events.push({ status: "RETURNED", message: "Return received & refunded", actor: "staff@asson.test", createdAt: new Date(created.getTime() + 8 * 86400000) });
    const o = await db.order.create({
      include: { items: true },
      data: {
        userId: u.id, email: u.email, phone: u.phone ?? "9000000000", status,
        paymentMethod, paymentStatus: status === "RETURNED" ? "REFUNDED" : paid ? "PAID" : "PENDING",
        subtotal, shippingFee, total: subtotal + shippingFee, shippingMethod: "standard",
        shippingAddress: addr ? { fullName: addr.fullName, phone: addr.phone, line1: addr.line1, line2: addr.line2, city: addr.city, district: addr.district, state: addr.state, postalCode: addr.postalCode, country: addr.country, zone } : {},
        carrier: flowIdx >= 3 ? (zone === "VALLEY" ? pick(["Own rider", "Pathao Parcel"]) : pick(["Nepal Can Move (NCM)", "Upaya City Cargo", "Aramex Nepal"])) : null,
        trackingNumber: flowIdx >= 3 ? `NP${int(10000000, 99999999)}` : null,
        createdAt: created, updatedAt: events[events.length - 1].createdAt,
        items: { create: lines.map((l) => ({ variantId: l.v.id, unitCost: l.v.costPrice, productId: l.p.id, name: l.p.name, slug: l.p.slug, sku: l.v.sku, color: l.v.color, size: l.v.size, image: l.p.images[0], unitPrice: l.p.price, quantity: l.q })) },
        events: { create: events },
      },
    });
    // demo history: where open and past orders were filled from (packed onwards = already picked)
    if (status !== "CANCELLED") {
      await db.orderAllocation.createMany({
        data: o.items.map((it) => ({ orderId: o.id, orderItemId: it.id, variantId: it.variantId, storeId: warehouse.id, quantity: it.quantity, createdAt: created, ...(flowIdx >= 2 ? { pickedAt: new Date(created.getTime() + 30 * 3600000) } : {}) })),
      });
    }
  }

  console.log("Loyalty points & stock alerts…");
  // credit points for the delivered history (1 pt / Rs 100 of goods), plus the welcome bonus
  for (const u of shoppers.slice(0, 9)) {
    const delivered = await db.order.findMany({ where: { userId: u.id, status: "DELIVERED" }, orderBy: { createdAt: "asc" }, select: { id: true, total: true, shippingFee: true, createdAt: true } });
    const entries: { userId: string; delta: number; reason: string; note: string; createdAt: Date; orderId?: string }[] = [{ userId: u.id, delta: 100, reason: "WELCOME", note: "Welcome to Asson", createdAt: new Date(Date.now() - 90 * 86400000) }];
    for (const o of delivered) {
      const pts = Math.floor((o.total - o.shippingFee) / 10000);
      if (!pts) continue;
      await db.order.update({ where: { id: o.id }, data: { pointsEarned: pts } });
      entries.push({ userId: u.id, delta: pts, reason: "EARN", note: "Classic tier", createdAt: new Date(o.createdAt.getTime() + 3 * 86400000), orderId: o.id });
    }
    await db.pointsEntry.createMany({ data: entries });
    await db.user.update({ where: { id: u.id }, data: { points: entries.reduce((s, e) => s + e.delta, 0) } });
  }
  const soldOut = await db.variant.findMany({ where: { stock: 0 }, take: 6, select: { id: true } });
  for (const [k, v] of soldOut.entries()) {
    await db.stockAlert.createMany({ data: Array.from({ length: (k % 3) + 1 }, (_, j) => ({ variantId: v.id, phone: `98${String(41000000 + k * 10 + j).padStart(8, "0")}` })) });
  }

  const counts = await Promise.all([db.product.count(), db.variant.count(), db.order.count(), db.user.count()]);
  console.log(`Done: ${counts[0]} products, ${counts[1]} variants, ${counts[2]} orders, ${counts[3]} users`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
