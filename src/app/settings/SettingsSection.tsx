"use client"

import { useEffect, useState, useCallback, useMemo, createContext, useContext } from "react"
import Link from "next/link"
import { ChevronDown, Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"

/** Color tone applied to a section's icon tile. Pages pass these in. */
export type SectionAccent = "blue" | "violet" | "emerald" | "amber" | "rose" | "sky" | "muted"

/** Tile classes when a section is expanded — full color. */
const ACCENT_CLASSES: Record<SectionAccent, string> = {
    blue: "text-blue-600 dark:text-blue-400 bg-blue-500/10",
    violet: "text-violet-600 dark:text-violet-400 bg-violet-500/10",
    emerald: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
    amber: "text-amber-600 dark:text-amber-400 bg-amber-500/10",
    rose: "text-rose-600 dark:text-rose-400 bg-rose-500/10",
    sky: "text-sky-600 dark:text-sky-400 bg-sky-500/10",
    muted: "text-muted-foreground bg-muted",
}

/**
 * Tile classes when a section is collapsed — muted by default, lifts to
 * the accent color on hover. Tailwind's JIT only picks up class strings
 * that appear literally in source, so each variant has to be its own
 * fully-formed string rather than runtime concatenation.
 */
const ACCENT_CLASSES_COLLAPSED: Record<SectionAccent, string> = {
    blue: "bg-muted/60 text-muted-foreground group-hover:bg-blue-500/10 group-hover:text-blue-600 dark:group-hover:text-blue-400",
    violet: "bg-muted/60 text-muted-foreground group-hover:bg-violet-500/10 group-hover:text-violet-600 dark:group-hover:text-violet-400",
    emerald: "bg-muted/60 text-muted-foreground group-hover:bg-emerald-500/10 group-hover:text-emerald-600 dark:group-hover:text-emerald-400",
    amber: "bg-muted/60 text-muted-foreground group-hover:bg-amber-500/10 group-hover:text-amber-600 dark:group-hover:text-amber-400",
    rose: "bg-muted/60 text-muted-foreground group-hover:bg-rose-500/10 group-hover:text-rose-600 dark:group-hover:text-rose-400",
    sky: "bg-muted/60 text-muted-foreground group-hover:bg-sky-500/10 group-hover:text-sky-600 dark:group-hover:text-sky-400",
    muted: "bg-muted/60 text-muted-foreground group-hover:bg-muted group-hover:text-foreground",
}

/**
 * Settings page layout primitives.
 *
 * The two big UX problems in /settings/workspace and /settings/integrations
 * are page length (10+ sections each) and discoverability ("where do I set
 * the booking link again?"). This file solves both:
 *
 *   - SettingsSection is collapsible. Open/closed state persists per page
 *     to localStorage, so customers see the same layout next visit. The
 *     first ~2 sections default to expanded so the page never opens
 *     completely empty.
 *
 *   - SettingsLayout adds a search input at the top of every settings
 *     page. Type "tag" and only sections whose title or description
 *     mention "tag" stay visible. Empty search restores the full list.
 *
 *   - Anchor scroll behavior still works: clicking a TOC link expands
 *     the target section if it's collapsed, then scrolls to it. Direct
 *     URL hash navigation (e.g. /settings/workspace#booking) does the
 *     same on mount.
 */

// ── Filter context — shared between SettingsLayout's search and each section.

interface SettingsFilterCtx {
    /** Current search query, lowercased. Empty string = show everything. */
    query: string
    /** Page identifier — used as the localStorage key prefix for collapsed
     *  state so each settings page has its own memory. */
    pageKey: string
}

const SettingsFilterContext = createContext<SettingsFilterCtx>({ query: "", pageKey: "settings" })

// ── Section ─────────────────────────────────────────────────────────────

export function SettingsSection({
    id,
    title,
    description,
    children,
    flush = false,
    /** When true, defaults to expanded. We use this for the top 1-2
     *  sections of each page so it doesn't open completely collapsed. */
    defaultOpen = false,
    /** Pre-rendered icon JSX — pass <SomeIcon className="w-4 h-4" /> from
     *  the calling page. We use ReactNode (rendered element) instead of
     *  a component reference because server-component pages can't
     *  serialize raw function references across the server→client
     *  boundary, but they CAN pass already-rendered JSX. */
    icon,
    accent = "muted",
}: {
    id?: string
    title: string
    description?: string
    children: React.ReactNode
    flush?: boolean
    defaultOpen?: boolean
    icon?: React.ReactNode
    accent?: SectionAccent
}) {
    const { query, pageKey } = useContext(SettingsFilterContext)
    const storageKey = id ? `settings:${pageKey}:${id}:open` : null

    // Hydrate open state from localStorage on mount. We start with the
    // declared default to avoid a hydration mismatch flash, then upgrade
    // to the persisted value once the client is ready.
    const [open, setOpen] = useState(defaultOpen)
    const [hydrated, setHydrated] = useState(false)
    useEffect(() => {
        if (!storageKey) { setHydrated(true); return }
        try {
            const saved = localStorage.getItem(storageKey)
            if (saved === "1") setOpen(true)
            else if (saved === "0") setOpen(false)
        } catch { /* ignore */ }
        setHydrated(true)
    }, [storageKey])

    // Listen for events fired when the user clicks a TOC anchor or lands
    // on the page with a deep-link hash — auto-expand the matching section.
    useEffect(() => {
        if (!id) return
        const handler = (e: Event) => {
            const ce = e as CustomEvent<string>
            if (ce.detail === id) setOpen(true)
        }
        window.addEventListener("settings:expand-section", handler as EventListener)
        // Also expand on mount if the URL hash matches
        if (typeof window !== "undefined" && window.location.hash === `#${id}`) {
            setOpen(true)
        }
        return () => window.removeEventListener("settings:expand-section", handler as EventListener)
    }, [id])

    const toggle = useCallback(() => {
        setOpen((prev) => {
            const next = !prev
            if (storageKey) {
                try { localStorage.setItem(storageKey, next ? "1" : "0") } catch { /* ignore */ }
            }
            return next
        })
    }, [storageKey])

    // Search filtering — hide sections whose title/description doesn't match
    // the current query. Empty query bypasses the filter entirely.
    const matchesQuery = useMemo(() => {
        if (!query) return true
        const haystack = `${title} ${description || ""}`.toLowerCase()
        return haystack.includes(query)
    }, [query, title, description])

    if (!matchesQuery) return null

    // When a search is active, force-open the matching section so users
    // see the relevant content immediately.
    const effectiveOpen = open || (!!query && matchesQuery)

    return (
        <section
            id={id}
            className={`scroll-mt-24 ${flush ? "" : "border-b border-border/50"}`}
            data-open={effectiveOpen}
        >
            <button
                type="button"
                onClick={toggle}
                aria-expanded={effectiveOpen}
                className={`w-full flex items-center justify-between gap-3 py-4 text-left group -mx-3 px-3 rounded-lg transition-colors ${
                    effectiveOpen
                        ? "bg-muted/30"
                        : "hover:bg-muted/20"
                }`}
            >
                <div className="flex items-center gap-3 min-w-0">
                    {icon && (
                        <div
                            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                                effectiveOpen
                                    ? ACCENT_CLASSES[accent]
                                    : ACCENT_CLASSES_COLLAPSED[accent]
                            }`}
                        >
                            {icon}
                        </div>
                    )}
                    <div className="min-w-0">
                        <h2 className={`text-sm font-semibold tracking-tight transition-colors ${
                            effectiveOpen ? "text-foreground" : "text-foreground/80 group-hover:text-foreground"
                        }`}>
                            {title}
                        </h2>
                        {description && (
                            <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{description}</p>
                        )}
                    </div>
                </div>
                <ChevronDown
                    className={`h-4 w-4 text-muted-foreground/50 shrink-0 transition-all duration-200 ${
                        effectiveOpen ? "rotate-180 text-foreground" : "group-hover:text-foreground"
                    }`}
                />
            </button>

            {/*
             * Children are ALWAYS mounted (this avoids first-mount race
             * conditions inside heavy editors). The `hidden` attribute
             * removes them from layout + the accessibility tree without
             * unmounting the React tree. We tried a CSS animation here
             * earlier; reverted because arbitrary-value Tailwind classes
             * don't reliably JIT in production builds. Icons + the
             * expanded/collapsed visual hierarchy do most of the
             * "feels smooth" work without any animation needed.
             */}
            <div hidden={!effectiveOpen} className="pt-2 pb-6">
                {children}
            </div>
        </section>
    )
}

// ── Sticky TOC ──────────────────────────────────────────────────────────

export function OnThisPage({
    sections,
}: {
    sections: Array<{ id: string; label: string }>
}) {
    const { query } = useContext(SettingsFilterContext)
    const [activeId, setActiveId] = useState<string>(sections[0]?.id ?? "")

    useEffect(() => {
        if (sections.length === 0) return
        const observer = new IntersectionObserver(
            (entries) => {
                const visible = entries
                    .filter((e) => e.isIntersecting)
                    .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
                if (visible[0]) {
                    setActiveId((visible[0].target as HTMLElement).id)
                }
            },
            { rootMargin: "-100px 0px -60% 0px", threshold: [0, 1] },
        )
        for (const s of sections) {
            const el = document.getElementById(s.id)
            if (el) observer.observe(el)
        }
        return () => observer.disconnect()
    }, [sections])

    /**
     * Clicking a TOC item should expand the target section (if collapsed)
     * BEFORE the browser scrolls to it. Otherwise the browser scrolls to
     * the section header but the content is hidden.
     */
    const handleClick = useCallback((id: string) => (e: React.MouseEvent) => {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent("settings:expand-section", { detail: id }))
        // Allow the React render to flush before scrolling
        requestAnimationFrame(() => {
            const el = document.getElementById(id)
            if (el) el.scrollIntoView({ behavior: "smooth", block: "start" })
            history.replaceState(null, "", `#${id}`)
        })
    }, [])

    return (
        <aside className="hidden lg:block w-44 shrink-0">
            <div className="sticky top-14">
                <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">
                    On this page
                </div>
                <ul className="space-y-0.5 text-sm">
                    {sections.map((s) => {
                        const active = s.id === activeId && !query
                        return (
                            <li key={s.id}>
                                <Link
                                    href={`#${s.id}`}
                                    onClick={handleClick(s.id)}
                                    className={`block px-2 py-1 rounded-md text-xs transition-colors ${
                                        active
                                            ? "bg-primary/10 text-primary font-medium"
                                            : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                                    }`}
                                >
                                    {s.label}
                                </Link>
                            </li>
                        )
                    })}
                </ul>

                {/* Quick controls under the TOC */}
                <div className="mt-4 pt-4 border-t border-border/40 space-y-1.5">
                    <button
                        type="button"
                        onClick={() => window.dispatchEvent(new CustomEvent("settings:expand-all"))}
                        className="block w-full text-left text-[11px] text-muted-foreground hover:text-foreground"
                    >
                        Expand all
                    </button>
                    <button
                        type="button"
                        onClick={() => window.dispatchEvent(new CustomEvent("settings:collapse-all"))}
                        className="block w-full text-left text-[11px] text-muted-foreground hover:text-foreground"
                    >
                        Collapse all
                    </button>
                </div>
            </div>
        </aside>
    )
}

