# Deployment runbook

Production target: **Vercel + Firebase + Cloudflare** (DNS).
Read this top-to-bottom before the first deploy. After that, the launch
checklist at the end is the day-of script.

## 1. Vercel project

- Import the repo, framework preset `Next.js`.
- Build command: default (`next build --webpack` is in package.json, but
  Vercel auto-detects).
- Install command: default (`npm install`).
- Root directory: project root.

### Environment variables

Set in **Project Settings → Environment Variables** for `Production` and
`Preview` (use different Firebase projects for each if you can — see [.env.example](./.env.example) for the full list with comments).

**Required to boot:**

- `NEXTAUTH_SECRET`, `AUTH_SECRET` — same value, `openssl rand -base64 32`
- `NEXT_PUBLIC_APP_URL` — your production URL (no trailing slash)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — see Google OAuth setup below
- `NEXT_PUBLIC_FIREBASE_*` — from Firebase Console → Project Settings → General
- `FIREBASE_SERVICE_ACCOUNT_KEY` — paste the entire service account JSON as one line
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`,
  `FIREBASE_STORAGE_BUCKET`, `FIREBASE_DATABASE_ID`
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL` — for transactional (password reset, invites, etc.)

**Strongly recommended:**

- `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` — both set to the same DSN string
- `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` — only needed at build time for source-map upload
- `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` — without these, the credit top-up flow is disabled
- `NEXT_PUBLIC_FIREBASE_VAPID_KEY` — without it, push notifications are silently disabled and a warning shows in user settings
- `CRON_SECRET` — required to gate cron endpoints; generate with `openssl rand -base64 32`

**Optional fallbacks (for single-tenant deploys):**

- `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_GEMINI_API_KEY`, `SERPER_API_KEY`, `PAGESPEED_API_KEY` — leave empty in multi-tenant prod so each workspace pays for its own usage.

## 2. Google OAuth

1. <https://console.cloud.google.com/apis/credentials>
2. Create OAuth client (web app)
3. Authorized JavaScript origins: `https://yourdomain.com`
4. Authorized redirect URIs:
   - `https://yourdomain.com/api/auth/callback/google` (NextAuth)
   - `https://yourdomain.com/api/auth/gmail/callback` (Gmail integration)
   - `https://yourdomain.com/api/auth/google-calendar/callback`
5. Copy client ID + secret into Vercel env.

## 3. Firebase

- Create a project + enable **Firestore (Native mode)** + **Cloud Storage**.
- Copy web config into `NEXT_PUBLIC_FIREBASE_*`.
- Service account: IAM → Service Accounts → create → download JSON → paste into `FIREBASE_SERVICE_ACCOUNT_KEY`.
- **Indexes**: deploy from `firestore.indexes.json` (in repo root if present) via the Firebase CLI:
  ```bash
  firebase deploy --only firestore:indexes
  ```

### Storage CORS (for client uploads)

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

Apply with `gsutil cors set cors.json gs://your-bucket`.

## 4. Stripe

1. Dashboard → Developers → API keys → copy live secret + publishable.
2. Dashboard → Developers → Webhooks → Add endpoint:
   - URL: `https://yourdomain.com/api/webhooks/stripe`
   - Events to send:
     - `checkout.session.completed`
     - `charge.refunded`
     - `charge.dispute.created`
     - `charge.dispute.closed`
3. Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.

If you skip Stripe entirely, the credit top-up UI hides itself and the rest
of the app works.

## 5. Email — Amazon SES

Each customer adds their own SES via Settings → Integrations → SES. As the
operator, you don't need a global SES setup.

Per-customer setup (the in-app walkthrough handles this):

1. AWS region selection (typically `us-east-1`)
2. Add domain identity
3. Vesta surfaces the **3 DKIM CNAME records + SPF TXT + DMARC TXT** to add to DNS
4. AWS verifies → status flips to `VERIFIED`
5. Customer requests SES production access (graduates from sandbox)

If you want a single transactional sender for the platform itself (invites,
password resets), use **Resend** — set `RESEND_API_KEY` + `RESEND_FROM_EMAIL`.

## 6. Cron jobs

Active in [vercel.json](./vercel.json):

- `/api/cron/gmail-watch` — daily at 06:00 UTC (refreshes Gmail webhook subscriptions)

Other cron endpoints exist (`advance-opportunities`, `stale-opportunities`,
`follow-up-reminders`, `send-scheduled-campaigns`, `send-reports`, `haro`,
`process-automations`, `ab-winner`, `date-triggers`) but aren't currently
scheduled. Add to `vercel.json` or invoke via external scheduler when ready.

All cron endpoints check `Authorization: Bearer ${CRON_SECRET}`.

## 7. DNS

For the production domain:

- `A` / `AAAA` record → Vercel's IPs (Vercel auto-issues TLS)
- Or `CNAME` → `cname.vercel-dns.com`

For each customer's email-sending domain (entered in their workspace):

- See section 5 — they add DKIM + SPF + DMARC themselves via the in-app walkthrough.

## 8. Sentry

If using Sentry:

1. Create a project at <https://sentry.io>
2. Copy DSN into both `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN`
3. For source-map uploads (recommended): create an **internal integration** with project:write scope, copy the auth token into `SENTRY_AUTH_TOKEN`, and set `SENTRY_ORG` + `SENTRY_PROJECT`.
4. Sentry events tunnel through `/monitoring` so ad-blockers don't drop them.

## 9. Launch-day checklist

Day-of, in this order:

- [ ] All required env vars set in Vercel for `Production`
- [ ] Custom domain attached + TLS issued
- [ ] Google OAuth redirect URIs include the production URL
- [ ] Firebase indexes deployed
- [ ] Storage CORS configured
- [ ] Stripe webhook registered with all four event types
- [ ] Sentry DSN populated; trigger a test error to verify ingestion
- [ ] `robots.txt` resolves at `/robots.txt`
- [ ] `sitemap.xml` resolves at `/sitemap.xml`
- [ ] `manifest.json` resolves and the install banner triggers on mobile
- [ ] Manual smoke: signup → create workspace → invite teammate → create contact → create deal → send test email → connect Gmail → all work
- [ ] Test Stripe checkout on a credit pack with a real test card
- [ ] Verify cron secret rejects requests without auth header

## 10. Rollback

Vercel keeps every deployment. To roll back:

1. Vercel Dashboard → Deployments → find the last good deploy
2. Click `...` → **Promote to Production**

Database changes don't roll back automatically. If you shipped a migration
that broke things, you'll need to either revert the migration manually or
restore from a Firestore export.

### Daily Firestore export (recommended)

Set up a scheduled export to GCS via `gcloud firestore export`. Keep 30 days
of history. Restore with `gcloud firestore import`.

## 11. Who to call when it breaks

- **App down** — check Vercel deployment status, then Sentry for crashes
- **Database issues** — Firebase status: <https://status.firebase.google.com>
- **Email not sending** — check SES sandbox status; check Resend dashboard
- **Stripe issues** — check webhook delivery log in Stripe Dashboard → Webhooks
- **OAuth broken** — Google Cloud Console → Credentials → check redirect URIs match

Keep this doc current. When something surprises you in production, add a
note here so the next person doesn't hit the same wall.
