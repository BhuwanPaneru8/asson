# Asson — Deployment Plan (free tier, launch-grade)

**Status 9 Nov 2026:** staging is live at https://staging-asson.bhuwanpaneru.com on Oracle Always Free `asson-micro` (AMD, 1 GB + 2 GB swap) behind a Cloudflare Tunnel. How it runs day to day: [deploy/README.md](../deploy/README.md). Done since: automatic staging deploys, owner login, off-site backups (Oracle Object Storage instead of R2: same free 20 GB, no extra account or card). Open: uptime monitor, Sentry, production go-live.

*Written 9 Nov 2026. Free-tier terms change often: re-check each provider's pricing page on the day you sign up.*

**Update 9 Nov 2026:** domains are subdomains of the owner's `bhuwanpaneru.com` (already on Cloudflare): shop `asson.bhuwanpaneru.com` (admin at `/admin`), staging `staging-asson.bhuwanpaneru.com`. Use single-level names only: Cloudflare Free Universal SSL covers `*.bhuwanpaneru.com`, not `*.asson.bhuwanpaneru.com`. Oracle signup worked but A1 creation hit "Out of capacity"; next step is the Pay-As-You-Go upgrade + retry (or 1 OCPU / 6 GB), with an AWS Free-plan Mumbai `t4g.small` as the fallback (§7). Build happens in GitHub Actions, not on the server, so a small fallback VM (2 GB) still works.

## 1. The decision in one paragraph

Run Asson on **one always-on server in India (Oracle Cloud Always Free, Mumbai or Hyderabad)**, with **Cloudflare (free)** in front for the domain, HTTPS, CDN, firewall and a private tunnel, **Cloudflare R2 (free)** for nightly database backups, and **GitHub Actions (free)** to test and deploy every change. The app, PostgreSQL and the scheduled jobs all run on that server, so the code deploys **as it is today**: no rewrites, no cold starts, and no surprise "site paused" when a quota runs out. The price is that we look after a server ourselves; the plan below automates most of that.

## 2. Why not the "obvious" free hosts