// ── Layout shell ────────────────────────────────────────────────────────

/**
 * Two-column settings layout with a top search bar.
 *
 * `pageKey` namespaces the collapsed-state localStorage keys so each
 * settings page (workspace, integrations, etc.) remembers its own
 * sections. Pass a stable string per page.
 */
export function SettingsLayout({
    toc,
    children,
    pageKey = "settings",
}: {
    toc: Array<{ id: string; label: string }>
    children: React.ReactNode
    pageKey?: string
}) {
    const [query, setQuery] = useState("")

    // Listen for the global expand/collapse events fired from the TOC.
    // We rebroadcast as per-section events so each SettingsSection can
    // react. We can't directly mutate every section's state from here.
    useEffect(() => {
        const onExpandAll = () => {
            for (const s of toc) {
                window.dispatchEvent(new CustomEvent("settings:expand-section", { detail: s.id }))
                try { localStorage.setItem(`settings:${pageKey}:${s.id}:open`, "1") } catch {}
            }
        }
        const onCollapseAll = () => {
            for (const s of toc) {
                window.dispatchEvent(new CustomEvent("settings:collapse-section", { detail: s.id }))
                try { localStorage.setItem(`settings:${pageKey}:${s.id}:open`, "0") } catch {}
            }
            // Force reload so collapsed state takes effect — collapse via
            // event would require every section to listen. Quick MVP.
            window.location.reload()
        }
        window.addEventListener("settings:expand-all", onExpandAll)
        window.addEventListener("settings:collapse-all", onCollapseAll)
        return () => {
            window.removeEventListener("settings:expand-all", onExpandAll)
            window.removeEventListener("settings:collapse-all", onCollapseAll)
        }
    }, [toc, pageKey])

    return (
        <SettingsFilterContext.Provider value={{ query: query.trim().toLowerCase(), pageKey }}>
            <div className="container mx-auto max-w-5xl py-6 px-4">
                <div className="flex gap-10">
                    <OnThisPage sections={toc} />
                    <div className="flex-1 min-w-0 max-w-3xl">
                        {/* Search filter — hidden until there are enough sections to make it useful */}
                        {toc.length >= 4 && (
                            <div className="relative mb-2 max-w-sm">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60 pointer-events-none" />
                                <Input
                                    type="search"
                                    placeholder="Filter sections…"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    className="h-9 pl-8 pr-8 text-sm"
                                />
                                {query && (
                                    <button
                                        type="button"
                                        onClick={() => setQuery("")}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground"
                                        aria-label="Clear search"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                )}
                            </div>
                        )}
                        {children}
                    </div>
                </div>
            </div>
        </SettingsFilterContext.Provider>
    )
}
