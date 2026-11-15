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
  /** The business's 9-digit PAN/VAT number from the IRD, printed on every tax invoice (empty = invoices say "PAN not set"). */
  // DUMMY (owner's choice, 15 Nov 2026): 999999999 is the IRD's own test PAN. Replace both with the real PAN and
  // registered name before relying on the invoices: invoices issued meanwhile keep these details for ever.
  vatNumber: "999999999",
  /** Registered business name for tax invoices (as on the PAN certificate); empty = `name`. */
  legalName: "Asson Pvt. Ltd. (sample details)",
  /** Tax invoices (docs/Tax-Invoices.md). Rules to be confirmed by the accountant before switching anything on. */
  invoices: {
    /** Abbreviated tax invoices at the till need the tax officer's permission (VAT Rules r.18): off until granted. */
    abbreviated: false,
    /** …and only up to this total (paisa), never when the buyer gives a PAN or asks for a full invoice. */
    abbreviatedMax: 1_000_000,
    /** Series for online orders (each shop's till uses its location code). */
    onlineSeries: "WEB",
    /** A CBMS post this soon after issue counts as real time (isrealtime). */
    cbmsRealtimeMinutes: 10,
  },
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
  /** VAT included in every price and delivery fee (used to split totals in the accounting registers) */
  vatPercent: 13,
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
  // Order SMS in Nepali for shoppers who ordered in Nepali. Devanagari SMS are Unicode: 70 characters per
  // segment instead of 160, so each message costs about 2–3× more. Off until the owner decides.
  smsInNepali: false,
  /** The Nepali shop (switch in the header, menu and footer, and Nepali for Nepali-language browsers). Off (owner, 13 Nov 2026):
   * everyone sees English. The translations stay in lib/i18n/ne.ts; set true and restore the switch to bring it back. */
  nepaliShop: false,
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
  /** Refer a friend (owner to confirm the amounts). The friend's discount is on their first order only. */
  referral: {
    friendDiscount: 20_000, // Rs 200 off …
    friendMinSubtotal: 150_000, // … an order of Rs 1,500 or more
    referrerPoints: 200, // = Rs 200 in points, once the friend's order is delivered
    monthlyCap: 10, // referral rewards per customer per 30 days
  },
  /** Birthday treat (owner to confirm): points added on the day, once a year, for customers with a delivered order. */
  birthday: { points: 200 },
  /**
   * People: attendance and leave (Admin → My time, Admin → People). Leave rules follow the Labour Act 2074
   * as commonly summarised; owner/accountant to confirm against the Act and your contracts.
   */
  people: {
    leaveYearStart: "07-17", // the leave year starts with the Nepal fiscal year (Shrawan 1, about 17 July)
    weeklyOff: 6, // Saturday (0 = Sunday … 6 = Saturday): not counted as a leave day
    autoCloseHours: 16, // an entry still open this long was a forgotten clock-out
    presentMinutes: 240, // a day counts as worked (for home leave) at 4+ hours
    // rosters: Labour Act 2074 — 8 hours a day, 48 a week, one day off a week; overtime beyond that needs consent and pay
    dayHours: 8,
    maxWeekHours: 48,
    lateGraceMinutes: 10, // clocking in this long after the shift starts counts as late
    leave: [
      { key: "HOME", label: "Home leave", accruePerDaysWorked: 20, maxBalance: 90, paid: true },
      { key: "SICK", label: "Sick leave", perYear: 12, paid: true },
      { key: "MATERNITY", label: "Maternity leave", perRequest: 98, paid: true },
      { key: "PATERNITY", label: "Paternity leave", perRequest: 15, paid: true },
      { key: "MOURNING", label: "Mourning leave", perRequest: 13, paid: true },
      { key: "UNPAID", label: "Unpaid leave", paid: false },
    ] as { key: string; label: string; paid: boolean; perYear?: number; perRequest?: number; accruePerDaysWorked?: number; maxBalance?: number }[],
  },
  /** Own production (Admin → Production). Owner to confirm. */
  /** Salary TDS and SSF are deposited within this many days after the payroll month ends (confirm with the accountant). */
  statutoryDueDays: 25,
  /** deliveries desk: a shipped parcel not delivered after this many days is "stuck"; a parcel coming back after this many is chased with the courier */
  delivery: { stuckDays: 5, chaseReturnDays: 10 },
  /** markdowns: sale prices round down to this (paisa); a sale price under cost + minMarginPct needs the owner to tick "below margin" */
  markdown: { roundTo: 10_00, minMarginPct: 10 },
  /** COD risk on the confirmation-call queue: a district returning this share of parcels (with at least `minShipped` in 90 days) is risky; a first COD order at or over `bigFirstOrder` paisa too */
  codRisk: { districtRate: 0.15, minShipped: 20, bigFirstOrder: 1_000_000 },
  /** Cash per location (Finance → Cash). */
  cash: {
    holdLimit: 200_000_00, // more than this in a safe: deposit it
    depositEveryDays: 3, // flag a shop that hasn't banked cash for longer
    pettyMax: 5_000_00, // one petty-cash spend; bigger costs go through Finance → Expenses
  },
  /** Store visit audits (Admin → Store visits). */
  visits: {
    everyDays: 30, // a shop not visited for longer is flagged
    fixDays: 7, // a failed item must be fixed within this many days
    criticalFixDays: 2, // ... or this many if it's critical (safety, cash, legal)
  },
  /** Customer care queue (Admin → Customer care). First reply due within these hours. */
  care: {
    replyHours: { URGENT: 2, NORMAL: 8, LOW: 24 },
    reopenDays: 14, // a customer reply within this many days of "resolved" reopens the case; later starts a new one
  },
  /** Shop issue reports (Admin → Issues): how long HQ has to fix each priority before it's overdue. */
  issues: {
    dueHours: { URGENT: 4, NORMAL: 48, LOW: 168 },
    repeatWindowDays: 30, // "3rd equipment issue at this shop in 30 days"
  },
  production: {
    wastagePercent: 3, // extra fabric/trims issued on top of the bill of materials for cutting loss
  },
  /** Keeping shops stocked from warehouses (Admin → Replenishment). Owner to confirm. */
  replenishment: {
    shopCoverDays: 21, // a shop holds enough for this many days of its own sales
    minDisplay: 1, // and at least this many of each size it has sold in the last 90 days
    warehouseReserveDays: 7, // a warehouse keeps this many days of its own online sales back
    rebalanceAfterDays: 60, // stock unsold this long at a shop can be moved to a shop that sells it
    autoDraft: false, // true: a nightly job drafts the suggested transfers by itself
  },
  /** Planning numbers for reorder and dead-stock insights (Admin → Insights). */
  insights: {
    leadTimeDays: 14, // typical days from placing a purchase order to counting it in
    coverDays: 45, // how long a reorder should last once it arrives (same as the old reorder rule)
    deadStockDays: 90, // in stock this long with no sale = dead stock
    festivalUplift: 1.5, // festival weeks sell this many times an ordinary week, until a year of history says otherwise (owner to confirm)
  },
  /** Click-and-collect at shops marked as pickup points (Admin → Locations). Free; pay at the counter. */
  pickup: {
    holdDays: 7, // ready orders are kept this long before staff may cancel and restock them
    readyNow: "In stock at this shop: usually ready the same day",
    readyLater: "Comes from our warehouse: usually ready in 2–4 days",
  },
  /** The till keeps selling when the shop's internet drops (Point of sale). */
  posOffline: {
    snapshotMaxAgeHours: 72, // the till won't sell offline from a price list older than this
    maxDiscountPercent: 5, // no approval PIN can be checked offline, so never more than a cashier's own limit
    clockSkewMinutes: 10, // a device clock this far off is corrected to the sync time (and noted on the sale)
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
