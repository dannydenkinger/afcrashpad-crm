"use client"

import React from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Props {
    children: React.ReactNode
    fallback?: React.ReactNode
    section?: string
}

interface State {
    hasError: boolean
    error: Error | null
}

export class ErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props)
        this.state = { hasError: false, error: null }
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error }
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error(`ErrorBoundary [${this.props.section || "unknown"}]:`, error, errorInfo)
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) return this.props.fallback

            return (
                <div className="flex flex-col items-center justify-center p-8 text-center min-h-[200px]">
                    <AlertTriangle className="h-8 w-8 text-destructive/60 mb-3" />
                    <p className="text-sm font-medium text-foreground mb-1">
                        {this.props.section ? `${this.props.section} failed to load` : "Something went wrong"}
                    </p>
                    <p className="text-xs text-muted-foreground mb-4 max-w-sm">
                        {this.state.error?.message || "An unexpected error occurred"}
                    </p>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => this.setState({ hasError: false, error: null })}
                        className="gap-1.5"
                    >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Try again
                    </Button>
                </div>
            )
        }

        return this.props.children
    }
}
