# Vesta CRM

A multi-tenant SaaS CRM built on Next.js 15 (App Router) and Firebase Firestore.
Pipeline / contacts / tasks / calendar / email + SMS marketing / automations /
documents + e-sign / analytics — all behind workspace-scoped data isolation,
RBAC, and BYO API keys for AI providers (Anthropic / OpenAI / Gemini).

## Stack

- **Framework**: Next.js 15 (App Router, Server Actions, RSC) + React 19
- **Auth**: NextAuth v5 with Google OAuth
- **Database**: Firebase Firestore (admin SDK server-side, web SDK client-side)
- **Storage**: Firebase Cloud Storage
- **Email**: Amazon SES (primary), Resend (fallback for system mail), Gmail OAuth (per-user)
- **SMS**: Twilio
- **Social**: Zernio (multi-platform scheduler)
- **Calendar**: Google Calendar OAuth + ICS feed
- **Payments**: Stripe Checkout (one-time credit top-ups, not subscriptions)
- **AI**: Anthropic Claude (primary), OpenAI, Google Gemini — BYO keys per workspace
- **Push**: Firebase Cloud Messaging
- **Errors**: Sentry (optional; falls back to console)

## Local development

```bash
npm install
cp .env.example .env.local   # then fill in REQUIRED values
npm run dev
```

The app boots at <http://localhost:3000>.

### Minimum env vars to boot

- `NEXTAUTH_SECRET` / `AUTH_SECRET` — generate with `openssl rand -base64 32`
- `NEXT_PUBLIC_APP_URL` — `http://localhost:3000` for dev
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — for sign-in
- All `FIREBASE_*` vars — for the database
- `RESEND_API_KEY` / `RESEND_FROM_EMAIL` — for transactional mail (or skip if you don't need email yet)

Everything else is optional. See [.env.example](./.env.example) for the full list with comments.

### Useful scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | Local dev server with HMR |
| `npm run build` | Production build (also runs typecheck) |
| `npm start` | Serve a built app |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit tests |
| `npm run test:e2e` | Playwright end-to-end |
| `npm run analyze` | Bundle size analyzer (`ANALYZE=true npm run build`) |

## Architecture notes

### Multi-tenancy

Every server action and API route uses `tenantDb(workspaceId)` from
[src/lib/tenant-db.ts](./src/lib/tenant-db.ts) instead of `adminDb` directly.
The helper auto-injects `workspaceId` on writes and filters on reads so
tenant data can't leak across workspaces. Direct `adminDb` use is allowed
only in:

- `src/lib/firebase-admin.ts` (re-export)
- `src/auth.ts` (global user lookup)
- `src/app/register/actions.ts` (workspace creation)
- migration scripts under `/scripts`

### Settings layout

Settings is structured as five top-level areas (Profile, Workspace, Team,
Integrations, Data) — each is a layout + sub-routes pattern with a sidebar
nav, not a single tabbed page. See [src/app/settings/SettingsSubPageLayout.tsx](./src/app/settings/SettingsSubPageLayout.tsx).

### Cron jobs

Cron entrypoints live under `src/app/api/cron/` and are gated by
`CRON_SECRET`. The active schedule is in [vercel.json](./vercel.json) — only
`gmail-watch` is currently scheduled there; the others are invoked manually
or via external schedulers.

### Billing model

Vesta is **not** a subscription SaaS. It uses one-time Stripe Checkout
purchases for prepaid email/SMS/AI credits (see
[src/lib/billing/credit-topups.ts](./src/lib/billing/credit-topups.ts)).
Refunds and chargebacks revoke credits idempotently via the webhook handler.

## Deployment

See [DEPLOY.md](./DEPLOY.md) for production setup: Vercel project config,
required env vars, Stripe webhook configuration, DNS records for SES,
Firebase indexes, and the launch checklist.
