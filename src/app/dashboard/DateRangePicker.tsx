"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Calendar, ChevronDown, X } from "lucide-react"

export interface DateRange {
    startDate: string // ISO date string YYYY-MM-DD
    endDate: string   // ISO date string YYYY-MM-DD
    label: string
}

const PRESET_RANGES = [
    { label: "Last 7 days", days: 7 },
    { label: "Last 30 days", days: 30 },
    { label: "This month", days: -1 },
    { label: "Last quarter", days: -2 },
    { label: "This year", days: -3 },
    { label: "All time", days: 0 },
] as const

function getPresetRange(preset: typeof PRESET_RANGES[number]): DateRange {
    const now = new Date()
    const endDate = now.toISOString().split("T")[0]

    if (preset.days === 0) {
        return { startDate: "", endDate: "", label: preset.label }
    }

    let startDate: string

    if (preset.days === -1) {
        // This month
        startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]
    } else if (preset.days === -2) {
        // Last quarter (90 days)
        const d = new Date(now)
        d.setDate(d.getDate() - 90)
        startDate = d.toISOString().split("T")[0]
    } else if (preset.days === -3) {
        // This year
        startDate = new Date(now.getFullYear(), 0, 1).toISOString().split("T")[0]
    } else {
        const d = new Date(now)
        d.setDate(d.getDate() - preset.days)
        startDate = d.toISOString().split("T")[0]
    }

    return { startDate, endDate, label: preset.label }
}

interface DateRangePickerProps {
    value: DateRange | null
    onChange: (range: DateRange | null) => void
}

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
    const [open, setOpen] = useState(false)
    const [showCustom, setShowCustom] = useState(false)
    const [customStart, setCustomStart] = useState("")
    const [customEnd, setCustomEnd] = useState("")
    const ref = useRef<HTMLDivElement>(null)

    // Close on outside click
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false)
                setShowCustom(false)
            }
        }
        if (open) {
            document.addEventListener("mousedown", handleClickOutside)
            return () => document.removeEventListener("mousedown", handleClickOutside)
        }
    }, [open])

    const handlePreset = (preset: typeof PRESET_RANGES[number]) => {
        const range = getPresetRange(preset)
        onChange(range.startDate === "" && range.endDate === "" ? null : range)
        setOpen(false)
        setShowCustom(false)
    }

    const handleCustomApply = () => {
        if (customStart && customEnd) {
            onChange({ startDate: customStart, endDate: customEnd, label: "Custom" })
            setOpen(false)
            setShowCustom(false)
        }
    }

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation()
        onChange(null)
        setCustomStart("")
        setCustomEnd("")
        setShowCustom(false)
    }

    const displayLabel = value ? value.label : "All time"

    return (
        <div className="relative" ref={ref}>
            <Button
                variant="outline"
                size="sm"
                onClick={() => setOpen(!open)}
                className="h-9 gap-2 text-xs font-medium"
            >
                <Calendar className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{displayLabel}</span>
                <span className="sm:hidden">Range</span>
                {value && (
                    <button
                        onClick={handleClear}
                        className="ml-1 rounded-full hover:bg-muted/50 p-0.5"
                    >
                        <X className="h-3 w-3" />
                    </button>
                )}
                {!value && <ChevronDown className="h-3 w-3 opacity-50" />}
            </Button>

            {open && (
                <div className="absolute right-0 top-full mt-2 z-50 w-64 rounded-lg border bg-popover p-2 shadow-lg animate-in fade-in-0 zoom-in-95">
                    {!showCustom ? (
                        <div className="space-y-0.5">
                            <p className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                                Date Range
                            </p>
                            {PRESET_RANGES.map((preset) => (
                                <button
                                    key={preset.label}
                                    onClick={() => handlePreset(preset)}
                                    className={`w-full text-left px-3 py-2 text-xs rounded-md transition-colors hover:bg-muted/50 ${
                                        value?.label === preset.label
                                            ? "bg-muted/40 font-semibold text-foreground"
                                            : "text-foreground/80"
                                    }`}
                                >
                                    {preset.label}
                                </button>
                            ))}
                            <div className="h-px bg-border my-1" />
                            <button
                                onClick={() => {
                                    setShowCustom(true)
                                    if (value && value.label === "Custom") {
                                        setCustomStart(value.startDate)
                                        setCustomEnd(value.endDate)
                                    }
                                }}
                                className={`w-full text-left px-3 py-2 text-xs rounded-md transition-colors hover:bg-muted/50 ${
                                    value?.label === "Custom"
                                        ? "bg-muted/40 font-semibold text-foreground"
                                        : "text-foreground/80"
                                }`}
                            >
                                Custom range...
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                                    Custom Range
                                </p>
                                <button
                                    onClick={() => setShowCustom(false)}
                                    className="text-xs text-muted-foreground hover:text-foreground"
                                >
                                    Back
                                </button>
                            </div>
                            <div className="space-y-2">
                                <div>
                                    <label className="text-[10px] font-medium text-muted-foreground block mb-1">
                                        Start Date
                                    </label>
                                    <input
                                        type="date"
                                        value={customStart}
                                        onChange={(e) => setCustomStart(e.target.value)}
                                        max={customEnd || undefined}
                                        className="w-full h-9 px-3 text-xs rounded-md border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-medium text-muted-foreground block mb-1">
                                        End Date
                                    </label>
                                    <input
                                        type="date"
                                        value={customEnd}
                                        onChange={(e) => setCustomEnd(e.target.value)}
                                        min={customStart || undefined}
                                        max={new Date().toISOString().split("T")[0]}
                                        className="w-full h-9 px-3 text-xs rounded-md border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                                    />
                                </div>
                            </div>
                            <Button
                                size="sm"
                                className="w-full h-8 text-xs"
                                disabled={!customStart || !customEnd}
                                onClick={handleCustomApply}
                            >
                                Apply Range
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
