# Deploy runbook

Server: Oracle Always Free, Ubuntu 24.04, Hyderabad. Current host: `asson-micro` (AMD E2.1.Micro, 1 GB + 2 GB swap) at the IP in GitHub variable `DEPLOY_HOST`. Cloudflare Tunnel serves `asson.bhuwanpaneru.com` → :3000 (production) and `staging-asson.bhuwanpaneru.com` → :3001 (staging). No web ports are open; SSH (22) is key-only.

| File | What it does |
|---|---|
| `server-setup.sh` | One-time, re-runnable server setup: swap, updates, Node 24, PostgreSQL (localhost), user `asson`, `/srv/asson/<env>`, `/etc/asson/<env>.env` (secrets generated on the server), `asson@<env>` systemd unit, cron, nightly backups, cloudflared. |
| `tunnel-setup.sh` | Creates the `asson` tunnel, DNS records and ingress after `cloudflared tunnel login`. |
| `build-bundle.sh` | Builds a standalone bundle for one environment (used by CI). |
| `owner-login.sh` | From the Mac: `deploy/owner-login.sh <staging\|production>` opens a DB tunnel and runs `scripts/create-owner.ts` (hidden password prompt). Run it in a real Terminal tab, not a non-interactive shell. |
| `release.sh` | Runs on the server: migrate → switch `current` → restart → health check → roll back on failure. |

## Layout on the server
```
/srv/asson/<env>/releases/<time>-<sha>/   unpacked bundles (4 kept)
/srv/asson/<env>/current -> releases/…    what systemd runs
/srv/asson/tools/                          prisma CLI for migrations
/etc/asson/<env>.env                       settings + secrets (root:asson 640)
/var/backups/asson/                        nightly pg_dump files (14 days)
```

## Everyday
- **Deploy staging:** merge to `main`; CI passes → Deploy workflow runs automatically.
- **Deploy production:** GitHub → Actions → Deploy → Run workflow → `production` (main only).
- **Logs:** `ssh asson@HOST journalctl -u asson@staging -f`
- **Health:** `curl https://staging-asson.bhuwanpaneru.com/api/health`

## Roll back by hand
```bash
ssh asson@HOST
cd /srv/asson/production && ls -1t releases       # pick the previous one
ln -sfn /srv/asson/production/releases/<id> current.tmp && mv -Tf current.tmp current
sudo systemctl restart asson@production
```
Migrations are never rolled back, so migrations must stay backward compatible with the previous release (add first, remove in a later release).

## Database access from the Mac (seed, owner login, inspection)
Open a tunnel in one Terminal tab and leave it running:
```bash
ssh -i ~/.ssh/asson_deploy -N -L 6543:localhost:5432 ubuntu@HOST
```
In another tab, get the env's DB URL without printing it, then use port 6543:
```bash
export DATABASE_URL=$(ssh -i ~/.ssh/asson_deploy ubuntu@HOST "sudo grep ^DATABASE_URL= /etc/asson/staging.env | cut -d= -f2-" | sed 's/localhost:5432/localhost:6543/')
npx tsx scripts/create-owner.ts      # owner login (password typed at a hidden prompt)
npm run db:seed                      # STAGING ONLY: wipes and loads demo data
```
After a staging re-seed: clear the data cache (`rm -rf /srv/asson/staging/current/.next-bundle/cache`, restart), re-create the owner login (`deploy/owner-login.sh staging`), and lock the demo staff accounts again (their seed passwords are public in the repo):
```bash
H=$(node -e 'const b=require("bcryptjs");console.log(b.hashSync(require("crypto").randomBytes(48).toString("hex"),12))')
ssh -i ~/.ssh/asson_deploy ubuntu@HOST "sudo -u postgres psql -d asson_staging -c \"update \\\"User\\\" set \\\"passwordHash\\\"='$H', \\\"approvalPinHash\\\"=null, \\\"tokenVersion\\\"=\\\"tokenVersion\\\"+1 where email like '%@asson.test' and role <> 'CUSTOMER'\""
```

## Backups and restore
Nightly at 02:30 (Nepal time) into `/var/backups/asson`. Restore into an env:
```bash
sudo systemctl stop asson@staging
sudo -u postgres pg_restore --clean --if-exists -d asson_staging /var/backups/asson/asson_staging-<stamp>.dump
sudo systemctl start asson@staging
```
Off-site copies to Cloudflare R2 are still to do (needs an R2 bucket + token).

## Moving to the bigger Ampere server later
Create it, run `server-setup.sh` + `tunnel-setup.sh` on it (`cloudflared tunnel login` again or copy `/etc/cloudflared`), restore the latest dumps, update `DEPLOY_HOST`/`DEPLOY_KNOWN_HOSTS`, and run the Deploy workflow. The bundle already contains the arm64 Prisma engine.
