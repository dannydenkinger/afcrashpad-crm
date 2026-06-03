import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import type { Firestore } from "firebase-admin/firestore"

// firebase-admin is loaded via globalThis (set in firebase-admin.ts, imported
// by the NextAuth route handler). This avoids dynamic imports which fail in
// both edge runtime (no dynamic imports) and Node.js (can't resolve @/ alias).
function getAdminDb(): Firestore | null {
    return (globalThis as any).__adminDb ?? null;
}

// Build providers list — Google is optional (only if CLIENT_ID is configured)
const providers = [
    Credentials({
        credentials: {
            email: { type: "email" },
            password: { type: "password" },
        },
        async authorize(credentials, request) {
            if (!credentials?.email || !credentials?.password) return null
            const email = String(credentials.email).toLowerCase().trim()
            // Two throttles:
            //   1. Per-email (10/min) — stops attacks targeting one account
            //   2. Per-IP (30/min) — stops distributed credential stuffing
            //      from a single attacker hitting many accounts. NextAuth v5
            //      exposes the underlying Request in authorize().
            try {
                const { rateLimit } = await import("@/lib/rate-limit")
                const { allowed: emailOk } = rateLimit(`login:email:${email}`, 10)
                if (!emailOk) {
                    console.warn(`[AUTH] login throttled (per-email) for ${email}`)
                    return null
                }
                const fwd = request?.headers?.get("x-forwarded-for") || ""
                const ip = fwd.split(",")[0]?.trim() || "unknown"
                if (ip !== "unknown") {
                    const { allowed: ipOk } = rateLimit(`login:ip:${ip}`, 30)
                    if (!ipOk) {
                        console.warn(`[AUTH] login throttled (per-IP) for ${ip}`)
                        return null
                    }
                }
            } catch { /* rate-limit failure shouldn't block login */ }
            try {
                const adminDb = getAdminDb()
                if (!adminDb) return null
                const snap = await adminDb.collection("users")
                    .where("email", "==", email)
                    .limit(1)
                    .get()
                if (snap.empty) return null
                const doc = snap.docs[0]
                const data = doc.data()
                if (!data.passwordHash) return null
                const valid = await bcrypt.compare(String(credentials.password), data.passwordHash)
                if (!valid) return null
                return { id: doc.id, email: data.email, name: data.name, role: data.role }
            } catch (err) {
                console.error("[AUTH] Credentials authorize error:", err)
                return null
            }
        },
    }),
]

// Only add Google provider if credentials are configured.
// Sign-in only requests basic identity scopes (openid/email/profile). Gmail
// access is requested separately via /api/auth/gmail when the user opts in
// from the Integrations page — this keeps the sign-in consent screen
// minimal and gives users a real "connect Gmail" affordance.
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.push(
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            authorization: {
                params: {
                    scope: "openid email profile",
                    access_type: "offline",
                },
            },
        }) as any
    )
}

