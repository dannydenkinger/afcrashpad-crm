"use client"

import { useState } from "react"
import { motion, type Transition } from "framer-motion"
import {
    Check,
    ChevronDown,
    Flag,
    Hexagon,
    Hourglass,
    MoreHorizontal,
} from "lucide-react"
import { cn } from "@/lib/utils"

export type MemberAccent = "sky" | "violet" | "rose" | "emerald" | "amber" | "zinc"

export interface TaskMember {
    id: string
    name: string
    accent?: MemberAccent
}

export interface TaskChecklistItem {
    id: string
    label: string
    done: boolean
}

export interface TaskCardProps {
    title: string
    priority: "Urgent" | "High" | "Medium" | "Low"
    status: "In Progress" | "Blocked" | "Done" | "Todo"
    checklist: TaskChecklistItem[]
    members: TaskMember[]
    defaultExpanded?: boolean
    className?: string
}

const PRIORITY_PILL: Record<TaskCardProps["priority"], string> = {
    Urgent: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
    High: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    Medium: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
    Low: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
}

const STATUS_PILL: Record<TaskCardProps["status"], string> = {
    "In Progress":
        "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    Blocked: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
    Done: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    Todo: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
}

const AVATAR_BG: Record<MemberAccent, string> = {
    sky: "bg-sky-200 dark:bg-sky-900/60",
    violet: "bg-violet-200 dark:bg-violet-900/60",
    rose: "bg-rose-200 dark:bg-rose-900/60",
    emerald: "bg-emerald-200 dark:bg-emerald-900/60",
    amber: "bg-amber-200 dark:bg-amber-900/60",
    zinc: "bg-zinc-200 dark:bg-zinc-800",
}

const CHIP_BG: Record<MemberAccent, string> = {
    sky: "bg-sky-50 border-sky-200 dark:bg-sky-950/40 dark:border-sky-900/60",
    violet:
        "bg-violet-50 border-violet-200 dark:bg-violet-950/40 dark:border-violet-900/60",
    rose: "bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:border-rose-900/60",
    emerald:
        "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900/60",
    amber: "bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-900/60",
    zinc: "bg-zinc-50 border-zinc-200 dark:bg-zinc-900/60 dark:border-zinc-800",
}

const DURATION_MS = 900
// EASE_OPEN is an ease-OUT (fast start, slow finish) — the smooth
// Apple-style settle. EASE_CLOSE is its mathematical inverse so the
// close plays as the literal reverse of the open: slow start that
// accelerates into the collapsed state. CSS transitions use whichever
// is active at the moment of the property change.
const EASE_OPEN = "cubic-bezier(0.32, 0.72, 0, 1)"
const EASE_CLOSE = "cubic-bezier(1, 0, 0.68, 0.28)"
const EASE_OPEN_ARR = [0.32, 0.72, 0, 1] as const
const EASE_CLOSE_ARR = [1, 0, 0.68, 0.28] as const

const fadeStyle = (expanded: boolean) => ({
    transition: `opacity ${DURATION_MS}ms ${expanded ? EASE_OPEN : EASE_CLOSE}`,
})
const sizeStyle = (expanded: boolean) => {
    const ease = expanded ? EASE_OPEN : EASE_CLOSE
    return {
        transition: `width ${DURATION_MS}ms ${ease}, height ${DURATION_MS}ms ${ease}, font-size ${DURATION_MS}ms ${ease}, padding ${DURATION_MS}ms ${ease}`,
    }
}

// Build a style that slides a row into place on open and back out on
// close. Mathematically symmetric — the close's ease is the inverse
// of the open's, so playing close is identical to playing the open
// video backwards.
//
// The x offset gives each row a meaningful origin in the collapsed
// layout: priority/status pills come from the LEFT (where their inline
// text labels lived), member chips come from the RIGHT (where the
// stacked avatars lived).
const slideStyle = (expanded: boolean, x: number, y: number) => ({
    transform: expanded ? "translate(0, 0)" : `translate(${x}px, ${y}px)`,
    transition: `transform ${DURATION_MS}ms ${expanded ? EASE_OPEN : EASE_CLOSE}`,
    willChange: "transform",
})

