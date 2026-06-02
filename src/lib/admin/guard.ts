import "server-only"
import { redirect } from "next/navigation"
import { getAuthSession } from "@/lib/auth-guard"

function operatorAllowlist(): Set<string> {
    const raw = process.env.OPERATOR_EMAILS || ""
    return new Set(
        raw
            .split(",")
            .map((e) => e.trim().toLowerCase())
            .filter(Boolean),
    )
}

/**
 * Returns the authenticated session if the user is a Vesta operator
 * (email is in OPERATOR_EMAILS), or null otherwise. Use isOperator()
 * for guards that redirect; use this for conditional UI.
 */
export async function getOperatorSession() {
    const session = await getAuthSession()
    const email = session?.user?.email?.toLowerCase()
    if (!email) return null
    const allowlist = operatorAllowlist()
    if (allowlist.size === 0) return null
    if (!allowlist.has(email)) return null
    return session
}

/**
 * Redirects to /dashboard if the visitor isn't a Vesta operator.
 * Use in every /admin route layout/page.
 */
export async function requireOperator() {
    const session = await getOperatorSession()
    if (!session) redirect("/dashboard")
    return session
}
