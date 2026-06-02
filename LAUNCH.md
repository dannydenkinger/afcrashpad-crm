# Launch walkthrough — step-by-step

Everything in this file requires logging into an external service (Sentry,
Stripe, Vercel, Google Cloud, AWS, Firebase, Cloudflare/your DNS host)
and can't be done by Claude. Work through it top-to-bottom.

[DEPLOY.md](./DEPLOY.md) is the full deployment reference. **This** file
is the day-of script with exact clicks, expected outputs, and
troubleshooting for when things go sideways.

**Total time:** ~90 minutes if everything goes smoothly. Budget 3 hours
for the first time through.

**Required accounts before you start:**

- Vercel (the deploy target) — <https://vercel.com>
- A Firebase / Google Cloud project (for Firestore + Storage + OAuth)
- Sentry (free tier is fine) — <https://sentry.io>
- Stripe (live mode + test mode) — <https://dashboard.stripe.com>
- AWS account (for SES) — only required if you'll send marketing email
- A domain registered somewhere with editable DNS

**CLIs to install first:**

```bash
# Firebase CLI — for index deploys
npm install -g firebase-tools

# Stripe CLI — for testing webhook deliveries locally
brew install stripe/stripe-cli/stripe   # macOS
# or download from https://stripe.com/docs/stripe-cli

# Google Cloud SDK — for storage CORS + Firestore exports
brew install --cask google-cloud-sdk    # macOS
# or download from https://cloud.google.com/sdk/docs/install
```

After installing, log into each:

```bash
firebase login
stripe login
gcloud auth login
```

---

## 0. Run preflight to see what's missing

⏱ **2 minutes**

```bash
npm run preflight
```

Output is colour-coded:

- **Red** = required (build will fail at runtime if missing)
- **Yellow** = recommended (features degrade silently)
- **Green** = set

Fix anything red before deploying. Anything yellow is fine for a first
deploy but should be filled in within the first week.

For a "what would prod need" view:

```bash
npm run preflight -- --prod
```

If you see "Cannot find module 'tsx'", `npx tsx` will install it on
first run automatically.

---

## 1. Sentry — error tracking

⏱ **5–10 minutes**  💰 **Free tier covers ~5k errors/month**

🎯 **Goal:** every production crash sends a stack trace to Sentry so the team sees it without users having to report.

### 1a. Create the project

1. Go to <https://sentry.io> and **sign up** (or log in)
2. **Create Project** button (top right after login)
3. **Choose platform:** scroll to **Browser** → pick **Next.js**
4. **Alert frequency:** "Alert me on every new issue" (you can tune later)
5. **Project name:** `vesta-crm-prod` (or whatever — just be consistent)
6. **Team:** if first time, accept the default team
7. Click **Create Project**

Sentry shows a setup screen with a DSN. **Copy the DSN** — it looks like:

```
https://abcdef1234567890@o12345.ingest.us.sentry.io/4505555555555555
```

Save it — you'll use it in **two** env vars in the next step.

### 1b. Add to Vercel env vars

1. Vercel Dashboard → your `vesta-crm` project
2. **Settings** (top nav) → **Environment Variables** (left nav)
3. Click **Add New**
4. For each row below: **Key**, **Value**, ensure **Production** is checked (and Preview if you want preview deploys to also report), then **Save**:

| Key | Value |
|-----|-------|
| `SENTRY_DSN` | the DSN from step 1a |
| `NEXT_PUBLIC_SENTRY_DSN` | **same** DSN |

> 💡 They're the same DSN. The `NEXT_PUBLIC_` one is exposed to the browser bundle. Setting both means client AND server crashes get reported.

### 1c. Redeploy so env vars take effect

1. **Deployments** tab → find the latest Production deploy
2. Click the **⋯** menu → **Redeploy** → confirm
3. Wait ~2 min for it to build

### 1d. (Optional but recommended) Source-map upload

