import crypto from "crypto"
import path from "path"
import { getAdminStorageBucket } from "@/lib/firebase-admin"

const DEFAULT_MAX_BYTES = 15 * 1024 * 1024 // 15 MB
const DEFAULT_ALLOWED_PREFIXES = ["image/", "video/"]

export interface UploadedMedia {
    url: string
    gsPath: string
    contentType: string
    sizeBytes: number
    originalName: string
}

export interface UploadOptions {
    workspaceId: string
    scope: string // e.g. "social", "campaigns"
    maxBytes?: number
    allowedPrefixes?: string[]
}

export async function uploadMedia(
    file: File,
    opts: UploadOptions,
): Promise<UploadedMedia> {
    const { workspaceId, scope } = opts
    if (!workspaceId) throw new Error("workspaceId required")
    if (!file) throw new Error("file required")

    const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES
    const allowedPrefixes = opts.allowedPrefixes ?? DEFAULT_ALLOWED_PREFIXES

    const contentType = file.type || "application/octet-stream"
    if (!allowedPrefixes.some((p) => contentType.startsWith(p))) {
        throw new Error(`Unsupported file type: ${contentType}`)
    }
    if (file.size > maxBytes) {
        throw new Error(`File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB)`)
    }

    const ext = safeExtension(file.name || "", contentType)
    const id = crypto.randomBytes(12).toString("hex")
    const objectPath = `workspaces/${workspaceId}/${scope}/${id}${ext}`

    const bucket = getAdminStorageBucket()
    const blob = bucket.file(objectPath)

    const buffer = Buffer.from(await file.arrayBuffer())
    await blob.save(buffer, {
        contentType,
        resumable: false,
        metadata: {
            metadata: {
                workspaceId,
                originalName: file.name || "",
            },
        },
    })

    // Make public so Zernio / SES can fetch without auth.
    // If you need private media, swap this for a signed URL.
    await blob.makePublic()
    const url = `https://storage.googleapis.com/${bucket.name}/${encodeURI(objectPath)}`

    return {
        url,
        gsPath: `gs://${bucket.name}/${objectPath}`,
        contentType,
        sizeBytes: file.size,
        originalName: file.name || id,
    }
}

function safeExtension(originalName: string, contentType: string): string {
    const fromName = path.extname(originalName).toLowerCase().slice(0, 10)
    if (fromName && /^\.[a-z0-9]+$/.test(fromName)) return fromName
    const byMime: Record<string, string> = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/gif": ".gif",
        "image/webp": ".webp",
        "image/svg+xml": ".svg",
        "video/mp4": ".mp4",
        "video/quicktime": ".mov",
        "video/webm": ".webm",
    }
    return byMime[contentType] || ""
}
