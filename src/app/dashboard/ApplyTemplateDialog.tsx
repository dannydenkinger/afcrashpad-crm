"use client"

import { useState } from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
    DASHBOARD_TEMPLATES,
    WIDGETS_BY_ID,
    type DashboardTemplate,
    type WidgetAccent,
} from "./widget-registry"

const ACCENT_TONES: Record<WidgetAccent, string> = {
    primary: "bg-primary/10 text-primary",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    sky: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
}

interface Props {
    open: boolean
    onClose: () => void
    /** Apply a template — replaces the current visible layout. */
    onApply: (template: DashboardTemplate, options: { mode: "replace" | "new" }) => void
}

export function ApplyTemplateDialog({ open, onClose, onApply }: Props) {
    const [selectedId, setSelectedId] = useState<string>("default")
    const selected = DASHBOARD_TEMPLATES.find((t) => t.id === selectedId)

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Choose a template</DialogTitle>
                    <DialogDescription>
                        Templates are pre-built dashboards tuned for a specific role. Pick one
                        to apply now, or save as a new layout to keep your current view.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2 max-h-[440px] overflow-y-auto pr-1">
                    {DASHBOARD_TEMPLATES.map((t) => {
                        const isSelected = t.id === selectedId
                        return (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => setSelectedId(t.id)}
                                className={cn(
                                    "group text-left rounded-lg border p-3 transition-all",
                                    isSelected
                                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                                        : "border-border hover:border-primary/40 hover:bg-muted/30",
                                )}
                            >
                                <div className="flex items-start gap-3">
                                    <div
                                        className={cn(
                                            "w-9 h-9 rounded-md flex items-center justify-center shrink-0",
                                            ACCENT_TONES[t.accent],
                                        )}
                                    >
                                        <t.Icon className="h-4 w-4" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-sm font-semibold leading-tight">
                                                {t.name}
                                            </span>
                                            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                                {t.audience}
                                            </span>
                                        </div>
                                        <div className="text-[11px] text-muted-foreground leading-snug mt-1">
                                            {t.description}
                                        </div>
                                        <div className="text-[10px] text-muted-foreground/70 mt-1.5 tabular-nums">
                                            {t.layout.length} widget{t.layout.length === 1 ? "" : "s"}
                                        </div>
                                    </div>
                                </div>

                                {/* Mini preview — sketches the layout shape */}
                                {t.layout.length > 0 && (
                                    <div className="mt-3 grid grid-cols-12 gap-0.5 h-16 bg-muted/30 rounded p-1 overflow-hidden">
                                        {t.layout.map((item) => {
                                            const widget = WIDGETS_BY_ID[item.i]
                                            return (
                                                <div
                                                    key={item.i}
                                                    className={cn(
                                                        "rounded-sm",
                                                        widget
                                                            ? ACCENT_TONES[widget.accent]
                                                            : "bg-muted-foreground/20",
                                                    )}
                                                    style={{
                                                        gridColumn: `${item.x + 1} / span ${item.w}`,
                                                        gridRow: `${Math.floor(item.y / 2) + 1} / span ${Math.max(1, Math.floor(item.h / 3))}`,
                                                    }}
                                                    title={widget?.title || item.i}
                                                />
                                            )
                                        })}
                                    </div>
                                )}
                            </button>
                        )
                    })}
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    {selected && (
                        <>
                            <Button
                                variant="outline"
                                onClick={() => {
                                    onApply(selected, { mode: "new" })
                                    onClose()
                                }}
                            >
                                Save as new layout
                            </Button>
                            <Button
                                onClick={() => {
                                    onApply(selected, { mode: "replace" })
                                    onClose()
                                }}
                            >
                                Replace current layout
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
