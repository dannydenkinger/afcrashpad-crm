# Vesta CRM — Setup Guide

Everything you need to go from zero to a fully operational CRM. Follow each step in order.

---

## Prerequisites

Before you begin, make sure you have:

- **Node.js 20+** — Download from https://nodejs.org
- **npm** — Comes with Node.js
- **Git** — Download from https://git-scm.com
- **A Google account** — Used for Firebase, OAuth, and Calendar integration
- **A credit card** — Required by Firebase (free tier covers most usage, you won't be charged unless you exceed it)

---

## Step 1: Clone & Install

```bash
git clone <your-repo-url> vesta-crm
cd vesta-crm
npm install
cp .env.example .env.local
```

Open `.env.local` in your editor. You'll fill in values throughout this guide.

---

## Step 2: Firebase Setup

Firebase is your database, file storage, and push notification backend.

### 2a. Create a Firebase Project

1. Go to https://console.firebase.google.com
2. Click **Add project**
3. Enter a project name (e.g., "MyCompany CRM")
4. Disable Google Analytics (or enable if you want it — not required)
5. Click **Create project**

### 2b. Enable Firestore Database

1. In the Firebase console, click **Build → Firestore Database** in the left sidebar
2. Click **Create database**
3. Select **Start in production mode**
4. Choose a region close to your users (e.g., `us-central1` for US, `europe-west1` for EU)
5. Click **Enable**
6. Note your **database ID** — it's usually `(default)`. If you created a named database, use that name.

Set in `.env.local`:
```
FIREBASE_DATABASE_ID=(default)
```

### 2c. Set Firestore Security Rules

In the Firebase console, go to **Firestore Database → Rules** and replace the contents with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

Click **Publish**. This blocks all client-side access — Vesta CRM uses server-side Firebase Admin SDK, which bypasses these rules. This is the most secure configuration.

### 2d. Enable Authentication

1. Click **Build → Authentication** in the left sidebar
2. Click **Get started**
3. Click the **Sign-in method** tab
4. Click **Google** → Enable it → Set a support email → Click **Save**

### 2e. Enable Cloud Storage

1. Click **Build → Storage** in the left sidebar
2. Click **Get started**
3. Accept the default rules for now → Click **Next**
4. Choose the same region as your Firestore database → Click **Done**

Set in `.env.local`:
```
FIREBASE_STORAGE_BUCKET=your-project-id.firebasestorage.app
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.firebasestorage.app
```

### 2f. Set Storage Security Rules

In the Firebase console, go to **Storage → Rules** and replace the contents with:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

Click **Publish**. This allows authenticated users to upload files and anyone to read them (needed for logos, documents, etc.).

### 2g. Enable Cloud Messaging (Push Notifications)

1. Click the **gear icon** (top left) → **Project settings**
2. Click the **Cloud Messaging** tab
3. Under **Web Push certificates**, click **Generate key pair**
4. Copy the key pair value

Set in `.env.local`:
```
NEXT_PUBLIC_FIREBASE_VAPID_KEY=your-vapid-key-here
```

### 2h. Get Your Web App Config

1. In Project settings → **General** tab, scroll to **Your apps**
2. Click the **Web** icon (`</>`) to create a web app
3. Enter a nickname (e.g., "Vesta CRM Web")
4. Click **Register app**
5. You'll see a config object — copy each value

Set in `.env.local`:
```
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

### 2i. Download Service Account Key

1. In Project settings → **Service accounts** tab
2. Click **Generate new private key** → **Generate key**
3. A JSON file downloads. Open it in a text editor.

Set in `.env.local` using values from the JSON:
```
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"
```

**Important:** The `FIREBASE_PRIVATE_KEY` must be wrapped in double quotes and have literal `\n` characters (not actual newlines).

You can also set `FIREBASE_SERVICE_ACCOUNT_KEY` to the entire JSON string if preferred (not required — the individual fields above are sufficient).

---

## Step 3: Google OAuth Setup

Google OAuth handles user login and provides access to Gmail and Calendar.

### 3a. Create OAuth Credentials

1. Go to https://console.cloud.google.com
2. Select your Firebase project (it's the same Google Cloud project)
3. In the left sidebar: **APIs & Services → Credentials**
4. Click **+ Create Credentials → OAuth 2.0 Client ID**
5. Select **Web application**
6. Name it (e.g., "Vesta CRM")
7. Under **Authorized redirect URIs**, add:
   - `http://localhost:3000/api/auth/callback/google` (for local development)
   - `https://your-production-domain.com/api/auth/callback/google` (add later when you deploy)
8. Click **Create**

Set in `.env.local`:
```
GOOGLE_CLIENT_ID=123456789-xxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxx
```

### 3b. Enable Required APIs

In the Google Cloud Console:

1. Go to **APIs & Services → Library**
2. Search for and enable each of these:
   - **Gmail API** — Required for email features
   - **Google Calendar API** — Required for calendar integration
   - **Google Analytics Data API** — Only if using the marketing analytics module

### 3c. Configure OAuth Consent Screen

1. Go to **APIs & Services → OAuth consent screen**
2. Select **External** → Click **Create**
3. Fill in:
   - **App name:** Your company name
   - **User support email:** Your email
   - **Developer contact:** Your email
4. Click **Save and Continue**
5. On the Scopes page, click **Add or Remove Scopes** and add:
   - `openid`
   - `email`
   - `profile`
   - `https://www.googleapis.com/auth/gmail.readonly`
6. Click **Save and Continue**
7. On the Test users page, add the email addresses of anyone who will use the CRM during development
8. Click **Save and Continue**

**Note:** While in "Testing" mode, only added test users can sign in. To allow anyone to sign in, you'll need to **Publish** the app (requires Google verification for the Gmail scope — this can take a few days).

---

## Step 4: Email Setup (Resend)

Resend handles all outbound email (notifications, sequences, tracked emails).

1. Go to https://resend.com and create an account
2. **Verify your sending domain:**
   - Go to **Domains** → **Add Domain**
   - Add the domain you want to send from (e.g., `yourdomain.com`)
   - Add the DNS records Resend provides (SPF, DKIM, DMARC)
   - Wait for verification (usually 5-15 minutes)
3. **Create an API key:**
   - Go to **API Keys** → **Create API Key**
   - Name it (e.g., "Vesta CRM")
   - Select **Full access**
   - Copy the key immediately (you won't see it again)

Set in `.env.local`:
```
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=CRM Notifications <noreply@yourdomain.com>
```

**Tip:** For development, you can use Resend's test domain (sends only to your account email) before verifying your own domain.

---

## Step 5: Generate Secrets

Run these commands in your terminal to generate random secrets:

```bash
openssl rand -base64 32
```

Run it twice — use the first output for `NEXTAUTH_SECRET` and the second for `AUTH_SECRET`.

Set in `.env.local`:
```
NEXTAUTH_SECRET=your-first-random-string
AUTH_SECRET=your-second-random-string
NEXT_PUBLIC_APP_URL=http://localhost:3000
OWNER_EMAIL=your-google-email@gmail.com
```

**Important:** `OWNER_EMAIL` must match the Google account you'll use to sign in for the first time. This account becomes the system Owner with full admin privileges.

---

## Step 6: Seed the Database

The seed script creates your initial pipeline, stages, contact statuses, and owner user account.

```bash
npx tsx seed-firebase.ts
```

You should see output like:
```
Seeding Firebase database...
1. Checking for existing pipelines...
   Creating default Sales Pipeline...
   Created pipeline with 7 stages.
2. Checking for contact statuses...
   Created 5 default statuses.
3. Checking for owner user (your-email@gmail.com)...
   Created owner user.

Seeding complete! You can now start the app with: npm run dev
```

**What this creates:**
- **Sales Pipeline** with stages: New Lead → Contacted → Qualified → Proposal Sent → Negotiation → Closed Won / Closed Lost
- **Contact statuses:** Lead, Prospect, Active, Customer, Inactive
- **Owner user** with your email and OWNER role

You can customize all of these later in Settings.

---

## Step 7: Deploy Firestore Indexes

Firestore requires composite indexes for multi-field queries. Without them, some features will fail.

```bash
# Install Firebase CLI (if you don't have it)
npm install -g firebase-tools

# Log in to Firebase
firebase login

# Initialize Firebase in this project (select Firestore only)
firebase init firestore
```

When prompted:
- **Select your Firebase project** from the list
- **Firestore Rules file:** Press Enter to skip (we set rules in the console)
- **Firestore indexes file:** Type `firestore.indexes.json` and press Enter

Then deploy the indexes:

```bash
firebase deploy --only firestore:indexes
```

This takes 1-5 minutes. You can check progress in the Firebase console under **Firestore → Indexes**.

---

## Step 8: Start Development

```bash
npm run dev
```

1. Open http://localhost:3000
2. Click **Sign in with Google**
3. Sign in with the email you set as `OWNER_EMAIL`
4. You should land on the Pipeline page

### Verify Your Setup

Open http://localhost:3000/api/health in your browser. You should see:

```json
{
  "healthy": true,
  "checks": {
    "NEXTAUTH_SECRET": { "status": "ok" },
    "GOOGLE_CLIENT_ID": { "status": "ok" },
    "GOOGLE_CLIENT_SECRET": { "status": "ok" },
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID": { "status": "ok" },
    "FIREBASE_PROJECT_ID": { "status": "ok" },
    "FIREBASE_PRIVATE_KEY": { "status": "ok" },
    "RESEND_API_KEY": { "status": "ok" },
    "RESEND_FROM_EMAIL": { "status": "ok" },
    "firebase_connection": { "status": "ok" }
  }
}
```

If any check shows `"missing"` or `"error"`, go back and fix that environment variable.

---

## Step 9: Configure Your CRM

Now that the app is running, customize it for your business.

### Branding

1. Go to **Settings** (gear icon in sidebar)
2. Under **My Profile**, scroll to the **Branding** section
3. Set your **Company Name** — this appears throughout the app
4. Upload your **Logo** — displayed in the sidebar and emails
5. Pick a **Primary Color** — used for buttons and accents

### System Properties

1. Go to **Settings → Workspace** tab
2. Under **System Properties**, customize:
   - **Lead Sources** — Where your leads come from (e.g., "Website", "Referral", "Cold Call")
   - **Tags** — Labels for categorizing contacts and deals (e.g., "VIP", "Hot Lead")
   - **Contact Statuses** — Lifecycle stages for contacts (default: Lead, Prospect, Active, Customer, Inactive)

### Pipeline Stages

1. Still in **Settings → Workspace**, find **Pipeline & Priority Settings**
2. Edit your pipeline stages to match your sales process
3. Adjust priority labels if needed

### Custom Fields

1. Go to **Settings → Custom Fields** tab
2. Add any fields specific to your business (e.g., "Company Size", "Industry", "Budget")
3. These appear on contact and deal forms automatically

### Integrations

1. Go to **Settings → Integrations** tab
2. **Google Calendar** — Click "Connect" to sync your calendar
3. **iCal Feed** — Copy the feed URL to subscribe from any calendar app

---

## Step 10: Deploy to Production

### Option A: Vercel (Recommended)

1. Push your code to a GitHub repository
2. Go to https://vercel.com and sign in with GitHub
3. Click **Add New → Project**
4. Import your repository
5. In **Environment Variables**, add every variable from your `.env.local`
6. Click **Deploy**

After deployment:
- Update `NEXT_PUBLIC_APP_URL` to your Vercel domain (e.g., `https://crm.yourdomain.com`)
- Add your production redirect URI to Google OAuth: `https://crm.yourdomain.com/api/auth/callback/google`

### Option B: Netlify

1. Push your code to a GitHub repository
2. Go to https://netlify.com and sign in
3. Click **Add new site → Import an existing project**
4. Select your repository
5. Build settings are auto-detected from `netlify.toml`
6. In **Site configuration → Environment variables**, add every variable from your `.env.local`
7. Click **Deploy site**

After deployment:
- Update `NEXT_PUBLIC_APP_URL` to your Netlify domain
- Add your production redirect URI to Google OAuth

### Custom Domain

Both Vercel and Netlify support custom domains:
1. Add your domain in the hosting dashboard
2. Update DNS records as instructed
3. Update `NEXT_PUBLIC_APP_URL` to your custom domain
4. Update Google OAuth redirect URIs

---

## Step 11: Invite Your Team

1. Share your production URL with team members
2. They sign in with their Google account
3. New users automatically get the **Agent** role
4. To promote someone: Go to **Settings → Users** (Owner only) → Change their role

### Roles Explained

| Role | Can do |
|------|--------|
| **Owner** | Everything. Manage users, delete data, access all settings. Only one per instance. |
| **Admin** | Manage deals, contacts, settings (except user management). Can access Finance and Marketing modules. |
| **Agent** | Manage their own deals and contacts. View dashboard. Cannot access Finance, Marketing, or admin settings. |

---

## Optional: Feature Flags

All optional modules are **enabled by default**. To disable a module, add the corresponding variable to your environment and set it to `false`.

| Module | Env Variable | What It Controls |
|--------|-------------|-----------------|
| Marketing | `NEXT_PUBLIC_FEATURE_MARKETING=false` | Blog CMS, SEO tools, HARO, analytics dashboard |
| Finance | `NEXT_PUBLIC_FEATURE_FINANCE=false` | Commissions, referrals, leaderboards |
| Documents | `NEXT_PUBLIC_FEATURE_DOCUMENTS=false` | Document management, e-signatures |
| Email Sequences | `NEXT_PUBLIC_FEATURE_EMAIL_SEQUENCES=false` | Automated multi-step email campaigns |
| Calendar | `NEXT_PUBLIC_FEATURE_CALENDAR=false` | Google Calendar sync, iCal feed |
| Push Notifications | `NEXT_PUBLIC_FEATURE_PUSH=false` | Browser push notifications |

Disabled modules are hidden from the sidebar and inaccessible.

---

## Optional: Marketing Module

The marketing module adds AI-powered content creation, SEO tools, and publishing integrations. Enable by keeping `NEXT_PUBLIC_FEATURE_MARKETING` unset (or not `false`).

### AI Blog Generation (Anthropic)

1. Go to https://console.anthropic.com
2. Create an account and get an API key
3. Set `ANTHROPIC_API_KEY=sk-ant-xxxxxxx`
4. Used for: AI-generated blog articles with SEO optimization

### AI Image Generation (Google Gemini)

1. Go to https://aistudio.google.com/apikey
2. Create an API key
3. Set `GOOGLE_GEMINI_API_KEY=xxxxxxx`
4. Used for: AI-generated featured images for blog posts

### Keyword Research (Serper)

1. Go to https://serper.dev
2. Create an account and get an API key
3. Set `SERPER_API_KEY=xxxxxxx`
4. Used for: SEO keyword research and SERP analysis

### WordPress Publishing

To publish blog posts directly to WordPress:

1. In your WordPress admin, go to **Users → Profile → Application Passwords**
2. Enter a name (e.g., "Vesta CRM") and click **Add New Application Password**
3. Copy the generated password

Set in your environment:
```
WORDPRESS_URL=https://yourblog.com
WORDPRESS_USERNAME=your-wp-username
WORDPRESS_APP_PASSWORD=xxxx xxxx xxxx xxxx
```

### Google Search Console

1. Set `GSC_SITE_URL=https://yourdomain.com` (must match your verified GSC property)
2. The marketing dashboard uses the same service account credentials as Firebase for API access

---

## Optional: Push Notifications

Push notifications alert users of new leads, deal changes, and task reminders.

1. In Firebase Console → **Project settings → Cloud Messaging**
2. Under **Web Push certificates**, copy the key pair (you may have done this in Step 2g)
3. Set `NEXT_PUBLIC_FIREBASE_VAPID_KEY=your-key`
4. Users will be prompted to allow notifications on first login

---

## Troubleshooting

### "Firebase connection" shows "error" in health check

- Verify `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` are correct
- Make sure `FIREBASE_PRIVATE_KEY` is wrapped in double quotes with `\n` literal characters
- Check that `FIREBASE_DATABASE_ID` matches your Firestore database (usually `(default)`)

### Google sign-in shows "Error 400: redirect_uri_mismatch"

- Your redirect URI doesn't match what's configured in Google Cloud Console
- Go to **APIs & Services → Credentials → Your OAuth Client**
- Add the exact URI: `https://your-domain.com/api/auth/callback/google`
- Make sure there's no trailing slash

### Google sign-in shows "Access blocked: This app's request is invalid"

- Your OAuth consent screen may not be configured
- Go to **APIs & Services → OAuth consent screen** and complete all required fields

### "Access Not Configured" or "API not enabled"

- Go to **APIs & Services → Library** and enable the required API (Gmail API, Calendar API, etc.)

### Emails not sending

- Verify your Resend API key is correct
- Check that your sending domain is verified in Resend
- Make sure `RESEND_FROM_EMAIL` uses a verified domain (e.g., `noreply@yourdomain.com`)

### Firestore query errors / "FAILED_PRECONDITION"

- You need to deploy the composite indexes: `firebase deploy --only firestore:indexes`
- Wait a few minutes for indexes to build (check progress in Firebase Console → Firestore → Indexes)

### Build fails with "out of memory"

- The build command already includes `--max-old-space-size=4096`
- If it still fails, increase it in `package.json` or your hosting environment variables

### Users can sign in but have no access

- New users default to the "Agent" role
- The Owner must promote them via **Settings → Users**
- If the Owner account wasn't created by the seed script, manually add a document to the `users` collection in Firestore with `role: "OWNER"` and the correct email

---

## Environment Variable Reference

Complete list of every environment variable. Required variables are marked with *.

### Core (Required)

| Variable | Description | Where to Get It |
|----------|-------------|-----------------|
| `NEXTAUTH_SECRET` * | Session encryption secret | Run `openssl rand -base64 32` |
| `AUTH_SECRET` * | Alternative session secret | Run `openssl rand -base64 32` |
| `NEXT_PUBLIC_APP_URL` * | Your app URL | `http://localhost:3000` for dev, your domain for production |

### Authentication (Required)

| Variable | Description | Where to Get It |
|----------|-------------|-----------------|
| `GOOGLE_CLIENT_ID` * | OAuth client ID | Google Cloud Console → Credentials |
| `GOOGLE_CLIENT_SECRET` * | OAuth client secret | Google Cloud Console → Credentials |

### Firebase Client (Required)

| Variable | Description | Where to Get It |
|----------|-------------|-----------------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` * | Firebase API key | Firebase Console → Project Settings → Your Apps |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` * | Firebase auth domain | Same as above |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` * | Firebase project ID | Same as above |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` * | Storage bucket | Same as above |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` * | FCM sender ID | Same as above |
| `NEXT_PUBLIC_FIREBASE_APP_ID` * | Firebase app ID | Same as above |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | GA measurement ID | Same as above (optional) |

### Firebase Admin (Required)

| Variable | Description | Where to Get It |
|----------|-------------|-----------------|
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Full service account JSON | Firebase Console → Service Accounts → Generate Key |
| `FIREBASE_PROJECT_ID` * | Project ID | From service account JSON |
| `FIREBASE_CLIENT_EMAIL` * | Service account email | From service account JSON |
| `FIREBASE_PRIVATE_KEY` * | Private key (in quotes) | From service account JSON |
| `FIREBASE_STORAGE_BUCKET` * | Storage bucket name | Firebase Console → Storage |
| `FIREBASE_DATABASE_ID` * | Firestore database ID | Usually `(default)` |

### Email (Required)

| Variable | Description | Where to Get It |
|----------|-------------|-----------------|
| `RESEND_API_KEY` * | Resend API key | https://resend.com → API Keys |
| `RESEND_FROM_EMAIL` * | Verified sender email | Must match a verified domain in Resend |

### Feature Flags (Optional)

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_FEATURE_MARKETING` | `true` | Marketing module (blog, SEO, HARO) |
| `NEXT_PUBLIC_FEATURE_FINANCE` | `true` | Finance module (commissions, referrals) |
| `NEXT_PUBLIC_FEATURE_DOCUMENTS` | `true` | Document management & e-signatures |
| `NEXT_PUBLIC_FEATURE_EMAIL_SEQUENCES` | `true` | Automated email sequences |
| `NEXT_PUBLIC_FEATURE_CALENDAR` | `true` | Google Calendar integration |
| `NEXT_PUBLIC_FEATURE_PUSH` | `true` | Push notifications |

### Push Notifications (Optional)

| Variable | Description | Where to Get It |
|----------|-------------|-----------------|
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | Web push VAPID key | Firebase Console → Cloud Messaging |

### Google Analytics (Optional)

| Variable | Description | Where to Get It |
|----------|-------------|-----------------|
| `NEXT_PUBLIC_GA_ID` | GA4 measurement ID | Google Analytics → Admin → Data Streams |
| `GA_PROPERTY_ID` | GA4 property ID | Google Analytics → Admin → Property Settings |
| `GA_CLIENT_EMAIL` | Service account email | Falls back to `FIREBASE_CLIENT_EMAIL` |
| `GA_PRIVATE_KEY` | Service account key | Falls back to `FIREBASE_PRIVATE_KEY` |

### Marketing Module (Optional)

| Variable | Description | Where to Get It |
|----------|-------------|-----------------|
| `ANTHROPIC_API_KEY` | Claude API key | https://console.anthropic.com |
| `GOOGLE_GEMINI_API_KEY` | Gemini API key | https://aistudio.google.com/apikey |
| `SERPER_API_KEY` | SERP research API key | https://serper.dev |
| `WORDPRESS_URL` | WordPress site URL | Your WordPress installation |
| `WORDPRESS_USERNAME` | WordPress username | WordPress admin panel |
| `WORDPRESS_APP_PASSWORD` | WordPress app password | WordPress → Users → Application Passwords |
| `GSC_SITE_URL` | Search Console site URL | Google Search Console |
| `NEXT_PUBLIC_SITE_DOMAIN` | Your website domain | e.g., `yourdomain.com` |
| `NEXT_PUBLIC_SITE_URL` | Your website full URL | e.g., `https://yourdomain.com` |

### Security (Optional)

| Variable | Description | Where to Get It |
|----------|-------------|-----------------|
| `CRON_SECRET` | Secret for cron job endpoints | Run `openssl rand -base64 32` |
| `WEBHOOK_API_KEY` | Bearer token for webhooks | Run `openssl rand -base64 32` |
| `TRACKING_SALT` | Salt for email tracking hashing | Run `openssl rand -base64 32` |

### Setup

| Variable | Description | Where to Get It |
|----------|-------------|-----------------|
| `OWNER_EMAIL` | Initial owner account email | Your Google account email |
