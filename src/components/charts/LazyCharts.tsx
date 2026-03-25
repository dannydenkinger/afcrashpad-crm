"use client"

/**
 * Lazy-loaded recharts wrapper components.
 *
 * Recharts sub-components (XAxis, Cell, Pie, etc.) cannot be individually
 * wrapped with next/dynamic because recharts uses React.Children to inspect
 * them — a dynamic wrapper breaks that introspection.
 *
 * Instead, we provide pre-built chart wrapper components that are themselves
 * dynamically loaded. Each wrapper accepts data + config props and renders
 * the full recharts tree internally, keeping all recharts imports in one
 * code-split chunk.
 */

import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"

const ChartSkeleton = () => <Skeleton className="h-full w-full rounded-xl" />

// ── Container components (safe to dynamic-wrap individually) ──────────────

export const LazyResponsiveContainer = dynamic(
    () => import("recharts").then((mod) => mod.ResponsiveContainer),
    { loading: ChartSkeleton, ssr: false }
)

// ── Full chart wrappers (recharts loaded in a single code-split chunk) ────

export const LazyAreaChartWrapper = dynamic(
    () => import("./RechartsAreaChart"),
    { loading: ChartSkeleton, ssr: false }
)

export const LazyPieChartWrapper = dynamic(
    () => import("./RechartsPieChart"),
    { loading: ChartSkeleton, ssr: false }
)
