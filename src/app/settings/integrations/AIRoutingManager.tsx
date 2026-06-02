"use client"

import { useEffect, useState } from "react"
import { Loader2, Sparkles, Bot, RotateCcw, Activity } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
    AI_FEATURES,
    MODEL_OPTIONS,
    type AIFeature,
    type AIProvider,
    type AIRoutingMap,
} from "@/lib/ai/types"
import {
    getAIRouting,
    updateAIRoute,
    resetAIRoute,
    getAIUsageSummary,
} from "./ai-routing-actions"

/**
 * Per-feature AI provider + model picker. Each row shows one CRM feature
 * (Assistant, Blog gen, Automation: AI Classify, etc) and lets the
 * workspace admin pick which provider runs it and which model that
 * provider should use.
 *
 * Workflow:
 *   1. User flips provider dropdown → model dropdown auto-updates with
 *      that provider's curated list, defaulting to whichever option
 *      matches the current saved model (or the feature's default).
 *   2. User picks a model → save fires immediately.
 *   3. "Custom" model option lets sophisticated users type any model id
 *      (azure deployments, fine-tunes, OpenRouter routes, etc).
 *
 * Below the table: 30-day usage summary so admins can see "which features
 * are spending the most tokens" before making a routing change.
 */
export function AIRoutingManager() {
    const [routing, setRouting] = useState<AIRoutingMap>({})
    const [loading, setLoading] = useState(true)
    const [savingFeature, setSavingFeature] = useState<AIFeature | null>(null)
    const [usage, setUsage] = useState<Awaited<ReturnType<typeof getAIUsageSummary>> | null>(null)
    /** Inline custom-model input state, keyed by feature. */
    const [customModel, setCustomModel] = useState<Partial<Record<AIFeature, string>>>({})

    const refresh = async () => {
        const [r, u] = await Promise.all([getAIRouting(), getAIUsageSummary(30)])
        if (r.success && r.routing) setRouting(r.routing)
        setUsage(u)
        setLoading(false)
    }

    useEffect(() => {
        refresh()
    }, [])

    const effectiveRoute = (feature: AIFeature): { provider: AIProvider; model: string; isDefault: boolean } => {
        const meta = AI_FEATURES.find((f) => f.feature === feature)!
        const saved = routing[feature]
        if (saved) {
            return { provider: saved.provider, model: saved.model, isDefault: false }
        }
        // Default: anthropic + that feature's curated default model
        return { provider: "anthropic", model: meta.defaultModel.anthropic, isDefault: true }
    }

    const handleProviderChange = async (feature: AIFeature, provider: AIProvider) => {
        const meta = AI_FEATURES.find((f) => f.feature === feature)!
        const newModel = meta.defaultModel[provider]
        await persist(feature, provider, newModel)
    }

    const handleModelChange = async (feature: AIFeature, modelValue: string) => {
        const eff = effectiveRoute(feature)
        if (modelValue === "__custom__") {
            // Reveal the inline input — don't save until they type something
            setCustomModel((c) => ({ ...c, [feature]: eff.model }))
            return
        }
        await persist(feature, eff.provider, modelValue)
    }

    const handleCustomSave = async (feature: AIFeature) => {
        const m = (customModel[feature] || "").trim()
        if (!m) return
        const eff = effectiveRoute(feature)
        await persist(feature, eff.provider, m)
        setCustomModel((c) => {
            const next = { ...c }
            delete next[feature]
            return next
        })
    }

    const handleReset = async (feature: AIFeature) => {
        setSavingFeature(feature)
        const res = await resetAIRoute(feature)
        setSavingFeature(null)
        if (!res.success) {
            toast.error(res.error || "Failed to reset")
            return
        }
        toast.success("Reset to default")
        refresh()
    }

    const persist = async (feature: AIFeature, provider: AIProvider, model: string) => {
        setSavingFeature(feature)
        const res = await updateAIRoute({ feature, provider, model })
        setSavingFeature(null)
        if (!res.success) {
            toast.error(res.error || "Failed to save")
            return
        }
        // Optimistic local update
        setRouting((r) => ({ ...r, [feature]: { provider, model } }))
    }

    if (loading) {
        return (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading AI routing…
            </div>
        )
    }

    return (
        <TooltipProvider delayDuration={150}>
            <div className="space-y-6">
                {/* How it works */}
                <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground space-y-2">
                    <div className="flex items-start gap-2">
                        <Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0 text-violet-500" />
                        <div>
                            <p className="font-medium text-foreground">Per-feature AI routing</p>
                            <p className="mt-1">
                                Each AI feature in the CRM can use a different provider + model. Use a
                                cheap fast model for short tasks (SMS rewrites, classification) and a
                                premium model where quality matters (long-form blog drafts, the assistant).
                                Save your API keys for both providers above before changing routes — the
                                CRM falls back to the env-var key only if no per-workspace key is set.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Routing table */}
                <div className="rounded-md border border-border/60 overflow-hidden">
                    <div className="grid grid-cols-[2fr_120px_1fr_80px] items-center gap-3 bg-muted/40 px-3 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        <span>Feature</span>
                        <span>Provider</span>
                        <span>Model</span>
                        <span className="text-right">Reset</span>
                    </div>
                    {AI_FEATURES.map((meta) => {
                        const eff = effectiveRoute(meta.feature)
                        const provModels = MODEL_OPTIONS[eff.provider]
                        const modelInList = provModels.some((m) => m.id === eff.model)
                        const showCustomInput = customModel[meta.feature] !== undefined
                        const usageCount = usage?.success ? usage.byFeature?.[meta.feature]?.calls || 0 : 0

                        return (
                            <div
                                key={meta.feature}
                                className="grid grid-cols-[2fr_120px_1fr_80px] items-start gap-3 px-3 py-2 border-t border-border/40 text-sm"
                            >
                                <div className="min-w-0 pt-1.5">
                                    <div className="flex items-center gap-1.5">
                                        <span className="font-medium truncate">{meta.label}</span>
                                        {usageCount > 0 && (
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground tabular-nums cursor-help">
                                                        <Activity className="h-2.5 w-2.5" />
                                                        {usageCount}
                                                    </span>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    {usageCount} call{usageCount === 1 ? "" : "s"} in the last 30 days
                                                </TooltipContent>
                                            </Tooltip>
                                        )}
                                        {eff.isDefault && (
                                            <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60 font-semibold">
                                                default
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                                        {meta.description}
                                    </p>
                                </div>

                                {/* Provider */}
                                <Select
                                    value={eff.provider}
                                    onValueChange={(v) => handleProviderChange(meta.feature, v as AIProvider)}
                                    disabled={savingFeature === meta.feature}
                                >
                                    <SelectTrigger className="h-8 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="anthropic">Anthropic</SelectItem>
                                        <SelectItem value="openai">OpenAI</SelectItem>
                                    </SelectContent>
                                </Select>

                                {/* Model */}
                                <div className="flex flex-col gap-1">
                                    {showCustomInput ? (
                                        <div className="flex gap-1">
                                            <Input
                                                value={customModel[meta.feature] || ""}
                                                onChange={(e) =>
                                                    setCustomModel((c) => ({ ...c, [meta.feature]: e.target.value }))
                                                }
                                                placeholder="Custom model id"
                                                className="h-8 text-xs"
                                                onKeyDown={(e) => { if (e.key === "Enter") handleCustomSave(meta.feature) }}
                                            />
                                            <Button
                                                size="sm"
                                                className="h-8 px-2 text-xs"
                                                onClick={() => handleCustomSave(meta.feature)}
                                                disabled={savingFeature === meta.feature}
                                            >
                                                Save
                                            </Button>
                                        </div>
                                    ) : (
                                        <Select
                                            value={modelInList ? eff.model : "__custom__"}
                                            onValueChange={(v) => handleModelChange(meta.feature, v)}
                                            disabled={savingFeature === meta.feature}
                                        >
                                            <SelectTrigger className="h-8 text-xs">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {provModels.map((m) => (
                                                    <SelectItem key={m.id} value={m.id}>
                                                        {m.label}
                                                    </SelectItem>
                                                ))}
                                                <SelectItem value="__custom__">Custom model id…</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    )}
                                    {!modelInList && !showCustomInput && (
                                        <span className="text-[10px] text-muted-foreground font-mono">
                                            {eff.model}
                                        </span>
                                    )}
                                </div>

                                {/* Reset */}
                                <div className="flex justify-end items-start pt-1">
                                    {!eff.isDefault && (
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 w-7 p-0"
                                                    onClick={() => handleReset(meta.feature)}
                                                    disabled={savingFeature === meta.feature}
                                                >
                                                    {savingFeature === meta.feature ? (
                                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                    ) : (
                                                        <RotateCcw className="h-3.5 w-3.5" />
                                                    )}
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>Reset to default</TooltipContent>
                                        </Tooltip>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* Usage summary */}
                {usage?.success && usage.totalCalls && usage.totalCalls > 0 ? (
                    <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-xs space-y-1">
                        <div className="flex items-center gap-2">
                            <Bot className="h-3.5 w-3.5 text-primary" />
                            <span className="font-medium text-foreground">Last 30 days</span>
                        </div>
                        <div className="text-muted-foreground tabular-nums">
                            {usage.totalCalls} AI calls · {usage.totalInputTokens?.toLocaleString()} in /
                            {" "}{usage.totalOutputTokens?.toLocaleString()} out tokens
                        </div>
                    </div>
                ) : null}
            </div>
        </TooltipProvider>
    )
}
