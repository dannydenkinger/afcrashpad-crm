"use client"

interface Branding {
    logoUrl?: string
    primaryColor?: string
    companyName?: string
}

/**
 * Single-org mode: AFCrashpad runs as ONE fixed workspace, so the former
 * workspace switcher / "Create new workspace" dropdown is reduced to a static
 * brand header (logo + company name). Kept as a named export with the same
 * props so the Sidebar usage (and its logo slot) is unchanged.
 */
export function WorkspaceSwitcher({
    collapsed,
    branding,
}: {
    collapsed: boolean
    branding: Branding | null
}) {
    const displayName = branding?.companyName || "AFCrashpad CRM"

    const brandIcon = branding?.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
            src={branding.logoUrl}
            alt={branding.companyName || "Logo"}
            className="h-10 w-10 shrink-0 rounded-lg object-cover shadow"
        />
    ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
            src="/logo.png"
            alt={displayName}
            className="h-10 w-10 shrink-0 rounded-lg object-contain shadow"
        />
    )

    return (
        <div
            className={
                collapsed
                    ? "flex items-center justify-center mb-10 mx-auto"
                    : "flex items-center mb-10 gap-3 px-2 -mx-2 py-1"
            }
        >
            {brandIcon}
            {!collapsed && (
                <div className="overflow-hidden flex-1 min-w-0">
                    <h2 className="text-lg font-semibold tracking-tight whitespace-nowrap truncate">
                        {displayName}
                    </h2>
                    <p className="text-xs text-muted-foreground font-medium whitespace-nowrap">
                        CRM Portal
                    </p>
                </div>
            )}
        </div>
    )
}
