# Deploy runbook

Server: Oracle Always Free, Ubuntu 24.04, Hyderabad. Current host: `asson-micro` (AMD E2.1.Micro, 1 GB + 2 GB swap) at the IP in GitHub variable `DEPLOY_HOST`. Cloudflare Tunnel serves `asson.bhuwanpaneru.com` → :3000 (production) and `staging-asson.bhuwanpaneru.com` → :3001 (staging). No web ports are open; SSH (22) is key-only.

| File | What it does |
|---|---|
| `server-setup.sh` | One-time, re-runnable server setup: swap, updates, Node 24, PostgreSQL (localhost), user `asson`, `/srv/asson/<env>`, `/etc/asson/<env>.env` (secrets generated on the server), `asson@<env>` systemd unit, cron, nightly backups, cloudflared. |
| `tunnel-setup.sh` | Creates the `asson` tunnel, DNS records and ingress after `cloudflared tunnel login`. |
| `build-bundle.sh` | Builds a standalone bundle for one environment (used by CI). |
| `with-db.sh` | From the Mac: `deploy/with-db.sh <env> <command>` runs a command with `DATABASE_URL` pointing at that server database through an SSH tunnel (never printed). |
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

## First production setup
1. Deploy production once (Actions → Deploy → production). The release runs the migrations, so the database gets its tables.
2. Load the reference data (categories, 77 district delivery rates, suppliers). Safe to re-run; never deletes or overwrites:
   ```bash
   deploy/with-db.sh production npx tsx prisma/bootstrap.ts
   ```
3. Owner login, in a Terminal tab: `deploy/owner-login.sh production` (use a different password from staging).
4. Never run `npm run db:seed` against production: it wipes everything (it also refuses when `NODE_ENV=production`).

## Backups and restore
Nightly at 02:30 (Nepal time) into `/var/backups/asson`. Restore into an env:
```bash
sudo systemctl stop asson@staging
sudo -u postgres pg_restore --clean --if-exists -d asson_staging /var/backups/asson/asson_staging-<stamp>.dump
sudo systemctl start asson@staging
```
**Off-site copies:** every dump is also uploaded to the private Oracle Object Storage bucket `asson-backups` (namespace `axyo2zdstaon`, Hyderabad, Always Free 20 GB) as `<host>/<db>/<db>-<stamp>.dump`.
- The server only holds a **write-only pre-authenticated link** (`/etc/asson/backup.env`, root-only, named `asson-server-upload`, **expires 2029-11-01**: renew before then). It can add files but cannot list, read or delete them (checked: 404), so a compromised server can't wipe the off-site copies.
- Success and failure are logged (`journalctl -t asson-backup`); `/var/backups/asson/.last-offsite-ok` holds the time of the last full upload.
- No automatic expiry yet: dumps are a few hundred KB, so 20 GB lasts years. Add a lifecycle rule when production data grows.
- Restore from off-site, from the owner's Mac (OCI CLI is configured there):
```bash
oci os object list -bn asson-backups --prefix asson-micro/asson_production/ --query 'data[].name'
oci os object get -bn asson-backups --name <name> --file latest.dump
scp -i ~/.ssh/asson_deploy latest.dump ubuntu@HOST:/tmp/   # then pg_restore as above
```
Restore drill done 9 Nov 2026: the staging dump downloaded from the bucket restored into a scratch DB with identical row counts (57 products, 901 variants, 161 orders, 47 users, 11 migrations).

## Moving to the bigger Ampere server later
Create it, run `server-setup.sh` + `tunnel-setup.sh` on it (`cloudflared tunnel login` again or copy `/etc/cloudflared`), restore the latest dumps, update `DEPLOY_HOST`/`DEPLOY_KNOWN_HOSTS`, and run the Deploy workflow. The bundle already contains the arm64 Prisma engine.
