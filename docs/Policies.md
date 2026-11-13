# Asson — Website policies

The shop's policies live at **/policies** (Terms and conditions, Privacy, Shipping and delivery, Returns/exchanges/refunds, Payments and pricing, Rewards terms, Cookies). They're linked from the footer, the Help page, checkout ("By placing your order you agree to…") and account sign-up, and listed in the sitemap.

## How they're written

- The text is in `src/lib/policies.ts`, in plain English, as sections of paragraphs, lists and notes.
- **Every number comes from the shop's settings** (`src/lib/config.ts`): the return window, free-delivery threshold, delivery fees and times, the cash-on-delivery limit, VAT, loyalty, referral and birthday amounts, the shop-collection hold. Change a setting and the policy changes with it, so a policy can never contradict what checkout or returns actually do.
- English is the authoritative text. On the Nepali site the page around it is translated and a note says the English applies and offers to explain in Nepali by phone or WhatsApp.
- When you change the wording, bump `POLICIES_UPDATED` (the "Last updated" date).

## Before relying on them (owner)

These are careful drafts for an online clothing shop in Nepal, following the Consumer Protection Act 2075, the Individual Privacy Act 2075 and the Electronic Transactions Act 2063 as commonly applied. **They are not legal advice.** Please:

1. Have a Nepali lawyer review all seven policies.
2. Confirm these business choices (the drafts use the defaults shown; they're also in `OWNER_TO_CONFIRM`):
   - Registered business name, address, PAN/VAT number (`store.vatNumber`), and a named grievance contact
   - The 7-day return window, and that innerwear, socks and altered items can't be returned unless faulty
   - Delivery fee not refunded on change-of-mind returns (refunded when we were at fault)
   - Cash-on-delivery limit of Rs. 30,000; refunds within 3–5 working days
   - Damaged or missing items reported within 48 hours; complaints resolved within 7 days
   - Sale items returnable like full-price items
   - How long records are kept (drafted: accounting records at least 6 years)
   - Loyalty, referral and birthday amounts
3. Analytics and advertising pixels (Meta, TikTok, Google Analytics) are built behind a consent banner and stay off until their IDs are set. When one is on, the cookie and privacy pages automatically name it and explain the "Accept all" / "Only necessary" choice; have the lawyer read those pages with the trackers you actually use switched on (staging is a good place).
