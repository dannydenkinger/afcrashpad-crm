"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { getCurrentUserRole } from "@/app/settings/users/actions"
import type { UserRole } from "@/lib/role-permissions"

/**
 * Hook that returns the current user's role.
 * Fetches from server on mount and when session changes.
 */
export function useUserRole() {
    const { data: session } = useSession()
    const [role, setRole] = useState<UserRole>("AGENT")
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let cancelled = false

        async function fetchRole() {
            if (!session?.user?.id) {
                setLoading(false)
                return
            }

            try {
                const fetchedRole = await getCurrentUserRole()
                if (!cancelled) {
                    setRole(fetchedRole as UserRole)
                }
            } catch (err) {
                console.error("Error fetching user role:", err)
            } finally {
                if (!cancelled) {
                    setLoading(false)
                }
            }
        }

        fetchRole()
        return () => { cancelled = true }
    }, [session?.user?.id])

    return { role, loading, isOwner: role === "OWNER", isAdmin: role === "ADMIN" || role === "OWNER", isAgent: role === "AGENT" }
}
