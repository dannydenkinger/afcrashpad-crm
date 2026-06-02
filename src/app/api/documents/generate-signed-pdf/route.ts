import { NextRequest, NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth-guard"
import { getAdminStorageBucket } from "@/lib/firebase-admin"
import { tenantDb } from "@/lib/tenant-db"
import { PDFDocument } from "pdf-lib"

export async function POST(req: NextRequest) {
    try {
        const session = await getAuthSession()
        if (!session?.user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
        }
        const workspaceId = (session.user as any).workspaceId
        if (!workspaceId) {
            return NextResponse.json({ success: false, error: "No workspace found" }, { status: 403 })
        }
        const db = tenantDb(workspaceId)

        const { configId, documentId, contactId } = await req.json()

        if (!configId || !documentId) {
            return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 })
        }

        const configDoc = await db.getOwned("document_signature_configs", configId)
        if (!configDoc) {
            return NextResponse.json({ success: false, error: "Config not found" }, { status: 404 })
        }

        const config = configDoc.data()!
        const pdfUrl = config.pdfUrl as string

        if (!pdfUrl) {
            return NextResponse.json({ success: false, error: "No PDF URL in config" }, { status: 400 })
        }

        let parsedPdfUrl: URL
        try {
            parsedPdfUrl = new URL(pdfUrl)
        } catch {
            return NextResponse.json({ success: false, error: "Invalid PDF URL" }, { status: 400 })
        }
        const pdfHost = parsedPdfUrl.hostname.toLowerCase()
        const ALLOWED = ["firebasestorage.app", "firebasestorage.googleapis.com", "storage.googleapis.com"]
        if (parsedPdfUrl.protocol !== "https:" || !ALLOWED.some(h => pdfHost === h || pdfHost.endsWith(`.${h}`))) {
            return NextResponse.json({ success: false, error: "PDF URL not allowed" }, { status: 403 })
        }

        // Fetch all completed signature requests for this config
        const requestsSnap = await db.collection("signature_requests")
            .where("configId", "==", configId)
            .where("status", "==", "signed")
            .get()

        // Collect all signed blocks across all requests
        interface SignedBlock {
            id: string
            pageNumber: number
            x: number
            y: number
            width: number
            height: number
            signed?: boolean
            signatureDataUrl?: string
            type: string
        }

        const signedBlocks: SignedBlock[] = []
        for (const reqDoc of requestsSnap.docs) {
            const blocks = (reqDoc.data().signatureBlocks || []) as SignedBlock[]
            for (const block of blocks) {
                if (block.signed && block.signatureDataUrl) {
                    signedBlocks.push(block)
                }
            }
        }

        if (signedBlocks.length === 0) {
            return NextResponse.json({ success: false, error: "No signed blocks found" }, { status: 400 })
        }

        // Fetch the original PDF
        const pdfResponse = await fetch(pdfUrl)
        if (!pdfResponse.ok) {
            return NextResponse.json({ success: false, error: "Failed to fetch PDF" }, { status: 500 })
        }
        const pdfBytes = await pdfResponse.arrayBuffer()

        // Load PDF with pdf-lib
        const pdfDoc = await PDFDocument.load(pdfBytes)

        // Embed each signature into the PDF
        for (const block of signedBlocks) {
            const page = pdfDoc.getPage(block.pageNumber - 1)
            if (!page) continue

            const { width: pageWidth, height: pageHeight } = page.getSize()

            // Convert dataURL to bytes
            const dataUrl = block.signatureDataUrl!
            const base64Data = dataUrl.split(",")[1]
            const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))

            let image
            if (dataUrl.includes("image/png")) {
                image = await pdfDoc.embedPng(imageBytes)
            } else {
                image = await pdfDoc.embedJpg(imageBytes)
            }

            // Convert percentage coordinates to PDF points
            // PDF uses bottom-left origin, our UI uses top-left
            const x = (block.x / 100) * pageWidth
            const w = (block.width / 100) * pageWidth
            const h = (block.height / 100) * pageHeight
            const y = pageHeight - ((block.y / 100) * pageHeight) - h

            page.drawImage(image, { x, y, width: w, height: h })
        }

        // Save the modified PDF
        const signedPdfBytes = await pdfDoc.save()

        // Upload to Firebase Storage
        const bucket = getAdminStorageBucket()
        const storagePath = `signed-documents/${documentId}-signed-${Date.now()}.pdf`
        const storageFile = bucket.file(storagePath)
        await storageFile.save(Buffer.from(signedPdfBytes), {
            metadata: { contentType: "application/pdf" },
        })

        const [signedUrl] = await storageFile.getSignedUrl({
            action: "read",
            expires: new Date("2030-01-01"),
        })

        // Update the document with signed PDF URL
        const docRef = contactId
            ? db.subcollection("contacts", contactId, "documents").doc(documentId)
            : db.doc("documents", documentId)

        await docRef.update({
            signedPdfUrl: signedUrl,
            updatedAt: new Date(),
        })

        // Update config status
        await configDoc.ref.update({
            status: "completed",
            updatedAt: new Date(),
        })

        return NextResponse.json({ success: true, signedPdfUrl: signedUrl })
    } catch (err) {
        console.error("Signed PDF generation error:", err)
        return NextResponse.json(
            { success: false, error: err instanceof Error ? err.message : "PDF generation failed" },
            { status: 500 }
        )
    }
}
