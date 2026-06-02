"use client"

import { useState } from "react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Trash2, UserCog, ShieldCheck, User, Copy, Check, RefreshCw, Clock } from "lucide-react"
import { updateUserRole, deleteUser } from "./actions"
import { revokeInvitation, resendInvitation } from "./invitation-actions"
import { toast } from "sonner"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { InviteUserDialog } from "./InviteUserDialog"

interface UserRecord {
    id: string
    name: string | null
    email: string
    role: string
    createdAt: string | null
}

interface PendingInvitation {
    id: string
    email: string
    role: string
    token: string
    status: "pending" | "expired"
    invitedByName: string
    createdAt: string
    expiresAt: string
}

interface Props {
    initialUsers: UserRecord[]
    currentUserId: string
    pendingInvitations: PendingInvitation[]
    workspaceId: string
}

export function UserManagementTable({ initialUsers, currentUserId, pendingInvitations: initialInvitations, workspaceId }: Props) {
    const [users, setUsers] = useState(initialUsers)
    const [invitations, setInvitations] = useState(initialInvitations)
    const [isDeleting, setIsDeleting] = useState<string | null>(null)
    const [userToDelete, setUserToDelete] = useState<string | null>(null)
    const [inviteToRevoke, setInviteToRevoke] = useState<string | null>(null)
    const [copiedToken, setCopiedToken] = useState<string | null>(null)
    const [resendingId, setResendingId] = useState<string | null>(null)

    const handleRoleChange = async (userId: string, newRole: string) => {
        try {
            await updateUserRole(userId, newRole)
            setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u))
            toast.success("Role Updated", {
                description: "User role has been successfully changed.",
            })
        } catch (error) {
            toast.error("Error", {
                description: "Failed to update user role.",
            })
        }
    }

    const handleDelete = async () => {
        if (!userToDelete) return

        setIsDeleting(userToDelete)
        try {
            await deleteUser(userToDelete)
            setUsers(users.filter(u => u.id !== userToDelete))
            toast.success("User Deleted", {
                description: "The user has been successfully removed.",
            })
        } catch (error) {
            toast.error("Error", {
                description: "Failed to delete user.",
            })
        } finally {
            setIsDeleting(null)
            setUserToDelete(null)
        }
    }

    const handleRevokeInvitation = async () => {
        if (!inviteToRevoke) return
        try {
            const res = await revokeInvitation(inviteToRevoke)
            if (res.success) {
                setInvitations(invitations.filter(i => i.id !== inviteToRevoke))
                toast.success("Invitation Revoked", {
                    description: "The invitation has been revoked.",
                })
            } else {
                toast.error("Error", { description: res.error || "Failed to revoke invitation." })
            }
        } catch {
            toast.error("Error", { description: "Failed to revoke invitation." })
        } finally {
            setInviteToRevoke(null)
        }
    }

    const handleCopyInviteLink = (inviteToken: string) => {
        const baseUrl = window.location.origin
        const url = `${baseUrl}/invite/${inviteToken}`
        navigator.clipboard.writeText(url)
        setCopiedToken(inviteToken)
        toast.success("Copied", { description: "Invite link copied to clipboard." })
        setTimeout(() => setCopiedToken(null), 2000)
    }

    const handleResendInvitation = async (invitationId: string) => {
        setResendingId(invitationId)
        try {
            const res = await resendInvitation(invitationId)
            if (res.success) {
                setInvitations(invitations.map(i =>
                    i.id === invitationId
                        ? { ...i, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), status: "pending" as const }
                        : i
                ))
                toast.success("Invitation Resent", {
                    description: "The invitation expiry has been extended by 7 days.",
                })
            } else {
                toast.error("Error", { description: res.error || "Failed to resend invitation." })
            }
        } catch {
            toast.error("Error", { description: "Failed to resend invitation." })
        } finally {
            setResendingId(null)
        }
    }

    const getRoleIcon = (role: string) => {
        switch (role) {
            case "OWNER": return <ShieldCheck className="h-4 w-4 text-primary" />
            case "ADMIN": return <UserCog className="h-4 w-4 text-blue-500" />
            default: return <User className="h-4 w-4 text-muted-foreground" />
        }
    }

    const formatDate = (dateStr: string) => {
        try {
            return new Date(dateStr).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
            })
        } catch {
            return "Unknown"
        }
    }

    return (
        <div className="space-y-8">
            <div className="flex justify-end">
                <InviteUserDialog />
            </div>

            <div className="space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active members</h3>
                <div className="rounded-md border overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>User</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {users.map((user) => (
                                <TableRow key={user.id}>
                                    <TableCell className="font-medium">{user.name || "Unknown User"}</TableCell>
                                    <TableCell>{user.email}</TableCell>
                                    <TableCell>
                                        <Select
                                            defaultValue={user.role}
                                            onValueChange={(val) => handleRoleChange(user.id, val)}
                                            disabled={user.id === currentUserId}
                                        >
                                            <SelectTrigger className="w-[140px] h-8 text-xs">
                                                <div className="flex items-center gap-2">
                                                    {getRoleIcon(user.role)}
                                                    <SelectValue placeholder="Select Role" />
                                                </div>
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="OWNER">Owner</SelectItem>
                                                <SelectItem value="ADMIN">Admin</SelectItem>
                                                <SelectItem value="AGENT">Agent</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-red-500 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/20"
                                            disabled={user.id === currentUserId || isDeleting === user.id}
                                            onClick={() => setUserToDelete(user.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {users.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">
                                        No active members found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* Pending Invitations Section */}
            <div className="space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pending invitations</h3>
                {invitations.length === 0 ? (
                    <div className="rounded-md border p-6 text-center">
                        <p className="text-sm text-muted-foreground">No pending invitations.</p>
                    </div>
                ) : (
                    <div className="rounded-md border overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Invited</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {invitations.map((invite) => (
                                    <TableRow key={invite.id}>
                                        <TableCell className="font-medium">{invite.email}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1.5">
                                                {getRoleIcon(invite.role)}
                                                <span className="text-xs">{invite.role}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {invite.status === "expired" ? (
                                                <Badge variant="secondary" className="text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400">
                                                    <Clock className="h-3 w-3 mr-1" />
                                                    Expired
                                                </Badge>
                                            ) : (
                                                <Badge variant="secondary" className="text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400">
                                                    Pending
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {formatDate(invite.createdAt)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    onClick={() => handleCopyInviteLink(invite.token)}
                                                    title="Copy invite link"
                                                >
                                                    {copiedToken === invite.token ? (
                                                        <Check className="h-3.5 w-3.5 text-green-500" />
                                                    ) : (
                                                        <Copy className="h-3.5 w-3.5" />
                                                    )}
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    onClick={() => handleResendInvitation(invite.id)}
                                                    disabled={resendingId === invite.id}
                                                    title="Resend (extend expiry)"
                                                >
                                                    <RefreshCw className={`h-3.5 w-3.5 ${resendingId === invite.id ? "animate-spin" : ""}`} />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/20"
                                                    onClick={() => setInviteToRevoke(invite.id)}
                                                    title="Revoke invitation"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </div>

            {/* Delete User Confirmation */}
            <AlertDialog open={!!userToDelete} onOpenChange={(open: boolean) => !open && setUserToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the user account
                            and remove their data from our servers.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-red-500 hover:bg-red-600 text-white"
                        >
                            {isDeleting ? "Deleting..." : "Delete User"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Revoke Invitation Confirmation */}
            <AlertDialog open={!!inviteToRevoke} onOpenChange={(open: boolean) => !open && setInviteToRevoke(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Revoke this invitation?</AlertDialogTitle>
                        <AlertDialogDescription>
                            The invitation link will no longer be valid. You can always send a new invitation later.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleRevokeInvitation}
                            className="bg-red-500 hover:bg-red-600 text-white"
                        >
                            Revoke
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