Without this, Sentry shows minified stack traces (`a.b.c is not a function`).
With this, you get real file names and line numbers.

1. In Sentry: **Settings** (gear icon top left) → **Developer Settings** → **Custom Integrations** → **Create New Integration**
2. **Internal Integration** (not Public)
3. **Name:** `Vercel CI`
4. **Permissions:** scroll down — `Project: Admin`, `Release: Admin`, `Organization: Read`
5. Click **Save Changes** at the top
6. After save, scroll to the bottom — copy the **Internal Integration Token**

Back to Vercel env vars, add three more (Production):

| Key | Value |
|-----|-------|
| `SENTRY_AUTH_TOKEN` | the token from step 6 above |
| `SENTRY_ORG` | your Sentry org slug — find it in `sentry.io/organizations/<slug>/issues/` |
| `SENTRY_PROJECT` | the slug of your project (probably `vesta-crm-prod`) |

Redeploy again.

### 1e. ✅ Verify Sentry works

The repo includes an owner-only test endpoint.

1. Open your production app
2. Log in as the **OWNER** of any workspace
3. Visit `https://<your-domain>/api/test/error`
4. The page should show a Next.js error / 500
5. **Within ~30 seconds**, check Sentry → **Issues** — you should see `Error: Sentry test — uncaught error path (triggered by your@email.com)`

If nothing appears:

- ❌ Did you redeploy after adding the env vars? Sentry runtime can't pick them up without a build.
- ❌ Is the DSN in **both** `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN`?
- ❌ Did the deploy build with the env vars? Check Vercel → Deployments → latest → **Build Logs** for `Sentry CLI uploaded source maps`. If you don't see that line, `SENTRY_AUTH_TOKEN` wasn't set at build time.

Two more test modes if you want to verify the manual-capture path:

```
/api/test/error?capture     → exercises captureException
/api/test/error?message     → exercises captureMessage (warning level)
```

---

## 2. Stripe — webhook event subscriptions

⏱ **3–5 minutes**  💰 **Free, but live mode requires KYC + a bank account**

🎯 **Goal:** when a customer disputes a credit-pack purchase or you issue a refund, we revoke the credits automatically.

### 2a. Confirm your webhook endpoint exists

1. <https://dashboard.stripe.com> → switch to **Live mode** (toggle, top right)
2. **Developers** (gear icon, top right) → **Webhooks**
3. You should see an endpoint pointing at `https://<your-domain>/api/webhooks/stripe`
4. If not, click **Add endpoint** → URL = `https://<your-domain>/api/webhooks/stripe`

### 2b. Add the new event subscriptions

1. Click into the endpoint
2. Click **+ Select events** (or **Edit** if there are already events)
3. In the search box, add these (one at a time):

   **Credit top-up events** (one-time payments):
   - `checkout.session.completed`
   - `charge.refunded`
   - `charge.dispute.created`
   - `charge.dispute.closed`

   **Subscription lifecycle events** (Pro / Max tier billing):
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `customer.subscription.paused`
   - `customer.subscription.resumed`
   - `invoice.payment_failed`
   - `invoice.paid`

4. Click **Update endpoint** at the bottom.

### 2c. Copy the signing secret (if you haven't already)

Same page, scroll up. **Signing secret** → **Reveal** → copy. Add to Vercel:

| Key | Value |
|-----|-------|
| `STRIPE_WEBHOOK_SECRET` | starts with `whsec_…` |

Redeploy if you just added it.

### 2c-bis. Create the four subscription products (Pro + Max, monthly + yearly)

⏱ **10 minutes**

The credit-pack products auto-created themselves on first checkout via
`price_data`. Subscription products need to exist in advance so we can
reference their **price IDs**. Make four prices, then paste each ID into
Vercel.

