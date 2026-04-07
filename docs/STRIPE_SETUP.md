# Stripe Local Testing — Setup Guide

How to configure Stripe for local development and testing with BASIRET.

---

## Prerequisites

- A Stripe account (sign up at https://dashboard.stripe.com/register)
- Docker containers running (`docker compose up -d`)
- Stripe CLI is pre-installed in the `basiret_api` container

---

## Step 1 — Get your Stripe test keys

1. Go to https://dashboard.stripe.com/test/apikeys
2. Copy **Secret key** (`sk_test_...`)
3. Copy **Publishable key** (`pk_test_...`) — used in the frontend (future)

Add the secret key to your `.env`:

```
STRIPE_SECRET_KEY=sk_test_your_key_here
```

---

## Step 2 — Create the Insights price in Stripe

1. Go to https://dashboard.stripe.com/test/products → **Add product**
2. Name: `Insights Plan`
3. Price: `$29.00 / month` (recurring)
4. Click **Save product**
5. Copy the **Price ID** (`price_...`) from the product detail page

Add it to your `.env`:

```
STRIPE_INSIGHTS_PRICE_ID=price_your_id_here
```

---

## Step 3 — Authenticate Stripe CLI inside Docker

```bash
docker compose exec api stripe login
```

This opens a browser-based pairing flow. Follow the link printed in the terminal
to authorize the CLI with your Stripe account.

> **Note:** The login session is stored in the container's filesystem. If you
> rebuild the container (`docker compose build api`), you'll need to re-login.

---

## Step 4 — Start the webhook listener

In a **separate terminal**, start the Stripe CLI listener that forwards webhook
events to your local API:

```bash
docker compose exec api stripe listen --forward-to localhost:8000/api/v1/billing/webhooks/stripe
```

The CLI will print a **webhook signing secret**:

```
> Ready! Your webhook signing secret is whsec_abc123...
```

Copy that value into your `.env`:

```
STRIPE_WEBHOOK_SECRET=whsec_abc123...
```

Then restart the API container so it picks up the new secret:

```bash
docker compose restart api
```

> **Important:** The `whsec_` secret changes every time you restart
> `stripe listen`. If you restart the listener, update `.env` and restart the
> API container again.

---

## Step 5 — Test the full checkout flow

### Option A: Via the frontend

1. Log in to the app at http://localhost:3000
2. Navigate to Settings → Billing → Upgrade
3. Complete checkout using a Stripe test card:
   - Card: `4242 4242 4242 4242`
   - Expiry: any future date
   - CVC: any 3 digits
4. Watch the webhook listener terminal — you should see events like:
   ```
   checkout.session.completed
   invoice.payment_succeeded
   customer.subscription.updated
   ```
5. Verify the user's plan changed to Insights in the dashboard

### Option B: Via the API directly

```bash
# 1. Register and get a token
TOKEN=$(curl -s http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234!","full_name":"Test","organization_name":"TestOrg"}' \
  | python -c "import sys,json; print(json.load(sys.stdin)['data']['access_token'])")

# 2. Create a checkout session
curl -s http://localhost:8000/api/v1/billing/create-checkout \
  -H "Authorization: Bearer $TOKEN" \
  -X POST | python -c "import sys,json; print(json.load(sys.stdin)['data']['checkout_url'])"

# 3. Open the URL in a browser, pay with test card 4242...

# 4. Check subscription status
curl -s http://localhost:8000/api/v1/billing/subscription \
  -H "Authorization: Bearer $TOKEN" | python -m json.tool
```

### Option C: Trigger a test webhook event directly

```bash
docker compose exec api stripe trigger checkout.session.completed
```

---

## Step 6 — Verify webhook handling

Check the API logs to confirm the webhook was processed:

```bash
docker compose logs api --tail=20
```

You should see lines like:

```
Stripe webhook received: checkout.session.completed
Org <uuid> upgraded to insights via checkout
```

---

## Webhook events handled

| Event | Action |
|---|---|
| `checkout.session.completed` | Upgrade to Insights, seed feature flags |
| `invoice.payment_succeeded` | Confirm active, update period dates |
| `invoice.payment_failed` | Mark subscription `past_due` |
| `customer.subscription.updated` | Sync status + period dates |
| `customer.subscription.deleted` | Downgrade to Starter |

---

## Stripe test cards

| Scenario | Card number |
|---|---|
| Successful payment | `4242 4242 4242 4242` |
| Requires authentication | `4000 0025 0000 3155` |
| Declined | `4000 0000 0000 0002` |
| Insufficient funds | `4000 0000 0000 9995` |

All test cards use any future expiry date and any 3-digit CVC.

---

## Troubleshooting

**"Webhook secret not configured" (503)**
→ Set `STRIPE_WEBHOOK_SECRET` in `.env` and restart: `docker compose restart api`

**"Invalid signature" (400)**
→ The `whsec_` secret changes each time you restart `stripe listen`. Copy the
new one from the CLI output into `.env` and restart the API.

**Stripe CLI not found**
→ Rebuild the API container: `docker compose build api && docker compose up -d api`

**Login expired**
→ Run `docker compose exec api stripe login` again.
