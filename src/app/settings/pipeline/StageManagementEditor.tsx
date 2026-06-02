"use client"

import { useEffect, useState, useCallback } from "react"
import { Loader2, ArrowUp, ArrowDown, Clock, Info } from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
    getStageManagement,
    updateStageStaleness,
    reorderStages,
    type StageManagementRow,
} from "./actions"

/**
 * Stage configuration UI — ordering + staleness threshold per stage.
 * Lives next to (not inside) the StageProbabilityEditor because
 * "what does the forecast think this stage is worth" and "how do we
 * physically arrange and time-box stages" are different mental models,
 * even if they share the same underlying stage docs.
 *
 * Reorder is up/down arrow controls rather than drag-and-drop —
 * simpler implementation, perfectly accessible, no extra dependencies.
 */
export function StageManagementEditor() {
    const [rows, setRows] = useState<StageManagementRow[]>([])
    const [loading, setLoading] = useState(true)
    /** Stage IDs currently mid-save, so we can disable interactions per row. */
    const [savingId, setSavingId] = useState<string | null>(null)
    /** Per-stage drafts so the input doesn't fight controlled state on each keystroke. */
    const [draft, setDraft] = useState<Record<string, string>>({})

    const refresh = useCallback(async () => {
        const res = await getStageManagement()
        if (res.success && res.rows) setRows(res.rows)
        setLoading(false)
    }, [])

    useEffect(() => { refresh() }, [refresh])

    const handleStalenessSave = async (row: StageManagementRow) => {
        const raw = draft[row.stageId]
        if (raw === undefined) return
        const num = raw === "" ? null : Number(raw)
        if (num !== null && (!Number.isFinite(num) || num < 0 || num > 999)) {
            toast.error("Days must be 0–999")
            return
        }
        if (num === row.stalenessThresholdDays) return
        setSavingId(row.stageId)
        const res = await updateStageStaleness(row.pipelineId, row.stageId, num)
        setSavingId(null)
        if (!res.success) {
            toast.error(res.error || "Failed to save")
            return
        }
        toast.success(`${row.stageName}: ${num === null ? "no staleness alerts" : `flag after ${num} days`}`)
        setDraft((d) => {
            const next = { ...d }
            delete next[row.stageId]
            return next
        })
        await refresh()
    }

    const handleMove = async (pipelineId: string, stageId: string, direction: -1 | 1) => {
        const pipelineRows = rows.filter((r) => r.pipelineId === pipelineId)
        const idx = pipelineRows.findIndex((r) => r.stageId === stageId)
        const swapIdx = idx + direction
        if (idx < 0 || swapIdx < 0 || swapIdx >= pipelineRows.length) return
        const reordered = [...pipelineRows]
        const [moved] = reordered.splice(idx, 1)
        reordered.splice(swapIdx, 0, moved)

        // Optimistic UI: update local state immediately
        const newRowsForPipeline = reordered.map((r, i) => ({ ...r, order: i }))
        setRows((prev) => {
            const others = prev.filter((r) => r.pipelineId !== pipelineId)
            return [...others, ...newRowsForPipeline]
        })

        setSavingId(stageId)
        const res = await reorderStages(pipelineId, reordered.map((r) => r.stageId))
        setSavingId(null)
        if (!res.success) {
            toast.error(res.error || "Failed to reorder")
            await refresh()
            return
        }
        toast.success(`Moved ${moved.stageName}`)
    }

    if (loading) {
        return (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading stages…
            </div>
        )
    }

    if (rows.length === 0) {
        return <div className="text-sm text-muted-foreground">No pipeline stages found yet.</div>
    }

    // Group by pipeline, preserving the order field within each group
    const grouped = rows.reduce<Record<string, { name: string; stages: StageManagementRow[] }>>((acc, r) => {
        if (!acc[r.pipelineId]) acc[r.pipelineId] = { name: r.pipelineName, stages: [] }
        acc[r.pipelineId].stages.push(r)
        return acc
    }, {})
    for (const id of Object.keys(grouped)) {
        grouped[id].stages.sort((a, b) => a.order - b.order)
    }

    return (
        <TooltipProvider delayDuration={150}>
            <div className="space-y-6">
                <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground space-y-2">
                    <div className="flex items-start gap-2">
                        <Clock className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-500" />
                        <div>
                            <p className="font-medium text-foreground">Staleness thresholds</p>
                            <p className="mt-1">
                                If a deal sits in a stage for more than the threshold (in days) without
                                moving, it gets flagged as stale on the kanban and a notification fires
                                to the deal&apos;s owner. Leave blank or set to 0 to disable for that stage.
                                Useful for "deals stuck in Negotiation for 30+ days need a follow-up call."
                            </p>
                        </div>
                    </div>
                    <div className="flex items-start gap-2">
                        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                        <div>
                            <p className="font-medium text-foreground">Reordering</p>
                            <p className="mt-1">
                                Use the arrows to move a stage up or down in the kanban view. Cards in
                                that stage stay where they are — only the column order changes.
                            </p>
                        </div>
                    </div>
                </div>

                {Object.entries(grouped).map(([pipelineId, { name, stages }]) => (
                    <div key={pipelineId} className="space-y-2">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{name}</h4>
                        <div className="rounded-md border border-border/60 overflow-hidden">
                            <div className="grid grid-cols-[1fr_120px_120px] items-center gap-3 bg-muted/40 px-3 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                                <span>Stage</span>
                                <span className="text-right">Stale after (days)</span>
                                <span className="text-right">Reorder</span>
                            </div>
                            {stages.map((row, idx) => {
                                const pending = draft[row.stageId]
                                const valueShown = pending !== undefined
                                    ? pending
                                    : (row.stalenessThresholdDays === null ? "" : String(row.stalenessThresholdDays))
                                const dirty = pending !== undefined && Number(pending || 0) !== (row.stalenessThresholdDays ?? 0)
                                return (
                                    <div
                                        key={row.stageId}
                                        className="grid grid-cols-[1fr_120px_120px] items-center gap-3 px-3 py-2 border-t border-border/40 text-sm"
                                    >
                                        <span className="font-medium truncate">{row.stageName}</span>

                                        {/* Staleness threshold */}
                                        <div className="flex items-center justify-end gap-1">
                                            <Input
                                                type="number"
                                                min={0}
                                                max={999}
                                                value={valueShown}
                                                onChange={(e) => setDraft((d) => ({ ...d, [row.stageId]: e.target.value }))}
                                                onBlur={() => handleStalenessSave(row)}
                                                onKeyDown={(e) => { if (e.key === "Enter") handleStalenessSave(row) }}
                                                placeholder="off"
                                                className="h-7 w-20 text-right text-xs tabular-nums px-2"
                                                disabled={savingId === row.stageId}
                                            />
                                            {dirty && savingId !== row.stageId && (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-6 px-1.5 text-[10px]"
                                                    onClick={() => handleStalenessSave(row)}
                                                >
                                                    Save
                                                </Button>
                                            )}
                                            {savingId === row.stageId && <Loader2 className="h-3 w-3 animate-spin" />}
                                        </div>

                                        {/* Reorder */}
                                        <div className="flex items-center justify-end gap-1">
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-7 w-7 p-0"
                                                        onClick={() => handleMove(row.pipelineId, row.stageId, -1)}
                                                        disabled={idx === 0 || savingId === row.stageId}
                                                    >
                                                        <ArrowUp className="h-3.5 w-3.5" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>Move up</TooltipContent>
                                            </Tooltip>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-7 w-7 p-0"
                                                        onClick={() => handleMove(row.pipelineId, row.stageId, 1)}
                                                        disabled={idx === stages.length - 1 || savingId === row.stageId}
                                                    >
                                                        <ArrowDown className="h-3.5 w-3.5" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>Move down</TooltipContent>
                                            </Tooltip>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </TooltipProvider>
    )
}