1. **Dashboard → Products → + Create product**
2. **Product 1 — "Vesta Pro"**:
   - Name: `Vesta Pro`
   - Description: `Unlocks automations, AI, marketing — 3 seats included`
   - Pricing model: **Standard pricing → Recurring**
   - Currency: `USD`
   - First price: `$29.00` monthly → **Save product**
   - Then add another price: **+ Add another price** → `$290.00` yearly → save
   - You now have two prices on the same product. Click each one to copy its **Price ID** (starts with `price_…`).
3. **Product 2 — "Vesta Max"**:
   - Same process. Prices: `$99.00` monthly + `$990.00` yearly.

Paste the four price IDs into Vercel env vars:

| Key | Value |
|-----|-------|
| `STRIPE_PRICE_PRO_MONTHLY` | `price_…` (Pro $29/mo) |
| `STRIPE_PRICE_PRO_YEARLY` | `price_…` (Pro $290/yr) |
| `STRIPE_PRICE_MAX_MONTHLY` | `price_…` (Max $99/mo) |
| `STRIPE_PRICE_MAX_YEARLY` | `price_…` (Max $990/yr) |

Redeploy. Until these are set, the upgrade buttons in `/settings/billing` show "Plan price not configured" instead of opening Checkout.

> 💡 Seat overage (per-seat above the included base) is **optional** — only set the `STRIPE_PRICE_*_SEAT_*` env vars if you've created additional metered/quantity prices for those. Without them, customers buy the base tier and we cap usage at the included seats.

### 2c-ter. Enable the Customer Portal

So customers can manage cards / cancel / view invoices themselves:

1. **Dashboard → Settings → Billing → Customer portal**
2. **Activate** the portal
3. Under **Functionality**:
   - ✅ Customers can update payment method
   - ✅ Customers can update billing address
   - ✅ Customers can view their invoice history
   - ✅ Customers can cancel subscriptions (recommended)
4. Under **Subscriptions → Allow customers to switch plans**:
   - Add **Vesta Pro** monthly + yearly + **Vesta Max** monthly + yearly to the "allowed products"
   - This lets a user upgrade Pro → Max or switch monthly ↔ yearly without leaving the portal
5. **Save**

### 2d. ✅ Verify webhooks work

The fastest way is the Stripe CLI:

```bash
# Replace with your real production endpoint
stripe trigger charge.refunded
```

Then check Stripe Dashboard → Webhooks → your endpoint → **Recent events**.
Look for:

- `charge.refunded` event with a **green** "200" response
- Click the event → bottom shows `{ "ok": true }`

To test against a local dev server first (recommended):

```bash
# Terminal 1
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Terminal 2
stripe trigger charge.refunded
stripe trigger charge.dispute.created
stripe trigger charge.dispute.closed
```

