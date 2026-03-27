"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle2, Circle, X, ChevronRight, Sparkles } from "lucide-react"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { getSetupStatus, dismissSetupChecklist } from "@/app/dashboard/setup-actions"

interface SetupItem {
    id: string
    label: string
    done: boolean
    href: string
}

export function SetupChecklist() {
    const router = useRouter()
    const [items, setItems] = useState<SetupItem[]>([])
    const [dismissed, setDismissed] = useState(true) // start hidden until loaded
    const [loading, setLoading] = useState(true)
    const [showDismissDialog, setShowDismissDialog] = useState(false)

    useEffect(() => {
        getSetupStatus().then(res => {
            if (!res.success || res.dismissed) {
                setDismissed(true)
            } else {
                setItems(res.items || [])
                setDismissed(false)
            }
            setLoading(false)
        })
    }, [])

    if (loading || dismissed) return null

    const completedCount = items.filter(i => i.done).length
    const allDone = completedCount === items.length

    if (allDone) {
        // Auto-dismiss when all done
        dismissSetupChecklist()
        return null
    }

    const handleDismiss = async () => {
        setDismissed(true)
        setShowDismissDialog(false)
        await dismissSetupChecklist()
    }

    return (
        <>
            <Card className="border-none shadow-md bg-gradient-to-br from-primary/5 to-primary/10 backdrop-blur-md">
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-primary" />
                            <CardTitle className="text-sm font-semibold">Get Started</CardTitle>
                            <span className="text-xs text-muted-foreground">{completedCount}/{items.length} complete</span>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowDismissDialog(true)}>
                            <X className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                    {/* Progress bar */}
                    <div className="h-1.5 bg-muted/30 rounded-full mt-2 overflow-hidden">
                        <div
                            className="h-full bg-primary rounded-full transition-all duration-500"
                            style={{ width: `${(completedCount / items.length) * 100}%` }}
                        />
                    </div>
                </CardHeader>
                <CardContent className="pt-0">
                    <div className="space-y-1">
                        {items.map(item => (
                            <button
                                key={item.id}
                                className="flex items-center gap-3 w-full py-2 px-2 rounded-lg text-left transition-colors hover:bg-muted/30"
                                onClick={() => !item.done && router.push(item.href)}
                                disabled={item.done}
                            >
                                {item.done ? (
                                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                                ) : (
                                    <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                                )}
                                <span className={`text-sm flex-1 ${item.done ? "text-muted-foreground line-through" : "text-foreground"}`}>
                                    {item.label}
                                </span>
                                {!item.done && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" />}
                            </button>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <AlertDialog open={showDismissDialog} onOpenChange={setShowDismissDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Hide setup checklist?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently hide the Get Started checklist. You can still access all these settings from the Settings page.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Keep it</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDismiss}>Hide permanently</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
