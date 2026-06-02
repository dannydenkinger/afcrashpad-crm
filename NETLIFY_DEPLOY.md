# Deploy Vesta CRM to Netlify

## 1. Push to Git

Ensure your code is committed and pushed to GitHub, GitLab, or Bitbucket:

```bash
git add .
git commit -m "Add Netlify config"
git push
```

## 2. Connect to Netlify

1. Go to [app.netlify.com](https://app.netlify.com)
2. Click **Add new site** → **Import an existing project**
3. Choose your Git provider and select the `Vesta CRM` repo
4. Netlify will auto-detect Next.js – leave **Build command** as `npm run build` and **Publish directory** empty (handled automatically)

## 3. Environment variables

In **Site settings** → **Environment variables**, add:

| Variable | Notes |
|----------|--------|
| `AUTH_SECRET` | Same value as in `.env` |
| `NEXTAUTH_SECRET` | Same value as in `.env` |
| `GOOGLE_CLIENT_ID` | Your Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Your Google OAuth client secret |
| `AUTH_URL` | **Required:** Your Netlify URL, e.g. `https://your-site-name.netlify.app` (NextAuth v5 uses this) |
| `NEXT_PUBLIC_FIREBASE_*` | All 7 Firebase public vars from `.env` |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Full JSON string (use Netlify’s “Insert variable” → “Load from .env” or paste) |
| `FIREBASE_PROJECT_ID` | Your Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | Firebase admin client email |
| `FIREBASE_PRIVATE_KEY` | Firebase admin private key (keep newlines as `\n`) |
| `FIREBASE_DATABASE_ID` | Your Firestore database ID |
| `WEBHOOK_API_KEY` | Webhook auth key |
| `NEXT_PUBLIC_GA_ID`, `GA_PROPERTY_ID`, `GA_CLIENT_EMAIL`, `GA_PRIVATE_KEY` | If using analytics |

## 4. Update Google OAuth

1. Open [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials
2. Edit your OAuth 2.0 Client ID
3. Add to **Authorized redirect URIs**:  
   `https://your-site-name.netlify.app/api/auth/callback/google`
4. Add to **Authorized JavaScript origins**:  
   `https://your-site-name.netlify.app`

## 5. Deploy

Click **Deploy site**. Netlify will build and deploy. If the build fails, check the deploy logs.

## 6. Custom domain (optional)

In **Domain management**, add your custom domain and follow Netlify’s DNS instructions.
