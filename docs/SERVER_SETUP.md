# BASIRET — Server Setup (Hetzner VPS, Ubuntu 24.04)

End-to-end setup for a fresh Hetzner Cloud server.

| | |
|---|---|
| **Server IP** | `178.104.191.148` |
| **Domain** | `basiret.co` (and `www.basiret.co`) |
| **OS** | Ubuntu 24.04 LTS |
| **Stack** | Docker Compose (nginx + FastAPI + React + Postgres + Redis + Celery) |
| **TLS** | Let's Encrypt via Certbot (standalone for issuance, webroot for renewal) |

The end state is: GitHub Actions can `git push` to `main` and the site rebuilds automatically.

---

## 0 — DNS first

Before touching the server, point both records at the box and let them propagate:

```
A    basiret.co       → 178.104.191.148
A    www.basiret.co   → 178.104.191.148
```

Verify from your laptop:

```bash
dig +short basiret.co
dig +short www.basiret.co
# both should print 178.104.191.148
```

If either record is wrong, certbot will fail later. Don't continue until both resolve.

---

## 1 — First SSH + base hardening

Hetzner emails the initial root password. SSH in:

```bash
ssh root@178.104.191.148
```

Then update the OS and install essentials:

```bash
apt update && apt upgrade -y
apt install -y \
  ca-certificates curl gnupg ufw fail2ban git \
  software-properties-common unattended-upgrades
```

Enable automatic security updates:

```bash
dpkg-reconfigure --priority=low unattended-upgrades
```

---

## 2 — Create the deploy user

GitHub Actions will SSH in as this user. We don't run anything as root.

```bash
adduser --disabled-password --gecos "" deploy
usermod -aG sudo deploy

# Allow passwordless sudo for docker commands (used by deploy.sh)
echo "deploy ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/deploy
chmod 440 /etc/sudoers.d/deploy

# Mirror root's authorized_keys so you can ssh as deploy with the same key
mkdir -p /home/deploy/.ssh
cp /root/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
```

Open a second terminal and verify the deploy user works **before disabling root SSH**:

```bash
ssh deploy@178.104.191.148   # should drop you straight in
sudo whoami                  # should print "root"
```

Now disable password auth + root login:

```bash
# back in the root session
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart ssh
```

---

## 3 — Firewall

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
ufw status
```

Postgres (5433), Redis (6382), and the API (8000) are **not** exposed to the host in the production compose file — they live only on the internal Docker network. Don't open those ports.

---

## 4 — Install Docker + Compose plugin

Official Docker repo (the Ubuntu one is too old for Compose v2):

```bash
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
  > /etc/apt/sources.list.d/docker.list

apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Let the deploy user run docker without sudo
usermod -aG docker deploy

# Verify
docker --version
docker compose version
```

The `deploy` user needs to log out and back in for the group membership to take effect.

---

## 5 — Clone the repo

```bash
# As the deploy user
ssh deploy@178.104.191.148

sudo mkdir -p /opt/basiret
sudo chown deploy:deploy /opt/basiret

git clone https://github.com/<your-org>/basiret.git /opt/basiret
cd /opt/basiret
```

If the repo is private, add a deploy key first:

```bash
ssh-keygen -t ed25519 -C "basiret-prod-deploy" -f ~/.ssh/github_deploy -N ""
cat ~/.ssh/github_deploy.pub
# Paste into GitHub → repo Settings → Deploy keys (read-only)

cat >> ~/.ssh/config <<'EOF'
Host github.com
  IdentityFile ~/.ssh/github_deploy
  StrictHostKeyChecking accept-new
EOF
chmod 600 ~/.ssh/config

