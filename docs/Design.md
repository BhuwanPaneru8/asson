# Asson — Design System

> **Clean. Minimal. Aesthetic. Classic. Pleasing to the eye. Visual harmony. Perfectionist.**

The clothes are the hero. The interface is a calm, well-lit room: warm paper background, near-black type, one quiet terracotta accent, generous space, editorial photography. Nothing shouts. Everything is aligned.

Tokens live in `src/app/globals.css` (`@theme`). Primitives live in `src/components/ui`. **Never hard-code a hex value or invent a one-off button in feature code.**

---

## 1. Brand

| | |
|---|---|
| **Name** | Asson |
| **Wordmark** | `asson.` set in Fraunces, lowercase, with the full stop in accent terracotta (`components/site/logo.tsx`) |
| **Tagline** | *Classic clothing. Quality fabric. Fair prices.* |
| **Promise** | *You don't need to worry about your clothing sense from now. We'll take care of you.* |
| **Personality** | Calm expert · honest · warm · precise · never pushy |

### Voice and tone

| Do | Don't |
|---|---|
| "Heavyweight cotton that softens with every wash." | "AMAZING premium quality!!! 🔥🔥" |
| "Only 2 left in M." | "Hurry!!! Selling fast!!!" |
| "We couldn't place your order. You have not been charged — please try again." | "Error 500" |
| "Delivery to all 77 districts." | "Fast shipping worldwide" |
| Specific fabric, fit and care facts | Vague superlatives |

Write short sentences. Lead with the benefit. Be precise about money, time and fabric. Use sentence case everywhere except the eyebrow labels, which are uppercase.

## 2. Colour

### 2.1 Core palette

| Token | Hex | Role | Contrast on paper |
|---|---|---|---|
| `ink` | `#141414` | Primary text, primary buttons, active states | 17.7 : 1 |
| `ink-soft` | `#3d3d3d` | Secondary text, body copy in long reads | 10.4 : 1 |
| `muted` | `#6f6f6f` | Captions, metadata, placeholders, helper text | 4.8 : 1 |
| `line` | `#e7e5e1` | Borders, dividers, inactive tracks | decorative only |
| `paper` | `#fbfaf8` | Page background (warm off-white) | — |
| `cloud` | `#f3f1ed` | Image placeholders, subtle panels, hovers | — |
| `white` | `#ffffff` | Inputs, cards on paper, summary panels | — |
| `accent` | `#8a3b24` | Terracotta: brand moments, sale prices, eyebrows, the logo dot | 7.4 : 1 |
| `accent-soft` | `#f6e9e3` | Accent backgrounds (coupon applied, selection) | — |

### 2.2 Status colours (reserved; never decorative)

| Token | Hex | Use | Contrast on paper |
|---|---|---|---|
| `success` | `#2f6b45` | Delivered, paid, free delivery unlocked | 6.1 : 1 |
| `warn` | `#8f5a0f` | Low stock, pending payment, attention | 5.5 : 1 |
| `danger` | `#b42318` | Errors, sold out, cancel actions | 6.3 : 1 |

Status always comes with a **word or icon**, never colour alone ("Only 2 left", "Sold out").

### 2.3 Usage ratio

**Roughly 70% paper and white, 25% ink and greys, 5% accent.** If a screen feels loud, remove accent first. The accent appears at most twice per viewport (e.g. the logo dot plus a sale price).

### 2.4 Product colour swatches

Swatch hexes are product data (`Variant.colorHex`), not UI tokens. Light swatches get a `border-black/10` ring so white and cream stay visible on paper.

## 3. Typography

| Family | Token | Use |
|---|---|---|
| **Fraunces** (variable, optical size) | `font-display` | Headlines, product names on the product page, prices in large display, the wordmark |
| **Inter** | `font-sans` (default) | Everything else: UI, body, forms, admin |

### Type scale

