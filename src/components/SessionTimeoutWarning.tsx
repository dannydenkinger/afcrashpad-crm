"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useSession } from "next-auth/react"
import { signOut } from "next-auth/react"
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

const TIMEOUT_MS = 60 * 60 * 1000 // 60 minutes of inactivity
const WARNING_MS = 5 * 60 * 1000  // Show warning 5 minutes before timeout

export function SessionTimeoutWarning() {
    const { status } = useSession()
    const [showWarning, setShowWarning] = useState(false)
    const warningRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const showWarningRef = useRef(false)

    const resetTimers = useCallback(() => {
        if (showWarningRef.current) return

        if (warningRef.current) clearTimeout(warningRef.current)
        if (timeoutRef.current) clearTimeout(timeoutRef.current)

        warningRef.current = setTimeout(() => {
            showWarningRef.current = true
            setShowWarning(true)
        }, TIMEOUT_MS - WARNING_MS)

        timeoutRef.current = setTimeout(() => {
            signOut({ callbackUrl: "/login" })
        }, TIMEOUT_MS)
    }, [])

    const handleStaySignedIn = useCallback(() => {
        showWarningRef.current = false
        setShowWarning(false)
        resetTimers()
    }, [resetTimers])

    useEffect(() => {
        if (status !== "authenticated") return

        resetTimers()

        // Only track interactions within the CRM — not window focus/blur
        const events = ["mousedown", "keydown", "scroll", "touchstart"]
        const handler = () => resetTimers()

        events.forEach(event => document.addEventListener(event, handler, { passive: true }))
        return () => {
            events.forEach(event => document.removeEventListener(event, handler))
            if (warningRef.current) clearTimeout(warningRef.current)
            if (timeoutRef.current) clearTimeout(timeoutRef.current)
        }
    }, [status, resetTimers])

    if (status !== "authenticated") return null

    return (
        <AlertDialog open={showWarning}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Session expiring soon</AlertDialogTitle>
                    <AlertDialogDescription>
                        Your session will expire in 5 minutes due to inactivity. Click &quot;Stay Signed In&quot; to continue working.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => signOut({ callbackUrl: "/login" })}>
                        Sign Out
                    </AlertDialogCancel>
                    <AlertDialogAction onClick={handleStaySignedIn}>
                        Stay Signed In
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