git clone git@github.com:<your-org>/basiret.git /opt/basiret
```

---

## 6 — Production `.env`

Copy the template and fill in **real** values. This file is the only thing on the server not in git.

```bash
cd /opt/basiret
cp .env.example .env
chmod 600 .env
nano .env
```

Required values:

```ini
# Postgres (pick strong passwords — generate with: openssl rand -base64 24)
POSTGRES_DB=basiret_db
POSTGRES_USER=basiret_user
POSTGRES_PASSWORD=<strong-random-password>
DATABASE_URL=postgresql://basiret_user:<same-password>@db:5432/basiret_db

# Redis (internal network, no auth needed)
REDIS_URL=redis://redis:6379/0

# JWT signing — must be different from dev (openssl rand -hex 32)
SECRET_KEY=<32-byte-hex>

ENVIRONMENT=production

# Meta / Instagram OAuth — production app credentials
META_APP_ID=<prod-app-id>
META_APP_SECRET=<prod-app-secret>
INSTAGRAM_REDIRECT_URI=https://basiret.co/api/v1/instagram/callback
INSTAGRAM_TEST_TOKEN=

# Gemini (note the EXACT casing — pydantic is case-sensitive on Linux)
GEMINI_API_KEY=<prod-gemini-key>

# Stripe — LIVE keys for production, test keys until you go live
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...   # set after step 9 (webhook setup)
STRIPE_INSIGHTS_PRICE_ID=price_...

# Public-facing URL — used by Stripe Checkout success/cancel redirects
FRONTEND_URL=https://basiret.co
```

After filling it in, double-check no value is still `your_..._here`:

```bash
grep -E '_here$' .env && echo "STILL PLACEHOLDER VALUES" || echo "ok"
```

---

## 7 — Get the SSL certificate (Certbot, standalone)

The nginx container can't start without `/etc/letsencrypt/live/basiret.co/fullchain.pem`, so we issue the cert *before* the first compose-up using certbot's standalone mode (it temporarily binds port 80 itself).

```bash
sudo apt install -y certbot

sudo certbot certonly --standalone \
  -d basiret.co -d www.basiret.co \
  --email leadersmart66@gmail.com \
  --agree-tos --no-eff-email
```

Verify the files exist:

```bash
sudo ls /etc/letsencrypt/live/basiret.co/
# fullchain.pem  privkey.pem  cert.pem  chain.pem  README
```

### Auto-renewal

Certbot installs a systemd timer (`certbot.timer`) that runs `certbot renew` twice a day. We need it to:
1. Use **webroot** mode for renewals so nginx doesn't have to stop
2. Reload the nginx **container** after a successful renewal

Drop in a renewal hook:

```bash
sudo tee /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh > /dev/null <<'EOF'
#!/usr/bin/env bash
docker exec basiret_nginx nginx -s reload
EOF
sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
```

And switch the renewal config to webroot (so the cert renews while nginx keeps running):

```bash
sudo sed -i \
  -e 's|^authenticator = standalone|authenticator = webroot|' \
  -e '/^webroot_path/d' \
  /etc/letsencrypt/renewal/basiret.co.conf

