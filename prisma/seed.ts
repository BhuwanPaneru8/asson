/**
 * Development seed: a year of demo trading so every part of Asson Commerce OS has realistic data to look at.
 * ⚠ WIPES the database first (refuses in production). Run with `npm run db:seed`.
 *
 * Demo accounts (development only — change or delete before going live):
 *   admin@asson.test    / Admin@12345     (owner, approval PIN 1357)
 *   manager@asson.test  / Manager@12345   (operations manager, approval PIN 2580)
 *   cashier@asson.test  / Cashier@12345   (cashier at the Flagship)
 *   staff@asson.test    / Staff@12345     (warehouse and online orders)
 *   customer@asson.test / Customer@12345  (a regular customer with a year of orders)
 * Everyone else on the team (one per job and shop, see prisma/demo/people.ts) signs in with Demo@12345;
 * shop managers' approval PINs are 4711 (Pokhara) and 4712 (Labim). Managers set up two-step sign-in on first login.
 *
 * What's in it and how it's built: prisma/demo/*.ts (history.ts runs the year; shared.ts explains the rules kept).
 */
import { DAY, IS_E2E, NOW, TODAY, U, addDays, db, int, pick, rand, slugify } from "./demo/shared";
import bcrypt from "bcryptjs";
import type { Gender } from "@prisma/client";
import { CATEGORIES, SUPPLIERS, deliveryRates } from "./reference-data";
import { loadOldMoneyEdit } from "./catalogue-old-money";
import { EXTRA_COLLECTIONS, EXTRA_LOOKS, EXTRA_TEMPLATES } from "./demo/catalogue-extra";
import { createTeam, leaveDayMap, planAbsences, planLeave, planRota, runPayroll, writePeople, type Shop } from "./demo/people";
import { FESTIVE, HISTORY_DAYS, runHistory } from "./demo/history";
import type { P } from "./demo/context";
import { HOLIDAYS, writeAlerts, writeCare, writeChecklists, writeIssues, writeReviews, writeStats, writeVisits } from "./demo/ops";
import { buildLinks, lockDays, planMarkdowns, resetSequences, writeCounts, writeExpenses, writePayables, writeStatement } from "./demo/finance";

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
  const started = Date.now();
  console.log(`Resetting data… (${IS_E2E ? "E2E database" : "development"})`);
  // append-only tables (triggers block DELETE): the cash book, the damaged register, statement lines, the audit trail
  await db.$executeRawUnsafe(`TRUNCATE "StatementLine", "CashEntry", "BankDeposit", "DamageEntry", "AuditLog"`);
  // issued invoices and credit notes can't be deleted (triggers): TRUNCATE them and their prints/CBMS outbox, and restart numbering
  await db.$executeRawUnsafe(`TRUNCATE "CbmsSync", "InvoicePrint", "CreditNote", "TaxInvoice", "InvoiceSeries"`);
  // closed months and filed VAT returns lock expenses, bills and payments (triggers): clear them before wiping
  await db.monthClose.deleteMany();
  await db.vatReturn.deleteMany();
  await db.fiscalYearClose.deleteMany();
  await db.$transaction([
    // own production first: it points at products, suppliers and locations
    db.productionReceipt.deleteMany(), db.materialLog.deleteMany(), db.productionLine.deleteMany(), db.productionOrder.deleteMany(),
    db.bomLine.deleteMany(), db.materialStock.deleteMany(), db.material.deleteMany(),
    db.creditAllocation.deleteMany(), db.supplierCredit.deleteMany(), db.paymentAllocation.deleteMany(), db.supplierPayment.deleteMany(), db.supplierBill.deleteMany(),
    db.absence.deleteMany(), db.attendance.deleteMany(), db.leaveRequest.deleteMany(),
    db.statutoryDeposit.deleteMany(), db.payslip.deleteMany(), db.payrollRun.deleteMany(), db.employment.deleteMany(), db.payrollTaxYear.deleteMany(),
    db.commissionRule.deleteMany(),
    db.checklistRun.deleteMany(), db.checklistTemplate.deleteMany(), db.announcement.deleteMany(),
    db.issueEvent.deleteMany(), db.issue.deleteMany(), db.careMessage.deleteMany(), db.careCase.deleteMany(), db.vmEvent.deleteMany(), db.vmSubmission.deleteMany(), db.vmBrief.deleteMany(), db.visitAction.deleteMany(), db.storeVisit.deleteMany(), db.visitTemplate.deleteMany(), db.shopBudget.deleteMany(), db.recurringCost.deleteMany(), db.binAssignment.deleteMany(), db.bin.deleteMany(), db.priceAlert.deleteMany(), db.priceEventItem.deleteMany(), db.priceEvent.deleteMany(), db.exchangeItem.deleteMany(), db.exchange.deleteMany(), db.deliveryAttempt.deleteMany(), db.returnToOrigin.deleteMany(), db.sopSignoff.deleteMany(), db.sop.deleteMany(), db.shiftSwap.deleteMany(), db.rosterShift.deleteMany(), db.rosterWeek.deleteMany(), db.manifestOrder.deleteMany(), db.manifest.deleteMany(), db.packCheck.deleteMany(), db.waveOrder.deleteMany(), db.pickWave.deleteMany(),
    db.stockCountLine.deleteMany(), db.stockCount.deleteMany(), db.productLink.deleteMany(), db.holiday.deleteMany(), db.handbookRead.deleteMany(),
    db.searchStat.deleteMany(), db.funnelStat.deleteMany(), db.notification.deleteMany(),
    db.stockAlert.deleteMany(), db.pointsEntry.deleteMany(),
    db.returnItem.deleteMany(), db.return.deleteMany(), db.goodsReceiptItem.deleteMany(), db.goodsReceipt.deleteMany(),
    db.purchaseOrderItem.deleteMany(), db.purchaseOrder.deleteMany(), db.supplier.deleteMany(), db.expense.deleteMany(),
    db.posException.deleteMany(), db.posDevice.deleteMany(),
    db.orderEvent.deleteMany(), db.orderItem.deleteMany(), db.tender.deleteMany(), db.payment.deleteMany(), db.order.deleteMany(), db.codRemittance.deleteMany(),
    db.staffLocation.deleteMany(), db.look.deleteMany(), db.dayClose.deleteMany(), db.shift.deleteMany(), db.stockTransfer.deleteMany(),
    db.inventoryLog.deleteMany(), db.cartItem.deleteMany(), db.cart.deleteMany(),
    db.wishlistItem.deleteMany(), db.review.deleteMany(), db.productImage.deleteMany(),
    db.variant.deleteMany(), db.store.deleteMany(), db.product.deleteMany(), db.collection.deleteMany(),
    db.category.deleteMany(), db.address.deleteMany(), db.coupon.deleteMany(), db.user.deleteMany(),
  ]);

  console.log("Locations and the team…");
  // online orders are filled from the warehouse first, then the shops; Labim opened five months ago
  const D0 = addDays(TODAY, -HISTORY_DAYS);
  const longAgo = addDays(D0, -30);
  const shopRows = [
    { code: "WH-KTM", name: "Main warehouse", kind: "WAREHOUSE" as const, district: "Kathmandu", address: "Balaju Industrial Area, Kathmandu", priority: 10, opened: longAgo, closedOn: [6], hours: [9, 17] as [number, number] },
    { code: "FLAGSHIP", name: "Asson Flagship", kind: "SHOP" as const, district: "Kathmandu", address: "Durbar Marg, Kathmandu", phone: "9761452270", hours: [10, 19] as [number, number], hoursText: "10am – 7pm, Sun–Fri", pickup: true, priority: 20, opened: longAgo, closedOn: [6] },
    { code: "PKR", name: "Asson Pokhara", kind: "SHOP" as const, district: "Kaski", address: "Lakeside, Pokhara", hours: [10, 20] as [number, number], hoursText: "10am – 8pm, every day", pickup: true, priority: 30, opened: longAgo, closedOn: [] as number[] },
    { code: "LTP", name: "Asson Labim", kind: "SHOP" as const, district: "Lalitpur", address: "Labim Mall, Pulchowk, Lalitpur", hours: [11, 20] as [number, number], hoursText: "11am – 8pm, every day", pickup: true, priority: 25, opened: addDays(TODAY, -150), closedOn: [] as number[] },
  ];
  const shops: Record<string, Shop> = {};
  for (const r of shopRows) {
    const row = await db.store.create({ data: { code: r.code, name: r.name, kind: r.kind, district: r.district, address: r.address, phone: "phone" in r ? r.phone : null, hours: "hoursText" in r ? r.hoursText : null, pickup: "pickup" in r ? r.pickup : false, priority: r.priority, minStaff: r.kind === "SHOP" ? 2 : 1, createdAt: new Date(`${r.opened}T03:00:00Z`) } });
    shops[r.code] = { id: row.id, code: r.code, name: r.name, kind: r.kind, opened: r.opened, closedOn: r.closedOn, hours: r.hours };
  }
  const people = await createTeam(db, shops);
  const owner = people.owner;
  const customerHash = await bcrypt.hash("Customer@12345", 10);
  const aarav = await db.user.create({
    data: {
      email: "customer@asson.test", name: "Aarav Shrestha", phone: "9841234567", passwordHash: await bcrypt.hash("Customer@12345", 12), createdAt: new Date(`${addDays(D0, 10)}T09:00:00Z`), birthday: "03-14", referralCode: "AARAV10",
      addresses: { create: { fullName: "Aarav Shrestha", phone: "9841234567", line1: "Naya Baneshwor-10, House 24", line2: "Behind Everest Bank", city: "Kathmandu Metropolitan City", district: "Kathmandu", state: "Bagmati", postalCode: "44600", isDefault: true } },
    },
  });

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
    ...EXTRA_COLLECTIONS,
  ];
  for (const [i, c] of COLLS.entries()) await db.collection.create({ data: { ...c, sortOrder: i } });

  console.log("Products…");
  type Tpl = T & { nameNe?: string; status?: "DRAFT" | "ARCHIVED"; age?: number };
  const all: Tpl[] = [...TEMPLATES];
  // a handful of "organic" line extensions on staples
  for (const t of TEMPLATES.filter((x) => ["Essential Crew Tee", "Ribbed Fitted Tee", "Classic Pullover Hoodie", "Stretch Chinos"].includes(x.name))) {
    for (const e of EXTRA_LINES) {
      all.push({ ...t, name: `${t.name} ${e.suffix}`, brand: e.brand, price: t.price + e.priceDelta, mrp: undefined, featured: false, tags: [...t.tags, "organic"], material: "100% GOTS-certified organic cotton", age: 150 });
    }
  }
  // made-in-Nepal pieces, a draft and last season's archived tee (after the originals, so their SKUs don't move)
  all.push(...(EXTRA_TEMPLATES as unknown as Tpl[]));

  const products: P[] = [];
  const opening: { storeId: string; variantId: string; quantity: number; at: Date }[] = [];
  let skuN = 1000;
  for (const t of all) {
    const slug = slugify(t.name);
    // most of the range has been on sale for over a year; a few are recent arrivals
    const ageDays = t.age ?? (rand() < 0.08 ? int(25, 70) : int(HISTORY_DAYS + 5, HISTORY_DAYS + 40));
    const created = new Date(NOW.getTime() - ageDays * DAY);
    // purchase cost ≈ 42–54% of the selling price (typical for a brand buying from wholesalers)
    const unitCost = Math.round((npr(t.price) * (0.42 + rand() * 0.12))) * 100;
    const variantsData = t.colors.flatMap((color, ci) =>
      t.sizes.map((size, si) => {
        // stock curve: middle sizes deeper; a few sizes start thin and sell out during the year
        const mid = Math.abs(si - (t.sizes.length - 1) / 2);
        let stock = Math.max(2, Math.round(int(18, 60) - mid * 10));
        if (rand() < 0.1) stock = int(1, 3);
        return { sku: `AS-${String(skuN++).padStart(5, "0")}`, color, colorHex: COLORS[color as ColorName] ?? "#888888", size, stock, position: ci * 100 + si, costPrice: unitCost };
      }),
    );
    const p = await db.product.create({
      data: {
        name: t.name, nameNe: t.nameNe ?? null, slug, brand: t.brand, gender: t.gender, status: t.status ?? "ACTIVE",
        description: t.desc, details: t.details, material: t.material, fit: t.fit,
        care: "Machine wash cold with like colours. Do not bleach. Tumble dry low. Warm iron if needed.",
        tags: t.tags, featured: !!t.featured,
        price: npr(t.price) * 100, compareAtPrice: t.mrp ? npr(t.mrp) * 100 : null,
        createdAt: created,
        categoryId: catIds.get(t.cat)!,
        collections: { connect: (t.collections ?? []).map((slug) => ({ slug })) },
        images: { create: t.images.map((id, pos) => ({ url: U(id), alt: `${t.name}${pos ? " — alternate view" : ""}`, position: pos })) },
        // stock is added per location by the history (Variant.stock is derived from it)
        variants: { create: variantsData.map((v) => ({ ...v, stock: 0 })) },
      },
      include: { variants: true },
    });
    if (t.status !== "DRAFT") {
      for (const v of p.variants) {
        const total = variantsData.find((x) => x.sku === v.sku)!.stock;
        const whQ = Math.ceil(total * 0.6), shopQ = Math.floor((total - whQ) * 0.6);
        for (const [storeId, quantity] of [[shops["WH-KTM"].id, whQ], [shops.FLAGSHIP.id, shopQ], [shops.PKR.id, total - whQ - shopQ]] as const) if (quantity > 0) opening.push({ storeId, variantId: v.id, quantity, at: created });
      }
    }
    const popularity = (t.featured ? 2.2 : 1) * (0.5 + rand() * 1.2) * (p.price < 150_000 ? 1.5 : p.price > 600_000 ? 0.45 : 1);
    products.push({ id: p.id, name: p.name, slug: p.slug, cat: t.cat, gender: t.gender, brand: t.brand, price: p.price, status: p.status, createdAt: created, image: U(t.images[0]), popularity, tags: t.tags, variants: p.variants.map((v) => ({ id: v.id, sku: v.sku, color: v.color, size: v.size, costPrice: v.costPrice, productId: p.id })) });
  }

  // the Old Money Edit: a featured collection, two categories and four looks (same loader the live shop uses);
  // its stock went into the warehouse. Launched about two months ago in this demo.
  console.log("Old Money Edit:", await loadOldMoneyEdit(db));
  const launched = new Date(NOW.getTime() - 58 * DAY);
  const heritage = await db.product.findMany({ where: { id: { notIn: products.map((p) => p.id) } }, include: { variants: true, category: { select: { slug: true } }, images: { take: 1, orderBy: { position: "asc" } } } });
  await db.product.updateMany({ where: { id: { in: heritage.map((p) => p.id) } }, data: { createdAt: launched } });
  await db.inventoryLog.updateMany({ where: { variant: { productId: { in: heritage.map((p) => p.id) } } }, data: { createdAt: launched } });
  for (const p of heritage) products.push({ id: p.id, name: p.name, slug: p.slug, cat: p.category.slug, gender: p.gender, brand: p.brand, price: p.price, status: p.status, createdAt: launched, image: p.images[0]?.url ?? "", popularity: (p.featured ? 1.8 : 0.9) * (0.6 + rand()), tags: p.tags, variants: p.variants.map((v) => ({ id: v.id, sku: v.sku, color: v.color, size: v.size, costPrice: v.costPrice, productId: p.id })) });

  console.log("Complete-the-look pairings & Lookbook…");
  const LOOKS: [string, string[]][] = [
    ["men-t-shirts", ["men-jeans", "men-trousers", "men-jackets"]],
    ["men-shirts", ["men-trousers", "men-blazers"]],
    ["men-hoodies", ["men-jeans"]],
    ["women-tops", ["women-jeans", "women-skirts", "women-jackets"]],
    ["women-knitwear", ["women-skirts", "women-jeans"]],
    ["men-ethnic", ["men-ethnic"]],
  ];
  for (const [top, bottoms] of LOOKS) {
    const pool = products.filter((p) => bottoms.includes(p.cat) && p.status === "ACTIVE");
    for (const [k, p] of products.filter((x) => x.cat === top && x.status === "ACTIVE").entries()) {
      const picks = [...new Set([pool[k % pool.length], pool[(k + 1) % pool.length], pool[(k + 3) % pool.length]].filter((x) => x && x.id !== p.id).map((x) => x.id))];
      if (picks.length) await db.product.update({ where: { id: p.id }, data: { pairsWith: { connect: picks.map((id) => ({ id })) } } });
    }
  }
  // demo looks from seeded products (their own photos as heroes); the owner curates real ones in Admin → Lookbook
  const LOOKBOOK: { title: string; subtitle: string; story: string; cats: string[] }[] = [
    { title: "Weekend in Pokhara", subtitle: "Soft cotton, broken-in denim and a light layer for the lakeside breeze", story: "Easy pieces for a slow Saturday: a tee you can live in, jeans that only get better, and a jacket for when the evening turns cool by Phewa.", cats: ["men-t-shirts", "men-jeans", "men-jackets"] },
    { title: "Monday, sorted", subtitle: "A crisp shirt, sharp trousers and a blazer that works with both", story: "The office uniform, done properly. Iron the shirt once, roll the sleeves after lunch, keep the blazer on the chair for the meeting that runs late.", cats: ["men-shirts", "men-trousers", "men-blazers"] },
    { title: "City errands", subtitle: "Relaxed denim, a soft top and a jacket with pockets that matter", story: "From Jhamsikhel coffee to New Road shopping: comfortable enough to walk all day, put-together enough for lunch.", cats: ["women-tops", "women-jeans", "women-jackets"] },
    { title: "Winter in the valley", subtitle: "Warm knits over a swishy skirt", story: "Kathmandu mornings ask for wool. Layer a knit over a skirt with boots and you are ready from the first cup of tea to the last.", cats: ["women-knitwear", "women-skirts"] },
  ];
  const lookStart = (await db.look.aggregate({ _max: { position: true } }))._max.position ?? 0;
  for (const [i, l] of LOOKBOOK.entries()) {
    const picks = l.cats.map((c) => products.find((p) => p.cat === c && p.status === "ACTIVE")).filter((p): p is P => !!p);
    if (picks.length < 2) continue;
    await db.look.create({ data: { title: l.title, slug: slugify(l.title), subtitle: l.subtitle, story: l.story, published: true, position: lookStart + 1 + i, items: { create: picks.map((p, n) => ({ productId: p.id, position: n })) } } });
  }
  for (const [i, l] of EXTRA_LOOKS.entries()) {
    const pieces = l.pieces.map((s) => products.find((p) => p.slug === s)).filter((p): p is P => !!p);
    if (pieces.length < 2) continue;
    await db.look.create({ data: { title: l.title, slug: slugify(l.title), subtitle: l.subtitle, story: l.story, published: l.published, position: lookStart + 10 + i, items: { create: pieces.map((p, n) => ({ productId: p.id, position: n, note: l.notes?.[n] ?? null })) } } });
  }

  console.log("Delivery rates, suppliers, coupons, holidays…");
  await db.deliveryRate.deleteMany();
  await db.deliveryRate.createMany({ data: deliveryRates() });
  const rates = new Map(deliveryRates().map((r) => [r.district, { zone: r.zone, fee: r.fee, etaMax: r.etaMaxDays }]));
  const suppliers = [];
  for (const sp of SUPPLIERS) {
    const nepal = sp.country === "Nepal";
    suppliers.push(await db.supplier.create({ data: { ...sp, pan: nepal ? `60${int(1000000, 9999999)}` : null, contact: nepal ? pick(["Ramesh ji", "Kamala didi", "Suresh dai"]) : null, paymentTermsDays: nepal ? 30 : 45, createdAt: new Date(`${longAgo}T05:00:00Z`) } }));
  }
  const day = (d: string, hh = 0) => new Date(`${d}T${String(hh).padStart(2, "0")}:00:00+05:45`);
  await db.coupon.createMany({
    data: [
      { code: "WELCOME10", description: "10% off your first order (up to Rs. 500)", type: "PERCENT", value: 10, maxDiscount: 50000, minSubtotal: 0, showOnHome: true },
      { code: "FLAT300", description: "Rs. 300 off orders above Rs. 2,499", type: "FIXED", value: 30000, minSubtotal: 249900 },
      { code: "FREESHIP", description: "Free standard delivery anywhere in Nepal", type: "FREE_SHIPPING", value: 0 },
      { code: "WINTER200", description: "Rs. 200 off winter wear above Rs. 2,999", type: "FIXED", value: 20000, minSubtotal: 299900, startsAt: day(addDays(TODAY, -3)), endsAt: day(addDays(TODAY, 40), 23) },
      { code: "DASHAIN25", description: "Dashain offer: 25% off above Rs. 4,999 (max Rs. 1,500)", type: "PERCENT", value: 25, maxDiscount: 150000, minSubtotal: 499900, usageLimit: 1000, startsAt: day(FESTIVE[2][0]), endsAt: day(FESTIVE[2][1], 23) },
      { code: "TIHAR15", description: "Tihar: 15% off (max Rs. 1,000)", type: "PERCENT", value: 15, maxDiscount: 100000, minSubtotal: 199900, startsAt: day(FESTIVE[3][0]), endsAt: day(FESTIVE[3][1], 23) },
      { code: "DASHAIN2082", description: "Last year's Dashain offer", type: "PERCENT", value: 20, maxDiscount: 120000, minSubtotal: 399900, startsAt: day(FESTIVE[0][0]), endsAt: day(FESTIVE[0][1], 23) },
      { code: "NEWYEAR2083", description: "Nepali New Year: Rs. 500 off above Rs. 3,999", type: "FIXED", value: 50000, minSubtotal: 399900, usageLimit: 300, startsAt: day("2026-04-10"), endsAt: day("2026-04-20", 23) },
      { code: "STAFF20", description: "Staff and family (paused)", type: "PERCENT", value: 20, minSubtotal: 0, active: false },
    ],
  });
  const coupons = [
    { code: "WELCOME10", type: "PERCENT" as const, value: 10, maxDiscount: 50000, minSubtotal: 0 },
    { code: "FLAT300", type: "FIXED" as const, value: 30000, minSubtotal: 249900 },
    { code: "FREESHIP", type: "FREE_SHIPPING" as const, value: 0, minSubtotal: 0, from: addDays(TODAY, -200) },
    { code: "WINTER200", type: "FIXED" as const, value: 20000, minSubtotal: 299900, from: addDays(TODAY, -3) },
    { code: "DASHAIN25", type: "PERCENT" as const, value: 25, maxDiscount: 150000, minSubtotal: 499900, from: FESTIVE[2][0], to: FESTIVE[2][1] },
    { code: "TIHAR15", type: "PERCENT" as const, value: 15, maxDiscount: 100000, minSubtotal: 199900, from: FESTIVE[3][0], to: FESTIVE[3][1] },
    { code: "DASHAIN2082", type: "PERCENT" as const, value: 20, maxDiscount: 120000, minSubtotal: 399900, from: FESTIVE[0][0], to: FESTIVE[0][1] },
    { code: "NEWYEAR2083", type: "FIXED" as const, value: 50000, minSubtotal: 399900, from: "2026-04-10", to: "2026-04-20" },
  ];
  await db.holiday.createMany({ data: HOLIDAYS.map(([date, name]) => ({ date, name })) });

  console.log("Team rota, leave and missed shifts…");
  const leave = planLeave(people);
  const { away } = planAbsences(people);
  const rota = planRota(people, shops, `${addDays(TODAY, -130).slice(0, 8)}01`, leaveDayMap(leave), away);
  await writePeople(db, people, shops, rota, leave);

  console.log("A year of trading (online orders, tills, purchasing, transfers)…");
  const protect = ["oxford-button-down-shirt", "two-piece-wool-suit"];
  const markdowns = planMarkdowns(products, protect);
  const regular = { id: aarav.id, email: aarav.email, phone: aarav.phone!, name: aarav.name, district: "Kathmandu", createdAt: aarav.createdAt, zone: "VALLEY", home: "FLAGSHIP", address: { fullName: "Aarav Shrestha", phone: "9841234567", line1: "Naya Baneshwor-10, House 24", line2: "Behind Everest Bank", city: "Kathmandu Metropolitan City", district: "Kathmandu", state: "Bagmati", postalCode: "44600", country: "Nepal" } };
  const { c, customers, bills } = await runHistory(db, { products, shops, people, suppliers: suppliers.map((s) => ({ id: s.id, name: s.name, country: s.country, pan: s.pan })), rates, coupons, markdowns: markdowns.windows, tillOf: rota.tillOf, regular, opening, protect, passwordHash: customerHash });
  await markdowns.write(db, owner.id);

  console.log("Payroll, reviews, care, operations and the books…");
  await runPayroll(db, people);
  await writeReviews(db, c);
  await writeCare(db, c, customers.filter((x) => x.id));
  await writeIssues(db, c);
  const shopList = [shops.FLAGSHIP, shops.PKR, shops.LTP];
  await writeChecklists(db, c, shopList);
  await writeVisits(db, c, shopList);
  await writeExpenses(db, c, shopList);
  await writePayables(db, c, bills);
  await writeStatement(db, c);
  await writeCounts(db, c);
  await writeStats(db, c);
  await writeAlerts(db, c, customers.filter((x) => x.id));
  console.log("Day closes and recommendations (with the app's own code)…");
  await lockDays(db, c, shopList);
  await buildLinks();
  await resetSequences(db);

  const counts = await Promise.all([db.product.count(), db.variant.count(), db.order.count(), db.user.count(), db.taxInvoice.count(), db.inventoryLog.count()]);
  console.log(`Done in ${Math.round((Date.now() - started) / 1000)} s: ${counts[0]} products, ${counts[1]} variants, ${counts[2]} orders, ${counts[3]} users, ${counts[4]} tax invoices, ${counts[5]} stock moves`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
