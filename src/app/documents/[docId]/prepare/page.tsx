"use client"

import { useState, useEffect, useCallback, use, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Save, Loader2 } from "lucide-react"
import { SignatureBlockEditor } from "../../components/SignatureBlockEditor"
import { SignerPanel } from "../../components/SignerPanel"
import type { SignatureBlockData } from "../../components/SignatureBlock"
import {
    saveSignatureConfig,
    getSignatureConfig,
    sendPreparedSignatures,
    getDocumentForPrepare,
} from "../../signature-config-actions"
import { toast } from "sonner"

export default function PrepareSignaturePageWrapper({
    params,
}: {
    params: Promise<{ docId: string }>
}) {
    return (
        <Suspense fallback={<div className="flex items-center justify-center h-full"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>}>
            <PrepareSignaturePage params={params} />
        </Suspense>
    )
}

function PrepareSignaturePage({
    params,
}: {
    params: Promise<{ docId: string }>
}) {
    const { docId } = use(params)
    const searchParams = useSearchParams()
    const contactId = searchParams.get("contactId") || ""
    const router = useRouter()

    const [docName, setDocName] = useState("")
    const [pdfUrl, setPdfUrl] = useState("")
    const [blocks, setBlocks] = useState<SignatureBlockData[]>([])
    const [signers, setSigners] = useState<string[]>([])
    const [activeSigner, setActiveSigner] = useState("")
    const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
    const [configId, setConfigId] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [sending, setSending] = useState(false)

    // ── Load Document & Config ──
    useEffect(() => {
        async function load() {
            setLoading(true)

            // Fetch document details
            const docResult = await getDocumentForPrepare(docId, contactId)
            if (docResult.success && docResult.doc) {
                setDocName(docResult.doc.name)
                setPdfUrl(docResult.doc.url)
            } else {
                toast.error(docResult.error || "Document not found")
                router.push("/documents")
                return
            }

            // Fetch existing config if any
            const configResult = await getSignatureConfig(docId, contactId)
            if (configResult.success && configResult.config) {
                setBlocks(configResult.config.blocks)
                setSigners(configResult.config.signers)
                setConfigId(configResult.config.id)
                if (configResult.config.signers.length > 0) {
                    setActiveSigner(configResult.config.signers[0])
                }
            }

            setLoading(false)
        }
        load()
    }, [docId, contactId, router])

    // ── Save Config ──
    const handleSave = useCallback(async () => {
        setSaving(true)
        const result = await saveSignatureConfig(docId, contactId, blocks, signers, pdfUrl)
        if (result.success) {
            toast.success("Configuration saved")
            if (result.configId) setConfigId(result.configId)
        } else {
            toast.error(result.error || "Failed to save")
        }
        setSaving(false)
    }, [docId, contactId, blocks, signers, pdfUrl])

    // ── Send for Signatures ──
    const handleSend = useCallback(async () => {
        // Save first
        setSending(true)
        const saveResult = await saveSignatureConfig(docId, contactId, blocks, signers, pdfUrl)
        if (!saveResult.success || !saveResult.configId) {
            toast.error("Failed to save configuration before sending")
            setSending(false)
            return
        }

        const sendResult = await sendPreparedSignatures(saveResult.configId)
        if (sendResult.success) {
            toast.success(`Sent to ${sendResult.sent} signer(s)`)
            router.push("/documents")
        } else {
            toast.error(sendResult.error || "Failed to send")
        }
        setSending(false)
    }, [docId, contactId, blocks, signers, pdfUrl, router])

    // ── Signer Management ──
    const addSigner = useCallback((email: string) => {
        setSigners(prev => [...prev, email])
        setActiveSigner(email)
    }, [])

    const removeSigner = useCallback((email: string) => {
        setSigners(prev => prev.filter(s => s !== email))
        setBlocks(prev => prev.filter(b => b.assignedTo !== email))
        if (activeSigner === email) {
            setActiveSigner(signers.find(s => s !== email) || "")
        }
    }, [activeSigner, signers])

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (!pdfUrl) {
        return (
            <div className="flex flex-col items-center justify-center h-screen gap-4">
                <p className="text-sm text-muted-foreground">This document does not have a PDF to annotate.</p>
                <Button variant="outline" onClick={() => router.push("/documents")}>
                    <ArrowLeft className="h-4 w-4 mr-2" /> Back to Documents
                </Button>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-screen bg-background">
            {/* Top Toolbar */}
            <div className="flex items-center gap-3 px-4 py-2 border-b bg-background shrink-0">
                <Button variant="ghost" size="sm" onClick={() => router.push("/documents")} className="h-8 text-xs">
                    <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back
                </Button>
                <div className="flex-1 min-w-0">
                    <h2 className="text-sm font-semibold truncate">{docName}</h2>
                    <p className="text-[10px] text-muted-foreground">Prepare signature blocks</p>
                </div>
                <Button variant="outline" size="sm" onClick={handleSave} disabled={saving} className="h-8 text-xs">
                    {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
                    Save
                </Button>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex min-h-0">
                {/* PDF Editor */}
                <div className="flex-1 flex flex-col min-h-0">
                    <SignatureBlockEditor
                        pdfUrl={pdfUrl}
                        blocks={blocks}
                        signers={signers}
                        activeSigner={activeSigner}
                        selectedBlockId={selectedBlockId}
                        onBlocksChange={setBlocks}
                        onSelectBlock={setSelectedBlockId}
                    />
                </div>

                {/* Signer Panel */}
                <div className="w-[280px] border-l bg-background shrink-0">
                    <SignerPanel
                        signers={signers}
                        blocks={blocks}
                        activeSigner={activeSigner}
                        sending={sending}
                        onAddSigner={addSigner}
                        onRemoveSigner={removeSigner}
                        onSetActiveSigner={setActiveSigner}
                        onSend={handleSend}
                    />
                </div>
            </div>
        </div>
    )
}
