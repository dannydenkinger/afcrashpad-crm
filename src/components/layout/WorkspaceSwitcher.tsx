"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Check, ChevronsUpDown, Plus, Hexagon, Loader2, Lock } from "lucide-react"
import Link from "next/link"
import { useWorkspacePlan } from "@/hooks/useWorkspacePlan"
import { toast } from "sonner"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { getUserWorkspaces, createWorkspace } from "@/app/settings/users/workspace-actions"

interface Workspace {
    id: string
    name: string
    role: string
}

interface Branding {
    logoUrl?: string
    primaryColor?: string
    companyName?: string
}

/**
 * The workspace selector lives in the sidebar's logo slot. Click anywhere on
 * the brand row (logo + name) to drop down a list of all workspaces this user
 * belongs to, plus a "Create new workspace" action.
 *
 * Renders the brand visuals always — even when the user has just one
 * workspace — so the "Create new workspace" affordance stays discoverable.
 */
export function WorkspaceSwitcher({
    collapsed,
    branding,
}: {
    collapsed: boolean
    branding: Branding | null
}) {
    const { data: session, update } = useSession()
    const [workspaces, setWorkspaces] = useState<Workspace[]>([])
    const [switching, setSwitching] = useState(false)
    const [createOpen, setCreateOpen] = useState(false)
    const [newName, setNewName] = useState("")
    const [creating, setCreating] = useState(false)
    const { hasFeature } = useWorkspacePlan()
    const multiWorkspaceUnlocked = hasFeature("multipleWorkspaces")

    const currentWorkspaceId = session?.user?.workspaceId
    const currentWorkspace = workspaces.find((w) => w.id === currentWorkspaceId)
    const displayName = currentWorkspace?.name || branding?.companyName || "Vesta CRM"

    const refreshWorkspaces = () => {
        getUserWorkspaces().then(setWorkspaces).catch(() => {})
    }

    useEffect(() => {
        refreshWorkspaces()
    }, [])

    const handleSwitch = async (workspaceId: string) => {
        if (workspaceId === currentWorkspaceId || switching) return
        setSwitching(true)
        try {
            await update({ workspaceId })
            // router.refresh() only re-runs Server Components — every client
            // component that fetched data in useEffect on mount keeps the
            // old workspace's data until it remounts. A hard reload forces
            // every component to re-fetch with the new session cookie.
            // Same pattern as logout — small visual flash, but it's the
            // only way to guarantee a clean state across the entire tree.
            window.location.assign(window.location.pathname + window.location.search)
        } catch (err) {
            console.error("Failed to switch workspace:", err)
            toast.error("Failed to switch workspace")
            setSwitching(false)
        }
    }

    const handleCreate = async () => {
        const trimmed = newName.trim()
        if (!trimmed) return
        setCreating(true)
        const res = await createWorkspace({ name: trimmed })
        setCreating(false)
        if (!res.success || !res.workspaceId) {
            toast.error(res.error || "Failed to create workspace")
            return
        }
        // Switch the session to the new workspace so the user lands inside it
        try {
            await update({ workspaceId: res.workspaceId })
        } catch (err) {
            console.error("Failed to switch into new workspace:", err)
        }
        toast.success(`Created ${trimmed}`)
        setCreateOpen(false)
        setNewName("")
        // Hard navigation to /dashboard so every client component
        // remounts with the new workspace's session cookie. Same
        // reasoning as handleSwitch above.
        window.location.assign("/dashboard")
    }

    // Brand visuals reused for the trigger
    const brandIcon = branding?.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
            src={branding.logoUrl}
            alt={branding.companyName || "Logo"}
            className="h-10 w-10 shrink-0 rounded-lg object-cover shadow"
        />
    ) : (
        <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 shadow"
            style={branding?.primaryColor ? { backgroundColor: branding.primaryColor } : undefined}
        >
            <Hexagon className="h-6 w-6 text-violet-500" />
        </div>
    )

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button
                        type="button"
                        data-onboarding="welcome"
                        aria-label="Switch or create workspace"
                        className={
                            collapsed
                                ? "flex items-center justify-center mb-10 mx-auto rounded-lg hover:opacity-80 transition-opacity"
                                : "flex items-center mb-10 pr-12 md:pr-0 gap-3 px-2 -mx-2 py-1 rounded-lg hover:bg-secondary/50 transition-colors text-left w-full"
                        }
                    >
                        {brandIcon}
                        {!collapsed && (
                            <div className="overflow-hidden flex-1 min-w-0">
                                <h2 className="text-lg font-semibold tracking-tight whitespace-nowrap truncate">
                                    {displayName}
                                </h2>
                                <p className="text-xs text-muted-foreground font-medium whitespace-nowrap">
                                    {currentWorkspace?.role
                                        ? `${currentWorkspace.role.charAt(0) + currentWorkspace.role.slice(1).toLowerCase()} · click to switch`
                                        : "CRM Portal"}
                                </p>
                            </div>
                        )}
                        {!collapsed && <ChevronsUpDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    align="start"
                    side={collapsed ? "right" : "bottom"}
                    className="w-64"
                    sideOffset={collapsed ? 8 : 4}
                >
                    {workspaces.length > 0 && (
                        <>
                            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">
                                Workspaces
                            </DropdownMenuLabel>
                            {workspaces.map((ws) => (
                                <DropdownMenuItem
                                    key={ws.id}
                                    onClick={() => handleSwitch(ws.id)}
                                    disabled={switching}
                                    className="flex items-center gap-2"
                                >
                                    <div className="flex flex-col flex-1 min-w-0">
                                        <span className="truncate text-sm">{ws.name}</span>
                                        <span className="text-xs text-muted-foreground capitalize">
                                            {ws.role.toLowerCase()}
                                        </span>
                                    </div>
                                    {ws.id === currentWorkspaceId && (
                                        <Check className="h-4 w-4 ml-2 text-primary shrink-0" />
                                    )}
                                </DropdownMenuItem>
                            ))}
                            <DropdownMenuSeparator />
                        </>
                    )}
                    {multiWorkspaceUnlocked ? (
                        <DropdownMenuItem
                            onClick={() => setCreateOpen(true)}
                            className="flex items-center gap-2 cursor-pointer"
                        >
                            <Plus className="h-4 w-4 text-primary" />
                            <span>Create new workspace</span>
                        </DropdownMenuItem>
                    ) : (
                        <DropdownMenuItem asChild>
                            <Link href="/settings/billing" className="flex items-center gap-2 cursor-pointer">
                                <Lock className="h-4 w-4 text-muted-foreground" />
                                <span className="flex-1">Create new workspace</span>
                                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-500">
                                    Max
                                </span>
                            </Link>
                        </DropdownMenuItem>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>

            <Dialog
                open={createOpen}
                onOpenChange={(o) => {
                    setCreateOpen(o)
                    if (!o) setNewName("")
                }}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Create new workspace</DialogTitle>
                        <DialogDescription>
                            A workspace is a separate CRM — its own pipeline, contacts, automations,
                            and team. You&apos;ll be the owner and can invite others later from
                            Settings → Team.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 py-2">
                        <Label htmlFor="ws-name" className="text-xs">
                            Workspace name
                        </Label>
                        <Input
                            id="ws-name"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder="Acme Sales Team"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !creating && newName.trim()) handleCreate()
                            }}
                            disabled={creating}
                            maxLength={80}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={creating}>
                            Cancel
                        </Button>
                        <Button onClick={handleCreate} disabled={creating || !newName.trim()}>
                            {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Create workspace
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
