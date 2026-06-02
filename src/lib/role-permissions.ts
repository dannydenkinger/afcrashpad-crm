/**
 * Role-based access control configuration.
 *
 * OWNER  - Full access to everything
 * ADMIN  - Everything except user management
 * AGENT  - Limited access: no Finance, Marketing (hidden), no admin Settings tabs
 */

export type UserRole = "OWNER" | "ADMIN" | "AGENT"

export interface PagePermission {
    /** Route prefix (matched with startsWith) */
    path: string
    /** Roles allowed to see / access this page */
    allowedRoles: UserRole[]
}

/**
 * Ordered list of page permissions.
 * More specific paths should come first so the first match wins.
 */
export const PAGE_PERMISSIONS: PagePermission[] = [
    // Settings sub-pages
    { path: "/settings", allowedRoles: ["OWNER", "ADMIN", "AGENT"] },

    // Finance & Marketing - hidden for agents
    { path: "/finance", allowedRoles: ["OWNER", "ADMIN"] },
    { path: "/marketing", allowedRoles: ["OWNER", "ADMIN"] },

    // Everything else is visible to all roles
    { path: "/dashboard", allowedRoles: ["OWNER", "ADMIN", "AGENT"] },
    { path: "/pipeline", allowedRoles: ["OWNER", "ADMIN", "AGENT"] },
    { path: "/contacts", allowedRoles: ["OWNER", "ADMIN", "AGENT"] },
    { path: "/calendar", allowedRoles: ["OWNER", "ADMIN", "AGENT"] },
    { path: "/documents", allowedRoles: ["OWNER", "ADMIN", "AGENT"] },
    { path: "/communications", allowedRoles: ["OWNER", "ADMIN", "AGENT"] },
    { path: "/tasks", allowedRoles: ["OWNER", "ADMIN", "AGENT"] },
    { path: "/notifications", allowedRoles: ["OWNER", "ADMIN", "AGENT"] },
    { path: "/search", allowedRoles: ["OWNER", "ADMIN", "AGENT"] },
]

/**
 * Settings tabs that are restricted by role.
 */
export const SETTINGS_TAB_PERMISSIONS: Record<string, UserRole[]> = {
    profile: ["OWNER", "ADMIN", "AGENT"],
    workspace: ["OWNER", "ADMIN"],
    users: ["OWNER"],
    integrations: ["OWNER", "ADMIN"],
    automations: ["OWNER", "ADMIN"],
    audit: ["OWNER", "ADMIN"],
    "custom-fields": ["OWNER", "ADMIN"],
    branding: ["OWNER", "ADMIN"],
    "api-keys": ["OWNER", "ADMIN"],
    "data-management": ["OWNER", "ADMIN"],
}

/**
 * Check if a role can access a given path.
 */
export function canAccessPage(role: UserRole, path: string): boolean {
    const permission = PAGE_PERMISSIONS.find((p) => path.startsWith(p.path))
    if (!permission) return true // If no rule defined, allow access
    return permission.allowedRoles.includes(role)
}

/**
 * Check if a role can see a settings tab.
 */
export function canAccessSettingsTab(role: UserRole, tab: string): boolean {
    const allowedRoles = SETTINGS_TAB_PERMISSIONS[tab]
    if (!allowedRoles) return true
    return allowedRoles.includes(role)
}

/**
 * Filter nav items based on role.
 */
export function getVisibleNavItems(
    role: UserRole,
    items: ({ name: string; href: string; icon: any } | { separator: string })[]
): typeof items {
    const filtered = items.filter((item) => {
        if ("separator" in item) return true
        return canAccessPage(role, item.href)
    })

    // Remove orphaned separators (separator at start, end, or consecutive separators)
    const result: typeof items = []
    for (let i = 0; i < filtered.length; i++) {
        const item = filtered[i]
        if ("separator" in item) {
            // Skip if it's the first item, last item, or follows another separator
            const prev = result[result.length - 1]
            const next = filtered[i + 1]
            if (!prev || !next || "separator" in next) continue
            if ("separator" in prev) continue
        }
        result.push(item)
    }

    // Remove trailing separator
    if (result.length > 0 && "separator" in result[result.length - 1]) {
        result.pop()
    }

    return result
}
