"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"
import type { SectionAccent } from "./SettingsSection"

/** A single navigable sub-page in a settings area. */
export interface SubPageItem {
    /** Path segment relative to the parent area (no leading slash). */
    slug: string
    label: string
    description?: string
    /** Pre-rendered icon JSX — pass <Foo className="w-4 h-4" />. */
    icon?: ReactNode
    accent?: SectionAccent
    /** Absolute href override — for items that live outside the parent
     *  area's slug tree (e.g. /settings/bases under the Workspace nav). */
    href?: string
}

const ACCENT_TILE_ACTIVE: Record<SectionAccent, string> = {
    blue: "text-blue-600 dark:text-blue-400 bg-blue-500/10",
    violet: "text-violet-600 dark:text-violet-400 bg-violet-500/10",
    emerald: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
    amber: "text-amber-600 dark:text-amber-400 bg-amber-500/10",
    rose: "text-rose-600 dark:text-rose-400 bg-rose-500/10",
    sky: "text-sky-600 dark:text-sky-400 bg-sky-500/10",
    muted: "text-muted-foreground bg-muted",
}

const ACCENT_TILE_IDLE: Record<SectionAccent, string> = {
    blue: "bg-muted/60 text-muted-foreground group-hover:bg-blue-500/10 group-hover:text-blue-600 dark:group-hover:text-blue-400",
    violet: "bg-muted/60 text-muted-foreground group-hover:bg-violet-500/10 group-hover:text-violet-600 dark:group-hover:text-violet-400",
    emerald: "bg-muted/60 text-muted-foreground group-hover:bg-emerald-500/10 group-hover:text-emerald-600 dark:group-hover:text-emerald-400",
    amber: "bg-muted/60 text-muted-foreground group-hover:bg-amber-500/10 group-hover:text-amber-600 dark:group-hover:text-amber-400",
    rose: "bg-muted/60 text-muted-foreground group-hover:bg-rose-500/10 group-hover:text-rose-600 dark:group-hover:text-rose-400",
    sky: "bg-muted/60 text-muted-foreground group-hover:bg-sky-500/10 group-hover:text-sky-600 dark:group-hover:text-sky-400",
    muted: "bg-muted/60 text-muted-foreground group-hover:bg-muted group-hover:text-foreground",
}

/**
 * Two-column layout for a settings area that uses real sub-routes.
 *
 * Left: vertical nav of sub-pages, each a real Next.js Link. Active item
 * is detected from the URL pathname so client-side navigation updates
 * the highlight without a re-render dance.
 *
 * Right: the rendered sub-page content (page.tsx of /<area>/<slug>).
 *
 * On mobile: sidebar collapses into a horizontal scroll strip across
 * the top so users can still pick sub-pages without taking screen real
 * estate.
 */
export function SettingsSubPageLayout({
    /** e.g. "/settings/workspace" — used to build full Hrefs. */
    basePath,
    /** Page title shown above the nav. */
    areaTitle,
    /** Short blurb shown under the title. */
    areaDescription,
    items,
    children,
}: {
    basePath: string
    areaTitle: string
    areaDescription?: string
    items: SubPageItem[]
    children: ReactNode
}) {
    const pathname = usePathname()

    return (
        <div className="container mx-auto max-w-6xl py-6 px-4">
            <div className="pb-4 border-b mb-6">
                <h1 className="text-2xl font-semibold tracking-tight">{areaTitle}</h1>
                {areaDescription && (
                    <p className="text-sm text-muted-foreground mt-0.5">{areaDescription}</p>
                )}
            </div>

            <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
                {/* Sidebar — desktop vertical, mobile horizontal scroll */}
                <nav
                    className="lg:w-60 lg:shrink-0 lg:sticky lg:top-14 lg:self-start"
                    aria-label="Section navigation"
                >
                    <ul className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible no-scrollbar">
                        {items.map((item) => {
                            const href = item.href ?? `${basePath}/${item.slug}`
                            const active =
                                pathname === href || pathname.startsWith(href + "/")
                            const accent = item.accent || "muted"
                            const tile = active
                                ? ACCENT_TILE_ACTIVE[accent]
                                : ACCENT_TILE_IDLE[accent]
                            return (
                                <li key={item.slug} className="shrink-0 lg:shrink">
                                    <Link
                                        href={href}
                                        className={`group flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors ${
                                            active
                                                ? "bg-muted/60"
                                                : "hover:bg-muted/30"
                                        }`}
                                    >
                                        {item.icon && (
                                            <div
                                                className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 transition-colors ${tile}`}
                                            >
                                                {item.icon}
                                            </div>
                                        )}
                                        <div className="min-w-0 hidden lg:block">
                                            <div
                                                className={`text-sm font-medium leading-tight ${
                                                    active ? "text-foreground" : "text-foreground/80 group-hover:text-foreground"
                                                }`}
                                            >
                                                {item.label}
                                            </div>
                                            {item.description && (
                                                <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                                                    {item.description}
                                                </div>
                                            )}
                                        </div>
                                        <span className="lg:hidden text-sm font-medium whitespace-nowrap pr-1">
                                            {item.label}
                                        </span>
                                    </Link>
                                </li>
                            )
                        })}
                    </ul>
                </nav>

                {/* Main pane */}
                <main className="flex-1 min-w-0 max-w-3xl">{children}</main>
            </div>
        </div>
    )
}

/**
 * Convenience wrapper for a sub-page's content. Provides a consistent
 * header (title + description) and a card-shaped container for the
 * actual form/widget below.
 *
 * Pages that already render their own bordered tile layout (e.g. data
 * import/export tile grids, the Connected services list) should pass
 * `flush` to skip the inner card and avoid card-on-card nesting.
 */
export function SettingsSubPage({
    title,
    description,
    children,
    flush = false,
}: {
    title: string
    description?: string
    children: ReactNode
    /** Skip the inner Card wrapper for pages that supply their own tile layout. */
    flush?: boolean
}) {
    return (
        <div className="space-y-4">
            <div>
                <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
                {description && (
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</p>
                )}
            </div>
            {flush ? (
                <div>{children}</div>
            ) : (
                <div className="rounded-xl border bg-card p-6 shadow-sm">{children}</div>
            )}
        </div>
    )
}