| Style | Size / line-height | Weight | Family | Example |
|---|---|---|---|---|
| Display XL | 60 px (`text-6xl`) / 1.05 | 400 | Fraunces | Hero headline |
| Display L | 48 px (`text-5xl`) / 1.1 | 400 | Fraunces | Category title (desktop) |
| H1 | 36–38 px / 1.15 | 400 | Fraunces | Product name, page title |
| H2 | 30–34 px / 1.2 | 400 | Fraunces | Section title ("Best sellers") |
| H3 | 18–20 px / 1.4 | 600 | Inter | Card titles, checkout steps |
| Body | 15 px / 1.6 | 400 | Inter | Paragraphs, descriptions |
| UI | 14–14.5 px / 1.45 | 400–500 | Inter | Nav, buttons, table cells |
| Small | 13 px / 1.4 | 400–500 | Inter | Labels, helper text, metadata |
| Eyebrow | 12 px, uppercase, tracking 0.14–0.2 em | 600 | Inter | "MOST LOVED", "SHOP MEN" |

Rules: one display headline per section · never bold Fraunces · `tabular-nums` for prices, quantities and tables · line length 60–75 characters for reading text.

## 4. Layout and spacing

- **Container:** `container-page`, max width 1440 px; side padding 16 px (mobile), 32 px (≥ 768), 48 px (≥ 1280).
- **Spacing scale:** Tailwind 4 px base. Use 4 · 8 · 12 · 16 · 20 · 24 · 32 · 48 · 64 · 96. Sections are separated by 48–96 px.
- **Grid:** product grid has 2 columns (mobile) · 3 (≥ 768) · 4 (≥ 1280); gaps 12 / 20 px horizontal and 32 px vertical.
- **Product imagery ratio:** **3:4** portrait everywhere (cards, gallery, cart thumbnails).
- **Breakpoints:** `sm` 640 · `md` 768 · `lg` 1024 · `xl` 1280. Design at **375 px first**.
- **Sticky elements:** header (64 px); mobile filter bar; mobile add-to-bag bar; checkout summary on desktop.

## 5. Shape, depth and borders

| | Storefront | Admin |
|---|---|---|
| Corner radius | **0, square.** Tailored, editorial | `rounded-md` / `rounded-lg`, friendlier for dense tools |
| Exceptions | Swatches, the wishlist heart and count badges are round | — |
| Borders | 1 px `line`; hover `ink-soft`; focus or selected `ink` | same |
| Shadows | Only on overlays (drawers, menus, dropdowns, toasts) | Cards are flat with a border |

## 6. Components

| Component | Spec |
|---|---|
| **Button** (`ui/button`) | Variants: `primary` (ink fill), `secondary` (ink outline on white), `ghost`, `danger`, `link`. Sizes: `sm` 36 px · `md` 44 px · `lg` 52 px tall. One primary per view. `loading` shows a spinner and blocks double-submit |
| **Input / Select / Textarea** | 44 px tall, white, 1 px `line`, ink border on focus, `danger` border when `aria-invalid` |
| **Field** | Label (13 px, `ink-soft`) wraps the control, so it is always accessible; error or hint below |
| **Sheet** | Drawer from right (bag, review, address), left (mobile menu) or bottom (mobile filters). Backdrop is black at 40%; closes on Escape and locks scroll |
| **Badge** | 11 px uppercase: `accent` (−25%), `dark` (Sold out), `warn` (Few left), neutral (New) |
| **Price** | Selling price in ink and semibold; MRP struck through in `muted`; "% off" in `accent` |
| **Stars** | Ink-filled on a `line` background; partial fill supported |
| **Product card** | 3:4 image; second image on hover; badges top-left; heart top-right; quick-add sizes on hover (desktop); swatches, brand eyebrow, name, price, rating |
| **Empty state** | Icon (1.2 stroke), Fraunces title, one sentence, one action |
| **Toasts** (sonner) | Bottom centre, square, short; success, error, or info with an action |

