import { Skeleton } from "@/components/ui/skeleton"

/**
 * Shared loading skeleton compositions used by route-level loading.tsx files
 * and Suspense fallbacks. Picks visual shapes that match the kind of UI being
 * loaded so the layout doesn't shift when content arrives.
 *
 *   <PageHeaderSkeleton />              // Gradient-style page title + subtitle
 *   <FilterBarSkeleton />               // Search + filter pills row
 *   <KpiStripSkeleton count={4} />      // Grid of KPI cards
 *   <ListRowsSkeleton count={8} />      // Vertical stack of row chips
 *   <KanbanColumnsSkeleton columns={4} />
 *   <ChartCardsSkeleton columns={2} />  // Tall card panels
 *   <TableSkeleton rows={8} columns={5} />
 *
 * All shapes are width-stable so the page layout doesn't jump on data load.
 */

export function PageHeaderSkeleton() {
    return (
        <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
        </div>
    )
}

export function FilterBarSkeleton() {
    return (
        <div className="flex items-center gap-2 flex-wrap">
            <Skeleton className="h-9 w-full max-w-sm" />
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-24" />
        </div>
    )
}

export function KpiStripSkeleton({ count = 4 }: { count?: number }) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="rounded-xl border bg-card/40 p-4 space-y-2">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-7 w-24" />
                    <Skeleton className="h-3 w-16" />
                </div>
            ))}
        </div>
    )
}

export function ListRowsSkeleton({ count = 8 }: { count?: number }) {
    return (
        <div className="space-y-2">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg border bg-card/30">
                    <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                    <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3.5 w-1/3" />
                        <Skeleton className="h-3 w-1/2" />
                    </div>
                    <Skeleton className="h-6 w-16 rounded-full" />
                </div>
            ))}
        </div>
    )
}

export function KanbanColumnsSkeleton({ columns = 4 }: { columns?: number }) {
    return (
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
            {Array.from({ length: columns }).map((_, c) => (
                <div key={c} className="rounded-xl border bg-card/40 p-3 space-y-3 min-h-[400px]">
                    <div className="flex items-center justify-between">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-6 rounded-full" />
                    </div>
                    {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-24 rounded-lg" />
                    ))}
                </div>
            ))}
        </div>
    )
}

export function ChartCardsSkeleton({ columns = 2, height = 240 }: { columns?: number; height?: number }) {
    return (
        <div className={`grid gap-4 ${columns === 2 ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"}`}>
            {Array.from({ length: columns }).map((_, i) => (
                <div key={i} className="rounded-xl border bg-card/40 p-4 space-y-3">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className={`w-full rounded-md`} style={{ height: `${height}px` }} />
                </div>
            ))}
        </div>
    )
}

export function TableSkeleton({ rows = 8, columns = 5 }: { rows?: number; columns?: number }) {
    return (
        <div className="rounded-md border bg-card/30">
            <div className="border-b px-4 py-2.5 flex items-center gap-3">
                {Array.from({ length: columns }).map((_, i) => (
                    <Skeleton key={i} className="h-3.5 w-20" />
                ))}
            </div>
            {Array.from({ length: rows }).map((_, r) => (
                <div key={r} className="border-b last:border-b-0 px-4 py-3 flex items-center gap-3">
                    {Array.from({ length: columns }).map((_, c) => (
                        <Skeleton key={c} className="h-4 w-20" />
                    ))}
                </div>
            ))}
        </div>
    )
}
