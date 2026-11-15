// The shop's policies, written from the store's own settings (lib/config.ts) so a number on a policy page can
// never disagree with what checkout, returns or loyalty actually do. Change a setting and the policy follows.
//
// Plain-language drafts for an online clothing shop in Nepal, following the Consumer Protection Act 2075, the
// Individual Privacy Act 2075 and the Electronic Transactions Act 2063 as commonly applied. THEY ARE NOT LEGAL
// ADVICE: have a Nepali lawyer review them, and confirm the points in OWNER_TO_CONFIRM, before relying on them.
// English is the authoritative text; the pages around it are translated.

import { store } from "./config";
import { formatPrice } from "./utils";
import { parseIds } from "./marketing-shared";

// Ad and analytics tools switched on for this shop (server environment; see lib/marketing.ts). The cookie and
// privacy pages name exactly these, so they can't claim more or less than the site does.
const ads = parseIds({ meta: process.env.META_PIXEL_ID, tiktok: process.env.TIKTOK_PIXEL_ID, ga4: process.env.GA4_MEASUREMENT_ID });
const adTools = [
  ads.meta && "Meta (Facebook and Instagram) pixel: _fbp, _fbc",
  ads.tiktok && "TikTok pixel: _ttp, ttcsid",
  ads.ga4 && "Google Analytics: _ga, _ga_*",
].filter((x): x is string => !!x);

export type Block = string | { list: string[] } | { note: string };
export type Section = { id: string; title: string; blocks: Block[] };
export type Policy = { slug: string; title: string; summary: string; sections: Section[] };

/** When the policies last changed in substance (bump it with any edit to the wording). */
export const POLICIES_UPDATED = "2026-11-13";

/** Choices the owner (and lawyer) must confirm; until then the drafts use these defaults. Listed in docs/Policies.md. */
export const OWNER_TO_CONFIRM = [
  "The registered business name, address, PAN/VAT number and the grievance contact person",
  `The ${store.returnWindowDays}-day return window and what can't be returned (innerwear, altered or worn items)`,
  "Whether the delivery fee is refunded on a change-of-mind return (drafted: no; yes when we were at fault)",
  `The cash-on-delivery limit of ${formatPrice(store.codMaxOrder)} and the refund time of 3–5 working days`,
  "How long order, account and customer-care records are kept (drafted: accounting records at least 6 years, as tax law requires)",
  "Reporting damaged or missing items within 48 hours, and complaints resolved within 7 days",
  "Sale items returnable like full-price items",
  "Loyalty, referral and birthday amounts",
];

const Z = store.shipping.zones;
const days = (z: { etaMinDays: number; etaMaxDays: number }) => `${z.etaMinDays}–${z.etaMaxDays} working days`;
const rs = formatPrice;
const contact = `phone or WhatsApp ${store.supportPhone}, or email ${store.supportEmail}`;
const payments = store.onlinePaymentsLive ? "cash on delivery, eSewa or Khalti" : "cash on delivery (online payment by eSewa and Khalti is coming soon)";

