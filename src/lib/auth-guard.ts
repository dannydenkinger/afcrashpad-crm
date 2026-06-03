"use server"

import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { adminDb } from "@/lib/firebase-admin"
import { getActiveSupportSession } from "@/lib/support/session"

/**
 * Auto-provision: if a user signs in (e.g. via Google OAuth) but doesn't have
 * a Firestore user doc or workspace, create them here. This runs in Node.js
 * server context where firebase-admin is available (unlike the JWT callback
 * which sometimes runs in edge runtime where dynamic imports fail).
 */
async function ensureUserAndWorkspace(email: string, name: string | null | undefined) {
    const userName = name || email.split("@")[0]

    // Check if user doc exists
    let userSnap = await adminDb.collection("users")
        .where("email", "==", email)
        .limit(1)
        .get()

    let userId: string

    if (userSnap.empty) {
        // Create user doc
        const now = new Date()
        const userRef = await adminDb.collection("users").add({
            name: userName,
            email,
            createdAt: now,
            updatedAt: now,
        })
        userId = userRef.id
        console.log("[AUTH-GUARD] Created user doc:", userId)
    } else {
        userId = userSnap.docs[0].id
    }

    // Check if workspace membership exists
    let memberSnap = await adminDb.collection("workspace_members")
        .where("userId", "==", userId)
        .where("status", "==", "active")
        .limit(1)
        .get()

    if (memberSnap.empty) {
        // Single-org mode: NEVER mint a new workspace — that would orphan all
        // existing data. Attach the user to the fixed AFCrashpad workspace,
        // preserving their existing users.role if present.
        const now = new Date()
        const workspaceId = process.env.DEFAULT_WORKSPACE_ID || "afcrashpad"
        const role = userSnap.empty ? "AGENT" : (userSnap.docs[0].data().role || "AGENT")

        await adminDb.collection("workspace_members").add({
            workspaceId,
            userId,
            role,
            status: "active",
            joinedAt: now,
            invitedBy: null,
        })

        console.log("[AUTH-GUARD] Attached user", userId, "to fixed workspace", workspaceId)

        return { userId, workspaceId, role }
    }

    const membership = memberSnap.docs[0].data()
    return { userId, workspaceId: membership.workspaceId, role: membership.role || "AGENT" }
}

/**
 * Get session with workspace recovery. Returns null if not authenticated.
 * Use this instead of calling auth() directly when you need workspaceId.
 */
export async function getAuthSession() {
    const session = await auth()
    if (!session?.user?.id) return null

    // If workspaceId is missing, recover or auto-provision
    if (!session.user.workspaceId) {
        try {
            const result = await ensureUserAndWorkspace(
                session.user.email!,
                session.user.name
            )
            session.user.id = result.userId
            session.user.workspaceId = result.workspaceId
            session.user.role = result.role
        } catch (err) {
            console.error("[AUTH-GUARD] Workspace provisioning failed:", err)
        }
    }

    // Set up Gmail watch if user signed in with Google and watch isn't active
    if ((session as any).authProvider === "google" && session.user.workspaceId && session.user.id) {
        try {
            const gmailDocId = `${session.user.workspaceId}_${session.user.id}`
            const gmailDoc = await adminDb.collection("gmail_integrations").doc(gmailDocId).get()
            if (gmailDoc.exists) {
                const data = gmailDoc.data()
                const watchExpiration = data?.watchExpiration || 0
                // Set up watch if not active or expiring within 1 hour
                if (!watchExpiration || watchExpiration < Date.now() + 60 * 60 * 1000) {
                    const { setupGmailWatch } = await import("@/lib/gmail-watch")
                    setupGmailWatch(session.user.workspaceId, session.user.id).catch((err) =>
                        console.error("[AUTH-GUARD] Gmail watch setup failed:", err)
                    )
                }
            }
        } catch {
            // Non-critical — don't block auth
        }
    }

    // Apply an active support-grant session, if any. The agent is
    // signed in as themselves; we just rewire workspaceId + role so
    // every server action operates inside the supported workspace
    // without the action needing to know it's a support session.
    try {
        const support = await getActiveSupportSession(session.user.email)
        if (support) {
            const u = session.user as unknown as Record<string, unknown>
            u.originalWorkspaceId = u.workspaceId
            u.originalRole = u.role
            u.workspaceId = support.actAsWorkspaceId
            u.actAsWorkspaceId = support.actAsWorkspaceId
            u.supportGrantId = support.grant.id
            u.supportGrantedByEmail = support.grant.grantedByEmail
            u.supportExpiresAt = support.grant.expiresAt
            u.role = "ADMIN"
        }
    } catch {
        // If support session lookup fails, fall back to the agent's
        // own workspace context.
    }

    return session
}

export async function requireAuth() {
    const session = await getAuthSession()
    if (!session?.user?.id) {
        redirect("/login")
    }
    if (!session.user.workspaceId) {
        redirect("/login")
    }

    // Block suspended workspaces. Skip when the request is inside a
    // support session — those grants are already invalidated against
    // suspended workspaces at issue/redeem time.
    const u = session.user as unknown as Record<string, unknown>
    if (!u.supportGrantId) {
        try {
            const snap = await adminDb
                .collection("workspaces")
                .doc(session.user.workspaceId)
                .get()
            if ((snap.data()?.status as string) === "suspended") {
                redirect("/suspended")
            }
        } catch {
            // If we can't read the workspace doc, fall through — better
            // to risk one extra request than lock everyone out on a
            // Firestore hiccup.
        }
    }
    return session
}

export async function requireAdmin() {
    const session = await requireAuth()
    const role = session.user.role
    if (role !== "ADMIN" && role !== "OWNER") {
        throw new Error("Forbidden: Admin access required")
    }
    return session
}

export async function requireRole(allowedRoles: string | string[]) {
    const session = await requireAuth()
    const role = session.user.role
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]
    if (!roles.includes(role)) {
        throw new Error(`Forbidden: Requires one of: ${roles.join(", ")}`)
    }
    return { session, role }
}
