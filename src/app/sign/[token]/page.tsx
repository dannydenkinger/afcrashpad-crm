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
    Maximize2,
} from "lucide-react"
import { getSignatureRequest, submitSignature, submitBlockSignatures } from "@/app/contacts/documents/signature-actions"
import { SignerBlockOverlay } from "../components/SignerBlockOverlay"
import type { SignatureBlockData } from "@/app/documents/components/SignatureBlock"
import { sanitizeHtml } from "@/lib/sanitize-html"

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
        pdfUrl?: string
        signatureBlocks?: SignatureBlockData[]
        allBlocks?: SignatureBlockData[]
    } | null>(null)

    const [isSubmitting, setIsSubmitting] = useState(false)
    const [submitted, setSubmitted] = useState(false)

    // Legacy canvas signing state
    const [isDrawing, setIsDrawing] = useState(false)
    const [hasSignature, setHasSignature] = useState(false)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const lastPosRef = useRef<{ x: number; y: number } | null>(null)

    // Block-based signing state
    const [signedBlocks, setSignedBlocks] = useState<SignatureBlockData[]>([])

    const hasBlocks = Boolean(request?.signatureBlocks && request.signatureBlocks.length > 0)

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
                    // Initialize signed blocks with existing data
                    if (res.request.signatureBlocks) {
                        setSignedBlocks(
                            (res.request.signatureBlocks as SignatureBlockData[]).map(b => ({ ...b }))
                        )
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

    // Initialize canvas (legacy mode only)
    useEffect(() => {
        if (hasBlocks) return
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext("2d")
        if (!ctx) return

        const rect = canvas.getBoundingClientRect()
        canvas.width = rect.width * 2
        canvas.height = rect.height * 2
        ctx.scale(2, 2)
        ctx.lineCap = "round"
        ctx.lineJoin = "round"
        ctx.lineWidth = 2
        ctx.strokeStyle = "#1a1a1a"
        ctx.fillStyle = "#ffffff"
        ctx.fillRect(0, 0, rect.width, rect.height)
    }, [request, submitted, hasBlocks])

    // ── Legacy Canvas Handlers ──

    const getPos = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current
        if (!canvas) return { x: 0, y: 0 }
        const rect = canvas.getBoundingClientRect()
        if ("touches" in e) {
            const touch = e.touches[0]
            return { x: touch.clientX - rect.left, y: touch.clientY - rect.top }
        }
        return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top }
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

    // ── Block Signing Handler ──

    const handleBlockSigned = useCallback((blockId: string, dataUrl: string) => {
        setSignedBlocks(prev =>
            prev.map(b => b.id === blockId ? { ...b, signed: true, signatureDataUrl: dataUrl } : b)
        )
    }, [])

    // ── Submit ──

    const handleSubmitLegacy = async () => {
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

    const handleSubmitBlocks = async () => {
        setIsSubmitting(true)
        try {
            const blockSignatures = signedBlocks
                .filter(b => b.signed && b.signatureDataUrl)
                .map(b => ({ blockId: b.id, signatureDataUrl: b.signatureDataUrl! }))

            const res = await submitBlockSignatures(token, blockSignatures)
            if (res.success) {
                setSubmitted(true)
            } else {
                setError(res.error || "Failed to submit signatures")
            }
        } catch {
            setError("Failed to submit signatures")
        }
        setIsSubmitting(false)
    }

    const allBlocksSigned = hasBlocks && signedBlocks.every(b => b.signed)

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
                    <p className="text-xs text-gray-400 mt-3">You can close this window.</p>
                </div>
            </div>
        )
    }

    // ── Block-Based Signing ──
    if (hasBlocks && request) {
        const completedCount = signedBlocks.filter(b => b.signed).length
        const totalCount = signedBlocks.length
        const signers = [...new Set([...(request.allBlocks || []).map(b => b.assignedTo)])]

        return (
            <div className="min-h-screen bg-gray-50 flex flex-col">
                {/* Header */}
                <header className="bg-white border-b px-6 py-3 shrink-0">
                    <div className="max-w-5xl mx-auto flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-50">
                            <FileText className="h-5 w-5 text-blue-600" />
                        </div>
                        <div className="flex-1">
                            <h1 className="text-sm font-semibold text-gray-900">Sign Document</h1>
                            <p className="text-xs text-gray-500">{request.documentName}</p>
                        </div>
                        <div className="text-xs text-gray-500">
                            {completedCount} of {totalCount} fields completed
                        </div>
                        <Button
                            onClick={handleSubmitBlocks}
                            disabled={!allBlocksSigned || isSubmitting}
                            size="sm"
                            className="h-8 text-xs"
                        >
                            {isSubmitting ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                            ) : (
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                            )}
                            Submit Signatures
                        </Button>
                    </div>
                </header>

                {/* PDF with block overlays */}
                <div className="flex-1 overflow-auto">
                    <div className="max-w-5xl mx-auto">
                        <SignerBlockOverlay
                            pdfUrl={request.pdfUrl || request.documentUrl}
                            signerBlocks={signedBlocks}
                            allBlocks={request.allBlocks || []}
                            signerEmail={request.contactEmail}
                            signers={signers}
                            onBlockSigned={handleBlockSigned}
                        />
                    </div>
                </div>

                {error && (
                    <div className="bg-red-50 border-t border-red-200 px-6 py-2 text-center">
                        <p className="text-sm text-red-600">{error}</p>
                    </div>
                )}

                <div className="bg-white border-t px-6 py-3 text-center">
                    <p className="text-[10px] text-gray-400">
                        By signing this document, you acknowledge that your electronic signature is the legal equivalent of your handwritten signature.
                    </p>
                </div>
            </div>
        )
    }

    // ── Legacy Canvas Signing ──
    return (
        <div className="min-h-screen bg-gray-50">
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
                {request?.generatedContent ? (
                    <div className="bg-white rounded-xl border shadow-sm p-6">
                        <div
                            className="prose prose-sm max-w-none"
                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(request.generatedContent) }}
                        />
                    </div>
                ) : request?.documentUrl ? (
                    <div className="bg-white rounded-xl border shadow-sm overflow-hidden relative group">
                        <iframe
                            src={request.documentUrl}
                            title={request.documentName}
                            className="w-full h-[60vh] border-none"
                        />
                        <a
                            href={request.documentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="absolute top-2 right-2 inline-flex items-center gap-1.5 rounded-md bg-white/90 backdrop-blur px-2.5 py-1.5 text-xs font-medium text-gray-700 border shadow-sm hover:bg-white transition-colors"
                        >
                            <Maximize2 className="h-3 w-3" />
                            Open full size
                        </a>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl border shadow-sm p-8 text-center">
                        <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                        <p className="text-sm text-gray-500">Document preview not available</p>
                    </div>
                )}

                <div className="bg-white rounded-xl border shadow-sm p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                                <PenLine className="h-4 w-4" />
                                Your Signature
                            </h2>
                            <p className="text-xs text-gray-500 mt-0.5">Draw your signature in the box below</p>
                        </div>
                        {hasSignature && (
                            <Button variant="ghost" size="sm" className="h-8 text-xs gap-1 text-gray-500" onClick={clearSignature}>
                                <RotateCcw className="h-3 w-3" /> Clear
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

                    {error && <p className="text-sm text-red-500">{error}</p>}

                    <div className="flex justify-end pt-2">
                        <Button onClick={handleSubmitLegacy} disabled={!hasSignature || isSubmitting} className="gap-1.5">
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
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
