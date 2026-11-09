# Asson — Engineering Rules

These rules apply to every person and every AI agent that changes this codebase.
**MUST** = non-negotiable. **SHOULD** = default; deviate only with a written reason in the PR.

> The staff experience should be simple. The system underneath should be strict.

---

## 0. The ten golden rules

1. **MUST: the server is the authority on money, stock and permissions.** Never trust a price, total, fee, discount, role or "paid" flag from the browser.
2. **MUST: money is integer paisa.** No floats, no `toFixed` maths. Format only at the edge with `formatPrice()`.
3. **MUST: stock changes only through conditional updates plus an `InventoryLog` row** (`UPDATE … WHERE stock >= q`). Never `stock = <number typed by a human>`.
4. **MUST: never delete financial or audit records** (orders, order items, events, payments, inventory logs). Void, refund, cancel or correct instead.
5. **MUST: every mutation re-checks authorisation inside the server action or route.** `proxy.ts` and hidden buttons are not security.
6. **MUST: validate every input at the boundary with zod.** Server actions, route handlers and search params.
7. **MUST: an order is paid only after server-to-server verification** with the provider, for exactly the order total.
8. **MUST: business settings live in `src/lib/config.ts`**, not scattered in components.
9. **MUST: lint, typecheck and build are clean before any merge.**
10. **MUST: leave it better.** No dead code, no commented-out blocks, no TODOs without an owner and a phase.

## 1. Next.js 16 specifics (this is not the Next.js you remember)

- **MUST** read `node_modules/next/dist/docs/` before using an unfamiliar API. Training data is out of date.
- Middleware is called **`proxy.ts`** (`export function proxy`).
- `params` and `searchParams` are **Promises**: `const { slug } = await params`.
- `revalidateTag(tag, profile)` takes **two arguments**, e.g. `revalidateTag("products", { expire: 0 })`. Use `refresh()` inside server actions to refresh the current view; use `updateTag` for read-your-own-writes on tagged data.
- `cacheComponents` is **off**. Do not add `"use cache"`; use `unstable_cache` with tags (see Architecture §8.1).
- Lint uses the React Compiler rules: no `setState` directly in effects (derive state, or store the previous value), no components defined inside components, no `Date.now()` in render (use `now()` from `lib/utils`).

## 2. Code organisation

| Put it in | When |
|---|---|
| `src/lib/*` | Domain logic, queries, calculations. Server files start with `import "server-only"` |
| `src/actions/*` | `"use server"` mutations. Thin: validate → authorise → call lib → `refresh()` / redirect |
| `src/app/**/page.tsx` | Data fetching plus layout. No business rules |
| `src/components/ui` | Reusable primitives. No data fetching, no domain knowledge |
| `src/components/<domain>` | Domain UI. Client components only where interaction needs them |

- **MUST** follow the dependency direction `app → actions → lib → db`. Components never import `db`.
- **MUST NOT** import server-only modules into client components. Shared constants go in client-safe files (`config.ts`, `utils.ts`, `order-status.ts`).
- **SHOULD** use Server Components by default; add `"use client"` at the smallest leaf that needs state or events.
- **SHOULD** keep files under ~300 lines; split by responsibility, not by type.
- Naming: files `kebab-case.tsx`; components `PascalCase`; functions `camelCase`; DB models `PascalCase` singular; enums `SCREAMING_CASE`.

## 3. TypeScript

- **MUST** use strict mode. No `any`; use `unknown` and narrow it. No `@ts-ignore`. Use `@ts-expect-error` only with a reason.
- **MUST** derive types from sources of truth: `z.infer` / `z.output`, `Prisma.XGetPayload`, `typeof config`.
- **SHOULD** prefer discriminated unions for results: `{ ok: true, … } | { ok: false, error }`.
- **SHOULD** avoid non-null `!` except right after a check the compiler can't see.

## 4. Data and database

