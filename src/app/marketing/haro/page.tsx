"use client"

import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"

const HaroDashboard = dynamic(
    () => import("./HaroDashboard").then((m) => ({ default: m.HaroDashboard })),
    {
        loading: () => <Skeleton className="h-[500px] w-full rounded-xl" />,
        ssr: false,
    },
)

export default function MarketingHaroPage() {
    return (
        <div className="container mx-auto max-w-6xl py-8 px-4">
            <HaroDashboard />
        </div>
    )
}