export function TaskCard({
    title,
    priority,
    status,
    checklist,
    members,
    defaultExpanded = false,
    className,
}: TaskCardProps) {
    const [expanded, setExpanded] = useState(defaultExpanded)
    const [barHover, setBarHover] = useState(false)

    // Use the inverse-curve ease for close so framer-motion's layout
    // (card height) animates back at the mirrored rate too.
    const T: Transition = {
        duration: DURATION_MS / 1000,
        ease: expanded ? EASE_OPEN_ARR : EASE_CLOSE_ARR,
    }
    const FADE_STYLE = fadeStyle(expanded)
    const SIZE_STYLE = sizeStyle(expanded)

    const doneCount = checklist.filter((c) => c.done).length
    const total = checklist.length
    const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0

    return (
        <motion.div
            layout
            transition={T}
            onClick={() => setExpanded((v) => !v)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    setExpanded((v) => !v)
                }
            }}
            className={cn(
                "relative cursor-pointer select-none rounded-[20px] border bg-card text-card-foreground",
                "shadow-sm hover:shadow-md transition-shadow",
                "w-full max-w-md overflow-hidden",
                className,
            )}
        >
            {/* HEADER — rendered ONCE. The title and icon size/font-size
              * interpolate via CSS so there's no doubled "Design System"
              * during the crossfade. Padding also CSS-transitions so the
              * header's position smoothly adjusts between collapsed and
              * expanded layouts. */}
            <div
                style={SIZE_STYLE}
                className={cn(
                    "flex items-center gap-3",
                    expanded ? "px-5 pt-5" : "px-4 pt-3.5",
                )}
            >
                <div
                    style={SIZE_STYLE}
                    className={cn(
                        "shrink-0 flex items-center justify-center rounded-lg border bg-background",
                        expanded ? "h-10 w-10" : "h-8 w-8",
                    )}
                >
                    <Hexagon
                        className={cn(expanded ? "h-4 w-4" : "h-3.5 w-3.5")}
                        style={SIZE_STYLE}
                        strokeWidth={1.75}
                    />
                </div>
                <span
                    style={SIZE_STYLE}
                    className={cn(
                        "font-bold tracking-tight whitespace-nowrap",
                        expanded ? "text-[22px]" : "text-[15px]",
                    )}
                >
                    {title}
                </span>

                {/* Right side of header crossfades between inline progress
                  * (collapsed) and menu button (expanded). Same CSS-opacity
                  * pattern as the body layers below. */}
                <div className="ml-auto relative flex items-center justify-end min-h-[36px] min-w-[44%]">
                    <div
                        aria-hidden={expanded}
                        style={{ ...FADE_STYLE, opacity: expanded ? 0 : 1 }}
                        className={cn(
                            "flex items-center gap-3 w-full",
                            expanded && "pointer-events-none absolute inset-0",
                        )}
                        onMouseEnter={(e) => {
                            if (expanded) return
                            e.stopPropagation()
                            setBarHover(true)
                        }}
                        onMouseLeave={() => !expanded && setBarHover(false)}
                    >
                        <ProgressBar pct={pct} barHover={!expanded && barHover} />
                        <span className="text-sm font-medium text-muted-foreground tabular-nums whitespace-nowrap">
                            {pct}%
                        </span>
                    </div>
                    <button
                        type="button"
                        aria-hidden={!expanded}
                        tabIndex={expanded ? 0 : -1}
                        style={{ ...FADE_STYLE, opacity: expanded ? 1 : 0 }}
                        onClick={(e) => expanded && e.stopPropagation()}
                        className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-lg border bg-background hover:bg-muted/60",
                            !expanded && "pointer-events-none absolute inset-y-0 right-0",
                        )}
                        aria-label="Task menu"
                    >
                        <MoreHorizontal className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* BODY — below the header. Two complete bodies always
              * rendered. Active one in flow (drives the remainder of the
              * card height). Inactive one absolute on top, opacity 0.
              * Card height interpolates via layout. */}
            <div className="relative">
                <div
                    aria-hidden={expanded}
                    style={{ ...FADE_STYLE, opacity: expanded ? 0 : 1 }}
                    className={cn(
                        expanded && "pointer-events-none absolute inset-x-0 top-0",
                    )}
                >
                    <CollapsedBody
                        priority={priority}
                        status={status}
                        members={members}
                    />
                </div>

                <div
                    aria-hidden={!expanded}
                    style={{ ...FADE_STYLE, opacity: expanded ? 1 : 0 }}
                    className={cn(
                        !expanded && "pointer-events-none absolute inset-x-0 top-0",
                    )}
                >
                    <ExpandedBody
                        expanded={expanded}
                        priority={priority}
                        status={status}
                        checklist={checklist}
                        members={members}
                        pct={pct}
                        doneCount={doneCount}
                        total={total}
                        barHover={expanded && barHover}
                        setBarHover={setBarHover}
                        interactive={expanded}
                    />
                </div>
            </div>
        </motion.div>
    )
}

