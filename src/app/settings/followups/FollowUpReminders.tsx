"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Clock, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { getFollowUpConfig, updateFollowUpConfig } from "./actions"
import type { FollowUpConfig } from "./types"

interface PipelineInfo {
    id: string
    name: string
}

interface FollowUpRemindersProps {
    pipelines: PipelineInfo[]
}

export function FollowUpReminders({ pipelines }: FollowUpRemindersProps) {
    const [config, setConfig] = useState<FollowUpConfig>({
        enabled: false,
        daysThreshold: 7,
        pipelineIds: [],
    })
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        async function load() {
            const res = await getFollowUpConfig()
            if (res.success && res.config) setConfig(res.config)
            setIsLoading(false)
        }
        load()
    }, [])

    const handleToggle = async (enabled: boolean) => {
        setConfig(prev => ({ ...prev, enabled }))
        const res = await updateFollowUpConfig({ enabled })
        if (!res.success) {
            setConfig(prev => ({ ...prev, enabled: !enabled }))
            toast.error("Failed to update setting.")
        }
    }

    const handleDaysChange = async (value: string) => {
        const days = parseInt(value)
        if (isNaN(days) || days < 1) return
        setConfig(prev => ({ ...prev, daysThreshold: days }))
        // Debounce: save after a brief delay
        await updateFollowUpConfig({ daysThreshold: days })
    }

    const handleTogglePipeline = async (pipelineId: string) => {
        const newIds = config.pipelineIds.includes(pipelineId)
            ? config.pipelineIds.filter(id => id !== pipelineId)
            : [...config.pipelineIds, pipelineId]

        setConfig(prev => ({ ...prev, pipelineIds: newIds }))
        const res = await updateFollowUpConfig({ pipelineIds: newIds })
        if (!res.success) {
            toast.error("Failed to update pipeline selection.")
        }
    }

    if (isLoading) {
        return (
            <Card>
                <CardContent className="p-12 text-center text-muted-foreground">Loading follow-up settings...</CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row gap-4 items-start w-full">
                    <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-500/10 text-orange-500">
                        <AlertCircle className="h-5 w-5" />
                    </div>
                    <div className="flex flex-col flex-1 space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-base sm:text-lg">Follow-Up Reminders</h3>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Automatically create follow-up tasks when deals haven&apos;t been updated within a configurable number of days.
                        </p>

                        {config.enabled && (
                            <div className="pt-4 space-y-4">
                                {/* Days Threshold */}
                                <div className="flex items-center gap-3">
                                    <Label className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                                        Days before stale:
                                    </Label>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            type="number"
                                            min="1"
                                            max="90"
                                            className="w-20 h-8 text-center"
                                            value={config.daysThreshold}
                                            onChange={e => handleDaysChange(e.target.value)}
                                        />
                                        <span className="text-xs text-muted-foreground">days</span>
                                    </div>
                                </div>

                                {/* Pipeline Selection */}
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium text-muted-foreground">
                                        Apply to pipelines:
                                    </Label>
                                    <p className="text-xs text-muted-foreground">
                                        Leave all unchecked to apply to all pipelines.
                                    </p>
                                    <div className="space-y-1.5">
                                        {pipelines.map(p => (
                                            <label
                                                key={p.id}
                                                className="flex items-center gap-2.5 p-2 rounded hover:bg-muted/50 cursor-pointer"
                                            >
                                                <Checkbox
                                                    checked={config.pipelineIds.includes(p.id)}
                                                    onCheckedChange={() => handleTogglePipeline(p.id)}
                                                />
                                                <span className="text-sm">{p.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-md p-3 border">
                                    <Clock className="h-3.5 w-3.5 shrink-0" />
                                    <span>
                                        A cron job checks daily for stale deals and creates follow-up tasks assigned to the deal owner.
                                        Duplicate reminders are not created if one already exists.
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-3 sm:ml-auto shrink-0 sm:pl-10 sm:border-l border-border/50">
                        <span className="text-sm font-medium text-muted-foreground w-12 text-right">
                            {config.enabled ? "Active" : "Paused"}
                        </span>
                        <Switch checked={config.enabled} onCheckedChange={handleToggle} />
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
