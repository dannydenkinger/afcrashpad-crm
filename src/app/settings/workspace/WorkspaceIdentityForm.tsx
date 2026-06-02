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

export function WorkspaceIdentityForm() {
    const { data: session, update } = useSession()
    const router = useRouter()
    const workspaceId = session?.user?.workspaceId

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [name, setName] = useState("")
    const [originalName, setOriginalName] = useState("")

    useEffect(() => {
        if (!workspaceId) return
        getWorkspaceInfo(workspaceId).then((info) => {
            if (info) {
                setName(info.name || "")
                setOriginalName(info.name || "")
            }
            setLoading(false)
        })
    }, [workspaceId])

    const dirty = name.trim() !== originalName

    const handleSave = async () => {
        const trimmed = name.trim()
        if (!trimmed) {
            toast.error("Workspace name cannot be empty")
            return
        }
        setSaving(true)
        const res = await updateWorkspaceSettings({ name: trimmed })
        setSaving(false)

        if (!res.success) {
            toast.error(res.error || "Failed to save")
            return
        }

        toast.success("Workspace renamed")
        setOriginalName(trimmed)
        try { await update() } catch {}
        router.refresh()
    }

    if (loading) {
        return <div className="text-sm text-muted-foreground">Loading…</div>
    }

    return (
        <div className="space-y-3">
            <div className="space-y-1.5">
                <Label htmlFor="ws-name" className="text-xs">
                    Workspace name
                </Label>
                <Input
                    id="ws-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Acme Sales Team"
                    maxLength={80}
                    disabled={saving}
                />
                <p className="text-[11px] text-muted-foreground">
                    Shown in the sidebar logo, emails, and the workspace switcher.
                </p>
            </div>

            <Button onClick={handleSave} disabled={!dirty || saving} size="sm">
                {saving && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
                Save name
            </Button>
        </div>
    )
}