// ───────────────────────────── COLLAPSED ─────────────────────────────

interface CollapsedBodyProps {
    priority: TaskCardProps["priority"]
    status: TaskCardProps["status"]
    members: TaskMember[]
}

function CollapsedBody({ priority, status, members }: CollapsedBodyProps) {
    return (
        <div className="flex items-center gap-5 px-4 pt-3 pb-3.5">
            <span className="inline-flex items-center gap-2 text-[15px]">
                <Flag className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
                {priority}
            </span>
            <span className="inline-flex items-center gap-2 text-[15px]">
                <Hourglass
                    className="h-4 w-4 text-muted-foreground"
                    strokeWidth={1.75}
                />
                {status}
            </span>
            <div className="ml-auto flex -space-x-2">
                {members.map((m) => (
                    <div
                        key={m.id}
                        className={cn(
                            "h-8 w-8 rounded-full ring-[3px] ring-card flex items-center justify-center text-xs font-semibold text-foreground/80",
                            AVATAR_BG[m.accent || "zinc"],
                        )}
                    >
                        {m.name.charAt(0).toUpperCase()}
                    </div>
                ))}
            </div>
        </div>
    )
}

// ───────────────────────────── EXPANDED ──────────────────────────────

interface ExpandedBodyProps {
    expanded: boolean
    priority: TaskCardProps["priority"]
    status: TaskCardProps["status"]
    checklist: TaskChecklistItem[]
    members: TaskMember[]
    pct: number
    doneCount: number
    total: number
    barHover: boolean
    setBarHover: (v: boolean) => void
    interactive: boolean
}

