import { PageHeaderSkeleton, FilterBarSkeleton, ListRowsSkeleton } from "@/components/ui/LoadingPatterns"

export default function Loading() {
    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-6">
            <PageHeaderSkeleton />
            <FilterBarSkeleton />
            <ListRowsSkeleton count={7} />
        </div>
    )
}
