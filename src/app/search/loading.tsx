import { PageHeaderSkeleton, ListRowsSkeleton } from "@/components/ui/LoadingPatterns"
import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-6">
            <PageHeaderSkeleton />
            <Skeleton className="h-11 w-full rounded-lg" />
            <ListRowsSkeleton count={5} />
        </div>
    )
}
