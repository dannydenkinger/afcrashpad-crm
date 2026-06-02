"use client"

import { useState, useEffect, useCallback } from "react"
import { Loader2, Sparkles, AlertTriangle, Info } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
    getStageProbabilities,
    updateStageProbability,
    type StageProbabilityRow,
} from "./actions"
import { SMART_PROBABILITY_MIN_SAMPLES } from "./types"

/**
 * Per-stage probability editor. Each stage has:
 *   - A manual % (used for the dashboard's weighted forecast)
 *   - A mode toggle: "Manual" (default) or "Smart"
 *
 * Smart mode computes the % from historical opportunities — what fraction of
 * deals that ever entered this stage eventually reached a won stage. Below
 * SMART_PROBABILITY_MIN_SAMPLES historical samples, the dashboard ignores
 * the smart number and silently falls back to the manual value (we still
 * display it, with a warning, so users see the trend forming).
 */
export function StageProbabilityEditor() {
    const [rows, setRows] = useState<StageProbabilityRow[]>([])
    const [loading, setLoading] = useState(true)
    const [savingKey, setSavingKey] = useState<string | null>(null)
    // Local edits keyed by stageId. `undefined` means "no pending edit".
    const [draft, setDraft] = useState<Record<string, number | undefined>>({})

    const refresh = useCallback(async () => {
        const res = await getStageProbabilities()
        if (res.success && res.rows) setRows(res.rows)
        setLoading(false)
    }, [])

    useEffect(() => {
        refresh()
    }, [refresh])

    const handleManualChange = (stageId: string, raw: string) => {
        const num = raw === "" ? 0 : Number(raw)
        if (!Number.isFinite(num)) return
        setDraft((d) => ({ ...d, [stageId]: Math.max(0, Math.min(100, Math.round(num))) }))
    }

    const handleSaveManual = async (row: StageProbabilityRow) => {
        const pending = draft[row.stageId]
        if (pending === undefined || pending === row.manualProbability) return
        setSavingKey(row.stageId)
        const res = await updateStageProbability(row.pipelineId, row.stageId, { probability: pending })
        setSavingKey(null)
        if (!res.success) {
            toast.error(res.error || "Failed to save probability")
            return
        }
        toast.success(`${row.stageName}: ${pending}%`)
        setDraft((d) => {
            const next = { ...d }
            delete next[row.stageId]
            return next
        })
        await refresh()
    }

    const handleToggleMode = async (row: StageProbabilityRow) => {
        const nextMode: "manual" | "smart" = row.mode === "smart" ? "manual" : "smart"
        setSavingKey(row.stageId)
        const res = await updateStageProbability(row.pipelineId, row.stageId, { mode: nextMode })
        setSavingKey(null)
        if (!res.success) {
            toast.error(res.error || "Failed to switch mode")
            return
        }
        toast.success(`${row.stageName} → ${nextMode === "smart" ? "Smart" : "Manual"}`)
        await refresh()
    }

    if (loading) {
        return (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading stages…
            </div>
        )
    }

    if (rows.length === 0) {
        return <div className="text-sm text-muted-foreground">No pipeline stages found yet.</div>
    }

    // Group rows by pipeline
    const grouped = rows.reduce<Record<string, { name: string; stages: StageProbabilityRow[] }>>((acc, r) => {
        if (!acc[r.pipelineId]) acc[r.pipelineId] = { name: r.pipelineName, stages: [] }
        acc[r.pipelineId].stages.push(r)
        return acc
    }, {})

    return (
        <TooltipProvider delayDuration={150}>
            <div className="space-y-6">
                {/* How it works */}
                <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground space-y-2">
                    <div className="flex items-start gap-2">
                        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                        <div>
                            <p className="font-medium text-foreground">How probability works</p>
                            <p className="mt-1">
                                Each stage has a probability — the % chance a deal in that stage will close.
                                These percentages drive the <span className="font-medium text-foreground">Weighted Pipeline Forecast</span> on
                                your dashboard: each open deal is multiplied by its stage&apos;s probability and
                                summed. A $10,000 deal in a 40% stage contributes $4,000 to the forecast.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-start gap-2 pt-1">
                        <Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0 text-violet-500" />
                        <div>
                            <p className="font-medium text-foreground">Smart vs Manual</p>
                            <p className="mt-1">
                                <span className="font-medium text-foreground">Manual</span> (default): you set the %.
                                Use this until you have enough historical data.
                                <br />
                                <span className="font-medium text-foreground">Smart</span>: computed live from your
                                history — % of deals that ever entered this stage and eventually reached
                                Closed Won, Won, Booked, or Signed. Below {SMART_PROBABILITY_MIN_SAMPLES} historical
                                deals the smart number is unreliable and the forecast falls back to the manual
                                value automatically.
                            </p>
                        </div>
                    </div>
                </div>

                {Object.entries(grouped).map(([pipelineId, { name, stages }]) => (
                    <div key={pipelineId} className="space-y-2">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{name}</h4>
                        <div className="rounded-md border border-border/60 overflow-hidden">
                            <div className="grid grid-cols-[1fr_120px_140px_120px] items-center gap-3 bg-muted/40 px-3 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                                <span>Stage</span>
                                <span className="text-right">Manual %</span>
                                <span className="text-right">Smart %</span>
                                <span className="text-right">Mode</span>
                            </div>
                            {stages.map((row) => {
                                const pending = draft[row.stageId]
                                const valueShown = pending !== undefined ? pending : row.manualProbability
                                const isDirty = pending !== undefined && pending !== row.manualProbability
                                const insufficient = row.sampleSize < SMART_PROBABILITY_MIN_SAMPLES
                                const isSmart = row.mode === "smart"
                                const effective = isSmart && !insufficient && row.smartProbability !== null
                                    ? `${row.smartProbability}%`
                                    : `${row.manualProbability}%`

                                return (
                                    <div
                                        key={row.stageId}
                                        className="grid grid-cols-[1fr_120px_140px_120px] items-center gap-3 px-3 py-2 border-t border-border/40 text-sm"
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className="font-medium truncate">{row.stageName}</span>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <span className="text-[10px] text-muted-foreground tabular-nums shrink-0 cursor-help">
                                                        → forecast uses {effective}
                                                    </span>
                                                </TooltipTrigger>
                                                <TooltipContent side="top" className="text-xs">
                                                    {isSmart && !insufficient
                                                        ? `Using Smart (${row.sampleSize} historical deals)`
                                                        : isSmart && insufficient
                                                            ? `Smart enabled but only ${row.sampleSize}/${SMART_PROBABILITY_MIN_SAMPLES} samples — falling back to manual`
                                                            : "Using Manual"}
                                                </TooltipContent>
                                            </Tooltip>
                                        </div>

                                        {/* Manual % input */}
                                        <div className="flex items-center justify-end gap-1">
                                            <Input
                                                type="number"
                                                min={0}
                                                max={100}
                                                value={valueShown}
                                                onChange={(e) => handleManualChange(row.stageId, e.target.value)}
                                                onBlur={() => handleSaveManual(row)}
                                                onKeyDown={(e) => { if (e.key === "Enter") handleSaveManual(row) }}
                                                className="h-7 w-16 text-right text-xs tabular-nums px-2"
                                                disabled={savingKey === row.stageId}
                                            />
                                            <span className="text-xs text-muted-foreground">%</span>
                                            {isDirty && savingKey !== row.stageId && (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-6 px-1.5 text-[10px]"
                                                    onClick={() => handleSaveManual(row)}
                                                >
                                                    Save
                                                </Button>
                                            )}
                                            {savingKey === row.stageId && <Loader2 className="h-3 w-3 animate-spin" />}
                                        </div>

                                        {/* Smart % display */}
                                        <div className="text-right text-xs tabular-nums">
                                            {row.smartProbability === null ? (
                                                <span className="text-muted-foreground/60">—</span>
                                            ) : (
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {insufficient && (
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <AlertTriangle className="h-3 w-3 text-amber-500 cursor-help" />
                                                            </TooltipTrigger>
                                                            <TooltipContent side="top" className="max-w-[260px] text-xs">
                                                                Only {row.sampleSize} historical deal{row.sampleSize === 1 ? "" : "s"} — needs {SMART_PROBABILITY_MIN_SAMPLES} for reliable smart probability. The forecast falls back to the manual value until then.
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    )}
                                                    <span className={insufficient ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400 font-medium"}>
                                                        {row.smartProbability}%
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground/70">
                                                        ({row.sampleSize})
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Mode toggle */}
                                        <div className="flex items-center justify-end gap-1">
                                            <button
                                                onClick={() => handleToggleMode(row)}
                                                disabled={savingKey === row.stageId}
                                                className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-md border transition-colors ${
                                                    isSmart
                                                        ? "bg-violet-500/10 text-violet-600 border-violet-500/30 hover:bg-violet-500/20"
                                                        : "bg-muted text-muted-foreground border-border hover:bg-muted/70"
                                                }`}
                                            >
                                                {isSmart ? <Sparkles className="h-3 w-3" /> : null}
                                                {isSmart ? "Smart" : "Manual"}
                                            </button>
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
