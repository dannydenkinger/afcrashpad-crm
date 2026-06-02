"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Mail, Copy, Check } from "lucide-react"
import { inviteUser } from "./invitation-actions"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

const formSchema = z.object({
    email: z.string().email("Invalid email address"),
    role: z.enum(["ADMIN", "AGENT"]),
})

export function InviteUserDialog() {
    const [open, setOpen] = useState(false)
    const [isPending, setIsPending] = useState(false)
    const [inviteUrl, setInviteUrl] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)
    const router = useRouter()

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            email: "",
            role: "AGENT",
        },
    })

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setIsPending(true)
        try {
            const res = await inviteUser(values.email, values.role)
            if (res.success && res.inviteUrl) {
                setInviteUrl(res.inviteUrl)
                toast.success("Invitation Sent", {
                    description: `An invitation has been created for ${values.email}.`,
                })
                router.refresh()
            } else {
                toast.error("Error", {
                    description: res.error || "Failed to send invitation.",
                })
            }
        } catch (error: any) {
            toast.error("Error", {
                description: error.message || "An unexpected error occurred.",
            })
        } finally {
            setIsPending(false)
        }
    }

    function handleCopyLink() {
        if (!inviteUrl) return
        navigator.clipboard.writeText(inviteUrl)
        setCopied(true)
        toast.success("Copied", { description: "Invite link copied to clipboard." })
        setTimeout(() => setCopied(false), 2000)
    }

    function handleClose(isOpen: boolean) {
        if (!isOpen) {
            // Reset state when closing
            setInviteUrl(null)
            setCopied(false)
            form.reset()
        }
        setOpen(isOpen)
    }

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Invite User
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                {inviteUrl ? (
                    <>
                        <DialogHeader>
                            <DialogTitle>Invitation Created</DialogTitle>
                            <DialogDescription>
                                Share this link with the user so they can join your workspace.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="flex items-center gap-2">
                                <Input
                                    value={inviteUrl}
                                    readOnly
                                    className="text-xs font-mono"
                                />
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={handleCopyLink}
                                    className="shrink-0"
                                >
                                    {copied ? (
                                        <Check className="h-4 w-4 text-green-500" />
                                    ) : (
                                        <Copy className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                This link expires in 7 days.
                            </p>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => handleClose(false)}>
                                Done
                            </Button>
                        </DialogFooter>
                    </>
                ) : (
                    <>
                        <DialogHeader>
                            <DialogTitle>Invite User</DialogTitle>
                            <DialogDescription>
                                Send an invitation link to add a new team member to your workspace.
                            </DialogDescription>
                        </DialogHeader>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="email"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Email Address</FormLabel>
                                            <FormControl>
                                                <Input placeholder="john@example.com" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="role"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Role</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select a role" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="ADMIN">Admin</SelectItem>
                                                    <SelectItem value="AGENT">Agent</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <DialogFooter className="pt-4">
                                    <Button type="submit" disabled={isPending}>
                                        {isPending ? "Sending..." : "Send Invitation"}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </>
                )}
            </DialogContent>
        </Dialog>
    )
}
