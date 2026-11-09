/**
 * Reference data the shop needs in EVERY environment (production included): the category tree,
 * delivery rates for all 77 districts, and the owner's supplier list. Used by prisma/seed.ts
 * (demo) and prisma/bootstrap.ts (production-safe, never overwrites edits).
 */
const U = (id: string) => `https://images.unsplash.com/photo-${id}`;

export const CATEGORIES: { name: string; slug: string; image: string; desc: string; children: { name: string; slug: string }[] }[] = [
  {
    name: "Men", slug: "men", image: U("1490114538077-0a7f8cb49891"), desc: "Everyday staples and sharp layers.",
    children: [
      { name: "T-Shirts & Polos", slug: "men-t-shirts" }, { name: "Shirts", slug: "men-shirts" },
      { name: "Jeans", slug: "men-jeans" }, { name: "Trousers & Chinos", slug: "men-trousers" },
      { name: "Jackets & Coats", slug: "men-jackets" }, { name: "Hoodies & Sweatshirts", slug: "men-hoodies" },
      { name: "Blazers & Suits", slug: "men-blazers" }, { name: "Ethnic Wear", slug: "men-ethnic" },
    ],
  },
  {
    name: "Women", slug: "women", image: U("1483985988355-763728e1935b"), desc: "Easy dresses, tailored separates, considered knits.",
    children: [
      { name: "Dresses", slug: "women-dresses" }, { name: "Tops & Tees", slug: "women-tops" },
      { name: "Jeans", slug: "women-jeans" }, { name: "Skirts", slug: "women-skirts" },
      { name: "Knitwear", slug: "women-knitwear" }, { name: "Jackets & Coats", slug: "women-jackets" },
      { name: "Ethnic Wear", slug: "women-ethnic" },
    ],
  },
  {
    name: "Kids", slug: "kids", image: U("1503944583220-79d8926ad5e2"), desc: "Built for play, made to be handed down.",
    children: [{ name: "Boys", slug: "kids-boys" }, { name: "Girls", slug: "kids-girls" }],
  },
];

const VALLEY = ["Kathmandu", "Lalitpur", "Bhaktapur"];
const REMOTE = ["Humla", "Dolpa", "Mugu", "Jumla", "Kalikot", "Bajura", "Bajhang", "Darchula", "Manang", "Mustang", "Solukhumbu", "Taplejung", "Rasuwa", "Rukum East"];
const PROVINCE_OF: Record<string, string> = {};
for (const [prov, list] of Object.entries({
  Koshi: ["Bhojpur", "Dhankuta", "Ilam", "Jhapa", "Khotang", "Morang", "Okhaldhunga", "Panchthar", "Sankhuwasabha", "Solukhumbu", "Sunsari", "Taplejung", "Terhathum", "Udayapur"],
  Madhesh: ["Bara", "Dhanusha", "Mahottari", "Parsa", "Rautahat", "Saptari", "Sarlahi", "Siraha"],
  Bagmati: ["Bhaktapur", "Chitwan", "Dhading", "Dolakha", "Kathmandu", "Kavrepalanchok", "Lalitpur", "Makwanpur", "Nuwakot", "Ramechhap", "Rasuwa", "Sindhuli", "Sindhupalchok"],
  Gandaki: ["Baglung", "Gorkha", "Kaski", "Lamjung", "Manang", "Mustang", "Myagdi", "Nawalpur", "Parbat", "Syangja", "Tanahun"],
  Lumbini: ["Arghakhanchi", "Banke", "Bardiya", "Dang", "Gulmi", "Kapilvastu", "Palpa", "Parasi", "Pyuthan", "Rolpa", "Rukum East", "Rupandehi"],
  Karnali: ["Dailekh", "Dolpa", "Humla", "Jajarkot", "Jumla", "Kalikot", "Mugu", "Rukum West", "Salyan", "Surkhet"],
  Sudurpashchim: ["Achham", "Baitadi", "Bajhang", "Bajura", "Dadeldhura", "Darchula", "Doti", "Kailali", "Kanchanpur"],
})) for (const d of list) PROVINCE_OF[d] = prov;

/** One row per district: zone defaults Valley Rs 100 (1–2 days), Outside Rs 150 (3–5), Remote Rs 250 (5–10). Fees in paisa. */
export function deliveryRates() {
  return Object.keys(PROVINCE_OF).map((district) => {
    const zone = VALLEY.includes(district) ? "VALLEY" : REMOTE.includes(district) ? "REMOTE" : "OUTSIDE";
    const t = { VALLEY: [10000, 1, 2], OUTSIDE: [15000, 3, 5], REMOTE: [25000, 5, 10] }[zone]!;
    return { district, province: PROVINCE_OF[district], zone, fee: t[0], etaMinDays: t[1], etaMaxDays: t[2], expressAvailable: zone === "VALLEY" };
  });
}

/** Where the owner buys stock (from the owner's operating notes). */
export const SUPPLIERS = [
  { name: "Ranjana Trade", location: "4th D32, New Road, Kathmandu", phone: "9813666352", country: "Nepal", notes: "Local wholesaler — quick restocks of basics." },
  { name: "Mahaboudha & Bhotahity wholesalers", location: "Mahaboudha / Bhotahity, Kathmandu", country: "Nepal", notes: "Wholesale market — compare several shops before buying." },
  { name: "New Baneshwor wholesalers", location: "New Baneshwor, Kathmandu", country: "Nepal" },
  { name: "Tank Road market", location: "Karol Bagh, Delhi", country: "India", notes: "India's largest wholesale market for jeans and men's casual wear." },
  { name: "Gandhi Nagar market", location: "Delhi", country: "India", notes: "Large readymade garment wholesale market." },
  { name: "Surat textile market", location: "Surat, Gujarat", country: "India", notes: "Fabric and ethnic wear." },
  { name: "Baima Clothing Market", location: "Guangzhou, Guangdong", country: "China", notes: "Premium, high-quality men's shirts, coats and casual wear." },
  { name: "Shaoxing Textile Market", location: "Shaoxing, Zhejiang", country: "China", notes: "\"Fabric capital of China\" — silk, cotton and yarns for own production." },
];
