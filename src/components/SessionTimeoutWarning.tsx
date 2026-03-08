"use client"

import { useState, useEffect, useCallback } from "react"
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

const TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes of inactivity
const WARNING_MS = 5 * 60 * 1000  // Show warning 5 minutes before timeout

export function SessionTimeoutWarning() {
    const { status } = useSession()
    const [showWarning, setShowWarning] = useState(false)
    const [timeoutId, setTimeoutId] = useState<ReturnType<typeof setTimeout> | null>(null)
    const [warningId, setWarningId] = useState<ReturnType<typeof setTimeout> | null>(null)

    const resetTimers = useCallback(() => {
        if (status !== "authenticated") return

        if (timeoutId) clearTimeout(timeoutId)
        if (warningId) clearTimeout(warningId)
        setShowWarning(false)

        const newWarningId = setTimeout(() => {
            setShowWarning(true)
        }, TIMEOUT_MS - WARNING_MS)

        const newTimeoutId = setTimeout(() => {
            signOut({ callbackUrl: "/" })
        }, TIMEOUT_MS)

        setWarningId(newWarningId)
        setTimeoutId(newTimeoutId)
    }, [status]) // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (status !== "authenticated") return

        resetTimers()

        const events = ["mousedown", "keydown", "scroll", "touchstart"]
        const handler = () => {
            if (!showWarning) resetTimers()
        }

        events.forEach(event => window.addEventListener(event, handler, { passive: true }))
        return () => {
            events.forEach(event => window.removeEventListener(event, handler))
            if (timeoutId) clearTimeout(timeoutId)
            if (warningId) clearTimeout(warningId)
        }
    }, [status, resetTimers]) // eslint-disable-line react-hooks/exhaustive-deps

    if (status !== "authenticated") return null

    return (
        <AlertDialog open={showWarning} onOpenChange={setShowWarning}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Session expiring soon</AlertDialogTitle>
                    <AlertDialogDescription>
                        Your session will expire in 5 minutes due to inactivity. Click &quot;Stay Signed In&quot; to continue working.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => signOut({ callbackUrl: "/" })}>
                        Sign Out
                    </AlertDialogCancel>
                    <AlertDialogAction onClick={resetTimers}>
                        Stay Signed In
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
