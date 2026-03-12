import NextAuth from "next-auth"
import Google from "next-auth/providers/google"

// NOTE: firebase-admin is imported dynamically inside the JWT callback
// to avoid bundling Node.js modules into the edge runtime (middleware).

export const { handlers, signIn, signOut, auth } = NextAuth({
    providers: [
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            authorization: {
                params: {
                    scope: "openid email profile https://www.googleapis.com/auth/gmail.readonly",
                    access_type: "offline",
                    prompt: "consent",
                },
            },
        }),
    ],
    session: { strategy: "jwt" },
    callbacks: {
        async jwt({ token, user, trigger, account }) {
            // On sign-in, store OAuth tokens and persist to Firestore
            if (account) {
                token.accessToken = account.access_token
                token.refreshToken = account.refresh_token
                token.accessTokenExpires = account.expires_at ? account.expires_at * 1000 : 0

                // Persist tokens to Firestore immediately so Gmail API can use them
                try {
                    const { adminDb } = await import(/* webpackIgnore: true */ "@/lib/firebase-admin")
                    const email = token.email || user?.email || account.providerAccountId
                    if (email && token.refreshToken) {
                        await adminDb.collection("oauth_tokens").doc("gmail").set({
                            accessToken: token.accessToken,
                            refreshToken: token.refreshToken,
                            accessTokenExpires: token.accessTokenExpires,
                            email,
                            updatedAt: new Date().toISOString(),
                        }, { merge: true })
                    }
                } catch (err) {
                    console.error("Failed to persist Gmail tokens:", err)
                }
            }

            // Refresh access token if expired
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

            if (user || trigger === "signIn") {
                try {
                    const { adminDb } = await import(/* webpackIgnore: true */ "@/lib/firebase-admin")
                    const email = token.email || user?.email
                    if (email) {
                        const usersSnap = await adminDb.collection("users")
                            .where("email", "==", email)
                            .limit(1)
                            .get()
                        if (!usersSnap.empty) {
                            token.role = usersSnap.docs[0].data().role || "AGENT"
                            token.dbUserId = usersSnap.docs[0].id
                        } else {
                            token.role = "AGENT"
                        }
                    }
                } catch (err) {
                    console.error("Failed to fetch user role for JWT:", err)
                    token.role = token.role || "AGENT"
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
            }
            // Expose OAuth tokens for server-side use (already encrypted in JWT cookie)
            ;(session as any).accessToken = token.accessToken
            ;(session as any).refreshToken = token.refreshToken
            ;(session as any).accessTokenExpires = token.accessTokenExpires
            return session
        },
    },
})
