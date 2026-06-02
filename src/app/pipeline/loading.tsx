import { PageHeaderSkeleton, FilterBarSkeleton, KanbanColumnsSkeleton } from "@/components/ui/LoadingPatterns"

export default function Loading() {
    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-6">
            <PageHeaderSkeleton />
            <FilterBarSkeleton />
            <div className="hidden md:block">
                <KanbanColumnsSkeleton columns={4} />
            </div>
        </div>
    )
}