| Option | Verdict | Why |
|---|---|---|
| **Vercel Hobby** | ❌ Not allowed | Hobby is for *non-commercial personal use only*; a shop is commercial ([Vercel fair use](https://vercel.com/docs/limits/fair-use-guidelines)). Vercel Pro is US$20 per seat per month. |
| **Netlify Free** | ⚠️ Risky for a live shop | 300 credits a month, about 15 GB of traffic; when credits run out, **projects pause until next month** and Free can't buy more ([Netlify billing FAQ](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/billing-faq-for-credit-based-plans/)). An image-heavy fashion store would hit that in a good month, which is exactly when it must not go down. Fine for previews only. |
| **Cloudflare Workers Free** | ⚠️ Doesn't fit | Next.js 16 is supported through OpenNext ([OpenNext](https://opennext.js.org/cloudflare)), but Free allows **10 ms CPU per request** ([Workers limits](https://developers.cloudflare.com/workers/platform/limits/)); server-rendered pages need more. It also needs a Prisma driver-adapter change. Workers Paid (US$5/month) is the best *first paid* upgrade (see §8). |
| **Render / Koyeb free** | ❌ | Apps sleep when idle: the first visitor waits ~30 s. |
| **Supabase Free (DB)** | ⚠️ | Projects pause after 7 days without activity; 500 MB ([summary](https://automationatlas.io/answers/supabase-free-tier-limits-2026/)). |
| **Neon Free (DB)** | ✅ Good fallback | 1 GB storage, 100 CU-hours per month, compute sleeps after 5 min idle ([Neon FAQ](https://neon.com/faqs/free-plan-limits-and-quotas)). Used only if we can't get the Oracle server (§7). |

## 3. Architecture

```
Shopper (Nepal)  ──HTTPS──▶  Cloudflare (DNS · SSL · CDN · WAF · cache)
                                   │  Cloudflare Tunnel (no open ports on the server)
                                   ▼
              Oracle Cloud VM — Ampere A1, Ubuntu 24.04, Mumbai/Hyderabad
              ├── Next.js 16 app (Node 24, systemd, 2 processes behind a local port)
              ├── PostgreSQL 16 (local, not reachable from the internet)
              ├── cron: /api/cron/notifications every 2 min, /api/cron/payments every 10 min
              └── nightly pg_dump ──encrypted──▶ Cloudflare R2 (30 daily + 12 monthly)

GitHub: PR → CI (typecheck, lint, 80 tests, build, E2E) → merge to main → deploy job (SSH) →
        build in Actions → copy bundle to server → prisma migrate deploy → atomic switch → health check → auto-rollback if it fails
```

Why this shape works for Asson specifically:
- **Same setup as development and CI**: native Prisma engine, in-memory rate limiter, on-disk Next cache and `after()` all behave exactly as tested.
- **Low latency for Nepal**: India regions are far closer than US or Singapore hosting, and the database sits next to the app (no network hop per query).
- **No idle sleep**: the first shopper of the morning gets a fast page.

## 4. Services and their free limits

| Need | Service (free) | Limit that matters | Notes |
|---|---|---|---|
| Server (app + DB) | **Oracle Cloud Always Free**, Ampere A1 | Now **2 OCPU / 12 GB RAM** (halved from 4/24 in 2026, [report](https://www.mrplanb.com/datacenter/free-vps-tiers)); 200 GB disk | Plenty for launch traffic. Idle instances can be **reclaimed** if CPU, network and memory stay under 20% for 7 days ([Oracle docs](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)) — see §7. |
| Domain, SSL, CDN, firewall | **Cloudflare Free** + **Cloudflare Tunnel** | Unmetered CDN | The server has no public ports; only Cloudflare reaches it. |
| Domain name | **Subdomains of `bhuwanpaneru.com`** (owner's, on Cloudflare) | Free | `asson.` and `staging-asson.`; a dedicated domain can be added later without code changes (set `NEXT_PUBLIC_SITE_URL`). |
| Backups | **Cloudflare R2** | 10 GB storage, free egress ([summary](https://upstash.com/kb/cloudflare-r2-pricing-in-2026-storage-operations-and-real-monthly-bills)) | Compressed dumps of this database are a few MB. |
| Product photos | **Cloudinary Free** (or R2 + Cloudflare resizing) | Monthly credit allowance | Resizes at the edge like Unsplash does today; our image loader already has this pattern. |
| CI/CD | **GitHub Actions** (private repo) | 2,000 min/month | One full CI run ≈ 6–8 min. |
| Uptime alerts | **UptimeRobot** or **Better Stack** free | 5-min checks | Alerts by email/app when the site or `/api/health` fails. |
| Error tracking | **Sentry** Developer (free) | ~5k errors/month | Stack traces for server and browser errors. |
| SMS (later) | Sparrow SMS / Aakash SMS | Paid per SMS | Messages queue safely until connected. |

## 5. Rollout plan

**Step 1 — Accounts (owner, ~1 hour).** I can't create accounts or enter card details for you.
1. Oracle Cloud: sign up, home region **Mumbai** (or Hyderabad). A card is needed for verification; Always Free resources are not charged.
2. Cloudflare: sign up (free).
3. Domain: apply for `asson.com.np` or buy `asson.com`; point its nameservers to Cloudflare.
4. Optional now, needed before launch: Sentry, UptimeRobot, Cloudinary.

**Step 2 — Make the app production-ready (me, in code).**
- `GET /api/health` (checks DB) for monitors and deploys.
- `scripts/create-owner.ts`: create the first owner account safely (the seed never runs in production).
- Startup check that refuses to boot without `AUTH_SECRET`, `DATABASE_URL`, `NEXT_PUBLIC_SITE_URL`, `CRON_SECRET`.
- Security headers: add HSTS and a Content-Security-Policy; trust Cloudflare's `CF-Connecting-IP` for rate limiting.
- `deploy/` folder: server setup script (Node, PostgreSQL, firewall, unattended security updates, swap), systemd units, cron entries, backup + restore scripts, Cloudflare Tunnel config.
- GitHub Actions `deploy.yml`: on merge to `main`, after CI passes → build → migrate → switch → health check → roll back on failure.
- Product photo upload to Cloudinary from the product editor (today it takes image URLs).
- Sentry wiring (only active when its key is set).

**Step 3 — Server setup (together, ~1 hour).** You create the VM and paste me its SSH details through GitHub Secrets; I give you the exact commands for the setup script and check each step.

**Step 4 — Staging run.** Deploy to `staging-asson.bhuwanpaneru.com` first, seed demo data there, and run the E2E tests against it. Rehearse a **restore from backup** before real orders exist.

**Step 5 — Go live.** Production database starts empty except settings and your owner account; add the real catalogue; switch DNS; confirm monitors, backups and the first test order.

## 6. What "without compromising quality" means here

- **Reliability:** CI must pass before deploy; migrations run before the switch; automatic rollback; uptime alerts; nightly off-site backups with a tested restore.
- **Security:** no open ports (tunnel), Cloudflare WAF and DDoS protection, database bound to localhost, SSH keys only, automatic OS security patches, secrets only in GitHub Secrets and the server's env file.
- **Speed:** Cloudflare caches static assets and images at the edge; pages render next to the database.
- **Recoverability:** worst case (server lost) → new VM + setup script + latest backup. Target: back online within 1 hour, losing at most 24 hours of data (tightened later with more frequent dumps).

## 7. Risks and how we handle them

| Risk | Mitigation |
|---|---|
| Oracle has no free Ampere capacity in Mumbai (happened 9 Nov 2026) | 1) Upgrade to Pay-As-You-Go (still free; paid accounts get capacity priority) and retry; 2) try 1 OCPU / 6 GB; 3) fallback: **AWS Free plan**, Mumbai, `t4g.small` on the 6-month signup credits, same scripts, move to Oracle later. Build in CI so the server never compiles. |
| Oracle reclaims a quiet instance | Upgrade the account to Pay-As-You-Go (still US$0 within Always Free; community reports say it avoids reclamation, so confirm with Oracle); backups make any loss recoverable in an hour. |
| One server = single point of failure | Acceptable at launch; backups + scripted rebuild. Second server or managed hosting when revenue justifies it. |
| Free limits change | Re-check yearly; nothing here locks us in (standard Postgres + Node). |

## 8. When to start paying (in order)

*Superseded for growth beyond launch by [Scaling](Scaling.md), which has measured capacity and triggers.*

1. **Domain** (~US$10/year) if `.com.np` isn't possible.
2. **SMS gateway** — per message, when order notifications go live.
3. **Managed hosting** once orders are steady: Cloudflare Workers Paid (US$5/month) or a small paid VM, plus Neon Launch (pay-as-you-go) — buys managed backups, point-in-time restore and no single server.

## 9. Open questions for the owner

1. ~~Domain~~ Decided: subdomains of `bhuwanpaneru.com`.
2. Who should get uptime alerts (email/phone)?
3. ~~Card on Oracle~~ Done; account works, waiting on A1 capacity.
