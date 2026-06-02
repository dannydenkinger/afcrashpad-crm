import { PageHeaderSkeleton, ChartCardsSkeleton } from "@/components/ui/LoadingPatterns"
import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-6">
            <PageHeaderSkeleton />
            <div className="flex items-center justify-between">
                <Skeleton className="h-9 w-32" />
                <Skeleton className="h-9 w-40" />
            </div>
            <ChartCardsSkeleton columns={1} height={500} />
        </div>
    )
}
