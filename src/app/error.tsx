"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"
import { captureError } from "@/lib/error-tracking"

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        captureError(error, { digest: error.digest, source: "error-boundary" })
    }, [error])

    return (
        <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 mb-6">
                    <AlertTriangle className="h-8 w-8 text-destructive" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight mb-2">Something went wrong</h2>
                <p className="text-sm text-muted-foreground max-w-md mb-8">
                    An unexpected error occurred. This has been logged and we&apos;ll look into it.
                </p>
                <div className="flex gap-3">
                    <Button variant="outline" onClick={() => window.location.href = "/dashboard"}>
                        Go to Dashboard
                    </Button>
                    <Button onClick={() => reset()}>
                        Try Again
                    </Button>
                </div>
                {error.digest && (
                    <p className="text-xs text-muted-foreground mt-6 font-mono">
                        Error ID: {error.digest}
                    </p>
                )}
            </div>
        </div>
    )
}
