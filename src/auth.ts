import NextAuth from "next-auth"
import Google from "next-auth/providers/google"

// NOTE: firebase-admin is imported dynamically inside the JWT callback
// to avoid bundling Node.js modules into the edge runtime (middleware).

export const { handlers, signIn, signOut, auth } = NextAuth({
    providers: [
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        }),
    ],
    session: { strategy: "jwt" },
    callbacks: {
        async jwt({ token, user, trigger }) {
            // On sign-in, look up role from Firestore (Google OAuth doesn't include role)
            if (user || trigger === "signIn") {
                try {
                    const { adminDb } = await import("@/lib/firebase-admin")
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
            return session
        },
    },
})
