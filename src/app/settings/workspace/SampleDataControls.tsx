"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Sparkles, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
    hasSampleData,
    loadSampleData,
    clearSampleData,
} from "@/app/dashboard/sample-data-actions"

/**
 * Lets workspace admins seed (and later wipe) the demo dataset. The action
 * lives behind the workspace settings page rather than as a one-shot
 * onboarding step so customers can re-populate or clear at any point —
 * useful for screen recordings, sales demos, or test runs.
 */
export function SampleDataControls() {
    const router = useRouter()
    const [hasSample, setHasSample] = useState<boolean | null>(null)
    const [busy, setBusy] = useState<"load" | "clear" | null>(null)

    useEffect(() => {
        hasSampleData().then(setHasSample).catch(() => setHasSample(false))
    }, [])

    const handleLoad = async () => {
        setBusy("load")
        const res = await loadSampleData()
        setBusy(null)
        if (!res.success) {
            toast.error(res.error || "Failed to load sample data")
            return
        }
        toast.success(`Loaded ${res.counts?.contacts || 0} sample contacts`)
        setHasSample(true)
        router.refresh()
    }

    const handleClear = async () => {
        setBusy("clear")
        const res = await clearSampleData()
        setBusy(null)
        if (!res.success) {
            toast.error(res.error || "Failed to clear sample data")
            return
        }
        toast.success(`Removed ${res.deleted || 0} sample records`)
        setHasSample(false)
        router.refresh()
    }

    if (hasSample === null) {
        return <div className="text-sm text-muted-foreground">Loading…</div>
    }

    return (
        <div className="space-y-3">
            <p className="text-[11px] text-muted-foreground">
                Populates the workspace with ~10 sample contacts, deals, and tasks so the dashboard
                isn&apos;t empty while you&apos;re exploring. Every record is tagged{" "}
                <code className="text-[10px] px-1 py-0.5 rounded bg-muted">__sample__</code> so you
                can wipe it in one click.
            </p>

            {hasSample ? (
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button size="sm" variant="outline" className="gap-1.5" disabled={!!busy}>
                            {busy === "clear" ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                            )}
                            Remove sample data
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Remove sample data?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This deletes every record tagged <code>__sample__</code>: the demo contacts,
                                their deals, and their tasks. Your real data is not touched.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleClear} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Remove
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            ) : (
                <Button size="sm" className="gap-1.5" onClick={handleLoad} disabled={!!busy}>
                    {busy === "load" ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                    )}
                    Load sample data
                </Button>
            )}
        </div>
    )
}
