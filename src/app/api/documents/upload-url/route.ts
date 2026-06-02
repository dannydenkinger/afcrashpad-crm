import { NextRequest, NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth-guard"
import { getAdminStorageBucket } from "@/lib/firebase-admin"
import { rateLimit } from "@/lib/rate-limit"

/**
 * Generates a short-lived signed PUT URL the client can use to upload a file
 * directly to Cloud Storage. This bypasses the Vercel serverless function
 * 4.5 MB body limit — the client never sends file bytes through our route.
 *
 * Flow:
 *   1. Client → POST /api/documents/upload-url { filename, contentType, contactId? }
 *      Server → { uploadUrl, storagePath, expiresAt }
 *   2. Client → PUT uploadUrl (with the file as the body, matching contentType)
 *   3. Client → POST /api/documents/record { storagePath, filename, contactId?, ... }
 *      Server verifies the object exists, signs a long-lived read URL, writes Firestore.
 */

const MAX_FILE_SIZE_HINT = 25 * 1024 * 1024 // 25 MB — informational; signed URL doesn't enforce
const ALLOWED_TYPES = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
    "text/csv",
]

function sanitizeFileName(name: string): string {
    return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100)
}

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

        const { allowed } = rateLimit(`upload-url:${session.user.id}`, 40)
        if (!allowed) {
            return NextResponse.json({ success: false, error: "Rate limit exceeded" }, { status: 429 })
        }

        const body = (await req.json().catch(() => ({}))) as {
            filename?: string
            contentType?: string
            contactId?: string
            sizeBytes?: number
        }

        const filename = (body.filename || "").trim()
        const contentType = (body.contentType || "application/octet-stream").trim()
        const contactId = (body.contactId || "").trim() || undefined
        const sizeBytes = typeof body.sizeBytes === "number" ? body.sizeBytes : undefined

        if (!filename) {
            return NextResponse.json({ success: false, error: "filename is required" }, { status: 400 })
        }

        if (!ALLOWED_TYPES.includes(contentType) && !contentType.startsWith("image/")) {
            return NextResponse.json({ success: false, error: `File type not allowed: ${contentType}` }, { status: 400 })
        }

        if (sizeBytes !== undefined && sizeBytes > MAX_FILE_SIZE_HINT) {
            return NextResponse.json(
                { success: false, error: `File too large (${(sizeBytes / 1024 / 1024).toFixed(1)} MB; max 25 MB)` },
                { status: 400 }
            )
        }

        const safeName = sanitizeFileName(filename) || "document"
        const storagePath = contactId
            ? `contacts/${contactId}/documents/${Date.now()}-${safeName}`
            : `documents/${workspaceId}/${Date.now()}-${safeName}`

        const bucket = getAdminStorageBucket()
        const storageFile = bucket.file(storagePath)

        const [uploadUrl] = await storageFile.getSignedUrl({
            action: "write",
            version: "v4",
            expires: Date.now() + 10 * 60 * 1000, // 10 minutes
            contentType,
        })

        return NextResponse.json({
            success: true,
            uploadUrl,
            storagePath,
            contentType,
            expiresAt: Date.now() + 10 * 60 * 1000,
        })
    } catch (err) {
        console.error("Upload URL generation error:", err)
        return NextResponse.json(
            { success: false, error: err instanceof Error ? err.message : "Failed to create upload URL" },
            { status: 500 }
        )
    }
}
