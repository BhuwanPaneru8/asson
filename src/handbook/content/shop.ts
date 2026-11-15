import type { HandbookPage } from "../types";

export const SHOP: HandbookPage[] = [
  {
    slug: "shop-overview",
    section: "shop",
    title: "The website: browsing, the bag and checkout",
    summary: "What a customer sees from the home page to a placed order, so you can guide them.",
    audience: "all",
    minutes: 6,
    version: 1,
    related: ["shop-account", "shop-policies", "shop-app"],
    body: `## Finding things
- **Home**: new arrivals, featured collections, the lookbook, recently viewed items.
- **Menu**: Men, Women, Kids, categories and collections.
- **Search**: instant and forgiving of typos ("oxfrod" finds Oxford). Nepali words work on the Nepali site.
- **Listings**: filter by size, colour, price and more; sort by newest, price or popularity.

## The product page
Photos, colour and size picker with **live stock** (sold-out sizes show; customers can ask to be told when they're back), fabric, fit and care, reviews with fit feedback ("most say true to size"), the **size guide**, a **delivery estimate** for their district (exact fee and arrival date), complete-the-look and similar products, and a price-drop alert.

## The bag
A slide-out bag with quantities, the **free-delivery progress** (free at Rs. 2,500 or more), "complete your order" suggestions and the coupon field.

## Checkout
Guest or signed-in. Name, mobile, address with province and district (delivery fee and days shown), Standard or Express, coupon, loyalty points (100+ points, up to 20% of the bag), and payment: **cash on delivery** (up to Rs. 30,000) or **collect at a shop** (click-and-collect, pay at the counter). Online payment with eSewa and Khalti is built and will be switched on later.

After ordering, the customer sees the confirmation and gets an SMS. The order page lets them follow, change or cancel it.

> **Tip:** when a customer on the phone is stuck, ask them what they see on screen, and walk them through it using this page.`,
  },
  {
    slug: "shop-account",
    section: "shop",
    title: "Customer accounts, orders, changes, returns and exchanges",
    summary: "Signing in, following orders, what customers can change themselves, returns and size exchanges.",
    audience: ["care", "cashier", "shop-manager", "warehouse", "ops-manager", "owner"],
    minutes: 6,
    version: 1,
    related: ["sys-orders", "sop-online-changes", "sys-customers-loyalty"],
    body: `## Signing in
One box: **mobile number or email**. Then the right next step: password; a one-time **SMS code**; creating a new account; or resetting a forgotten password. Signing in happens in a side drawer, so the customer doesn't lose their page. Care staff can send a **reset link** to a customer who can't get in. "Continue with Google" is ready to switch on.

## The account
Orders, addresses, wishlist, loyalty points and tier, referral code, back-in-stock and price-drop alerts, details.

## What customers can do themselves
| When | What |
|---|---|
| Before packing | Change size, remove items, change address; cancel |
| After delivery, within 7 days | Ask for a **size exchange** (free; the rider collects the old one) or a **return** |
| Any time | Track the order, buy a past order again, write a review after delivery |

Anyone can track an order at /track with the order number and mobile, without signing in.

## Returns and exchanges
Returns are accepted within **7 days** of delivery: unworn, unwashed, unaltered, with tags. Innerwear and socks, and items altered for the customer, can't be returned unless faulty. A wrong size is usually better as an **exchange**: the customer gets the right size free and we keep the sale. Faulty, damaged or wrong items: replaced or refunded in full including delivery, collected free. Refunds are made within 3–5 working days of the return reaching us: COD orders to the customer's eSewa or Khalti wallet or bank account; shop purchases in cash, to the card or as store credit. For change-of-mind returns the delivery fee isn't refunded. Points are adjusted.

> **Why:** every change a customer makes themselves is a call care doesn't have to take, and it happens instantly, any time of day.`,
  },
  {
    slug: "shop-app",
    section: "shop",
    title: "The Asson app, Nepali language and offline",
    summary: "Installing the shop and the staff app on a phone, the Nepali site, and what happens offline.",
    audience: "all",
    minutes: 3,
    version: 1,
    related: ["shop-overview"],
    body: `## Installing the app (no app store)
- **Customers**: on Android, "Get the app" in the footer opens the install prompt. On iPhone, tap Share in Safari, then **Add to Home Screen**. The Asson icon opens the shop like an app. Long-press it on Android for shortcuts: Shop, Bag, Orders, Track.
- **Staff**: open /admin on your phone and install it the same way. It installs as **Asson Admin** (terracotta icon), separate from the shop app.

## Nepali (नेपाली)
Customers can switch the whole shop to Nepali: menus, product and category names, checkout, messages and errors. Prices stay in Rs. with 0–9 digits. The staff side stays in English.

## Offline
If the phone loses its connection, the app shows a clear offline page in English and Nepali, and reloads by itself when the connection is back. Nothing is lost. The app never keeps old prices or pages on the phone; everything is always fresh.`,
  },
  {
    slug: "shop-policies",
    section: "shop",
    title: "Customer policies: delivery, returns, COD, privacy",
    summary: "The promises in our published policies that every staff member must keep.",
    audience: "all",
    minutes: 4,
    version: 1,
    related: ["shop-account", "sys-delivery-rates"],
    body: `The full policies are on the website at /policies. The key points:

| Policy | What we promise |
|---|---|
| Delivery | To all 77 districts. Valley Rs. 100, outside Rs. 150, remote Rs. 250, express Rs. 200. Free at Rs. 2,500 or more. Delivery days shown before ordering. |
| Cash on delivery | Up to Rs. 30,000. Larger or risky COD orders may get a confirmation call. |
| Returns | Within 7 days of delivery (or of a shop sale, with the receipt): unworn, unwashed, unaltered, with tags. Innerwear, socks and altered items only if faulty. |
| Exchanges | Free size exchange within the return window. |
| Refunds | Within 3–5 working days of the return reaching us. COD: to the customer's eSewa, Khalti or bank account. Shop: cash, card or store credit. Delivery fee refunded only when we were at fault. |
| Privacy | We collect only what we need to deliver and serve; we never sell personal data. Ad cookies only with permission. |
| Cookies | Necessary cookies always; ad and analytics cookies only after "Accept all". |

> **Rule:** never promise what the policy doesn't (for example, a return after 30 days) without a manager's approval, and never refuse what it does promise.

> **Note:** the policies are a draft until reviewed by a lawyer before launch.`,
  },
];
