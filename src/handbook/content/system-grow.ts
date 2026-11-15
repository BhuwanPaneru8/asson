import type { HandbookPage } from "../types";

export const SYSTEM_GROW: HandbookPage[] = [
  {
    slug: "sys-insights",
    section: "system",
    title: "Insights: what to buy, what's selling, what customers do",
    summary: "Reorder signals, dead stock, size and colour profit, searches, the funnel, customers, forecast and KPI pulse.",
    audience: ["buyer", "owner", "ops-manager", "marketing"],
    minutes: 8,
    version: 1,
    restricted: "insights",
    open: [{ label: "Insights", href: "/admin/insights" }],
    related: ["sys-purchasing", "sys-transfers", "sys-coupons-markdowns", "owner-kpis"],
    body: `Insights turns our own sales into decisions. Every number comes from real orders, tills, stock and searches.

## Buying and merchandising
- **Reorder by sales speed**: for each product and size, how many days the stock lasts at today's speed, what's on order, and how many to **order now**.
- **Dead stock**: items not selling, with their value at cost and the last time they sold. Candidates for a markdown or a transfer to a shop where they sell.
- **By size and by colour**: units, revenue and margin. Shows which sizes to buy deeper and which colours to drop.

## Demand forecast
Demand per product and size for the coming weeks, with **festival seasonality** (Dashain, Tihar, winter). Shows the **stock-out date** for each and the quantity to reorder. The **demand radar** shows what's rising or falling, searches that found nothing, back-in-stock waiting lists, and products looked at but not bought.

## Searches
Top search terms and **searches that found nothing**. A popular search with no result is a product we should stock, or a word we should add to a product's tags.

## The shop funnel
Each day: **product views → added to bag → checkout visits → orders**, with each product's bag rate (adds per view). Bots are filtered out. A product with many views and few adds has a problem: price, photos, sizes or description.

## Customers
New and **repeat customers**, revenue from repeaters, **lifetime value**, cohorts (how each month's new customers keep buying) and **RFM segments** (how recently, how often and how much they buy: champions, loyal, at risk, lost).

## KPI pulse
Every key number against its usual level **for that weekday** (Saturdays are different from Tuesdays). Unusual moves are flagged on Needs attention, with a month-end forecast.

> **Why:** world-class retailers buy from data, not opinion. Buying the right sizes in the right depth is the biggest lever on profit we have.`,
  },
  {
    slug: "sys-customers-loyalty",
    section: "system",
    title: "Customers, loyalty points and referrals",
    summary: "Customer records, how points and tiers work, birthdays, refer-a-friend and back-in-stock alerts.",
    audience: ["care", "cashier", "shop-manager", "marketing", "owner", "ops-manager"],
    minutes: 5,
    version: 1,
    open: [{ label: "Customers", href: "/admin/customers" }],
    related: ["sys-pos", "shop-account", "sys-insights"],
    body: `## Customer records
Customers lists everyone who has an account or ordered: orders, lifetime spend, last order, joined date. Search by name, email or phone. Store sales link to a customer by their **mobile number**, so one person's shop and online purchases are together.

## Loyalty points
| Rule | How it works |
|---|---|
| Earning | 1 point per Rs. 100 of goods, credited when the order is delivered (or at the till sale) |
| Value | 1 point = Rs. 1 |
| Spending | 100 points or more, for up to 20% of the bag, at checkout |
| Welcome | 100 points when an account is created |
| Tiers | Classic (1×), Silver from Rs. 25,000 a year (1.25×), Gold from Rs. 75,000 (1.5×) |
| Cancel / return | Points used are refunded on cancel; points earned are taken back on returns |

## Birthdays and referrals
- **Birthday points**: a gift of points on the customer's birthday (a daily job sends them).
- **Refer a friend**: each customer has a code and share link. The friend gets a first-order discount; the referrer gets points when the friend's order is delivered (with a monthly cap, and taken back if returned).

## Alerts customers ask for
- **Back in stock**: a customer asks on a sold-out size; they get one SMS when it's back from any source. Buyers see the waiting list in Purchasing.
- **Price drop**: a customer asks on a product; one SMS when a sale or price cut brings it lower.

> **Tip:** at the till, always ask for the mobile number. It's how a customer becomes a repeat customer we can recognise.`,
  },
  {
    slug: "sys-coupons-markdowns",
    section: "system",
    title: "Coupons, markdowns and sale prices",
    summary: "Discount codes with limits, planned sales that start and end by themselves, and margin floors.",
    audience: ["marketing", "buyer", "owner"],
    minutes: 5,
    version: 1,
    open: [{ label: "Coupons", href: "/admin/coupons" }, { label: "Markdowns", href: "/admin/markdowns" }],
    related: ["sys-insights", "sys-products", "owner-festival"],
    body: `## Coupons
A coupon is a code customers type at checkout: percent or amount off, minimum order, start and end dates, total uses and uses per customer. Limits are enforced on the server at the moment of checkout, so a code can't be used more times than allowed, even with many people at once.

## Markdowns (planned sales)
Plan a sale (Dashain, end of season, clearance): products, sale prices, start and end dates.
- **Margin floor**: a sale price below the minimum margin needs the owner's approval.
- **Starts and ends by itself**: prices change everywhere (website and every till) at the start and go back at the end, safely, even if someone changed a price meanwhile.
- **Price tags**: print sale tags for the shops; the opening checklist reminds staff to put them on.
- **Results**: units, revenue and margin during the sale against before.
- **Suggestions**: slow-moving stock that would benefit from a markdown.
- **Watchers**: how many customers asked for a price-drop alert on each product.

> **Rule:** never change product prices by hand for a sale. Use Markdowns, so prices come back on time and the results are measured.`,
  },
  {
    slug: "sys-lookbook-reviews",
    section: "system",
    title: "Lookbook, recommendations and reviews",
    summary: "Styled outfits from our own products, automatic recommendations, and review moderation.",
    audience: ["marketing", "owner", "care"],
    minutes: 4,
    version: 1,
    open: [{ label: "Lookbook", href: "/admin/lookbook" }, { label: "Reviews", href: "/admin/reviews" }],
    related: ["sys-products", "sys-marketing"],
    body: `## Lookbook
A **look** is an outfit styled from our own products, with a photo and a short story. Each look shows on the shop's Lookbook page with **Shop the look**, which adds the whole outfit to the bag. Looks also appear on product pages.

> **Rule:** only our own photos and products. Never copy other brands' or Pinterest images: it's copyright infringement and misleads customers.

## Recommendations (automatic)
Rebuilt every night from real orders: **bought together**, **similar products**, **recommended for you**, and **complete your order** in the bag (with how much more for free delivery). Nobody maintains these by hand.

## Reviews
Customers who received an item can review it with a rating and fit feedback ("true to size"). Reviews shows them all; **hide** reviews that break the guidelines (abuse, personal data, spam). Ratings recalculate automatically. Never hide a review just because it's negative: answer the problem instead.`,
  },
  {
    slug: "sys-marketing",
    section: "system",
    title: "Marketing tools: ad measurement, product feeds and SEO",
    summary: "Meta, TikTok and Google measurement behind a cookie banner, product feeds and search engines.",
    audience: ["marketing", "owner"],
    minutes: 4,
    version: 1,
    related: ["sys-insights", "shop-policies"],
    body: `## Ad measurement
The shop can report visits, product views, add to bag, checkout and purchases to **Meta (Facebook and Instagram)**, **TikTok** and **Google Analytics 4**, so ad spend can be measured and targeted. Purchases are also sent to Meta from our server (Conversions API), so they count even when a browser blocks the pixel.

- It only runs after the shopper chooses **Accept all** on the cookie banner. "Only necessary" means nothing is sent.
- It's switched on by adding the ad accounts' IDs to the server settings (no code change). Until then there's no banner and nothing is tracked.
- The cookie and privacy policies update themselves to name the partners that are switched on.

## Product feeds
A product feed for Google Merchant Center and Meta catalogues is published at /feeds/products.xml, so products can appear in Google Shopping and Instagram/Facebook shops.

## Search engines
Every product and category page has proper titles, descriptions and structured data, and a sitemap lists them. Staging is never indexed.`,
  },
  {
    slug: "sys-delivery-rates",
    section: "system",
    title: "Delivery rates",
    summary: "Delivery fee, days, express and COD for each of the 77 districts.",
    audience: ["owner", "ops-manager"],
    minutes: 2,
    version: 1,
    restricted: "delivery",
    open: [{ label: "Delivery rates", href: "/admin/delivery" }],
    related: ["shop-policies", "sys-orders"],
    body: `Each of the 77 districts has a row: **fee**, **delivery days**, **express** available and its fee, **COD** allowed, and **serviceable** (whether we deliver there at all). The page shows 90 days of order demand per district next to each rate.

Starting rates: Kathmandu Valley Rs. 100, outside the Valley Rs. 150, remote districts Rs. 250, express Rs. 200, **free delivery at or above Rs. 2,500**. COD is allowed up to Rs. 30,000.

Changes apply immediately to the product page's delivery estimate, the bag and checkout.`,
  },
  {
    slug: "sys-system-health",
    section: "system",
    title: "System health",
    summary: "Background jobs, errors, the SMS outbox, the nightly stock check and alerts to the owner.",
    audience: ["owner"],
    minutes: 3,
    version: 1,
    restricted: "system",
    open: [{ label: "System", href: "/admin/system" }],
    related: ["owner-tech", "owner-incidents"],
    body: `System answers "is everything running?":
- **Health**: the database, the job worker and the release running now.
- **Background jobs**: queued, running and **failed jobs** (with retries). Failures can be retried.
- **Errors**: errors from the server and from people's browsers, grouped, with Critical and Warning levels. Mark them fixed.
- **SMS outbox**: messages waiting or failed.
- **Stock audit**: the nightly check that every location's stock matches its movement history.
- **Scheduled work**: what runs when.

A watchdog checks every 5 minutes. If something critical breaks, **the owner is texted** once per incident, and again when it recovers.`,
  },
];