sudo tee -a /etc/letsencrypt/renewal/basiret.co.conf > /dev/null <<'EOF'
webroot_path = /var/lib/docker/volumes/basiret_certbot_webroot/_data,
[[webroot_map]]
basiret.co = /var/lib/docker/volumes/basiret_certbot_webroot/_data
www.basiret.co = /var/lib/docker/volumes/basiret_certbot_webroot/_data
EOF
```

The `certbot_webroot` named volume is created by the nginx service in `docker-compose.prod.yml`; certbot writes the ACME challenge file into it, and the nginx config serves `/.well-known/acme-challenge/` from that path.

Test renewal end-to-end (this is a no-op against the real CA but exercises the full flow):

```bash
sudo certbot renew --dry-run
```

---

## 8 — First boot

```bash
cd /opt/basiret
docker compose -f docker-compose.prod.yml --env-file .env up --build -d
docker compose -f docker-compose.prod.yml ps
```

All five service containers should show `Up`. Tail the logs while you smoke-test:

```bash
docker compose -f docker-compose.prod.yml logs -f nginx api frontend
```

Smoke-test from your laptop:

```bash
curl -I https://basiret.co/                    # 200
curl    https://basiret.co/api/v1/health       # {"status":"ok"} or similar
```

---

## 9 — Stripe webhook

In the Stripe dashboard (Developers → Webhooks → Add endpoint):

- URL: `https://basiret.co/api/v1/billing/webhooks/stripe`
- Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`

Copy the signing secret (`whsec_...`) into `.env` as `STRIPE_WEBHOOK_SECRET`, then rebuild:

```bash
docker compose -f docker-compose.prod.yml up -d --no-deps --force-recreate api celery
```

---

## 10 — GitHub Actions auto-deploy

The workflow at `.github/workflows/deploy.yml` SSHes into the box on every push to `main` and runs `deploy.sh`. To enable it, add these repo secrets (Settings → Secrets and variables → Actions):

| Secret | Value |
|---|---|
| `SSH_HOST` | `178.104.191.148` |
| `SSH_USER` | `deploy` |
| `SSH_PORT` | `22` (or override if you moved sshd) |
| `REPO_DIR` | `/opt/basiret` |
| `SSH_PRIVATE_KEY` | the **private** key whose public half is in `/home/deploy/.ssh/authorized_keys` |

Generate a dedicated CI key (don't reuse a personal key):

```bash
# On your laptop
ssh-keygen -t ed25519 -C "basiret-ci" -f ~/.ssh/basiret-ci -N ""

# Add the PUBLIC key to the server
ssh-copy-id -i ~/.ssh/basiret-ci.pub deploy@178.104.191.148

# Paste the PRIVATE key (cat ~/.ssh/basiret-ci) into the SSH_PRIVATE_KEY secret
```

Push a trivial commit to `main` and watch the Actions tab — the deploy job should go green and the site should reflect the new code in ~2 min.

---

## 11 — Day-2 ops cheatsheet

```bash
# View running containers
docker compose -f docker-compose.prod.yml ps

# Tail logs for one service
docker compose -f docker-compose.prod.yml logs -f api

# Restart a single service after .env change
docker compose -f docker-compose.prod.yml up -d --no-deps --force-recreate api celery

# Manually trigger a deploy from your laptop (skips GitHub Actions)
./deploy.sh

# DB shell
docker compose -f docker-compose.prod.yml exec db \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"

# Run a Celery task one-off
docker compose -f docker-compose.prod.yml exec celery \
  celery -A app.core.celery_app:celery call app.tasks.insights.generate_weekly_insights \
  --args='["<account-uuid>"]'

# Backup Postgres (run from server, copy off-box afterward)
docker compose -f docker-compose.prod.yml exec -T db \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > backup-$(date +%F).sql.gz
```

---

## Troubleshooting

**`nginx: [emerg] cannot load certificate ... fullchain.pem`** — the cert wasn't issued before `compose up`. Run step 7, then `docker compose -f docker-compose.prod.yml up -d nginx`.

**Certbot renewal fails with "challenge file not found"** — the webroot path in `/etc/letsencrypt/renewal/basiret.co.conf` doesn't match the `certbot_webroot` Docker volume location. Run `docker volume inspect basiret_certbot_webroot` and fix the path.

**`502 Bad Gateway` on the frontend** — `vite preview` is slow to start the first time after a build. Wait 30s and retry. If it persists, check `docker logs basiret_frontend` for build errors.

**Stripe webhook 400s with "Invalid signature"** — `STRIPE_WEBHOOK_SECRET` doesn't match what Stripe is sending. Re-copy from the Stripe dashboard and `force-recreate api`.

**GitHub Actions deploy fails at the SSH step** — re-check that the **public** half of `SSH_PRIVATE_KEY` is in `/home/deploy/.ssh/authorized_keys` on the server, and that `~/.ssh` is `700` and `authorized_keys` is `600`.
