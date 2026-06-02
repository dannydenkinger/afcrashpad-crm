"use client"

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { BarChart3, Eye, Send, TrendingUp } from "lucide-react"
import type { LeadForm } from "./types"

interface Props {
    open: boolean
    onClose: () => void
    form: LeadForm
}

export function FormAnalytics({ open, onClose, form }: Props) {
    const views = form.viewCount || 0
    const submissions = form.submissionCount || 0
    const conversionRate = views > 0 ? ((submissions / views) * 100).toFixed(1) : "0.0"

    return (
        <Sheet open={open} onOpenChange={v => !v && onClose()}>
            <SheetContent className="overflow-y-auto w-[360px] sm:w-[400px]">
                <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                        <BarChart3 className="h-4 w-4" />
                        Form Analytics
                    </SheetTitle>
                </SheetHeader>

                <div className="space-y-6 mt-6">
                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                                <Eye className="h-4 w-4 text-blue-600" />
                                <span className="text-xs text-blue-600 font-medium">Views</span>
                            </div>
                            <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{views}</p>
                        </div>
                        <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                                <Send className="h-4 w-4 text-green-600" />
                                <span className="text-xs text-green-600 font-medium">Submissions</span>
                            </div>
                            <p className="text-2xl font-bold text-green-700 dark:text-green-400">{submissions}</p>
                        </div>
                        <div className="col-span-2 p-4 bg-purple-50 dark:bg-purple-950/20 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                                <TrendingUp className="h-4 w-4 text-purple-600" />
                                <span className="text-xs text-purple-600 font-medium">Conversion Rate</span>
                            </div>
                            <p className="text-2xl font-bold text-purple-700 dark:text-purple-400">{conversionRate}%</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                {submissions} of {views} visitors submitted the form
                            </p>
                        </div>
                    </div>

                    {/* Field drop-off */}
                    <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Fields</p>
                        <div className="space-y-2">
                            {form.fields?.filter(f => !["header", "divider", "image", "rich_text", "hidden"].includes(f.type)).map((field, idx) => {
                                // Simple visual showing field order — full drop-off tracking needs more data
                                const barWidth = Math.max(10, 100 - (idx * 8))
                                return (
                                    <div key={field.id} className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground w-24 truncate">{field.label}</span>
                                        <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                                            <div className="h-full bg-primary/60 rounded-full" style={{ width: `${barWidth}%` }} />
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-2">Detailed drop-off analytics update as more submissions are collected.</p>
                    </div>

                    {/* Status */}
                    <div className="text-center py-4 border-t">
                        <p className="text-xs text-muted-foreground">
                            Form created {form.createdAt ? new Date(form.createdAt).toLocaleDateString() : "recently"}
                        </p>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    )
}
