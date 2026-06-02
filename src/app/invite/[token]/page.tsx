"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, CheckCircle2, AlertTriangle, Building2, ShieldCheck, UserCog, User } from "lucide-react"
import { getInvitationByToken, acceptInvitation } from "./actions"
import type { InvitationData } from "./actions"

export default function InvitePage() {
    const params = useParams()
    const router = useRouter()
    const token = params.token as string

    const [loading, setLoading] = useState(true)
    const [invitation, setInvitation] = useState<InvitationData | null>(null)
    const [error, setError] = useState<string | null>(null)

    // Registration form state
    const [name, setName] = useState("")
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [formError, setFormError] = useState<string | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [accepted, setAccepted] = useState(false)

    // Fetch invitation data
    useEffect(() => {
        async function fetchInvitation() {
            setLoading(true)
            try {
                const res = await getInvitationByToken(token)
                if (res.success && res.invitation) {
                    setInvitation(res.invitation)
                } else {
                    setError(res.error || "Invitation not found.")
                }
            } catch {
                setError("Failed to load invitation.")
            }
            setLoading(false)
        }
        if (token) fetchInvitation()
    }, [token])

    const getRoleLabel = (role: string) => {
        switch (role) {
            case "OWNER": return "Owner"
            case "ADMIN": return "Admin"
            default: return "Agent"
        }
    }

    const getRoleIcon = (role: string) => {
        switch (role) {
            case "OWNER": return <ShieldCheck className="h-4 w-4 text-primary" />
            case "ADMIN": return <UserCog className="h-4 w-4 text-blue-500" />
            default: return <User className="h-4 w-4 text-muted-foreground" />
        }
    }

    async function handleAccept() {
        if (!invitation) return
        setFormError(null)

        // Existing user — accept without re-entering credentials. Their existing
        // account just gets a new workspace_members row.
        if (invitation.existingUser) {
            setIsSubmitting(true)
            try {
                const res = await acceptInvitation(token)
                if (res.success) setAccepted(true)
                else setFormError(res.error || "Failed to accept invitation.")
            } catch {
                setFormError("An unexpected error occurred.")
            }
            setIsSubmitting(false)
            return
        }

        // New user — collect name + password to create the account.
        if (!name.trim()) {
            setFormError("Name is required.")
            return
        }
        if (!password) {
            setFormError("Password is required.")
            return
        }
        if (password.length < 8) {
            setFormError("Password must be at least 8 characters.")
            return
        }
        if (password !== confirmPassword) {
            setFormError("Passwords do not match.")
            return
        }

        setIsSubmitting(true)
        try {
            const res = await acceptInvitation(token, { name, password })
            if (res.success) {
                setAccepted(true)
            } else {
                setFormError(res.error || "Failed to accept invitation.")
            }
        } catch {
            setFormError("An unexpected error occurred.")
        }
        setIsSubmitting(false)
    }

    // Loading state
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-background">
                <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto" />
                    <p className="text-sm text-muted-foreground mt-3">Loading invitation...</p>
                </div>
            </div>
        )
    }

    // Error state
    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-background p-4">
                <Card className="w-full max-w-md">
                    <CardHeader className="text-center">
                        <div className="mx-auto mb-2 w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                            <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                        </div>
                        <CardTitle>Invitation Unavailable</CardTitle>
                        <CardDescription>{error}</CardDescription>
                    </CardHeader>
                    <CardContent className="text-center">
                        <Button variant="outline" onClick={() => router.push("/login")}>
                            Go to Sign In
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    // Success state
    if (accepted) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-background p-4">
                <Card className="w-full max-w-md">
                    <CardHeader className="text-center">
                        <div className="mx-auto mb-2 w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                            <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <CardTitle>Welcome to {invitation?.workspaceName}!</CardTitle>
                        <CardDescription>
                            {invitation?.existingUser
                                ? `You've been added as ${getRoleLabel(invitation.role || "AGENT")}. Sign in to switch into this workspace.`
                                : `Your account has been set up and you have been added to the workspace as ${getRoleLabel(invitation?.role || "AGENT")}.`}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="text-center space-y-2">
                        <Button onClick={() => router.push(invitation?.existingUser ? "/dashboard" : "/login")}>
                            {invitation?.existingUser ? "Open Dashboard" : "Sign In"}
                        </Button>
                        {invitation?.existingUser && (
                            <p className="text-xs text-muted-foreground">
                                Already signed in? Use the workspace switcher in the sidebar to jump in.
                            </p>
                        )}
                    </CardContent>
                </Card>
            </div>
        )
    }

    // Invitation form
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-background p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <div className="mx-auto mb-2 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <Building2 className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle>You have been invited</CardTitle>
                    <CardDescription>
                        {invitation?.invitedByName
                            ? `${invitation.invitedByName} has invited you to join`
                            : "You have been invited to join"}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Workspace info */}
                    <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Workspace</span>
                            <span className="text-sm font-medium">{invitation?.workspaceName}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Role</span>
                            <div className="flex items-center gap-1.5">
                                {getRoleIcon(invitation?.role || "AGENT")}
                                <span className="text-sm font-medium">{getRoleLabel(invitation?.role || "AGENT")}</span>
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Email</span>
                            <span className="text-sm font-medium">{invitation?.email}</span>
                        </div>
                    </div>

                    {/* Existing user → quick join. New user → create-account form. */}
                    {invitation?.existingUser ? (
                        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm">
                            <p className="font-medium">Welcome back{invitation.existingUserName ? `, ${invitation.existingUserName}` : ""}!</p>
                            <p className="text-muted-foreground mt-1 text-xs">
                                You already have an account. Click below to join {invitation.workspaceName} —
                                you&apos;ll see it in the workspace switcher next time you sign in.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <h3 className="text-sm font-medium">Create your account</h3>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-sm text-muted-foreground mb-1.5 block">Full Name</label>
                                    <Input
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="John Doe"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm text-muted-foreground mb-1.5 block">Password</label>
                                    <Input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Min. 8 characters"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm text-muted-foreground mb-1.5 block">Confirm Password</label>
                                    <Input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Confirm your password"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {formError && (
                        <p className="text-sm text-red-500">{formError}</p>
                    )}

                    <Button
                        onClick={handleAccept}
                        disabled={isSubmitting}
                        className="w-full"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                Accepting...
                            </>
                        ) : invitation?.existingUser ? (
                            `Join ${invitation.workspaceName}`
                        ) : (
                            "Accept Invitation"
                        )}
                    </Button>

                    <p className="text-xs text-center text-muted-foreground">
                        Already have an account?{" "}
                        <a href="/login" className="text-primary hover:underline">
                            Sign in
                        </a>
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}
