# Deploy runbook

Server: Oracle Always Free, Ubuntu 24.04, Hyderabad. Current host: `asson-micro` (AMD E2.1.Micro, 1 GB + 2 GB swap) at the IP in GitHub variable `DEPLOY_HOST`. Cloudflare Tunnel serves `asson.bhuwanpaneru.com` → :3000 (production) and `staging-asson.bhuwanpaneru.com` → :3001 (staging). No web ports are open; SSH (22) is key-only.

| File | What it does |
|---|---|
| `server-setup.sh` | One-time, re-runnable server setup: swap, updates, Node 24, PostgreSQL (localhost), user `asson`, `/srv/asson/<env>`, `/etc/asson/<env>.env` (secrets generated on the server), `asson@<env>` systemd unit, cron, nightly backups, cloudflared. |
| `tunnel-setup.sh` | Creates the `asson` tunnel, DNS records and ingress after `cloudflared tunnel login`. |
| `build-bundle.sh` | Builds a standalone bundle for one environment (used by CI). |
| `with-db.sh` | From the Mac: `deploy/with-db.sh <env> <command>` runs a command with `DATABASE_URL` pointing at that server database through an SSH tunnel (never printed). |
| `owner-login.sh` | From the Mac: `deploy/owner-login.sh <staging\|production>` opens a DB tunnel and runs `scripts/create-owner.ts` (hidden password prompt). Run it in a real Terminal tab, not a non-interactive shell. |
| `release.sh` | Runs on the server. **Blue/green** (after `server-setup.sh` has installed nginx): migrate → start the new release in the idle slot → check it (and that it is the new build) → nginx switches gracefully → old slot stops after 20 s of draining. A release that fails its checks never gets traffic. Older single-service servers: migrate → switch → restart → check → roll back. Tested on every CI run (`npm run test:deploy`: zero failed requests during an upgrade). |

## Layout on the server
```
/srv/asson/<env>/releases/<time>-<sha>/   unpacked bundles (4 kept)
/srv/asson/<env>/current -> releases/…    the live release
/srv/asson/<env>/slot-a, slot-b -> releases/…   blue/green slots (ports PORT+100 / PORT+200)
/srv/asson/<env>/active-slot               a or b: which slot nginx sends traffic to
/etc/nginx/asson/<env>.upstream.conf       nginx upstream (rewritten by release.sh)
/srv/asson/tools/                          prisma CLI for migrations
/etc/asson/<env>.env                       settings + secrets (root:asson 640)
/var/backups/asson/                        nightly pg_dump files (14 days)
```

## Everyday
- **Deploy staging:** merge to `main`; CI passes → Deploy workflow runs automatically.
- **Deploy production:** GitHub → Actions → Deploy → Run workflow → `production` (main only).
- **Logs:** `ssh ubuntu@HOST sudo asson-ctl staging logs` (follows whichever slot is live)
- **Restart / stop / start the live app:** `sudo asson-ctl production restart` (a restart is a short outage; deploys are not)
- **Health:** `curl https://staging-asson.bhuwanpaneru.com/api/health`

## Roll back by hand
```bash
ssh asson@HOST
cd /srv/asson/production && ls -1t releases       # pick the previous one
bash releases/<id>/deploy/release.sh production <id>   # blue/green: no downtime; migrations are a no-op
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

## Health, alerts and the uptime monitor
- **Watchdog** (job `system.watchdog`, every 5 min): checks database, worker, job queue, failed jobs, SMS outbox, nightly stock audit, errors, nightly and hourly backups, disk space. Each failure opens an **incident** (Admin → System → Health); critical ones text `ALERT_PHONES` (in `/etc/asson/<env>.env`, comma-separated) once, and again on recovery. Texts need an SMS gateway; until then incidents are recorded and shown only.
- **Uptime monitor:** add two UptimeRobot (free) HTTP monitors, every 5 min:
  1. `https://asson.bhuwanpaneru.com/api/health`: the site answers.
  2. `https://asson.bhuwanpaneru.com/api/health/deep?key=<HEALTH_KEY>`: nothing critical is failing (503 otherwise). `HEALTH_KEY` is in `/etc/asson/production.env`, generated by `server-setup.sh`. Without the key the URL answers 404.
  Alert contacts: the owner's email and phone (the UptimeRobot app).

## Backups and restore
Nightly at 02:30 (Nepal time) into `/var/backups/asson`, and **hourly at :15 for production** into `/var/backups/asson/hourly` (24 rotating copies, one per hour of the day, also uploaded off-site as `<host>/asson_production/hourly/…`). At most an hour of orders is at risk. Restore an hourly copy the same way as a nightly one. Restore into an env:
```bash
sudo asson-ctl staging stop
sudo -u postgres pg_restore --clean --if-exists -d asson_staging /var/backups/asson/asson_staging-<stamp>.dump
sudo asson-ctl staging start
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
**Product photos** (uploaded in the admin) live in `/srv/asson/<env>/media` (`MEDIA_DIR` in the env file; the app refuses to start without it). The same nightly job copies each new photo file off-site once, to `<host>/media/<env>/p/…` in the bucket (`/var/backups/asson/.media-offsite-<env>` lists what was copied). Restore: download the `<host>/media/<env>/` prefix (`oci os object bulk-download -bn asson-backups --prefix asson-micro/media/production/ --download-dir restore`) and copy its `p/` folder into `/srv/asson/<env>/media/` (owner `asson`). Moving servers: copy the media folders along with the database dumps.

Restore drill done 9 Nov 2026: the staging dump downloaded from the bucket restored into a scratch DB with identical row counts (57 products, 901 variants, 161 orders, 47 users, 11 migrations).

## Moving to the bigger Ampere server later
Create it, run `server-setup.sh` + `tunnel-setup.sh` on it (`cloudflared tunnel login` again or copy `/etc/cloudflared`), restore the latest dumps and copy `/srv/asson/*/media`, update `DEPLOY_HOST`/`DEPLOY_KNOWN_HOSTS`, and run the Deploy workflow. The bundle already contains the arm64 Prisma engine.
