# Stripe Setup Guide

Clients connect their revenue by pasting their own Stripe **secret key** on
the Billing page — there is no OAuth flow, no Stripe Connect platform
profile, and no `STRIPE_CLIENT_ID`. That whole flow was retired; this doc
used to describe it and was badly out of date.

## Environment Variables Required in Vercel

#### 1. **STRIPE_SECRET_KEY**
- **Where to get it**: [Stripe Dashboard](https://dashboard.stripe.com/apikeys) → API Keys → Secret key
- **Whose key this is**: VirtueCore's own **platform** Stripe account — used to charge clients' saved cards for the automated billing cycle (`api/_lib/billing.js`) and to create Checkout Sessions for card-on-file / one-off invoices. It is never used to read a client's own revenue.

#### 2. **SUPABASE_URL** (or `VITE_SUPABASE_URL`)
- **Where to get it**: [Supabase Console](https://app.supabase.com) → Project Settings → API → Project URL

#### 3. **SUPABASE_SERVICE_ROLE_KEY**
- **Where to get it**: [Supabase Console](https://app.supabase.com) → Project Settings → API → Service Role Key
- **⚠️ WARNING**: Super-admin key. Keep it secret. Never commit to the repo.

#### 4. **CREDENTIALS_ENCRYPTION_KEY**
- A 32-byte base64 secret (e.g. `openssl rand -base64 32`), used to encrypt every client's pasted Stripe secret key at rest (`api/_lib/crypto.js`). Losing this key means every stored client Stripe key becomes undecryptable — back it up somewhere safe outside Vercel.

### Optional

#### **STRIPE_WEBHOOK_SECRET**
- **Where to get it**: [Stripe Dashboard](https://dashboard.stripe.com/webhooks) → Your webhook endpoint
- Required only if webhooks are enabled.

---

## How the client-side flow actually works

1. Client goes to **Billing**, pastes their own Stripe secret key (`sk_live_...` or `sk_test_...`).
2. `POST /api/stripe/save-secret-key` validates it live against Stripe (`balance.retrieve()`) before saving — a bad or fake key is rejected immediately with Stripe's own error message.
3. Once valid, it's encrypted (`api/_lib/crypto.js`) and stored — the plaintext key is never returned to the browser again, only a masked version (`sk_live_••••1234`).
4. `POST /api/stripe/sync-revenue` decrypts the key server-side and reads the client's own charges directly (no `stripeAccount` header — it *is* their account) to compute total revenue since they joined.
5. The automated 28-day billing cycle (`api/_lib/billing.js`) uses this same revenue figure, combined with `revenue_share_percentage` + `monthly_retainer`, to charge the client's **saved card on file** — which is a completely separate thing, created via the platform's own Stripe account (`setup-payment-method`), not the client's pasted key.

**Legacy clients**: a handful of early clients connected via the old Stripe Standard OAuth Connect flow and still have a `clients.stripe_account_id` set. Both code paths coexist — `sync-revenue` and the billing cycle check `stripe_account_id` first (legacy) and fall back to the pasted-key path if it's absent. No action needed for these existing clients; new clients only ever use the key-paste path.

---

## Troubleshooting

### Error: "That doesn't look like a valid Stripe secret key"
- The pasted value doesn't start with `sk_live_` or `sk_test_` — check for a stray publishable key (`pk_...`) instead.

### Error: "Stripe rejected this key: ..."
- Stripe's own error message is passed straight through — usually an expired, revoked, or restricted-permission key. Ask the client to generate a fresh secret key from their own Stripe Dashboard.

### Error: "Server not configured: missing Stripe secret key" / "missing Supabase service role key"
- One of the required env vars above isn't set in Vercel. Add it and redeploy.

### Error: "CREDENTIALS_ENCRYPTION_KEY not set"
- Add it (see above) and redeploy. Every already-saved client key will fail to decrypt if this value ever changes after being set — treat it as immutable once real client keys exist.