export const POLICIES: Policy[] = [
  {
    slug: "terms",
    title: "Terms and conditions",
    summary: "The agreement between you and Asson when you use this website or buy from us.",
    sections: [
      { id: "about", title: "1. About these terms", blocks: [
        `These terms apply when you browse ${store.name}'s website, create an account or place an order with us, online or for delivery from one of our shops. By placing an order you accept them. Our Privacy, Shipping, Returns, Payments and Cookie policies form part of these terms.`,
        `“We”, “us” and “${store.name}” mean the business that runs this shop in ${store.country}. “You” means the person using the site or placing the order.`,
      ] },
      { id: "account", title: "2. Your account", blocks: [
        "You can shop as a guest or with an account. If you create one, keep your password private and tell us straight away if you think someone else has used it. You're responsible for orders placed from your account.",
        "Give us true details, especially your name, phone number and delivery address: we use them to deliver your order and to confirm cash-on-delivery orders by phone.",
        "We may suspend an account that is used for fraud, abuse of offers, or repeated refusal of cash-on-delivery parcels.",
      ] },
      { id: "products", title: "3. Products, sizes and colours", blocks: [
        "We describe every product as accurately as we can: fabric, composition, fit and care. Colours can look slightly different on different screens, and handmade or natural fabrics vary a little from piece to piece. That is not a fault.",
        "Use the size guide and the fit notes on each product. If something doesn't fit, you can exchange it (see our Returns policy).",
      ] },
      { id: "prices", title: "4. Prices", blocks: [
        `Prices are in Nepali rupees (NPR) and include ${store.vatPercent}% VAT. Delivery is charged by district and shown before you place the order; it's free on orders of ${rs(store.shipping.freeThreshold)} or more.`,
        "Prices and offers can change at any time, but the price you see when you place an order is the price you pay.",
        "If a product is listed at a clearly wrong price because of a mistake (for example, a missing digit), we'll contact you before dispatch: you can pay the correct price or cancel for a full refund.",
      ] },
      { id: "orders", title: "5. Placing an order", blocks: [
        `When you place an order we send a confirmation with your order number (starting “${store.orderPrefix}”). The contract is made when we confirm and dispatch it. We may call you to confirm a cash-on-delivery order before we pack it.`,
        `We can limit quantities (at most ${store.maxQtyPerItem} of one item per order) and may refuse or cancel an order if an item is out of stock, the price was wrong, delivery to the address isn't possible, or we suspect fraud. If you've already paid, we refund you in full.`,
      ] },
      { id: "changes", title: "6. Changing or cancelling an order", blocks: [
        "Until your order is packed you can cancel it, change a size, remove items or change the delivery address yourself from your order page, or by contacting us. Once it's packed it can't be cancelled, but you can return it after delivery.",
      ] },
      { id: "delivery", title: "7. Delivery", blocks: [
        "We deliver to all 77 districts of Nepal through our courier partners. Delivery times are estimates and can be longer during festivals, strikes, bad weather or road closures. Details are in our Shipping policy.",
        "The risk in the goods passes to you when they're delivered to you or to the person you asked us to deliver to.",
      ] },
      { id: "returns", title: "8. Returns, exchanges and faulty items", blocks: [
        `You can return or exchange items within ${store.returnWindowDays} days of delivery, as set out in our Returns policy. This doesn't affect your rights under the Consumer Protection Act if an item is faulty, not as described, or not what you ordered.`,
      ] },
      { id: "offers", title: "9. Coupons, loyalty points and referrals", blocks: [
        "Coupons and offers have their own conditions (minimum spend, dates, one per order) shown with the offer. They have no cash value and can't be exchanged for cash.",
        "Loyalty points, referral rewards and birthday points are governed by our Rewards terms. We can change or end these programmes with notice, but points you've already earned stay valid as described there.",
      ] },
      { id: "reviews", title: "10. Reviews and content you send us", blocks: [
        "Reviews must be honest and about the product. We may decline or remove reviews that are offensive, misleading, contain personal details or advertise. By posting a review you allow us to show it on our site.",
      ] },
      { id: "use", title: "11. Using this website", blocks: [
        "Don't misuse the site: no automated scraping, attempts to break security, false orders or abuse of other customers or our staff. The site's design, photos and text belong to us or our suppliers; don't copy them without permission.",
        "We work to keep the site available and accurate but can't guarantee it will always be uninterrupted or free of errors.",
      ] },
      { id: "liability", title: "12. Our responsibility to you", blocks: [
        "If we break these terms we're responsible for loss you suffer that was a foreseeable result. Our total liability for an order is limited to what you paid for it, except where the law doesn't allow a limit (for example, for death or injury caused by negligence, or fraud).",
        "We're not responsible for delays or failures caused by events outside our control, such as natural disasters, strikes, bandhs, road closures or network outages.",
      ] },
      { id: "complaints", title: "13. Complaints", blocks: [
        `If something has gone wrong, contact us first: ${contact}, or use the form on the Help page. We reply within one working day and aim to resolve complaints within 7 days. If you're not satisfied, you can contact the Department of Commerce, Supplies and Consumer Protection.`,
      ] },
      { id: "law", title: "14. Law and changes to these terms", blocks: [
        "These terms are governed by the laws of Nepal, and the courts of Nepal have jurisdiction.",
        "We may update these terms; the version on this page when you place an order applies to that order. If a part of these terms is found invalid, the rest still applies.",
      ] },
    ],
  },
  {
    slug: "privacy",
    title: "Privacy policy",
    summary: "What we collect about you, why, who we share it with, and your rights.",
    sections: [
      { id: "who", title: "1. Who we are", blocks: [
        `${store.name} runs this shop and is responsible for your personal information. Questions about privacy: ${contact}.`,
      ] },
      { id: "collect", title: "2. What we collect", blocks: [
        { list: [
          "Details you give us: name, phone number, email, delivery addresses and district, and, if you choose, your birthday.",
          "Orders: what you bought, prices, delivery and payment method, returns, exchanges and the messages about them.",
          "Account activity: your wishlist, reviews, size and price-drop alerts, loyalty points and referrals.",
          "Customer care: what you write to us, and notes of phone or WhatsApp conversations about your order.",
          "Technical details: your IP address and device information, used to keep the site secure (for example, to stop repeated failed sign-ins).",
          "Search terms typed on the site, counted without linking them to you, to improve what we stock.",
        ] },
        "We don't store card details: when online payments are available, they're handled by the payment provider.",
      ] },
      { id: "why", title: "3. Why we use it", blocks: [
        { list: [
          "To take, deliver and support your orders, including returns, exchanges and refunds (needed to fulfil our contract with you).",
          "To send order updates by SMS, and to call to confirm cash-on-delivery orders.",
          "To run your account, loyalty points and referrals.",
          "To prevent fraud and keep the site secure.",
          "To keep the accounting and tax records the law requires.",
          "To send offers, only if you've agreed. You can unsubscribe at any time.",
        ] },
      ] },
      { id: "share", title: "4. Who we share it with", blocks: [
        "We never sell your personal information. We share only what each party needs:",
        { list: [
          "Courier partners: your name, phone, address and the cash amount to collect.",
          "SMS providers: your phone number and the message.",
          store.onlinePaymentsLive ? "Payment providers (eSewa, Khalti): the order amount and reference." : "Payment providers (eSewa, Khalti), once online payment is available: the order amount and reference.",
          "Our hosting and security providers, who store and protect the site and its backups under contract.",
          ...(adTools.length ? ["Advertising and analytics partners (" + [ads.meta && "Meta", ads.tiktok && "TikTok", ads.ga4 && "Google"].filter(Boolean).join(", ") + "), only if you choose \"Accept all\" on our cookie banner: the pages you visit and what you add to your bag or buy on this site. For a purchase we may also send Meta your email and phone number in scrambled (hashed) form so it can match the order to an ad; they can't read them back from that."] : []),
          "Authorities, when the law requires it (for example, tax authorities or the police with a lawful request).",
        ] },
      ] },
      { id: "keep", title: "5. How long we keep it", blocks: [
        "Order and accounting records are kept for as long as tax and accounting law requires (at least 6 years). Account details are kept while your account is open. Marketing consent is kept until you withdraw it. Security logs are kept for a limited time and then deleted.",
      ] },
      { id: "security", title: "6. Keeping it safe", blocks: [
        "The site uses encrypted connections (HTTPS). Passwords are stored as one-way hashes, never in plain text. Staff see only the information their job needs, and every change staff make to orders, prices and stock is recorded in a permanent audit trail. Backups are encrypted in transit and kept in restricted storage.",
      ] },
      { id: "rights", title: "7. Your rights", blocks: [
        "You can ask to see the personal information we hold about you, to correct it, or to delete it where we don't have to keep it by law. You can update most details yourself under Account → Profile and Addresses.",
        `To make a request, contact us: ${contact}. We'll confirm who you are and reply within 15 days.`,
      ] },
      { id: "children", title: "8. Children", blocks: [
        "Our shop is for adults. We sell children's clothing to parents and guardians; we don't knowingly collect information from children.",
      ] },
      { id: "changes", title: "9. Changes", blocks: [
        "If we change this policy, we'll update the date on this page, and tell you directly if the change is significant.",
      ] },
    ],
  },
  {
    slug: "shipping",
    title: "Shipping and delivery",
    summary: "Where we deliver, how long it takes and what it costs.",
    sections: [
      { id: "where", title: "Where we deliver", blocks: [
        "To all 77 districts of Nepal. Choose your district at checkout, or on any product page, to see the exact fee and estimated delivery time for your area.",
      ] },
      { id: "times", title: "How long it takes", blocks: [
        { list: [
          `${Z.VALLEY.label}: ${days(Z.VALLEY)}.`,
          `${Z.OUTSIDE.label}: ${days(Z.OUTSIDE)}.`,
          `${Z.REMOTE.label} (for example Humla, Dolpa, Mustang): ${days(Z.REMOTE)}.`,
          `${store.shipping.express.label} inside the Valley: ${store.shipping.express.eta.toLowerCase()}.`,
        ] },
        "Times are counted from when we dispatch your order. Festivals (especially Dashain and Tihar), strikes, weather and road closures can add delays; we'll tell you if your order is affected.",
      ] },
      { id: "cost", title: "What it costs", blocks: [
        `Delivery is free on orders of ${rs(store.shipping.freeThreshold)} or more, anywhere in Nepal. Below that, the fee depends on your district: typically ${rs(Z.VALLEY.fee)} inside the Valley, ${rs(Z.OUTSIDE.fee)} outside it and ${rs(Z.REMOTE.fee)} to remote districts. Express delivery is ${rs(store.shipping.express.fee)}. The exact fee is always shown before you place your order, and includes VAT.`,
      ] },
      { id: "tracking", title: "Tracking your order", blocks: [
        "We send an SMS when your order is confirmed, shipped (with the tracking number and any cash to pay) and out for delivery. You can also track it on the Track your order page with your order number and phone number.",
      ] },
      { id: "collect", title: "Collecting from a shop", blocks: [
        `Choose “Collect from a shop” at checkout to pick your order up at one of our shops with no delivery fee. We'll text you when it's ready. We keep it for ${store.pickup.holdDays} days; after that it may be cancelled and returned to stock.`,
      ] },
      { id: "failed", title: "If we can't deliver", blocks: [
        "The courier will call before delivering. If they can't reach you, they'll try again. If delivery still fails, or a cash-on-delivery parcel is refused, the order comes back to us and is cancelled. Repeatedly refusing cash-on-delivery parcels may mean we ask for payment in advance next time.",
        "Check your parcel when it arrives. If it's damaged or something is missing, tell us within 48 hours with a photo, and we'll put it right.",
      ] },
    ],
  },
  {
    slug: "returns",
    title: "Returns, exchanges and refunds",
    summary: `${store.returnWindowDays} days to return or swap a size, and what happens to your money.`,
    sections: [
      { id: "window", title: `${store.returnWindowDays} days to change your mind`, blocks: [
        `You can return or exchange items within ${store.returnWindowDays} days of delivery. Items must be unworn, unwashed and unaltered, with their original tags attached.`,
        { note: "For hygiene, innerwear and socks can't be returned unless they're faulty. Items altered for you (for example, hemmed trousers) can't be returned unless faulty." },
      ] },
      { id: "exchange", title: "Exchanging a size", blocks: [
        "The quickest way to get the right fit. Open your order (Account → Orders, or the link in your order SMS) and choose “Exchange a size”. We send the new size free of charge and collect the old one at the same time. If the size you want is out of stock, you can return the item instead.",
        "You can also exchange at any of our shops: bring the item and your order number.",
      ] },
      { id: "how", title: "How to return", blocks: [
        "Open your order and choose “Return items”, tell us why, and we'll arrange a pickup. You can also bring it to one of our shops. Please pack the items securely.",
      ] },
      { id: "faulty", title: "Faulty, damaged or wrong items", blocks: [
        "If an item is faulty, damaged on arrival or not what you ordered, tell us as soon as possible with a photo. We'll replace it or refund you in full, including delivery, and collect it at no cost to you. This is in addition to your rights under the Consumer Protection Act.",
      ] },
      { id: "refunds", title: "Refunds", blocks: [
        "Once your return reaches us and passes a quick check, we refund the items' price:",
        { list: [
          "Online payments: to the same wallet or card.",
          "Cash on delivery: to your eSewa or Khalti wallet or your bank account, whichever you choose.",
          "Shop purchases: in cash, to the card used, or as store credit.",
        ] },
        "Refunds are made within 3–5 working days of the return reaching us. For a change-of-mind return the original delivery fee isn't refunded; when we made the mistake, it is.",
        "Loyalty points earned on returned items are taken back, and points you used are given back. If a coupon was used, the refund is what you actually paid.",
      ] },
      { id: "sale", title: "Sale items", blocks: [
        "Sale items can be returned or exchanged in the same way as full-price items.",
      ] },
    ],
  },
  {
    slug: "payments",
    title: "Payments and pricing",
    summary: "How you can pay, cash on delivery, VAT and receipts.",
    sections: [
      { id: "methods", title: "How you can pay", blocks: [
        `Online orders: ${payments}. In our shops: cash, Fonepay QR and cards.`,
      ] },
      { id: "cod", title: "Cash on delivery", blocks: [
        `Available everywhere we deliver for orders up to ${rs(store.codMaxOrder)}. Have the exact amount ready if you can; the rider may also accept QR payment. We may call to confirm a cash-on-delivery order before we pack it, especially for a first order or a larger amount.`,
      ] },
      { id: "vat", title: "VAT and receipts", blocks: [
        `All prices and delivery fees include ${store.vatPercent}% VAT. You receive a tax invoice when your order is delivered or collected (on your order page, to print or save)${store.vatNumber ? `, showing our VAT number ${store.vatNumber}` : ""}. If you need it in your business's name and PAN, ask us before the order is dispatched; in our shops, give your PAN at the till.`,
      ] },
      { id: "security", title: "Payment security", blocks: [
        "We never ask for your card PIN, wallet password or OTP by phone, SMS or WhatsApp. If anyone claiming to be us asks, don't share it, and tell us.",
      ] },
    ],
  },
  {
    slug: "rewards",
    title: "Rewards terms",
    summary: "Loyalty points, tiers, referrals and birthday points.",
    sections: [
      { id: "earn", title: "Earning points", blocks: [
        `Members earn 1 point for every ${rs(store.loyalty.earnPer)} paid for goods (delivery isn't included), added when the order is delivered. New members get ${store.loyalty.welcomePoints} welcome points. Shop purchases earn points when your phone number is linked to your account.`,
        { list: store.loyalty.tiers.map((t) => `${t.name}: ${t.multiplier}× points${t.minSpend ? `, for ${rs(t.minSpend)} or more spent in the last 12 months` : ""}.`) },
      ] },
      { id: "use", title: "Using points", blocks: [
        `1 point is worth ${rs(store.loyalty.pointValue)} off. You can use ${store.loyalty.minRedeem} points or more at checkout, covering up to ${store.loyalty.maxRedeemPercent}% of the items' price. Points have no cash value and can't be transferred.`,
        "If you cancel an order, points you used are given back. If you return items, points earned on them are taken back.",
      ] },
      { id: "referral", title: "Refer a friend", blocks: [
        `Share your code: your friend gets ${rs(store.referral.friendDiscount)} off their first order of ${rs(store.referral.friendMinSubtotal)} or more, and you get ${store.referral.referrerPoints} points when their order is delivered (up to ${store.referral.monthlyCap} rewards in 30 days). Referring yourself or creating extra accounts isn't allowed.`,
      ] },
      { id: "birthday", title: "Birthday points", blocks: [
        `If you've added your birthday and have had an order delivered, we add ${store.birthday.points} points on your birthday, once a year.`,
      ] },
      { id: "changes", title: "Changes", blocks: [
        "We can change or end the rewards programme with at least 30 days' notice on this page. Points you've already earned stay usable for at least those 30 days. Points gained by fraud or abuse can be removed.",
      ] },
    ],
  },
  {
    slug: "cookies",
    title: "Cookie policy",
    summary: "The small files this site stores in your browser, and why.",
    sections: [
      { id: "what", title: "What we use", blocks: [
        adTools.length
          ? "We use cookies and browser storage that the shop needs to work, and to remember your choices. Advertising and analytics cookies are used only if you choose \"Accept all\" on our cookie banner."
          : "We only use cookies and browser storage that the shop needs to work, and to remember your choices. We don't use advertising or third-party tracking cookies.",
        { list: [
          "Sign-in (tl_session): keeps you signed in. Needed for your account and checkout.",
          "Bag (tl_cart): remembers what's in your bag.",
          "District (asson_district): remembers your district so delivery fees and times are right.",
          "Referral (asson_ref): remembers a friend's referral code until you order.",
          "Recently viewed and recent searches (asson_recent, browser storage): shown back to you only, on this device.",
          "Your phone number for stock alerts (browser storage), so you don't have to type it twice.",
          ...(adTools.length ? ["Your cookie choice (asson_consent): remembers whether you accepted advertising cookies, for 6 months."] : []),
        ] },
      ] },
      ...(adTools.length ? [{ id: "ads", title: "Advertising and analytics (only with your permission)", blocks: [
        "If you choose \"Accept all\", these partners set their own cookies to measure which ads bring people to our shop and to show you more relevant ads on their platforms:",
        { list: adTools },
        "They see the pages you visit here and what you add to your bag or buy. Each partner handles that data under its own privacy policy. If you choose \"Only necessary\", none of them is loaded.",
      ] }] : []),
      { id: "control", title: "Your choices", blocks: [
        "You can clear or block cookies in your browser settings. If you block the sign-in or bag cookies, you won't be able to sign in or check out.",
        adTools.length
          ? "You can change your mind at any time with \"Cookie settings\" at the bottom of every page. Choosing \"Only necessary\" stops the partners above from loading on your next page; to remove cookies they already set, clear them in your browser."
          : "If we ever add analytics or advertising cookies, we'll ask for your permission first and update this page.",
      ] },
    ],
  },
];

export const policy = (slug: string) => POLICIES.find((p) => p.slug === slug);
