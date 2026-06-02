"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { signOut } from "next-auth/react"
import {
    AlertTriangle,
    LogOut,
    Loader2,
    Crown,
    UserMinus,
    Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import {
    deleteAccount,
    leaveWorkspace,
    transferOwnership,
    type MembershipState,
} from "./actions"

export function DangerZoneClient({ initial }: { initial: MembershipState }) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [transferTarget, setTransferTarget] = useState<string>("")
    const [confirmDelete, setConfirmDelete] = useState("")

    const isOwner = initial.role === "OWNER"
    const onlyOwner = initial.isOnlyOwner

    const handleTransfer = () => {
        if (!transferTarget) {
            toast.error("Pick someone to transfer ownership to")
            return
        }
        startTransition(async () => {
            const res = await transferOwnership(transferTarget)
            if (!res.success) {
                toast.error(res.error || "Transfer failed")
                return
            }
            toast.success("Ownership transferred")
            router.refresh()
        })
    }

    const handleLeave = () => {
        if (
            !confirm(
                `Leave "${initial.workspaceName}"? You'll lose access to all its data.`,
            )
        ) {
            return
        }
        startTransition(async () => {
            const res = await leaveWorkspace()
            if (!res.success) {
                toast.error(res.error || "Failed to leave")
                return
            }
            toast.success("You've left the workspace")
            // Hard-reload so the workspace cookie + session refresh.
            window.location.assign("/")
        })
    }

    const handleDelete = () => {
        if (confirmDelete.trim() !== initial.workspaceName.trim() && confirmDelete.trim() !== "DELETE MY ACCOUNT") {
            toast.error('Type DELETE MY ACCOUNT to confirm')
            return
        }
        startTransition(async () => {
            const res = await deleteAccount()
            if (!res.success) {
                toast.error(res.error || "Failed to delete account")
                return
            }
            toast.success("Account deleted. Goodbye 👋")
            await signOut({ callbackUrl: "/" })
        })
    }

    return (
        <div className="space-y-6">
            {/* Current workspace context */}
            <div className="rounded-lg border bg-muted/20 p-4 flex items-start gap-3">
                <Crown className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                    <p className="text-sm">
                        Operating in{" "}
                        <span className="font-semibold">{initial.workspaceName}</span> as{" "}
                        <span className="font-mono uppercase text-[11px] tracking-wider">
                            {initial.role}
                        </span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        {initial.otherWorkspaces.length > 0
                            ? `Also a member of ${initial.otherWorkspaces.length} other workspace${initial.otherWorkspaces.length === 1 ? "" : "s"}.`
                            : "This is your only workspace."}
                    </p>
                </div>
            </div>

            {/* Transfer ownership — only when you're the only OWNER and there are candidates */}
            {isOwner && onlyOwner && initial.transferCandidates.length > 0 && (
                <SectionCard
                    icon={<Crown className="h-4 w-4" />}
                    accent="amber"
                    title="Transfer ownership"
                    description={`You're the only OWNER of ${initial.workspaceName}. Promote another active member before you can leave or delete your account.`}
                >
                    <div className="space-y-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs">New owner</Label>
                            <Select value={transferTarget} onValueChange={setTransferTarget}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Pick a member…" />
                                </SelectTrigger>
                                <SelectContent>
                                    {initial.transferCandidates.map((c) => (
                                        <SelectItem key={c.id} value={c.id}>
                                            {c.name || c.email}{" "}
                                            <span className="text-muted-foreground text-xs">
                                                — {c.email} ({c.role})
                                            </span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleTransfer}
                            disabled={!transferTarget || isPending}
                        >
                            {isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                            Transfer ownership to selected member
                        </Button>
                        <p className="text-[11px] text-muted-foreground">
                            You&apos;ll become an ADMIN. The new OWNER can re-promote you if needed.
                        </p>
                    </div>
                </SectionCard>
            )}

            {/* Leave workspace */}
            <SectionCard
                icon={<LogOut className="h-4 w-4" />}
                accent="amber"
                title="Leave this workspace"
                description={
                    onlyOwner
                        ? "You're the only OWNER. Transfer ownership above first, or delete the workspace via Workspace → Danger zone."
                        : `Removes you from ${initial.workspaceName}. Your data inside the workspace stays; you just lose access. You can be re-invited.`
                }
            >
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLeave}
                    disabled={onlyOwner || isPending}
                >
                    <UserMinus className="mr-2 h-3.5 w-3.5" />
                    Leave {initial.workspaceName}
                </Button>
            </SectionCard>

            {/* Delete account */}
            <SectionCard
                icon={<AlertTriangle className="h-4 w-4" />}
                accent="rose"
                title="Delete my account"
                description="Permanently removes your user record across every workspace, your Gmail and Calendar integrations, and your push notification tokens. Audit history and email delivery logs are retained for compliance. This cannot be undone."
            >
                <div className="space-y-3">
                    <div className="space-y-1.5">
                        <Label htmlFor="confirm-delete" className="text-xs">
                            Type <span className="font-mono text-foreground">DELETE MY ACCOUNT</span> to confirm
                        </Label>
                        <Input
                            id="confirm-delete"
                            value={confirmDelete}
                            onChange={(e) => setConfirmDelete(e.target.value)}
                            placeholder="DELETE MY ACCOUNT"
                            autoComplete="off"
                            className="font-mono"
                            disabled={isPending}
                        />
                    </div>
                    <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleDelete}
                        disabled={
                            isPending ||
                            confirmDelete.trim() !== "DELETE MY ACCOUNT" ||
                            onlyOwner
                        }
                        title={
                            onlyOwner
                                ? "Transfer ownership of your workspace first"
                                : undefined
                        }
                    >
                        {isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                        <Trash2 className="mr-2 h-3.5 w-3.5" />
                        Delete my account permanently
                    </Button>
                    {onlyOwner && (
                        <p className="text-[11px] text-rose-500">
                            You must transfer ownership above (or delete your workspace) before you can delete your account.
                        </p>
                    )}
                </div>
            </SectionCard>
        </div>
    )
}

function SectionCard({
    icon,
    accent,
    title,
    description,
    children,
}: {
    icon: React.ReactNode
    accent: "amber" | "rose"
    title: string
    description: string
    children: React.ReactNode
}) {
    const accentClass =
        accent === "rose"
            ? "border-destructive/40 bg-destructive/5"
            : "border-amber-500/30 bg-amber-500/5"
    const iconClass =
        accent === "rose"
            ? "text-destructive"
            : "text-amber-600 dark:text-amber-500"

    return (
        <div className={`rounded-lg border ${accentClass} p-4 space-y-3`}>
            <div className="flex items-start gap-3">
                <div className={`shrink-0 mt-0.5 ${iconClass}`}>{icon}</div>
                <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${iconClass}`}>{title}</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        {description}
                    </p>
                </div>
            </div>
            <div className="pl-7">{children}</div>
        </div>
    )
}
