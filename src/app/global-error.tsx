"use client"

import { useEffect } from "react"
import * as Sentry from "@sentry/nextjs"

/**
 * Catches errors that escape every other error boundary — including
 * crashes in the root layout. Must be a self-contained <html> document
 * because the root layout itself may have failed.
 */
export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        Sentry.captureException(error)
    }, [error])

    return (
        <html>
            <body
                style={{
                    fontFamily:
                        "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                    margin: 0,
                    minHeight: "100vh",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "1.5rem",
                    background: "#fafafa",
                    color: "#0a0a0a",
                }}
            >
                <div style={{ maxWidth: 420, textAlign: "center" }}>
                    <div
                        style={{
                            width: 56,
                            height: 56,
                            borderRadius: 28,
                            background: "rgba(239, 68, 68, 0.1)",
                            color: "#ef4444",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            marginBottom: 16,
                            fontSize: 28,
                        }}
                    >
                        ⚠
                    </div>
                    <h1 style={{ fontSize: 20, margin: "0 0 8px", fontWeight: 600 }}>
                        Something went wrong
                    </h1>
                    <p
                        style={{
                            fontSize: 14,
                            color: "#737373",
                            margin: "0 0 24px",
                            lineHeight: 1.5,
                        }}
                    >
                        An unexpected error stopped the app from loading. The team has been
                        notified — refresh in a moment or head back to the dashboard.
                    </p>
                    <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                        <button
                            onClick={() => reset()}
                            style={{
                                background: "#0a0a0a",
                                color: "white",
                                border: "none",
                                padding: "8px 16px",
                                borderRadius: 6,
                                fontSize: 14,
                                cursor: "pointer",
                            }}
                        >
                            Try again
                        </button>
                        <button
                            onClick={() => (window.location.href = "/")}
                            style={{
                                background: "transparent",
                                color: "#0a0a0a",
                                border: "1px solid #e5e5e5",
                                padding: "8px 16px",
                                borderRadius: 6,
                                fontSize: 14,
                                cursor: "pointer",
                            }}
                        >
                            Go home
                        </button>
                    </div>
                    {error.digest && (
                        <p
                            style={{
                                fontSize: 11,
                                color: "#a3a3a3",
                                fontFamily: "ui-monospace, monospace",
                                marginTop: 24,
                            }}
                        >
                            Error ID: {error.digest}
                        </p>
                    )}
                </div>
            </body>
        </html>
    )
}
