import { NextRequest, NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth-guard"
import { getAdminStorageBucket } from "@/lib/firebase-admin"
import { rateLimit } from "@/lib/rate-limit"

/**
 * Upload an image (logo / header / background) for a lead form.
 *
 * Returns a long-lived signed URL that the form can render. Files live
 * under `lead-forms/<workspaceId>/...` so the workspace can find them
 * later if needed. We don't write a record to Firestore — the URL is
 * stored directly on the form's style object.
 */

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB — form images don't need to be huge
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"]

function sanitizeFileName(name: string): string {
    return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80)
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

        const { allowed } = rateLimit(`form-image-upload:${session.user.id}`, 30)
        if (!allowed) {
            return NextResponse.json({ success: false, error: "Upload rate limit exceeded" }, { status: 429 })
        }

        const formData = await req.formData()
        const file = formData.get("file") as File | null

        if (!file || !file.size) {
            return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 })
        }
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json({ success: false, error: "Image too large (max 5 MB)" }, { status: 400 })
        }
        const type = file.type || "application/octet-stream"
        if (!ALLOWED_TYPES.includes(type)) {
            return NextResponse.json(
                { success: false, error: "Use JPG, PNG, GIF, or WebP" },
                { status: 400 },
            )
        }

        const bucket = getAdminStorageBucket()
        const safeName = sanitizeFileName(file.name || "image")
        const storagePath = `lead-forms/${workspaceId}/${Date.now()}-${safeName}`
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const storageFile = bucket.file(storagePath)
        await storageFile.save(buffer, { metadata: { contentType: type } })
        const [signedUrl] = await storageFile.getSignedUrl({
            action: "read",
            expires: new Date("2030-01-01"),
        })

        return NextResponse.json({ success: true, url: signedUrl })
    } catch (err) {
        console.error("Lead-form image upload error:", err)
        return NextResponse.json(
            { success: false, error: err instanceof Error ? err.message : "Upload failed" },
            { status: 500 },
        )
    }
}
