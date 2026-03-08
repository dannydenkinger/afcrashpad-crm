"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
    CheckCircle2,
    Loader2,
    PenLine,
    RotateCcw,
    FileText,
    AlertTriangle,
} from "lucide-react"
import { getSignatureRequest, submitSignature } from "@/app/contacts/documents/signature-actions"

export default function SigningPage() {
    const params = useParams()
    const token = params.token as string

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [request, setRequest] = useState<{
        id: string
        documentName: string
        documentUrl: string
        generatedContent: string
        contactName: string
        contactEmail: string
        status: string
        requestedAt: string
        signedAt: string | null
    } | null>(null)

    const [isSubmitting, setIsSubmitting] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const [isDrawing, setIsDrawing] = useState(false)
    const [hasSignature, setHasSignature] = useState(false)

    const canvasRef = useRef<HTMLCanvasElement>(null)
    const lastPosRef = useRef<{ x: number; y: number } | null>(null)

    // Fetch the signature request
    useEffect(() => {
        async function fetchRequest() {
            setLoading(true)
            try {
                const res = await getSignatureRequest(token)
                if (res.success && res.request) {
                    setRequest(res.request as typeof request)
                    if (res.request.status === "signed") {
                        setSubmitted(true)
                    }
                } else {
                    setError(res.error || "Signature request not found")
                }
            } catch {
                setError("Failed to load signature request")
            }
            setLoading(false)
        }
        if (token) fetchRequest()
    }, [token])

    // Initialize canvas
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext("2d")
        if (!ctx) return

        // Set canvas resolution
        const rect = canvas.getBoundingClientRect()
        canvas.width = rect.width * 2
        canvas.height = rect.height * 2
        ctx.scale(2, 2)
        ctx.lineCap = "round"
        ctx.lineJoin = "round"
        ctx.lineWidth = 2
        ctx.strokeStyle = "#1a1a1a"

        // Fill white background
        ctx.fillStyle = "#ffffff"
        ctx.fillRect(0, 0, rect.width, rect.height)
    }, [request, submitted])

    const getPos = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current
        if (!canvas) return { x: 0, y: 0 }
        const rect = canvas.getBoundingClientRect()

        if ("touches" in e) {
            const touch = e.touches[0]
            return {
                x: touch.clientX - rect.left,
                y: touch.clientY - rect.top,
            }
        }
        return {
            x: (e as React.MouseEvent).clientX - rect.left,
            y: (e as React.MouseEvent).clientY - rect.top,
        }
    }, [])

    const startDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault()
        setIsDrawing(true)
        lastPosRef.current = getPos(e)
    }, [getPos])

    const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault()
        if (!isDrawing || !lastPosRef.current) return

        const canvas = canvasRef.current
        const ctx = canvas?.getContext("2d")
        if (!canvas || !ctx) return

        const pos = getPos(e)
        ctx.beginPath()
        ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y)
        ctx.lineTo(pos.x, pos.y)
        ctx.stroke()

        lastPosRef.current = pos
        setHasSignature(true)
    }, [isDrawing, getPos])

    const stopDrawing = useCallback(() => {
        setIsDrawing(false)
        lastPosRef.current = null
    }, [])

    const clearSignature = useCallback(() => {
        const canvas = canvasRef.current
        const ctx = canvas?.getContext("2d")
        if (!canvas || !ctx) return

        const rect = canvas.getBoundingClientRect()
        ctx.fillStyle = "#ffffff"
        ctx.fillRect(0, 0, rect.width, rect.height)
        setHasSignature(false)
    }, [])

    const handleSubmit = async () => {
        const canvas = canvasRef.current
        if (!canvas || !hasSignature) return

        setIsSubmitting(true)
        try {
            const signatureDataUrl = canvas.toDataURL("image/png")
            const res = await submitSignature(token, signatureDataUrl)
            if (res.success) {
                setSubmitted(true)
            } else {
                setError(res.error || "Failed to submit signature")
            }
        } catch {
            setError("Failed to submit signature")
        }
        setIsSubmitting(false)
    }

    // Loading state
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto" />
                    <p className="text-sm text-gray-500 mt-3">Loading document...</p>
                </div>
            </div>
        )
    }

    // Error state
    if (error && !request) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center max-w-md px-6">
                    <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
                    <h1 className="text-lg font-semibold text-gray-900 mb-2">Signature Request Not Found</h1>
                    <p className="text-sm text-gray-500">{error}</p>
                </div>
            </div>
        )
    }

    // Success state
    if (submitted) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center max-w-md px-6">
                    <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                        <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                    </div>
                    <h1 className="text-xl font-semibold text-gray-900 mb-2">Document Signed</h1>
                    <p className="text-sm text-gray-500">
                        Thank you{request?.contactName ? `, ${request.contactName}` : ""}. Your signature has been recorded.
                    </p>
                    <p className="text-xs text-gray-400 mt-3">
                        You can close this window.
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white border-b px-6 py-4">
                <div className="max-w-3xl mx-auto flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-50">
                        <FileText className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                        <h1 className="text-sm font-semibold text-gray-900">Sign Document</h1>
                        <p className="text-xs text-gray-500">{request?.documentName}</p>
                    </div>
                </div>
            </header>

            <div className="max-w-3xl mx-auto p-6 space-y-6">
                {/* Document preview */}
                {request?.generatedContent ? (
                    <div className="bg-white rounded-xl border shadow-sm p-6">
                        <div
                            className="prose prose-sm max-w-none"
                            dangerouslySetInnerHTML={{ __html: request.generatedContent }}
                        />
                    </div>
                ) : request?.documentUrl ? (
                    <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                        <iframe
                            src={request.documentUrl}
                            title={request.documentName}
                            className="w-full h-[50vh] border-none"
                        />
                    </div>
                ) : (
                    <div className="bg-white rounded-xl border shadow-sm p-8 text-center">
                        <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                        <p className="text-sm text-gray-500">Document preview not available</p>
                    </div>
                )}

                {/* Signature pad */}
                <div className="bg-white rounded-xl border shadow-sm p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                                <PenLine className="h-4 w-4" />
                                Your Signature
                            </h2>
                            <p className="text-xs text-gray-500 mt-0.5">
                                Draw your signature in the box below
                            </p>
                        </div>
                        {hasSignature && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs gap-1 text-gray-500"
                                onClick={clearSignature}
                            >
                                <RotateCcw className="h-3 w-3" />
                                Clear
                            </Button>
                        )}
                    </div>

                    <div className="relative border-2 border-dashed rounded-lg overflow-hidden bg-white">
                        <canvas
                            ref={canvasRef}
                            className="w-full cursor-crosshair touch-none"
                            style={{ height: "160px" }}
                            onMouseDown={startDrawing}
                            onMouseMove={draw}
                            onMouseUp={stopDrawing}
                            onMouseLeave={stopDrawing}
                            onTouchStart={startDrawing}
                            onTouchMove={draw}
                            onTouchEnd={stopDrawing}
                        />
                        {!hasSignature && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <p className="text-sm text-gray-300">Sign here</p>
                            </div>
                        )}
                    </div>

                    {error && (
                        <p className="text-sm text-red-500">{error}</p>
                    )}

                    <div className="flex justify-end pt-2">
                        <Button
                            onClick={handleSubmit}
                            disabled={!hasSignature || isSubmitting}
                            className="gap-1.5"
                        >
                            {isSubmitting ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <CheckCircle2 className="h-4 w-4" />
                            )}
                            {isSubmitting ? "Submitting..." : "Submit Signature"}
                        </Button>
                    </div>
                </div>

                <p className="text-[10px] text-gray-400 text-center">
                    By signing this document, you acknowledge that your electronic signature is the legal equivalent of your handwritten signature.
                </p>
            </div>
        </div>
    )
}
