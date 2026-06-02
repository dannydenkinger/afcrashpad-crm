"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getWorkspaceInfo, updateWorkspaceSettings } from "../users/workspace-actions"

/**
 * Default profit margin (%) seeded into new deals and used as the fallback
 * for "Expected Profit" on the deal sheet's finance tab when no per-deal
 * margin is set. Lives next to the stage probability editor because both
 * drive deal-level forecast math.
 */
export function DefaultMarginForm() {
    const { data: session } = useSession()
    const router = useRouter()
    const workspaceId = session?.user?.workspaceId

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [margin, setMargin] = useState<string>("")
    const [originalMargin, setOriginalMargin] = useState<string>("")

    useEffect(() => {
        if (!workspaceId) return
        getWorkspaceInfo(workspaceId).then((info) => {
            if (info) {
                const m = info.defaultMargin == null ? "" : String(info.defaultMargin)
                setMargin(m)
                setOriginalMargin(m)
            }
            setLoading(false)
        })
    }, [workspaceId])

    const dirty = margin !== originalMargin

    const handleSave = async () => {
        const marginNum = margin === "" ? null : Number(margin)
        if (marginNum !== null && (isNaN(marginNum) || marginNum < 0 || marginNum > 100)) {
            toast.error("Default margin must be between 0 and 100")
            return
        }
        setSaving(true)
        const res = await updateWorkspaceSettings({ defaultMargin: marginNum })
        setSaving(false)

        if (!res.success) {
            toast.error(res.error || "Failed to save")
            return
        }

        toast.success("Default margin updated")
        setOriginalMargin(margin)
        router.refresh()
    }

    if (loading) {
        return <div className="text-sm text-muted-foreground">Loading…</div>
    }

    return (
        <div className="space-y-3">
            <div className="space-y-1.5">
                <Label htmlFor="ws-margin" className="text-xs">
                    Default profit margin (%)
                </Label>
                <div className="flex items-center gap-2">
                    <Input
                        id="ws-margin"
                        type="number"
                        inputMode="decimal"
                        min={0}
                        max={100}
                        step="0.1"
                        value={margin}
                        onChange={(e) => setMargin(e.target.value)}
                        placeholder="25"
                        disabled={saving}
                        className="max-w-[120px]"
                    />
                    <Button onClick={handleSave} disabled={!dirty || saving} size="sm">
                        {saving && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
                        Save
                    </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                    Seeds the margin field on new deals and powers the &ldquo;Expected
                    Profit&rdquo; line on the deal&apos;s finance tab. Leave blank to fall back
                    to the built-in 25% default.
                </p>
            </div>
        </div>
    )
}