- **MUST** wrap multi-row writes that must succeed together in `db.$transaction`.
- **MUST** use **conditional updates** for anything contended: stock, coupon usage, order status (`updateMany({ where: { id, status: expected } })`), payment settlement (`status: { not: "COMPLETED" }`). Check `count`.
- **MUST** snapshot purchase-time data on `OrderItem` and `Order.shippingAddress`. Never join back to the live catalogue for historical documents.
- **MUST review every generated migration SQL before applying it.** Prisma silently **drops indexes it doesn't know about.** Declare indexes in `schema.prisma` where possible (e.g. the trigram index); keep expression indexes (full-text search) in raw SQL migrations and check they survive.
- **MUST NOT** run `prisma db seed` or `migrate reset` against any shared or production database. The seed wipes everything and refuses when `NODE_ENV=production`.
- **MUST** use `prisma migrate deploy` (never `migrate dev`) in CI and production.
- **SHOULD** select only the fields you need; paginate every list (`take` ≤ 100); add an index with every new query pattern.
- **SHOULD** use `Prisma.sql` tagged templates for raw SQL. Never concatenate user input.

## 5. Error handling

| Situation | Do |
|---|---|
| Expected failure (validation, sold out, coupon expired) | Return `{ ok: false, error, fieldErrors }` with a human sentence. Don't throw |
| Domain rule violated inside a transaction | Throw a typed error (`CheckoutError`, `TransitionError`), catch at the action, map to a message |
| Unexpected failure | `console.error("<where>", err)` with context (never secrets or full card or wallet data); return a calm generic message: *"We couldn't place your order. You have not been charged — please try again."* |
| External provider down | Never throw into the UI. Return `UNKNOWN` and retry later (reconciliation job). Never mark failed or paid on a guess |
| Not found or no access | `notFound()`. Don't reveal whether a private order exists |
| Page crash | Segment `error.tsx` shows a retry; the bag is never lost |

Error copy rules: say what happened, whether money moved, and what to do next. No stack traces, no codes without explanation, no blame.

## 6. Security

- **MUST** hash passwords with bcrypt (cost ≥ 12). Never log or return them.
- **MUST** keep sessions in httpOnly, `secure` (in production), `sameSite=lax` cookies. Bump `tokenVersion` on password or role change.
- **MUST** gate staff and admin pages and actions with `requirePermission("<permission>")` **inside** the page or action. Change who can do what only in `lib/permissions.ts`.
- **MUST** rate-limit auth, order placement, order tracking, search suggestions and payment start.
- **MUST** sanitise redirects (`safeNext`: only same-site paths).
- **MUST** escape user text in regexes. Never put personal data (phone, email, address) in URLs or logs.
- **MUST** keep secrets in env vars only. `.env` is never committed; `.env.example` lists every key with no values.
- **MUST** compare signatures and secrets with `timingSafeEqual`.
- **SHOULD** run `npm audit` and a dependency review before each release.

## 7. Payments

- **MUST** create a new `Payment` row (unique `reference`) for every attempt.
- **MUST** verify eSewa with the HMAC signature **and/or** the status API. Khalti is verified **only** through the lookup API. Redirect query strings are untrusted.
- **MUST** compare the provider amount with `order.total`. A mismatch means AMBIGUOUS plus an alert, never PAID.
- **MUST** keep settlement idempotent: refreshes, duplicate callbacks and the cron can run in any order.
- **MUST NOT** auto-cancel an order whose payment is AMBIGUOUS. It goes to a human.
- eSewa's documented example signatures don't match standard HMAC-SHA256. Trust the sandbox (it accepts our signatures), not the doc samples.

## 8. Libraries

**Approved:** next, react, prisma, zod, jose, bcryptjs, tailwindcss, clsx and tailwind-merge (`cn`), lucide-react, sonner.

