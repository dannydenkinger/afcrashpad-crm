"use client"

import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * Lazy-loaded recharts components to reduce initial bundle size.
 * Import these instead of directly importing from "recharts" in page-level components.
 */

const ChartSkeleton = () => <Skeleton className="h-full w-full rounded-xl" />

export const LazyAreaChart = dynamic(
    () => import("recharts").then((mod) => mod.AreaChart),
    { loading: ChartSkeleton, ssr: false }
)

export const LazyPieChart = dynamic(
    () => import("recharts").then((mod) => mod.PieChart),
    { loading: ChartSkeleton, ssr: false }
)

export const LazyResponsiveContainer = dynamic(
    () => import("recharts").then((mod) => mod.ResponsiveContainer),
    { loading: ChartSkeleton, ssr: false }
)

// Re-export lightweight components that don't need lazy loading
// (they're sub-components used inside charts and have negligible size)
export {
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Area,
    Pie,
    Cell,
    Legend,
} from "recharts"