## 7. Iconography

- **lucide-react** only. Stroke 1.6–1.8 (storefront) and 1.8 (admin). Sizes 16, 20 and 21 px.
- Icons support labels and never replace them, except universal ones (search, bag, heart, menu, close), which get an `aria-label`.

## 8. Photography and content (the studio upstairs)

The brand promise is quality, and the photo is where customers judge it.

| Rule | Detail |
|---|---|
| **Ratio and resolution** | 3:4 portrait, ≥ 2000 × 2667 px, sRGB, WebP or JPEG < 600 kB uploaded |
| **Set** | 1 on-model front · 1 on-model back or side · 1 flat-lay or hanger · 1 **fabric close-up** (texture and weave) · 1 detail (buttons, stitching, label) |
| **Light** | Soft daylight or large softbox; no hard shadows; consistent white balance across a collection |
| **Background** | Warm off-white or light grey seamless (close to `paper`), or calm natural texture. No busy streets for catalogue shots |
| **Styling** | Classic and minimal. One hero item per photo; neutral complementary pieces |
| **Colour accuracy** | Each colour variant gets its own images, assigned to the colour in the product editor |
| **Video** | 6–10 s vertical clips for TikTok and Reels; fabric movement and fit |

## 9. Motion

| Token | Value | Use |
|---|---|---|
| `fade-in` | 200 ms ease-out | Overlays, menus |
| `slide-in-*` | 280 ms `cubic-bezier(0.2, 0.8, 0.2, 1)` | Drawers |
| `slide-up` | 280 ms | Bottom sheets |
| Image hover | Scale 1.02–1.05 over 700–1500 ms | Editorial tiles, cards |
| Pending | Content dims to 50% opacity during transitions | Filter changes, cart updates |

Motion is quiet and purposeful. Nothing bounces. Respect `prefers-reduced-motion` for any new animation.

## 10. Accessibility

- Text contrast ≥ 4.5 : 1 (all tokens above pass on paper, white and cloud).
- Visible focus: 2 px ink outline with 2 px offset (`:focus-visible`).
- Touch targets ≥ 40 × 40 px; size buttons are 48 px tall.
- Every input has a label; icon buttons have `aria-label`; toggles use `aria-pressed` or `role="switch"`.
- Skip link to `#main`; landmarks (`header`, `nav`, `main`, `footer`); one `h1` per page.

## 11. Formatting standards

| Thing | Format | Helper |
|---|---|---|
| Money | `Rs. 1,49,900` (lakh grouping, no decimals) | `formatPrice(paisa)` |
| Dates | `9 Nov 2026`; with time `9 Nov 2026, 2:39 pm` (Asia/Kathmandu) | `formatDate`, `formatDateTime` |
| Order number | `AS000123` | `formatOrderNumber` |
| Phone | `+977 98XXXXXXXX` | — |
| Address | Tole, landmark / City, District / Province (postal code) | `addressLines()` |

## 12. Admin UI

Same tokens; tuned for density and speed:
- Dark ink sidebar, light `#f6f5f2` canvas, white cards with 8 px radius.
- Tables: 12 px uppercase headers, 14 px rows, `tabular-nums`, hover row tint.
- Status pills (rounded-full) for order states; numbers right-aligned.
- Primary action top-right; destructive actions are text-danger and need confirmation.
- Charts: single series in ink, hover in accent, recessive gridlines, tooltip on hover.

## 13. Do and don't

| ✅ Do | ❌ Don't |
|---|---|
| Let photography carry colour | Coloured backgrounds behind products |
| Use whitespace to group | Boxes inside boxes inside boxes |
| One primary button per view | Two competing black buttons |
| Real stock and fit information | Fake urgency timers |
| Consistent 3:4 imagery | Mixed square and landscape crops in a grid |
| Accent for sale, brand and selection | Accent for random decoration |
