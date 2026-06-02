"use client"

import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"

const AnalyticsDashboard = dynamic(() => import("../AnalyticsDashboard"), {
    loading: () => <Skeleton className="h-[500px] w-full rounded-xl" />,
    ssr: false,
})

export default function MarketingAnalyticsPage() {
    return (
        <div className="container mx-auto max-w-6xl py-8 px-4">
            <AnalyticsDashboard />
        </div>
    )
}
