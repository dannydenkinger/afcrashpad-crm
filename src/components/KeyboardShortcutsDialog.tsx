"use client"

import { useState, useEffect } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
import { Keyboard } from "lucide-react"

type ShortcutEntry = { keys: string[]; description: string } | { divider: string }

const shortcuts: ShortcutEntry[] = [
    { divider: "General" },
    { keys: ["Cmd", "K"], description: "Open command palette / search" },
    { keys: ["Esc"], description: "Close panel, dialog, or sheet" },
    { keys: ["?"], description: "Show this shortcuts guide" },
    { divider: "Navigation" },
    { keys: ["G", "D"], description: "Go to Dashboard" },
    { keys: ["G", "P"], description: "Go to Pipeline" },
    { keys: ["G", "C"], description: "Go to Contacts" },
    { keys: ["G", "K"], description: "Go to Calendar" },
    { keys: ["G", "T"], description: "Go to Tasks" },
    { keys: ["G", "N"], description: "Go to Notifications" },
    { keys: ["G", "F"], description: "Go to Finance" },
    { keys: ["G", "M"], description: "Go to Marketing" },
    { keys: ["G", "S"], description: "Go to Settings" },
    { divider: "Actions" },
    { keys: ["N", "D"], description: "New deal / opportunity" },
    { keys: ["N", "C"], description: "New contact" },
    { keys: ["N", "T"], description: "New task" },
    { divider: "Tables & Lists" },
    { keys: ["\u2191"], description: "Move up in list" },
    { keys: ["\u2193"], description: "Move down in list" },
    { keys: ["Enter"], description: "Open selected item" },
    { keys: ["Space"], description: "Toggle selection (checkbox)" },
    { divider: "Pipeline" },
    { keys: ["1\u20139"], description: "Switch pipeline stage tab (mobile)" },
    { keys: ["V"], description: "Toggle Kanban / List view" },
]

export function KeyboardShortcutsDialog() {
    const [open, setOpen] = useState(false)

    useEffect(() => {
        const handler = () => setOpen(true)
        window.addEventListener("crm:show-shortcuts", handler)
        return () => window.removeEventListener("crm:show-shortcuts", handler)
    }, [])

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Keyboard className="h-5 w-5 text-muted-foreground" />
                        Keyboard Shortcuts
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                        Press <kbd className="inline-flex h-5 min-w-[20px] items-center justify-center rounded border bg-muted px-1 text-[10px] font-medium text-muted-foreground mx-0.5">?</kbd> anywhere to open this guide. Shortcuts are disabled when typing in inputs.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-0.5 max-h-[60vh] overflow-y-auto pr-1 -mr-1">
                    {shortcuts.map((item, i) => {
                        if ("divider" in item) {
                            return (
                                <div key={i} className="pt-4 pb-1.5 first:pt-0">
                                    <span className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider">
                                        {item.divider}
                                    </span>
                                </div>
                            )
                        }
                        return (
                            <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/40 transition-colors">
                                <span className="text-sm text-muted-foreground">{item.description}</span>
                                <div className="flex items-center gap-1 shrink-0 ml-4">
                                    {item.keys.map((key, j) => (
                                        <span key={j} className="inline-flex items-center">
                                            {j > 0 && <span className="text-muted-foreground/30 mx-1 text-[10px]">then</span>}
                                            <kbd className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-md border border-border/60 bg-muted/60 px-1.5 text-[11px] font-mono font-medium text-muted-foreground shadow-[0_1px_0_1px_rgba(0,0,0,0.04)]">
                                                {key === "Cmd" ? (typeof navigator !== "undefined" && navigator.platform?.includes("Mac") ? "\u2318" : "Ctrl") : key}
                                            </kbd>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                </div>
                <div className="pt-2 border-t">
                    <p className="text-[10px] text-muted-foreground/50 text-center">
                        Two-key combos: press the first key, then the second within 800ms
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    )
}
