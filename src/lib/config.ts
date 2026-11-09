/**
 * Store-wide configuration. Everything brand-, currency- or policy-specific lives here
 * so the business can change it without touching feature code.
 */
export const store = {
  name: "Asson",
  tagline: "Classic clothing. Quality fabric. Fair prices.",
  supportEmail: "support.asson@gmail.com",
  supportPhone: "9761452270",
  supportWhatsApp: "9761452270",
  /** Flagship shop address — printed on POS receipts. */
  storeAddress: "Kathmandu, Nepal",
  vatNumber: "",
  currency: "NPR",
  currencySymbol: "Rs.",
  /** Number grouping: Nepal uses lakh/crore grouping (1,00,000), same as en-IN. */
  numberLocale: "en-IN",
  timeZone: "Asia/Kathmandu",
  country: "Nepal",
  phonePrefix: "+977",
  /** Order numbers are shown as PREFIX + number, e.g. AS000231 */
  orderPrefix: "AS",
  vatLabel: "Inclusive of 13% VAT",
  shipping: {
    /** Free standard delivery anywhere in Nepal at or above this subtotal (paisa). */
    freeThreshold: 250000,
    /**
     * Default rates used to seed the per-district table (Admin → Delivery) and as a fallback.
     * The live price for a district always comes from the DeliveryRate table.
     */
    zones: {
      VALLEY: { label: "Inside Kathmandu Valley", fee: 10000, etaMinDays: 1, etaMaxDays: 2, express: true },
      OUTSIDE: { label: "Outside the Valley", fee: 15000, etaMinDays: 3, etaMaxDays: 5, express: false },
      REMOTE: { label: "Remote district", fee: 25000, etaMinDays: 5, etaMaxDays: 10, express: false },
    },
    express: { label: "Express delivery", fee: 20000, eta: "Same or next day" },
  },
  /** Online payments (eSewa/Khalti) stay hidden until the integration is finished and approved. */
  onlinePaymentsLive: false,
  codMaxOrder: 3000000, // COD allowed up to Rs 30,000
  returnWindowDays: 7,
  loyalty: {
    /** 1 point per Rs 100 paid for goods (delivery excluded) */
    earnPer: 10_000,
    /** 1 point = Rs 1 off */
    pointValue: 100,
    minRedeem: 100,
    /** points can cover at most this share of the bag */
    maxRedeemPercent: 20,
    welcomePoints: 100,
    /** tier by spend over the last 12 months (paisa) */
    tiers: [
      { name: "Classic", minSpend: 0, multiplier: 1 },
      { name: "Silver", minSpend: 2_500_000, multiplier: 1.25 },
      { name: "Gold", minSpend: 7_500_000, multiplier: 1.5 },
    ],
  },
  maxQtyPerItem: 10,
  /** Click-and-collect at shops marked as pickup points (Admin → Locations). Free; pay at the counter. */
  pickup: {
    holdDays: 7, // ready orders are kept this long before staff may cancel and restock them
    readyNow: "In stock at this shop: usually ready the same day",
    readyLater: "Comes from our warehouse: usually ready in 2–4 days",
  },
} as const;

/** Opens a WhatsApp chat with the support number (wa.me needs the country code, digits only). */
export function whatsappUrl() {
  return `https://wa.me/${(store.phonePrefix + store.supportWhatsApp).replace(/\D/g, "")}`;
}

export type ShippingMethodId = "standard" | "express";
export type Zone = "VALLEY" | "OUTSIDE" | "REMOTE";

export const PROVINCES: { name: string; districts: string[] }[] = [
  { name: "Koshi", districts: ["Bhojpur", "Dhankuta", "Ilam", "Jhapa", "Khotang", "Morang", "Okhaldhunga", "Panchthar", "Sankhuwasabha", "Solukhumbu", "Sunsari", "Taplejung", "Terhathum", "Udayapur"] },
  { name: "Madhesh", districts: ["Bara", "Dhanusha", "Mahottari", "Parsa", "Rautahat", "Saptari", "Sarlahi", "Siraha"] },
  { name: "Bagmati", districts: ["Bhaktapur", "Chitwan", "Dhading", "Dolakha", "Kathmandu", "Kavrepalanchok", "Lalitpur", "Makwanpur", "Nuwakot", "Ramechhap", "Rasuwa", "Sindhuli", "Sindhupalchok"] },
  { name: "Gandaki", districts: ["Baglung", "Gorkha", "Kaski", "Lamjung", "Manang", "Mustang", "Myagdi", "Nawalpur", "Parbat", "Syangja", "Tanahun"] },
  { name: "Lumbini", districts: ["Arghakhanchi", "Banke", "Bardiya", "Dang", "Gulmi", "Kapilvastu", "Palpa", "Parasi", "Pyuthan", "Rolpa", "Rukum East", "Rupandehi"] },
  { name: "Karnali", districts: ["Dailekh", "Dolpa", "Humla", "Jajarkot", "Jumla", "Kalikot", "Mugu", "Rukum West", "Salyan", "Surkhet"] },
  { name: "Sudurpashchim", districts: ["Achham", "Baitadi", "Bajhang", "Bajura", "Dadeldhura", "Darchula", "Doti", "Kailali", "Kanchanpur"] },
];

export const DISTRICTS = PROVINCES.flatMap((p) => p.districts).sort();

const VALLEY = ["Kathmandu", "Lalitpur", "Bhaktapur"];
// Districts most couriers serve on longer routes / at higher cost. Adjust to your courier's rate card.
const REMOTE = ["Humla", "Dolpa", "Mugu", "Jumla", "Kalikot", "Bajura", "Bajhang", "Darchula", "Manang", "Mustang", "Solukhumbu", "Taplejung", "Rasuwa", "Rukum East"];

export function provinceOf(district: string) {
  return PROVINCES.find((p) => p.districts.includes(district))?.name ?? null;
}

export function zoneOf(district: string | null | undefined): Zone {
  if (district && VALLEY.includes(district)) return "VALLEY";
  if (district && REMOTE.includes(district)) return "REMOTE";
  return "OUTSIDE";
}

export const SIZE_ORDER = [
  "XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL",
  "26", "28", "30", "32", "34", "36", "38", "40",
  "2-3Y", "4-5Y", "6-7Y", "8-9Y", "10-11Y", "12-13Y",
  "Free",
];

export function sortSizes<T extends string>(sizes: T[]): T[] {
  return [...sizes].sort((a, b) => {
    const ia = SIZE_ORDER.indexOf(a);
    const ib = SIZE_ORDER.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });
}