**Before adding any dependency (SHOULD):**
1. Can 30 lines of our own code do it? Prefer that.
2. Is it maintained (release within 6 months), typed, tree-shakeable, and MIT, Apache or ISC licensed?
3. What does it add to the client bundle? Over 15 kB gzipped on the storefront needs justification.
4. Pin it in the PR description with the reason.

**Not allowed:** moment.js (use `Intl`); lodash (full); axios (use `fetch`); any payment SDK not published by the provider; UI kits that bring their own design system; analytics scripts loaded without consent; anything that makes the browser compute prices.

## 9. UI and UX

- **MUST** use design tokens and primitives from [Design](Design.md) and `components/ui`. No hex colours or one-off button styles in feature code.
- **MUST** meet WCAG 2.1 AA: every input labelled (`Field` wraps it in `<label>`), icon-only buttons have `aria-label`, focus visible, contrast ≥ 4.5:1 for text.
- **MUST** design mobile first. Check 375 px width with no horizontal scroll.
- **MUST** handle every state: loading (transition dimming, button `loading`), empty (`EmptyState`), error, success (toast), sold out.
- **MUST** use `next/image` with `sizes`; at most 4 `priority` images per page.
- **SHOULD** use optimistic UI for low-risk actions (quantity, wishlist), never for payment or order placement.
- **SHOULD** keep copy short, warm and specific. Use "Rs." with lakh grouping and Nepal dates.

## 10. Performance budgets

| Metric | Budget |
|---|---|
| LCP (p75, mobile 4G) | < 2.5 s |
| INP | < 200 ms |
| CLS | < 0.1 |
| JS per storefront route | < 170 kB gzipped |
| Search suggestions (server) | < 150 ms p95 |
| Checkout `placeOrder` | < 800 ms p95 |

Hot reads must be cached (see Architecture). No N+1 queries in loops over user data; batch with `in: [...]`.

## 11. Testing and verification

- **MUST, before merge:** `npm run typecheck`, `npm run lint`, `npm test` (unit + integration), `npm run test:e2e`; CI runs all of them plus `next build`.
- **MUST** add or update tests with every change to money, stock, permissions, order states or notifications. A change that isn't covered by a test that would fail without it isn't done.
- **MUST** test any change touching checkout, payments, stock or order status end to end in the browser: Valley, outside-Valley and remote district; COD and online; sold-out race; coupon edge cases.
- **SHOULD** prove a new test can fail (temporarily break the rule it guards) before trusting a green run.
- **MUST** add a `loading.tsx` to any new dynamic route segment (cheap prefetching, see ADR-10).

## 12. Git and reviews

- Branch from `main`: `feat/…`, `fix/…`, `chore/…`, `docs/…`.
- Commit messages are imperative and scoped: `checkout: compute delivery fee from district`.
- One concern per PR; under ~400 changed lines where possible; screenshots for UI changes.
- Never commit `.env`, secrets, real customer data or production dumps.
- Update [Memory](Memory.md) at the end of any session that changes behaviour, decisions or open work.

## 13. Boundaries for AI agents

AI assistants working on this repo **MUST**:
- Read [Memory](Memory.md) first, then the doc relevant to the task.
- Stay inside the requested scope; propose (not perform) unrelated refactors.
- Ask before: running migrations on non-local databases, deleting files or data, changing money, stock or payment logic semantics, adding dependencies, changing `config.ts` business values (fees, limits, policies), or pushing to a remote.
- Never invent API details for payment or delivery providers. Read the provider's docs, or say what's unknown.
- Report honestly: what was verified, what wasn't, and anything skipped.

## 14. Definition of done

- [ ] Meets the PRD requirement and its acceptance criteria
- [ ] Server-side validation and authorisation in place
- [ ] Loading, empty, error and success states handled; mobile checked
- [ ] Accessible (labels, focus, contrast)
- [ ] Typecheck, lint and build clean; migration SQL reviewed
- [ ] Verified in the browser (and the database where money or stock is involved)
- [ ] Docs updated: Memory always; PRD, Architecture or Phases if scope or design changed
