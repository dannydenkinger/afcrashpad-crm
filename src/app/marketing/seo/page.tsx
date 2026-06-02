"use client"

import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"

const SEODashboard = dynamic(() => import("./SEODashboard"), {
    loading: () => <Skeleton className="h-[500px] w-full rounded-xl" />,
    ssr: false,
})

export default function MarketingSeoPage() {
    return (
        <div className="container mx-auto max-w-6xl py-8 px-4">
            <SEODashboard />
        </div>
    )
}