The `stripe listen` output will print a temporary signing secret —
paste that into `.env.local` as `STRIPE_WEBHOOK_SECRET` for testing
(don't commit it).

### 🔧 Troubleshooting Stripe

- **400 signature error** → secret mismatch. Confirm `STRIPE_WEBHOOK_SECRET` matches whatever the dashboard shows. Live mode and test mode have **different** secrets.
- **404** → endpoint URL is wrong. Should be `/api/webhooks/stripe`, not `/api/webhook/stripe` or `/api/stripe/webhook`.
- **500** → check Vercel function logs (Vercel → Logs → filter by `/api/webhooks/stripe`). Common cause: `STRIPE_SECRET_KEY` is the test-mode key but the webhook is firing live events.

---

## 3. Vercel — environment variables

⏱ **15–20 minutes one-time**  💰 **Free**

🎯 **Goal:** every env var the app needs is set for Production. Use [.env.example](./.env.example) as the master list.

### 3a. The "must be set or build fails" vars

For each: **Settings → Environment Variables → Add New**, scope to **Production** (and ideally Preview).

| Key | How to get the value |
|-----|----------------------|
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
| `AUTH_SECRET` | same value as `NEXTAUTH_SECRET` (NextAuth v4 + v5 compat) |
| `NEXT_PUBLIC_APP_URL` | `https://yourdomain.com` (no trailing slash) |
| `GOOGLE_CLIENT_ID` | section 4 below |
| `GOOGLE_CLIENT_SECRET` | section 4 below |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Console → Project Settings → General → "Your apps" → Web app config |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | same screen as above |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | same screen |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | same screen |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | same screen |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | same screen |
| `FIREBASE_PROJECT_ID` | same as the public one above |
| `FIREBASE_CLIENT_EMAIL` | from the service account JSON (section 3c) |
| `FIREBASE_PRIVATE_KEY` | from the service account JSON — **see warning below** |
| `FIREBASE_STORAGE_BUCKET` | same as the public one |
| `FIREBASE_DATABASE_ID` | usually `(default)` unless you renamed |
| `RESEND_API_KEY` | <https://resend.com> → API Keys → Create |
| `RESEND_FROM_EMAIL` | a verified sender on Resend, e.g. `noreply@yourdomain.com` |

### 3b. ⚠ The `FIREBASE_PRIVATE_KEY` trap

The service account JSON has a `private_key` field that looks like:

```
"-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"
```

When you paste this into Vercel's text field:

- ✅ **Paste it WITH the `\n` escape sequences exactly as in the JSON**
- ❌ Do **not** convert `\n` to real newlines
- ❌ Do **not** wrap it in quotes (Vercel adds those itself)

The code at `firebase-admin.ts` does `.replace(/\\n/g, "\n")` to convert
back. If you paste real newlines, the key splits across env-var boundaries
and breaks.

If your deploy fails with "Failed to parse private key" or "DECODER routines",
this is the cause. Delete the var, repaste the raw string with `\n` literals.

### 3c. Get the Firebase service account JSON

1. Firebase Console → ⚙️ next to "Project Overview" → **Project settings**
2. **Service accounts** tab
3. **Generate new private key** → **Generate key**
4. A JSON file downloads. Keep it safe — **anyone with this can do anything to your Firestore.**
5. Open it. You need three fields:
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_PRIVATE_KEY` (see warning above)
   - `project_id` → `FIREBASE_PROJECT_ID`

### 3d. Required-in-prod security secrets

| Key | What it does | How to generate |
|-----|--------------|-----------------|
| `TRACKING_SECRET` | HMAC signing key for inbound automation webhook tokens (`/api/automations/trigger/[token]`) and cron auth. **Without this, the app throws at runtime in production.** | `openssl rand -base64 32` |
| `CRON_SECRET` | Bearer token for all `/api/cron/*` endpoints. Used by the GitHub Actions workflows in `.github/workflows/`. | `openssl rand -base64 32` |

### 3e. Optional vars (paste them now or fill in as features ship)

| Key | When needed |
|-----|-------------|
| `STRIPE_SECRET_KEY` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` / `STRIPE_WEBHOOK_SECRET` | for credit top-ups (section 2) |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_AUTH_TOKEN` / `SENTRY_ORG` / `SENTRY_PROJECT` | section 1 |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | section 7 below |
| `WEBHOOK_API_KEY` | optional bearer for inbound non-Stripe webhooks |
| `TRACKING_SALT` | optional salt for email tracking IP hashing — `openssl rand -hex 16` |
| `HEALTH_CHECK_SECRET` | optional bearer for `/api/health?detailed=1` per-env-var status |
| `TWILIO_ALLOW_UNSIGNED` | dev-only — set to `1` to bypass Twilio signature validation. NEVER set in production |
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog project API key. Without it, product analytics is silently off (everything still works). |
| `NEXT_PUBLIC_POSTHOG_HOST` | Usually `https://us.i.posthog.com`. Defaults to that if unset. |
| `OPERATOR_EMAILS` | Comma-separated allowlist of emails that can access `/admin/*`. Anyone else is redirected to `/dashboard`. Example: `danny@vesta.com,support@vestacrm.com`. |
| `SUPPORT_AGENT_EMAILS` | Comma-separated allowlist of emails that can redeem support-access tokens at `/support`. Same format as above. |
| `SUPPORT_GRANT_SECRET` | HMAC signing key for support-access grant tokens. App throws when creating/verifying grants in production if unset. Generate: `openssl rand -base64 32`. |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GOOGLE_GEMINI_API_KEY` / `SERPER_API_KEY` / `PAGESPEED_API_KEY` | only for single-tenant — leave empty in multi-tenant prod so each workspace BYOs |

### 3e. ✅ Verify

```bash
# Locally, mirror your Vercel env into .env.local then:
npm run preflight -- --prod

# Expected: "✓ all required vars set"
```

---

## 4. Google OAuth — production redirect URIs

⏱ **5 minutes**  💰 **Free**

🎯 **Goal:** signing in with Google + connecting Gmail + connecting Google Calendar all work on the production domain. (#1 cause of first-deploy failure.)

### 4a. Find your OAuth client

1. <https://console.cloud.google.com> → make sure the project picker (top bar) is your Vesta project
2. **APIs & Services** → **Credentials** (left nav)
3. Under **OAuth 2.0 Client IDs**, click your existing Web client
   - If none, click **+ Create Credentials** → **OAuth client ID** → **Web application**

### 4b. Add the production URIs

In the OAuth client edit page:

**Authorized JavaScript origins** (these are origins, not paths):

- `https://yourdomain.com`
- (you can also add `https://www.yourdomain.com` if you support it)

**Authorized redirect URIs** (these are full paths):

- `https://yourdomain.com/api/auth/callback/google` *(NextAuth signin)*
- `https://yourdomain.com/api/auth/gmail/callback` *(Gmail integration)*
- `https://yourdomain.com/api/auth/google-calendar/callback` *(Calendar integration)*

Click **Save** at the bottom.

> 💡 Changes propagate in ~5 minutes. If you immediately hit a `redirect_uri_mismatch` error, wait and retry.

### 4c. Confirm Client ID + Secret are in Vercel

The same OAuth client edit page shows **Client ID** and **Client secret**.
These should already be in Vercel as `GOOGLE_CLIENT_ID` /
`GOOGLE_CLIENT_SECRET` from section 3.

### 4d. ✅ Verify

1. Open `https://yourdomain.com/login` in an incognito window
2. Click "Sign in with Google"
3. Should hit Google's account picker (no `redirect_uri_mismatch` error)
4. After picking an account, should land back on `/dashboard` or `/setup`

If you get `redirect_uri_mismatch`:

- 🔧 Read the error page — Google shows the **exact** URI it tried to use. Add that one to the list. (Often it's the missing trailing slash, or `www.` vs apex.)
- 🔧 Confirm `NEXT_PUBLIC_APP_URL` in Vercel matches the URI you registered.

---

## 5. Firebase — Firestore indexes + Storage CORS

⏱ **10 minutes**  💰 **Free (Spark tier covers light usage; Blaze pay-as-you-go for production)**

🎯 **Goal:** complex queries don't 500 because of missing indexes; client-side uploads from the browser aren't blocked by CORS.

### 5a. Deploy Firestore indexes

If `firestore.indexes.json` exists in repo root:

```bash
firebase use <your-prod-project-id>
firebase deploy --only firestore:indexes
```

(Find your project ID in Firebase Console → Project settings → "Project ID".)

If `firestore.indexes.json` doesn't exist:

- You'll get errors in production the first time a query needs a composite index — Firebase returns a 400 with a link to auto-create the index in the console.
- After a week or two of usage, run the same `firebase deploy` command to capture them into source control (Firebase CLI generates the file from the live config).

### 5b. Storage CORS

Without this, every browser upload (profile photos, document attachments,
campaign images) fails silently.

1. Create a file called `cors.json` anywhere:

```json
[
  {
    "origin": ["https://yourdomain.com"],
    "method": ["GET", "POST", "PUT", "DELETE"],
    "responseHeader": ["*"],
    "maxAgeSeconds": 3600
  }
]
```

2. Apply it (replace `<bucket>` with your storage bucket name, e.g. `vesta-crm-prod.appspot.com`):

```bash
gsutil cors set cors.json gs://<bucket>
```

3. Verify:

```bash
gsutil cors get gs://<bucket>
```

You should see your config echoed back.

### 5c. (Optional) Set up daily Firestore exports

For point-in-time recovery / restore:

```bash
gcloud firestore export gs://<bucket>/firestore-backups/$(date +%Y-%m-%d)
```

Wrap this in a Cloud Scheduler job to run nightly. Or use the
[managed Firestore backups](https://firebase.google.com/docs/firestore/backups)
feature (Blaze tier only, ~$0.18/GB/month).

---

## 6. DNS — point your domain at Vercel

⏱ **5 minutes + DNS propagation (usually 5 min, max 48h)**  💰 **Free**

🎯 **Goal:** typing `yourdomain.com` in a browser loads the app.

### 6a. Add the domain in Vercel

1. Vercel → vesta-crm → **Settings** → **Domains** (left nav)
2. Enter `yourdomain.com` → **Add**
3. Vercel will show "Invalid Configuration" with the DNS records you need to add. **Copy them.**

You'll usually get one of these two setups:

**For the apex (`yourdomain.com`):**
- Type: `A`
- Name: `@` (or blank)
- Value: `76.76.21.21`

**For www (`www.yourdomain.com`):**
- Type: `CNAME`
- Name: `www`
- Value: `cname.vercel-dns.com`

### 6b. Add the records in your DNS host

**Cloudflare:**

1. Cloudflare Dashboard → your domain → **DNS** (left nav)
2. **+ Add record** for each
3. ⚠ **Disable the orange proxy cloud** (set to "DNS only") for the A record pointing to Vercel — Vercel handles TLS, not Cloudflare, and proxying breaks the auto-issue.

**Route 53:**

1. AWS Console → Route 53 → Hosted Zones → click your domain
2. **Create record** → Simple routing → Define simple record
3. Enter the values above

**GoDaddy / Namecheap / Squarespace:**

1. Domain dashboard → DNS Management
2. Add records as above. UI varies by host.

### 6c. Wait + verify

```bash
# Wait 1–5 min, then:
dig yourdomain.com +short
# Should show 76.76.21.21 (or another Vercel IP)

# Check propagation globally:
# https://dnschecker.org/#A/yourdomain.com
```

Back in Vercel → Domains, the status will flip from **Invalid Configuration** → **Valid Configuration** → **Verified** within ~10 minutes once DNS resolves.

### 6d. TLS certificate

Vercel auto-issues a Let's Encrypt cert as soon as DNS verifies.
You'll see a green ✓ on the domain. Visit `https://yourdomain.com` —
the padlock should be green.

### 🔧 Troubleshooting DNS

- **Vercel stuck on "Invalid Configuration"** → DNS not propagated yet. Wait or check with `dig`.
- **TLS doesn't issue** → 90% of the time, Cloudflare proxy is on. Turn it off.
- **`Error: too many redirects`** → Cloudflare SSL mode is "Flexible" — change to "Full (strict)" in Cloudflare → SSL/TLS.

---

## 7. Push notifications (optional — VAPID key)

⏱ **5 minutes**  💰 **Free**

🎯 **Goal:** users can opt into browser push for new lead / task due / engagement alerts. Without VAPID, the Enable button in user settings shows a yellow warning instead.

1. Firebase Console → ⚙️ → **Project settings** → **Cloud Messaging** tab
2. Scroll to **Web configuration** section
3. **Web Push certificates** → **Generate key pair** (or copy existing)
4. Copy the **Key pair** value
5. Add to Vercel:

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | the value from step 4 |

Redeploy.

### ✅ Verify

1. Open the app, log in
2. **Settings → Profile → Notifications**
3. The yellow "Push not configured" warning should be **gone**
4. Click **Enable** under Push notifications
5. Browser shows the native permission prompt → **Allow**
6. Toast: "Push notifications enabled"

---

## 8. SES (only if customers will send marketing email)

⏱ **30 minutes for the operator-side setup; customers self-serve domain verification**

Each customer adds their own SES creds via Settings → Integrations → SES.
You as the operator only need to make sure your AWS account can receive
their identities — that's covered just by having an active AWS account.

If you also want to use SES yourself for platform mail (invites,
password resets):

1. AWS Console → SES (Simple Email Service) → pick a region (usually `us-east-1`)
2. **Verified identities** → **Create identity**
3. **Domain** → enter your sender domain (e.g. `mail.yourdomain.com`)
4. AWS gives you DKIM CNAMEs → add them to DNS
5. AWS verifies (usually within minutes)
6. **Request production access** → fill out the form (out of sandbox = can send to anyone)

Alternative: just use **Resend** (already configured in `RESEND_API_KEY`)
for platform mail and skip SES for the operator side.

---

## 9. Smoke test on a fresh account

⏱ **15 minutes**  💰 **Free (use Stripe test mode)**

🎯 **Goal:** verify the cold-start signup → first deal path works end-to-end.

Open an **incognito window** (Cmd+Shift+N on Mac, Ctrl+Shift+N on Win/Linux).

- [ ] **Signup** — `https://yourdomain.com/register` with a brand-new email
- [ ] **Setup wizard** — `/setup` walks through Google Calendar, email, AI integrations. Skip what you don't need.
- [ ] **Workspace identity** — `/settings/workspace/identity` — set workspace name + save
- [ ] **Branding** — `/settings/branding` — upload a logo, pick a colour, save
- [ ] **Invite a teammate** — `/settings/team/members` → Invite → enter a second email → check that email arrives
- [ ] **Accept invite** — in a different browser, click the invite link, sign in with Google, confirm you can access the workspace
- [ ] **Create a contact** — `/contacts` → New Contact → fill name + email → save
- [ ] **Create a deal** — `/pipeline` → New → drag across stages
- [ ] **Send email** — `/communications` → Compose → send to yourself → confirm delivery
- [ ] **Connect Gmail** — `/settings/integrations/services` → Gmail → Connect → complete OAuth
- [ ] **Buy credits** — go to the credits page, buy 1k pack, use Stripe test card `4242 4242 4242 4242`, expiry any future date, CVC any 3 digits → confirm credits appear in `/settings/integrations/services`
- [ ] **Push notification** — `/settings/profile/notifications` → Enable → allow browser permission → toast confirms
- [ ] **Trigger Sentry test** — as workspace owner, visit `/api/test/error` → confirm Sentry receives it
- [ ] **Public assets** — `https://yourdomain.com/robots.txt`, `/sitemap.xml`, `/manifest.json` all resolve

---

## 10. Cron jobs (schedule when ready)

⏱ **10 min once you decide which to enable**

Active in `vercel.json` today: **only** `/api/cron/gmail-watch` (daily 06:00 UTC).

The endpoints below exist but aren't scheduled. They're gated by
`CRON_SECRET` (set in section 3) so they're safe to schedule from
Vercel cron OR from external schedulers (cron-job.org, GitHub Actions,
Cloud Scheduler). Decide which you need:

| Endpoint | Suggested cron | Free plan? |
|----------|----------------|------------|
| `/api/cron/advance-opportunities` | `0 * * * *` (hourly) | ❌ Pro needed |
| `/api/cron/stale-opportunities` | `0 9 * * *` (daily 09:00 UTC) | ✓ |
| `/api/cron/follow-up-reminders` | `*/30 * * * *` (every 30 min) | ❌ |
| `/api/cron/send-scheduled-campaigns` | `*/5 * * * *` (every 5 min) | ❌ |
| `/api/cron/send-reports` | `0 7 * * *` (daily 07:00 UTC) | ✓ |
| `/api/cron/process-automations` | `*/5 * * * *` | ❌ |
| `/api/cron/date-triggers` | `0 * * * *` (hourly) | ❌ |
| `/api/cron/ab-winner` | `0 12 * * *` | ✓ |
| `/api/cron/haro` | `0 14 * * *` | ✓ |

> Vercel Hobby plan: **2 cron jobs max**. Vercel Pro: **40**. If you're on Hobby, use cron-job.org (free) for the rest — just have it POST to your cron endpoints with `Authorization: Bearer <CRON_SECRET>`.

To add a cron to Vercel, edit `vercel.json`:

```json
{
  "crons": [
    { "path": "/api/cron/gmail-watch", "schedule": "0 6 * * *" },
    { "path": "/api/cron/send-scheduled-campaigns", "schedule": "*/5 * * * *" }
  ]
}
```

Commit, push, redeploy. Vercel registers the new schedule on deploy.

---

## 11. Final pre-flip checklist

Before you point DNS at Vercel and tell anyone the URL:

- [ ] `npm run preflight -- --prod` → zero red items
- [ ] Production build deploys clean (Vercel → Deployments → latest = "Ready")
- [ ] All Stripe webhook events show `200` in Recent events
- [ ] `/api/test/error` triggers a Sentry issue
- [ ] OAuth login works in an incognito window on the production domain
- [ ] Firebase indexes deployed
- [ ] Storage CORS configured
- [ ] DNS A + CNAME records are live, TLS cert issued (green padlock)
- [ ] `robots.txt` and `sitemap.xml` resolve
- [ ] Smoke test (section 9) passed end-to-end
- [ ] Daily Firestore export configured (or you've accepted the risk)

If all green, you're live.

---

## 12. First 48 hours — what to watch

Dashboards to keep open:

- **Sentry → Issues** — any unexpected errors. Tag, triage, fix.
- **Vercel → Functions → Invocations** — 4xx/5xx rate per route. Spikes = broken auth, broken webhooks, or a hot bug.
- **Stripe → Webhooks → endpoint → Recent events** — every event should be `200`. Stripe auto-retries failures, but a >5% failure rate means a real bug.
- **Firebase Console → Firestore → Usage** — read/write spikes. A new feature with a bad query can 10x your bill overnight.
- **Vercel → Analytics** (if enabled) — traffic, latency, top routes.

---

## 13. 2 AM playbook

| Symptom | First place to look |
|---------|---------------------|
| Whole site 500ing | Vercel → Deployments → latest → **Logs** |
| Auth broken / "redirect_uri_mismatch" | Section 4 — did the domain change? |
| Database errors | <https://status.firebase.google.com> |
| Email not sending | SES sandbox status? Resend dashboard? |
| Stripe events failing | Stripe → Webhooks → endpoint → **Recent events** |
| Push not working | `NEXT_PUBLIC_FIREBASE_VAPID_KEY` set? Settings UI shows it. |
| Slow queries | Firebase Console → Firestore → Indexes — missing one? |

### Rollback in 30 seconds

1. Vercel Dashboard → Deployments
2. Find the last "Ready" deployment before the broken one
3. **⋯ menu → Promote to Production** → confirm

Done. Database changes don't auto-revert — if a migration broke
things, you'll need to restore manually from a Firestore export.

---

## 14. After launch — keep this doc honest

When something surprises you in production, add a section here. The
next-you (or the next teammate) shouldn't have to relearn what you
just learned at 2 AM.

[DEPLOY.md](./DEPLOY.md) is the permanent reference (how things are
architected). **This** file is the live runbook (what to do when things
go wrong). They diverge over time and that's fine.
