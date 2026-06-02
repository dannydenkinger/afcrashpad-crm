import { PageHeaderSkeleton, KpiStripSkeleton, ChartCardsSkeleton } from "@/components/ui/LoadingPatterns"

export default function Loading() {
    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-6">
            <PageHeaderSkeleton />
            <KpiStripSkeleton count={4} />
            <ChartCardsSkeleton columns={2} height={240} />
        </div>
    )
}
