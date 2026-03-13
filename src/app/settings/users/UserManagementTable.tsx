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
import { Trash2, UserCog, ShieldCheck, User } from "lucide-react"
import { updateUserRole, deleteUser } from "./actions"
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
import { CreateUserDialog } from "./CreateUserDialog"

interface User {
    id: string
    name: string | null
    email: string
    role: string
    createdAt: string | null
}

export function UserManagementTable({ initialUsers, currentUserId }: { initialUsers: User[], currentUserId: string }) {
    const [users, setUsers] = useState(initialUsers)
    const [isDeleting, setIsDeleting] = useState<string | null>(null)
    const [userToDelete, setUserToDelete] = useState<string | null>(null)

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

    const getRoleIcon = (role: string) => {
        switch (role) {
            case "OWNER": return <ShieldCheck className="h-4 w-4 text-primary" />
            case "ADMIN": return <UserCog className="h-4 w-4 text-blue-500" />
            default: return <User className="h-4 w-4 text-muted-foreground" />
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-muted-foreground px-1">Manage system access and roles</h3>
                <CreateUserDialog />
            </div>

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
                                        disabled={user.id === currentUserId} // Prevent owner from changing their own role easily
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
                                    No users found.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>

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
            </div>
        </div>
    )
}
