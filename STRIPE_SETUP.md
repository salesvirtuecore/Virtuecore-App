# Stripe Connect Setup Guide

## Environment Variables Required in Vercel

Your Stripe integration requires these environment variables to be set in Vercel. The 500 errors are likely caused by one or more of these being missing.

### Required Variables

#### 1. **STRIPE_SECRET_KEY**
- **Where to get it**: [Stripe Dashboard](https://dashboard.stripe.com/apikeys) → API Keys → Secret key
- **Format**: Starts with `sk_test_` (test) or `sk_live_` (production)
- **Used by**: Both `/api/stripe/connect` (admin) and `/api/stripe/client-connect` endpoints
- **Why it's critical**: Powers all Stripe API calls on the backend

#### 2. **SUPABASE_URL**
- **Where to get it**: [Supabase Console](https://app.supabase.com) → Project Settings → API → Project URL
- **Format**: `https://xxxxxxxxxxxx.supabase.co`
- **Alternative names**: `VITE_SUPABASE_URL` (frontend config)
- **Used by**: All API routes to connect to your database
- **Why it's critical**: Without this, the endpoint can't query your clients and profiles tables

#### 3. **SUPABASE_SERVICE_ROLE_KEY**
- **Where to get it**: [Supabase Console](https://app.supabase.com) → Project Settings → API → Service Role Key
- **Format**: Long string starting with `eyJ...` (JWT)
- **⚠️ WARNING**: This is a super-admin key. Keep it secret. Never commit to repo.
- **Used by**: Backend API routes (server-side only)
- **Why it's critical**: Allows the API to query/update the clients table with admin privileges

#### 4. **STRIPE_CLIENT_ID** (Admin endpoint only)
- **Where to get it**: [Stripe Dashboard](https://dashboard.stripe.com/connect/settings/applications) → Connect → Branding
- **Format**: Starts with `ca_` (e.g., `ca_1234567890ABCDEFGHIJKLMNO`)
- **Used by**: `/api/stripe/connect` (admin onboarding flow only)
- **Why it's critical**: Required for OAuth-based Connect flow for admins

### Optional Variables

#### 5. **STRIPE_WEBHOOK_SECRET**
- **Where to get it**: [Stripe Dashboard](https://dashboard.stripe.com/webhooks) → Your webhook endpoint
- **Format**: Starts with `whsec_`
- **Used by**: `/api/webhooks/stripe` to verify incoming webhook events
- **Status**: Required only if webhooks are enabled

#### 6. **STRIPE_CONNECT_RETURN_URL** & **STRIPE_CONNECT_REFRESH_URL**
- **Default**: `https://virtuecore-app.vercel.app/admin/clients`
- **Can override**: Set custom return/refresh URLs if needed
- **Used by**: Admin Connect onboarding flow

#### 7. **STRIPE_CONNECT_CLIENT_RETURN_URL** & **STRIPE_CONNECT_CLIENT_REFRESH_URL**
- **Default**: `https://virtuecore-app.vercel.app/client`
- **Can override**: Set custom return/refresh URLs for client flow
- **Used by**: Client Connect endpoint

---

## Stripe Platform Profile Setup (After Environment Variables)

Once your environment variables are set and deployed, you'll need to complete **one more critical step** before clients can connect:

### Step 1: Complete Platform Profile
1. Go to **[Stripe Dashboard → Settings → Connect → Platform Profile](https://dashboard.stripe.com/settings/connect/platform-profile)**
2. Fill in any missing information
3. **Most importantly**: Read and accept the section about "responsibilities of managing losses for connected accounts"
4. Save your changes

### Step 2: Verify Connect is Fully Enabled
1. Go to **[Stripe Dashboard → Connect Settings](https://dashboard.stripe.com/connect/settings)**
2. Check that your platform account shows a "Connected" status
3. If it shows "Pending" or has warnings, resolve them

### Why This is Needed
When you create a connected Stripe account (for your clients), Stripe requires your **platform account** to have agreed to manage chargebacks, disputes, and account losses. This is a legal responsibility you're accepting by offering Connect on your platform.

---

### Step 1: Go to Your Project Settings
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click on your `virtuecore-app` project
3. Click **Settings** (top navigation)
4. Click **Environment Variables** (left sidebar)

### Step 2: Add Each Variable
For each required variable:
1. Click **Add New**
2. Enter the **Name** (e.g., `STRIPE_SECRET_KEY`)
3. Enter the **Value** (paste from Stripe/Supabase dashboard)
4. Select which environments: **Dev**, **Preview**, **Production**
5. Click **Save**

### Step 3: Important - Redeploy After Adding Variables
After adding environment variables:
1. Go to **Deployments**
2. Click the three dots next to your latest deployment
3. Click **Redeploy** (this picks up the new env vars)
4. Wait for deployment to complete (usually 1-2 minutes)

---

## Testing Your Setup

### Option 1: Check Logs Immediately
Once you've redeployed:
1. Open your client app: [https://virtuecore-app.vercel.app/client/billing](https://virtuecore-app.vercel.app/client/billing)
2. Click **Connect Stripe**
3. Open browser console (F12 → Console)
4. You should see errors that tell you which env var is missing, OR the flow should proceed

### Option 2: Check Vercel Logs
1. Go to [Vercel Dashboard](https://vercel.com/dashboard) → Your Project
2. Click **Deployments** (top nav)
3. Click your latest deployment
4. Click **Functions** tab
5. Click on `/api/stripe/client-connect`
6. You'll see live console logs showing:
   - `[Stripe Connect] Environment check passed...`
   - OR which specific env var is missing

### Option 3: Manual Test with cURL
```bash
# Get your session token first, then:
curl -X POST https://virtuecore-app.vercel.app/api/stripe/client-connect \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -d "{}"
```

---

## Troubleshooting

### Error: "Server not configured: missing Stripe secret key"
- ✅ Add `STRIPE_SECRET_KEY` to Vercel env vars
- ✅ Make sure you used the **Secret key**, not the Publishable key
- ✅ Redeploy the project after adding

### Error: "Server not configured: missing Supabase service role key"
- ✅ Add `SUPABASE_SERVICE_ROLE_KEY` to Vercel env vars
- ✅ Get the **Service Role Key**, not the anon key
- ✅ Redeploy the project after adding

### Error: "Invalid auth token"
- ✅ Make sure you're logged in on the client app
- ✅ Check browser console for session errors
- ✅ Sign out and sign back in

### Error: "Platform setup required: Admin must complete Stripe Connect platform profile"
- ✅ Go to [Stripe Dashboard → Settings → Connect → Platform Profile](https://dashboard.stripe.com/settings/connect/platform-profile)
- ✅ Complete the platform profile form
- ✅ **Accept the responsibility agreement** for managing losses (chargebacks, disputes, etc.)
- ✅ Save and wait ~5 minutes for Stripe to process the change
- ✅ Try "Connect Stripe" button again

### Error: "Connection timeout" or "Service Unavailable"
- ✅ Clear browser cache (Ctrl+Shift+Delete)
- ✅ Wait 30 seconds and try again
- ✅ Check Vercel Deployments tab to confirm the latest version is deployed

---

## Checklist

Before you declare this fixed, verify each:

- [ ] STRIPE_SECRET_KEY added to Vercel env vars
- [ ] SUPABASE_URL added to Vercel env vars
- [ ] SUPABASE_SERVICE_ROLE_KEY added to Vercel env vars
- [ ] STRIPE_CLIENT_ID added to Vercel env vars (if using admin endpoint)
- [ ] Project **redeployed** after adding env vars
- [ ] Vercel Deployments shows status: `Ready`
- [ ] No errors in Vercel Functions logs for `/api/stripe/client-connect`
- [ ] Browser successfully fetches from the endpoint
- [ ] Stripe onboarding link opens in new tab

---

## Debugging: Enable Full Logging

The endpoints now log detailed information. You can see it in:
1. **Vercel Deployments → Your Deployment → Functions → `/api/stripe/client-connect`** (Live logs)
2. **Your browser Console** (F12 → Console) when clicking the button

The logs will show:
```
[Stripe Connect] Environment check passed. Initializing Stripe and Supabase...
[Stripe Connect] Authenticating user with token...
[Stripe Connect] User authenticated: user-id-here
[Stripe Connect] Fetching user profile...
[Stripe Connect] Looking up client record...
[Stripe Connect] Creating new Stripe Express account...
[Stripe Connect] Stripe account created: acct_xxx
[Stripe Connect] Account ID saved to database
[Stripe Connect] Creating account onboarding link for account: acct_xxx
[Stripe Connect] Onboarding link created. Returning to client.
```

If you see earlier logs stopping (e.g., stops at "Environment check"), that's where the error is.

---

## After Setup Works

Once the Stripe Connect button works:
1. You should see an onboarding link open in a new tab
2. Complete Stripe's onboarding form (~5 minutes)
3. You should be redirected back to `https://virtuecore-app.vercel.app/client`
4. The Billing page should show "Connected" status

If it shows "Connected" but onboarding isn't complete, Stripe will email you with a link to finish setup.
