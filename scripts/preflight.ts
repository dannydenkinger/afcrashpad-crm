/**
 * Pre-launch env-var checker. Runs before deploying so missing required
 * vars get caught before they break the app silently.
 *
 *   npx tsx scripts/preflight.ts          # reads .env.local
 *   npx tsx scripts/preflight.ts --prod   # also warns on optional vars
 *
 * Exits 1 if any REQUIRED var is missing.
 */
import * as dotenv from "dotenv"
import * as path from "path"
import * as fs from "fs"

const envFile = path.resolve(__dirname, "../.env.local")
if (fs.existsSync(envFile)) {
    dotenv.config({ path: envFile })
}

type Severity = "required" | "recommended" | "optional"

interface EnvVar {
    name: string
    severity: Severity
    purpose: string
}

const VARS: EnvVar[] = [
    // ── Core (REQUIRED) ──
    { name: "NEXTAUTH_SECRET", severity: "required", purpose: "Session encryption" },
    { name: "AUTH_SECRET", severity: "required", purpose: "Mirror of NEXTAUTH_SECRET (NextAuth v5 looks at both)" },
    { name: "NEXT_PUBLIC_APP_URL", severity: "required", purpose: "Public base URL (no trailing slash)" },
    { name: "GOOGLE_CLIENT_ID", severity: "required", purpose: "Google OAuth sign-in" },
    { name: "GOOGLE_CLIENT_SECRET", severity: "required", purpose: "Google OAuth sign-in" },

    // ── Firebase (REQUIRED) ──
    { name: "NEXT_PUBLIC_FIREBASE_API_KEY", severity: "required", purpose: "Firebase web SDK" },
    { name: "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", severity: "required", purpose: "Firebase web SDK" },
    { name: "NEXT_PUBLIC_FIREBASE_PROJECT_ID", severity: "required", purpose: "Firebase web SDK" },
    { name: "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", severity: "required", purpose: "Firebase web SDK (uploads)" },
    { name: "NEXT_PUBLIC_FIREBASE_APP_ID", severity: "required", purpose: "Firebase web SDK" },
    { name: "FIREBASE_PROJECT_ID", severity: "required", purpose: "Admin SDK" },
    { name: "FIREBASE_CLIENT_EMAIL", severity: "required", purpose: "Admin SDK service account" },
    { name: "FIREBASE_PRIVATE_KEY", severity: "required", purpose: "Admin SDK service account" },
    { name: "FIREBASE_STORAGE_BUCKET", severity: "required", purpose: "Admin SDK uploads" },
    { name: "FIREBASE_DATABASE_ID", severity: "required", purpose: "Firestore database ID (often 'default')" },

    // ── Email (REQUIRED for transactional) ──
    { name: "RESEND_API_KEY", severity: "required", purpose: "Transactional email (password reset, invites)" },
    { name: "RESEND_FROM_EMAIL", severity: "required", purpose: "Verified sender" },

    // ── Recommended for production ──
    { name: "SENTRY_DSN", severity: "recommended", purpose: "Server error tracking" },
    { name: "NEXT_PUBLIC_SENTRY_DSN", severity: "recommended", purpose: "Client error tracking" },
    { name: "STRIPE_SECRET_KEY", severity: "recommended", purpose: "Credit top-up checkout" },
    { name: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", severity: "recommended", purpose: "Stripe.js" },
    { name: "STRIPE_WEBHOOK_SECRET", severity: "recommended", purpose: "Webhook signature verification" },
    { name: "NEXT_PUBLIC_FIREBASE_VAPID_KEY", severity: "recommended", purpose: "Push notifications" },
    { name: "CRON_SECRET", severity: "recommended", purpose: "Gates cron endpoints" },

    // ── Optional ──
    { name: "SENTRY_AUTH_TOKEN", severity: "optional", purpose: "Source-map upload at build time" },
    { name: "SENTRY_ORG", severity: "optional", purpose: "Used by build-time source-map upload" },
    { name: "SENTRY_PROJECT", severity: "optional", purpose: "Used by build-time source-map upload" },
    { name: "WEBHOOK_API_KEY", severity: "optional", purpose: "Bearer token for inbound webhooks" },
    { name: "TRACKING_SALT", severity: "optional", purpose: "Salt for email tracking IP hashing" },
    { name: "ANTHROPIC_API_KEY", severity: "optional", purpose: "Operator fallback (workspaces use BYO keys)" },
    { name: "OPENAI_API_KEY", severity: "optional", purpose: "Operator fallback" },
    { name: "GOOGLE_GEMINI_API_KEY", severity: "optional", purpose: "Operator fallback" },
]

const RED = "\x1b[31m"
const YELLOW = "\x1b[33m"
const GREEN = "\x1b[32m"
const DIM = "\x1b[2m"
const RESET = "\x1b[0m"
const BOLD = "\x1b[1m"

const verbose = process.argv.includes("--prod")

const missing = { required: [] as EnvVar[], recommended: [] as EnvVar[], optional: [] as EnvVar[] }
const present: EnvVar[] = []

for (const v of VARS) {
    const val = process.env[v.name]
    if (!val || !val.trim()) {
        missing[v.severity].push(v)
    } else {
        present.push(v)
    }
}

console.log(`${BOLD}Vesta CRM — preflight env check${RESET}`)
console.log(`${DIM}Reading from ${envFile}${RESET}\n`)

if (missing.required.length > 0) {
    console.log(`${RED}${BOLD}✗ MISSING REQUIRED (${missing.required.length})${RESET}`)
    for (const v of missing.required) {
        console.log(`  ${RED}${v.name}${RESET}  ${DIM}— ${v.purpose}${RESET}`)
    }
    console.log()
}

if (missing.recommended.length > 0) {
    console.log(`${YELLOW}${BOLD}⚠ MISSING RECOMMENDED (${missing.recommended.length})${RESET}`)
    for (const v of missing.recommended) {
        console.log(`  ${YELLOW}${v.name}${RESET}  ${DIM}— ${v.purpose}${RESET}`)
    }
    console.log()
}

if (verbose && missing.optional.length > 0) {
    console.log(`${DIM}${BOLD}· MISSING OPTIONAL (${missing.optional.length})${RESET}`)
    for (const v of missing.optional) {
        console.log(`  ${DIM}${v.name}  — ${v.purpose}${RESET}`)
    }
    console.log()
}

console.log(`${GREEN}✓ ${present.length} set${RESET}`)
if (missing.required.length === 0) {
    console.log(`${GREEN}${BOLD}Ready to deploy.${RESET}`)
    if (missing.recommended.length > 0) {
        console.log(`${DIM}(${missing.recommended.length} recommended vars are unset — see LAUNCH.md.)${RESET}`)
    }
}

process.exit(missing.required.length > 0 ? 1 : 0)