function ExpandedBody({
    expanded,
    priority,
    status,
    checklist,
    members,
    pct,
    doneCount,
    total,
    barHover,
    setBarHover,
    interactive,
}: ExpandedBodyProps) {
    // Per-row offsets give each row a directional origin in the
    // collapsed layout. Same offsets apply in both directions so close
    // is the literal reverse of open.
    return (
        <div>
            <div
                style={slideStyle(expanded, 0, -16)}
                className="mx-5 mt-4 px-3 py-2 rounded-full border bg-background flex items-center gap-2.5"
                onMouseEnter={(e) => {
                    if (!interactive) return
                    e.stopPropagation()
                    setBarHover(true)
                }}
                onMouseLeave={() => interactive && setBarHover(false)}
            >
                <span className="inline-flex items-center justify-center h-4 w-4 shrink-0 rounded-full border-2 border-zinc-300 dark:border-zinc-600">
                    <Check className="h-2 w-2 text-zinc-400" strokeWidth={3} />
                </span>
                <span className="text-sm font-medium whitespace-nowrap">
                    {doneCount} of {total}
                </span>
                <div className="flex-1">
                    <ProgressBar pct={pct} barHover={interactive && barHover} />
                </div>
                <span className="text-sm font-medium text-muted-foreground tabular-nums whitespace-nowrap">
                    {pct}%
                </span>
            </div>

            <div style={slideStyle(expanded, 0, -24)} className="px-5 pt-5">
                <ul className="relative pl-8 space-y-3.5">
                    <span
                        aria-hidden
                        className="absolute left-3 top-0 bottom-3 w-px bg-border"
                    />
                    {checklist.map((item) => (
                        <li
                            key={item.id}
                            className="relative flex items-center gap-3 text-base"
                        >
                            <span
                                aria-hidden
                                className="absolute -left-5 top-1/2 w-4 h-px bg-border"
                            />
                            <span
                                className={cn(
                                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                                    item.done
                                        ? "bg-zinc-800 dark:bg-zinc-200"
                                        : "border-2 border-zinc-300 dark:border-zinc-600 bg-transparent",
                                )}
                            >
                                {item.done && (
                                    <Check
                                        className="h-3 w-3 text-white dark:text-zinc-900"
                                        strokeWidth={3}
                                    />
                                )}
                            </span>
                            <span
                                className={cn(
                                    item.done
                                        ? "text-foreground"
                                        : "text-muted-foreground",
                                )}
                            >
                                {item.label}
                            </span>
                        </li>
                    ))}
                </ul>
            </div>

            <div className="px-5 pt-5 space-y-3.5">
                {/* Priority pill comes from the LEFT — same direction as
                  * the "Urgent" inline text it morphs out of in the
                  * collapsed meta row. */}
                <div
                    style={slideStyle(expanded, -56, -32)}
                    className="flex items-center gap-3"
                >
                    <Flag
                        className="h-4 w-4 text-muted-foreground shrink-0"
                        strokeWidth={1.75}
                    />
                    <span className="text-[15px] text-muted-foreground">Priority</span>
                    <span
                        className={cn(
                            "inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[13px] font-medium",
                            PRIORITY_PILL[priority],
                        )}
                    >
                        {priority}
                        <ChevronDown className="h-3 w-3" strokeWidth={2.5} />
                    </span>
                </div>
                {/* Status pill also from the LEFT, slightly further out so
                  * it appears to slide UNDER priority into its slot. */}
                <div
                    style={slideStyle(expanded, -72, -40)}
                    className="flex items-center gap-3"
                >
                    <Hourglass
                        className="h-4 w-4 text-muted-foreground shrink-0"
                        strokeWidth={1.75}
                    />
                    <span className="text-[15px] text-muted-foreground">Status</span>
                    <span
                        className={cn(
                            "inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[13px] font-medium",
                            STATUS_PILL[status],
                        )}
                    >
                        {status}
                        <ChevronDown className="h-3 w-3" strokeWidth={2.5} />
                    </span>
                </div>
            </div>

            {/* Member chips come from the RIGHT — where the stacked
              * avatars sat in the collapsed meta row. */}
            <div
                style={slideStyle(expanded, 80, -48)}
                className="px-5 pt-5 pb-5 flex flex-wrap gap-2"
            >
                {members.map((m) => (
                    <div
                        key={m.id}
                        className={cn(
                            "inline-flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border",
                            CHIP_BG[m.accent || "zinc"],
                        )}
                    >
                        <div
                            className={cn(
                                "h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold text-foreground/80",
                                AVATAR_BG[m.accent || "zinc"],
                            )}
                        >
                            {m.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-[14px] font-medium">{m.name}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

// ─────────────────────────── PROGRESS BAR ────────────────────────────

function ProgressBar({ pct, barHover }: { pct: number; barHover: boolean }) {
    return (
        <div className="relative flex-1 h-2.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
            <div
                className="absolute inset-y-0 left-0 bg-emerald-500 rounded-full overflow-hidden"
                style={{ width: `${pct}%` }}
            >
                <motion.div
                    className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/80 to-transparent"
                    style={{ filter: "blur(2px)" }}
                    initial={{ x: "-150%" }}
                    animate={barHover ? { x: "350%" } : { x: "-150%" }}
                    transition={
                        barHover
                            ? {
                                  duration: 1.4,
                                  ease: "easeInOut",
                                  repeat: Infinity,
                                  repeatDelay: 0.8,
                              }
                            : { duration: 0 }
                    }
                />
            </div>
        </div>
    )
}
