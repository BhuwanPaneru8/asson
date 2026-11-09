# Owner setup checklist (for deployment)

Do these in order. Each part says **what to send back** to Claude. **Never paste passwords, card numbers, tokens or private keys into the chat.**

Screens and button names on these sites change from time to time. If something looks different, describe or screenshot it and we'll find the right button.

*Updated 9 Nov 2026: domain is now a subdomain of `bhuwanpaneru.com` (already on Cloudflare); Oracle hit "Out of capacity".*

---

## Part A — Domain: nothing to buy

`bhuwanpaneru.com` is already on Cloudflare, so Asson uses subdomains of it:

| Address | What |
|---|---|
| `asson.bhuwanpaneru.com` | The shop. The back office stays at `asson.bhuwanpaneru.com/admin` (same login, same app). |
| `staging-asson.bhuwanpaneru.com` | Test copy we check before every go-live. |

Why not `admin.bhuwanpaneru.com` or `staging.asson.bhuwanpaneru.com`:
- Cloudflare's free certificate covers only **one level** below the domain (`*.bhuwanpaneru.com`). `staging.asson.bhuwanpaneru.com` is two levels and would show a certificate error, so we use `staging-asson`.
- `admin.bhuwanpaneru.com` is generic for your personal domain, and splitting admin onto another host makes logins and cookies more fragile. Keeping `/admin` on the shop host is safer. If you still want a separate admin address later, it can be added.

**You don't need to create these DNS records by hand.** The Cloudflare Tunnel creates them when we connect the server (Part C, after the server exists).

➡️ **Send back:** "OK with these addresses", or the names you prefer.

---

## Part B — Cloudflare: one check (2 minutes)

1. Make sure **two-factor authentication** is on: **dash.cloudflare.com → My Profile → Authentication**.
2. Open **bhuwanpaneru.com → SSL/TLS → Overview** and set the mode to **Full (strict)** if it isn't already. (Check first that your main site still loads after the change; if it breaks, set it back and tell Claude.)

➡️ **Send back:** "Cloudflare checked".

---

## Part C — Fix Oracle "Out of capacity" (recommended, ~10 minutes)

Free Ampere servers in Mumbai are often full for **free-trial** accounts. Upgrading the account to **Pay As You Go** usually fixes this, because paid accounts get priority for capacity, and **Always Free servers stay free** after the upgrade.

### C1. Upgrade to Pay As You Go
1. Oracle console → **☰ menu → Billing & Cost Management → Upgrade and Manage Payment → Upgrade to Pay As You Go**.
2. Oracle may place a small temporary hold on the card. Approval usually takes from a few minutes to a few hours; you'll get an email.

### C2. Set a budget alert (protects you from any charge)
**☰ → Billing & Cost Management → Budgets → Create budget**: amount **US$1**, alert at **1%** of actual spend, your email. If anything ever costs money, you'll know the same day.

### C3. Create the server again
Same as before:
1. Copy the key in Terminal on your Mac (it copies the **public** key, which is safe to share):
   ```bash
   pbcopy < ~/.ssh/asson_deploy.pub
   ```
2. **☰ → Compute → Instances → Create instance**:
   - **Name:** `asson-prod`
   - **Image:** Canonical Ubuntu 24.04 (not "Minimal")
   - **Shape:** Ampere → **VM.Standard.A1.Flex**, **2 OCPUs**, **12 GB** memory (shows *Always Free-eligible*)
   - **Networking:** defaults; **Assign a public IPv4 address** on
   - **SSH keys:** Paste public keys → ⌘V
   - **Boot volume:** custom size **100 GB**
3. **Create**, wait for **Running**.

If it still says "Out of capacity", try **1 OCPU / 6 GB** (also free; enough to launch, and we can grow it later), or retry early morning Nepal time.

➡️ **Send back:** the instance's **Public IP address**, or "still no capacity".

### C4. If Oracle still fails after a day: AWS backup plan
Tell Claude first. The plan would be an **AWS Free plan** account (region **Asia Pacific (Mumbai)**). New accounts get **free credits for 6 months**, which cover a small server (`t4g.small`, 2 GB). Same setup scripts; we move to Oracle later without changing the app. Claude will give exact steps if we go this way.

---

## Part D — GitHub (1 minute)

Open [the pull request](https://github.com/BhuwanPaneru8/asson/pull/1) and press **Merge pull request → Confirm merge**, or just tell Claude "merge it".
Then go to **github.com → Settings → Password and authentication** and make sure **two-factor authentication** is on.

➡️ **Send back:** "merged" (or ask Claude to do it).

---

## Part E — Later (not needed for the first deploy)

| Account | Why | What to send back |
|---|---|---|
| **UptimeRobot** (uptimerobot.com, free) | Texts/emails you if the site goes down | The email/phone for alerts |
| **Sentry** (sentry.io, free Developer plan) | Shows us any error customers hit | Create a project "Next.js" → send the **DSN** (it isn't secret) |
| **Cloudinary** (cloudinary.com, free) | Uploading real product photos | Your **cloud name** only; the API secret goes into GitHub Secrets (Claude will show you where) |
| **SMS gateway** (Sparrow SMS / Aakash SMS) | Order and back-in-stock texts | Later, when you're ready to pay per SMS |

---

## Status (9 Nov 2026)

Done: Cloudflare checked, Oracle account (home region **Hyderabad**), free AMD server `asson-micro` (140.245.230.86) set up, Cloudflare Tunnel authorized, **staging live** at https://staging-asson.bhuwanpaneru.com. The Ampere server retry keeps running from the Mac (`~/.oci/asson-retry.log`).

## Part F — Turn on automatic deploys (1 minute, you)

GitHub needs the deploy key that lets it upload releases to the server. Run this in Terminal on your Mac, from the project folder. It sends the key straight from your Mac to GitHub's encrypted secrets; nothing is shown on screen:

```bash
gh secret set DEPLOY_SSH_KEY < ~/.ssh/asson_ci
```

➡️ **Send back:** "secret added".

## Part G — Your owner login (5 minutes, you, after Part F)

Claude will open a secure connection to the server database and start `scripts/create-owner.ts` for you in a Terminal tab. You type your email, name and a password (12+ characters) there. The password is hidden while you type and never reaches the chat.

