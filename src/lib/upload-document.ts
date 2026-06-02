"use client"

/**
 * Client-side helper that uploads a document through the signed-URL flow.
 *
 *   1. POST /api/documents/upload-url to get a signed PUT URL
 *   2. PUT the file directly to Cloud Storage
 *   3. POST /api/documents/record to finalize and write the Firestore doc
 *
 * Bypasses the Vercel serverless function 4.5 MB body limit because file
 * bytes never traverse our API routes.
 */

export interface UploadDocumentOptions {
    /** If provided, doc is recorded as a contact-scoped attachment. */
    contactId?: string
    /** Display name (falls back to file.name). */
    displayName?: string
    /** Folder name for the documents page (ignored for contact-scoped). */
    folder?: string
    /** Folder path for nested folders, e.g. "/Contracts/2026". */
    folderPath?: string
    /** Optional progress callback for the PUT step (0..1). */
    onProgress?: (progress: number) => void
}

export interface UploadDocumentResult {
    success: true
    document: { name: string; url: string; status: string; storagePath: string }
}

export interface UploadDocumentError {
    success: false
    error: string
    /** Which phase failed — useful for retry UI. */
    phase: "sign" | "put" | "record"
}

export async function uploadDocument(
    file: File,
    options: UploadDocumentOptions = {},
): Promise<UploadDocumentResult | UploadDocumentError> {
    // Step 1 — get signed PUT URL
    let uploadUrl: string
    let storagePath: string
    let contentType: string
    try {
        const signRes = await fetch("/api/documents/upload-url", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                filename: file.name,
                contentType: file.type || "application/octet-stream",
                contactId: options.contactId,
                sizeBytes: file.size,
            }),
        })
        const signJson = await signRes.json().catch(() => ({}))
        if (!signRes.ok || !signJson.uploadUrl) {
            return {
                success: false,
                phase: "sign",
                error: signJson.error || `Couldn't create upload URL (${signRes.status})`,
            }
        }
        uploadUrl = signJson.uploadUrl
        storagePath = signJson.storagePath
        contentType = signJson.contentType
    } catch (err) {
        return {
            success: false,
            phase: "sign",
            error: err instanceof Error ? err.message : "Network error creating upload URL",
        }
    }

    // Step 2 — PUT the file directly to Cloud Storage. Use XMLHttpRequest
    // when a progress callback is provided so we can report bytes uploaded;
    // otherwise fetch is simpler.
    if (options.onProgress) {
        const putErr = await new Promise<string | null>((resolve) => {
            const xhr = new XMLHttpRequest()
            xhr.open("PUT", uploadUrl, true)
            xhr.setRequestHeader("Content-Type", contentType)
            xhr.upload.onprogress = (ev) => {
                if (ev.lengthComputable && options.onProgress) {
                    options.onProgress(ev.loaded / ev.total)
                }
            }
            xhr.onload = () =>
                resolve(xhr.status >= 200 && xhr.status < 300 ? null : `Upload failed (${xhr.status})`)
            xhr.onerror = () => resolve("Network error during upload")
            xhr.send(file)
        })
        if (putErr) return { success: false, phase: "put", error: putErr }
    } else {
        try {
            const putRes = await fetch(uploadUrl, {
                method: "PUT",
                headers: { "Content-Type": contentType },
                body: file,
            })
            if (!putRes.ok) {
                return { success: false, phase: "put", error: `Upload failed (${putRes.status})` }
            }
        } catch (err) {
            return {
                success: false,
                phase: "put",
                error: err instanceof Error ? err.message : "Network error during upload",
            }
        }
    }

    // Step 3 — record the document in Firestore
    try {
        const recordRes = await fetch("/api/documents/record", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                storagePath,
                filename: file.name,
                displayName: options.displayName,
                contactId: options.contactId,
                folder: options.folder,
                folderPath: options.folderPath,
            }),
        })
        const recordJson = await recordRes.json().catch(() => ({}))
        if (!recordRes.ok || !recordJson.success) {
            return {
                success: false,
                phase: "record",
                error: recordJson.error || `Couldn't record upload (${recordRes.status})`,
            }
        }
        return { success: true, document: recordJson.document }
    } catch (err) {
        return {
            success: false,
            phase: "record",
            error: err instanceof Error ? err.message : "Network error recording upload",
        }
    }
}