export const { handlers, signIn, signOut, auth } = NextAuth({
    providers,
    /**
     * Trust the host header on incoming requests. Required in any NextAuth
     * v5 production deploy where AUTH_URL isn't explicitly set — without
     * this, the PKCE cookie isn't written and every Google sign-in fails
     * with "Invalid code verifier" on the callback. Vercel's domain is
     * trusted; reverse-proxy setups that need stricter validation should
     * leave this false and set AUTH_URL explicitly.
     */
    trustHost: true,
    session: {
        strategy: "jwt",
        // 30 days. Strikes a balance between "users hate logging in every day"
        // and "stolen-laptop window shouldn't be infinite." If we add a
        // device-management UI later, drop this to 7d and let users extend.
        maxAge: 30 * 24 * 60 * 60,
        updateAge: 24 * 60 * 60, // Refresh the JWT once per day
    },
    /**
     * Explicit config for every cookie NextAuth uses. Without this we
     * customized only sessionToken with the v4 cookie name and let the
     * OAuth-flow cookies (pkce.code_verifier, state, nonce, csrf-token,
     * callback-url) fall back to v5 defaults. Mixing v4 + v5 cookie
     * names confused some browsers + Vercel's edge cache and produced
     * intermittent "invalid_grant: Invalid code verifier" errors during
     * Google sign-in. Configuring them all explicitly makes the flow
     * deterministic.
     *
     * sameSite=lax is correct for OAuth — the cookie is set on our
     * origin, the user navigates to Google (top-level navigation),
     * Google sends them back, and lax cookies ARE sent on top-level
     * cross-site navigations back to our origin.
     */
    cookies: {
        sessionToken: {
            name: process.env.NODE_ENV === "production"
                ? "__Secure-next-auth.session-token"
                : "next-auth.session-token",
            options: {
                httpOnly: true,
                sameSite: "lax",
                path: "/",
                secure: process.env.NODE_ENV === "production",
            },
        },
        callbackUrl: {
            name: process.env.NODE_ENV === "production"
                ? "__Secure-next-auth.callback-url"
                : "next-auth.callback-url",
            options: {
                sameSite: "lax",
                path: "/",
                secure: process.env.NODE_ENV === "production",
            },
        },
        csrfToken: {
            name: process.env.NODE_ENV === "production"
                ? "__Host-next-auth.csrf-token"
                : "next-auth.csrf-token",
            options: {
                httpOnly: true,
                sameSite: "lax",
                path: "/",
                secure: process.env.NODE_ENV === "production",
            },
        },
        pkceCodeVerifier: {
            name: process.env.NODE_ENV === "production"
                ? "__Secure-next-auth.pkce.code_verifier"
                : "next-auth.pkce.code_verifier",
            options: {
                httpOnly: true,
                sameSite: "lax",
                path: "/",
                secure: process.env.NODE_ENV === "production",
                maxAge: 60 * 15, // 15 minutes — same as NextAuth default
            },
        },
        state: {
            name: process.env.NODE_ENV === "production"
                ? "__Secure-next-auth.state"
                : "next-auth.state",
            options: {
                httpOnly: true,
                sameSite: "lax",
                path: "/",
                secure: process.env.NODE_ENV === "production",
                maxAge: 60 * 15,
            },
        },
        nonce: {
            name: process.env.NODE_ENV === "production"
                ? "__Secure-next-auth.nonce"
                : "next-auth.nonce",
            options: {
                httpOnly: true,
                sameSite: "lax",
                path: "/",
                secure: process.env.NODE_ENV === "production",
            },
        },
    },
    pages: {
        signIn: "/login",
    },
    callbacks: {
        async jwt({ token, user, trigger, account, session }) {
            // On Google OAuth sign-in, just record auth provider. Gmail/Calendar
            // tokens are NOT collected here — the basic sign-in scope is only
            // openid/email/profile. Gmail access is granted via the dedicated
            // /api/auth/gmail flow once the user opts in from Integrations.
            if (account && account.provider === "google") {
                token.authProvider = "google"
            }

            // Track auth provider for credentials sign-ins
            if (account && account.provider === "credentials") {
                token.authProvider = "credentials"
            }

            // Refresh Google access token if expired
            if (token.accessTokenExpires && Date.now() > (token.accessTokenExpires as number)) {
                try {
                    const response = await fetch("https://oauth2.googleapis.com/token", {
                        method: "POST",
                        headers: { "Content-Type": "application/x-www-form-urlencoded" },
                        body: new URLSearchParams({
                            client_id: process.env.GOOGLE_CLIENT_ID!,
                            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
                            grant_type: "refresh_token",
                            refresh_token: token.refreshToken as string,
                        }),
                    })
                    const refreshed = await response.json()
                    if (refreshed.access_token) {
                        token.accessToken = refreshed.access_token
                        token.accessTokenExpires = Date.now() + refreshed.expires_in * 1000
                    }
                } catch (err) {
                    console.error("Failed to refresh access token:", err)
                }
            }

            // On sign-in: fetch user record + workspace membership
            // If Google OAuth user doesn't exist yet, auto-create user + workspace
            if (user || trigger === "signIn") {
                try {
                    const adminDb = getAdminDb()
                    if (!adminDb) throw new Error("adminDb not available (edge runtime)")
                    const email = token.email || user?.email
                    if (email) {
                        let usersSnap = await adminDb.collection("users")
                            .where("email", "==", email)
                            .limit(1)
                            .get()

                        // Single-org mode: NEVER mint a new workspace — that would
                        // orphan all existing data behind a stray workspaceId. Create
                        // the user and attach them to the fixed AFCrashpad workspace as
                        // an AGENT. Self-signup + multi-workspace creation are disabled;
                        // the OWNER membership (afcrashpad@gmail.com) is created by the
                        // data backfill. To restrict access entirely, gate this branch
                        // on an email allowlist.
                        if (usersSnap.empty && account?.provider === "google") {
                            const now = new Date()
                            const userName = token.name || user?.name || email.split("@")[0]
                            const workspaceId = process.env.DEFAULT_WORKSPACE_ID || "afcrashpad"

                            const userRef = await adminDb.collection("users").add({
                                name: userName,
                                email,
                                createdAt: now,
                                updatedAt: now,
                            })

                            await adminDb.collection("workspace_members").add({
                                workspaceId,
                                userId: userRef.id,
                                role: "AGENT",
                                status: "active",
                                joinedAt: now,
                                invitedBy: null,
                            })

                            token.dbUserId = userRef.id
                            token.workspaceId = workspaceId
                            token.role = "AGENT"
                        } else if (!usersSnap.empty) {
                            const userDoc = usersSnap.docs[0]
                            token.dbUserId = userDoc.id

                            // Fetch all active memberships, then pick the most-recently-active one.
                            // For multi-workspace users this means signing back into whichever
                            // workspace they last visited rather than whatever Firestore returned
                            // first (which has no defined order without orderBy).
                            const memberSnap = await adminDb.collection("workspace_members")
                                .where("userId", "==", userDoc.id)
                                .where("status", "==", "active")
                                .get()

                            if (!memberSnap.empty) {
                                // Prefer lastActiveAt; fall back to joinedAt; final fallback first doc.
                                const sorted = memberSnap.docs.slice().sort((a, b) => {
                                    const aTime = (a.data().lastActiveAt?.toMillis?.() ?? 0)
                                        || (a.data().joinedAt?.toMillis?.() ?? 0)
                                    const bTime = (b.data().lastActiveAt?.toMillis?.() ?? 0)
                                        || (b.data().joinedAt?.toMillis?.() ?? 0)
                                    return bTime - aTime
                                })
                                const membership = sorted[0].data()
                                token.workspaceId = membership.workspaceId
                                token.role = membership.role || "AGENT"
                            } else {
                                // Existing user without a membership: pin to the fixed
                                // workspace rather than orphaning them (auth-guard creates
                                // the membership doc on the next getAuthSession call).
                                token.workspaceId = process.env.DEFAULT_WORKSPACE_ID || "afcrashpad"
                                token.role = userDoc.data().role || "AGENT"
                            }
                        } else {
                            token.role = "AGENT"
                        }
                    }
                } catch (err) {
                    console.error("Failed to fetch user/workspace for JWT:", err)
                    token.role = token.role || "AGENT"
                }
            }
            // Gmail token persistence used to happen here on sign-in. It now
            // lives in /api/auth/gmail/callback so users only grant Gmail
            // access when they explicitly connect from Integrations.

            // Handle workspace switching
            if (trigger === "update" && session?.workspaceId) {
                try {
                    const adminDb = getAdminDb()
                    if (!adminDb) throw new Error("adminDb not available")
                    const memberSnap = await adminDb.collection("workspace_members")
                        .where("userId", "==", token.dbUserId)
                        .where("workspaceId", "==", session.workspaceId)
                        .where("status", "==", "active")
                        .limit(1)
                        .get()
                    if (!memberSnap.empty) {
                        const membership = memberSnap.docs[0]
                        token.workspaceId = session.workspaceId
                        token.role = membership.data().role || "AGENT"
                        // Stamp lastActiveAt so the next sign-in lands on this
                        // workspace by default. Fire-and-forget so the JWT
                        // callback doesn't block on the write.
                        membership.ref.update({ lastActiveAt: new Date() }).catch(() => {})
                    }
                } catch (err) {
                    console.error("[AUTH] Workspace switch error:", err)
                }
            }
            if (user) {
                token.id = user.id
            }
            return token
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.role = token.role as string
                session.user.id = (token.dbUserId as string) || (token.id as string)
                session.user.workspaceId = token.workspaceId as string
            }
            // Expose OAuth tokens and auth provider for server-side use
            ;(session as any).accessToken = token.accessToken
            ;(session as any).refreshToken = token.refreshToken
            ;(session as any).accessTokenExpires = token.accessTokenExpires
            ;(session as any).authProvider = token.authProvider || "credentials"
            return session
        },
    },
})
