"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"

export type DateRange = "all" | "month" | "quarter" | "year"

const RANGES: { value: DateRange; label: string }[] = [
    { value: "all", label: "All time" },
    { value: "month", label: "This month" },
    { value: "quarter", label: "This quarter" },
    { value: "year", label: "This year" },
]

export interface DateFilterValue {
    start: string
    end: string
}

export function useDateFilter() {
    const [range, setRange] = useState<DateRange>("all")
    const value = useMemo<DateFilterValue | null>(() => {
        const now = new Date()
        if (range === "month") {
            return {
                start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
                end: now.toISOString(),
            }
        }
        if (range === "quarter") {
            const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
            return { start: qStart.toISOString(), end: now.toISOString() }
        }
        if (range === "year") {
            return {
                start: new Date(now.getFullYear(), 0, 1).toISOString(),
                end: now.toISOString(),
            }
        }
        return null
    }, [range])
    return { range, setRange, value }
}

export function FinanceDateFilter({
    range,
    onChange,
    onExport,
}: {
    range: DateRange
    onChange: (r: DateRange) => void
    onExport?: () => void
}) {
    return (
        <div className="flex items-center gap-2 flex-wrap">
            {onExport && (
                <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs font-semibold"
                    onClick={onExport}
                >
                    <Download className="h-3.5 w-3.5" />
                    Export CSV
                </Button>
            )}
            <div className="flex items-center gap-1 bg-muted/30 p-0.5 rounded-md border border-border">
                {RANGES.map((r) => (
                    <button
                        key={r.value}
                        type="button"
                        onClick={() => onChange(r.value)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-sm transition-all ${
                            range === r.value
                                ? "bg-background shadow-sm text-foreground"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        {r.label}
                    </button>
                ))}
            </div>
        </div>
    )
}

/**
 * Pull the visible <table> out of the active panel and dump it to CSV.
 * Same approach as the legacy tabs page so users see no behavior change.
 */
export function exportVisibleTableCsv(filenameBase: string) {
    const tabContent =
        document.querySelector(`[data-state="active"][role="tabpanel"]`) ??
        document.body
    const table = tabContent.querySelector("table")
    if (!table) return false

    const rows: string[][] = []
    table.querySelectorAll("tr").forEach((tr) => {
        const cells: string[] = []
        tr.querySelectorAll("th, td").forEach((cell) => {
            if (
                cell.querySelector('button[role="checkbox"]') ||
                cell.querySelector("[data-state]")
            )
                return
            cells.push((cell as HTMLElement).innerText.replace(/,/g, "").trim())
        })
        if (cells.length > 0) rows.push(cells)
    })

    if (rows.length === 0) return false
    const csv = rows.map((r) => r.join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${filenameBase}-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    return true
}
