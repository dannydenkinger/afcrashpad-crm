"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { RevenueForecast } from "./RevenueForecast"
import { listPipelinesLite } from "./actions"

export default function FinanceForecastingPage() {
    const [pipelines, setPipelines] = useState<Array<{ id: string; name: string }>>([])
    const [pipelineId, setPipelineId] = useState<string>("")
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        listPipelinesLite().then((p) => {
            setPipelines(p)
            setPipelineId(p[0]?.id ?? "")
            setLoading(false)
        })
    }, [])

    return (
        <div className="container mx-auto max-w-6xl py-6 px-4 space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">Forecasting</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Pipeline-weighted revenue projections by close period.
                    </p>
                </div>
                {pipelines.length > 1 && (
                    <Select value={pipelineId} onValueChange={setPipelineId}>
                        <SelectTrigger className="w-[200px] h-9">
                            <SelectValue placeholder="Pick a pipeline" />
                        </SelectTrigger>
                        <SelectContent>
                            {pipelines.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                    {p.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
            </div>
            {loading ? (
                <div className="py-20 flex items-center justify-center text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Loading…
                </div>
            ) : pipelines.length === 0 ? (
                <div className="py-20 text-center text-sm text-muted-foreground">
                    No pipelines yet — create one in{" "}
                    <a href="/settings/pipeline" className="underline">
                        Settings → Pipeline
                    </a>
                    .
                </div>
            ) : pipelineId ? (
                <RevenueForecast pipelineId={pipelineId} />
            ) : null}
        </div>
    )
}
