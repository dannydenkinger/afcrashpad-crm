"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
    UserPlus,
    DollarSign,
    CheckCircle,
    Mail,
    Clock,
    Activity,
} from "lucide-react"
import { getRecentActivity } from "./actions"
import type { ActivityItem } from "./types"
import Link from "next/link"

const ACTIVITY_CONFIG: Record<ActivityItem['type'], { icon: typeof UserPlus; iconColor: string; bgColor: string }> = {
    contact_added: { icon: UserPlus, iconColor: "text-blue-500", bgColor: "bg-blue-500/10" },
    deal_stage_change: { icon: DollarSign, iconColor: "text-emerald-500", bgColor: "bg-emerald-500/10" },
    task_completed: { icon: CheckCircle, iconColor: "text-amber-500", bgColor: "bg-amber-500/10" },
    communication_sent: { icon: Mail, iconColor: "text-violet-500", bgColor: "bg-violet-500/10" },
}

function relativeTime(isoString: string): string {
    const now = Date.now()
    const then = new Date(isoString).getTime()
    const diffMs = now - then
    const diffSec = Math.floor(diffMs / 1000)
    const diffMin = Math.floor(diffSec / 60)
    const diffHr = Math.floor(diffMin / 60)
    const diffDay = Math.floor(diffHr / 24)

    if (diffSec < 60) return "just now"
    if (diffMin < 60) return `${diffMin}m ago`
    if (diffHr < 24) return `${diffHr}h ago`
    if (diffDay < 7) return `${diffDay}d ago`
    if (diffDay < 30) return `${Math.floor(diffDay / 7)}w ago`
    return `${Math.floor(diffDay / 30)}mo ago`
}

export function ActivityFeed() {
    const [activities, setActivities] = useState<ActivityItem[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        getRecentActivity().then(result => {
            if (result.success && result.data) {
                setActivities(result.data)
            }
            setLoading(false)
        })
    }, [])

    return (
        <Card className="border-none shadow-md bg-card/40 backdrop-blur-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 sm:p-6 pb-4">
                <div className="space-y-1">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <Activity className="h-4 w-4 text-primary" />
                        Recent Activity
                    </CardTitle>
                    <CardDescription className="text-xs">Latest actions across your CRM</CardDescription>
                </div>
                <Clock className="h-4 w-4 text-muted-foreground opacity-50" />
            </CardHeader>
            <CardContent className="pt-0 px-4 sm:px-6 pb-4 sm:pb-6">
                {loading ? (
                    <div className="space-y-4">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="flex items-start gap-3">
                                <div className="h-8 w-8 rounded-full bg-muted/30 animate-pulse shrink-0" />
                                <div className="flex-1 space-y-1.5">
                                    <div className="h-3.5 w-3/4 bg-muted/30 rounded animate-pulse" />
                                    <div className="h-3 w-1/4 bg-muted/20 rounded animate-pulse" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : activities.length === 0 ? (
                    <div className="py-12 flex flex-col items-center justify-center text-muted-foreground">
                        <Activity className="h-10 w-10 mb-3 opacity-15" />
                        <p className="text-sm font-medium">No recent activity</p>
                        <p className="text-xs mt-1 text-muted-foreground/70">
                            Activity will appear here as you use the CRM
                        </p>
                    </div>
                ) : (
                    <ScrollArea className="h-[360px] pr-3">
                        <div className="relative">
                            {/* Vertical timeline line */}
                            <div className="absolute left-[15px] top-2 bottom-2 w-[1px] bg-border/40" />

                            <div className="space-y-1">
                                {activities.map((activity) => {
                                    const config = ACTIVITY_CONFIG[activity.type]
                                    const Icon = config.icon

                                    return (
                                        <Link
                                            key={activity.id}
                                            href={activity.linkHref}
                                            className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/20 transition-colors group relative"
                                        >
                                            {/* Icon with colored background */}
                                            <div className={`relative z-10 flex items-center justify-center h-[30px] w-[30px] rounded-full shrink-0 ${config.bgColor}`}>
                                                <Icon className={`h-3.5 w-3.5 ${config.iconColor}`} />
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0 pt-0.5">
                                                <p className="text-xs font-medium text-foreground/90 leading-snug line-clamp-2 group-hover:text-foreground transition-colors">
                                                    {activity.description}
                                                </p>
                                                <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">
                                                    {relativeTime(activity.timestamp)}
                                                </p>
                                            </div>
                                        </Link>
                                    )
                                })}
                            </div>
                        </div>
                    </ScrollArea>
                )}
            </CardContent>
        </Card>
    )
}
