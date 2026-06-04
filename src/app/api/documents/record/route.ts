import { NextRequest, NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth-guard"
import { getAdminStorageBucket } from "@/lib/firebase-admin"
import { tenantDb } from "@/lib/tenant-db"
import { revalidatePath } from "next/cache"

/**
 * Final step of the signed-URL upload flow. Called by the client AFTER it has
 * PUT the file to the signed URL returned by /api/documents/upload-url.
 *
 * Verifies the object exists in storage (so a malicious client can't fabricate
 * fake docs), generates a long-lived read URL, and writes the Firestore record.
 */

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

        const body = (await req.json().catch(() => ({}))) as {
            storagePath?: string
            filename?: string
            displayName?: string
            contactId?: string
            folder?: string
            folderPath?: string
        }

        const storagePath = (body.storagePath || "").trim()
        const filename = (body.filename || "").trim()
        const contactId = (body.contactId || "").trim() || undefined

        if (!storagePath) {
            return NextResponse.json({ success: false, error: "storagePath required" }, { status: 400 })
        }

        // Defense-in-depth: ensure the path is one we'd have generated. Stops
        // a forged record from referencing arbitrary objects in the bucket.
        const expectedPrefix = contactId
            ? `contacts/${contactId}/documents/`
            : `documents/${workspaceId}/`
        if (!storagePath.startsWith(expectedPrefix)) {
            return NextResponse.json(
                { success: false, error: "storagePath does not match the expected prefix for this workspace/contact" },
                { status: 400 }
            )
        }

        const bucket = getAdminStorageBucket()
        const storageFile = bucket.file(storagePath)
        const [exists] = await storageFile.exists()
        if (!exists) {
            return NextResponse.json(
                { success: false, error: "File not found in storage — did the upload finish?" },
                { status: 404 }
            )
        }

        // Signed read URL valid through 2030. Storage rules already gate access by ACL.
        const [signedUrl] = await storageFile.getSignedUrl({
            action: "read",
            expires: new Date("2030-01-01"),
        })

        const displayName = body.displayName?.trim() || filename || "Uploaded document"
        const folderPathRaw = (body.folderPath || "").trim()
        const folder = folderPathRaw
            ? folderPathRaw.split("/").pop() || "General"
            : (body.folder || "General").trim() || "General"
        const folderPath = folderPathRaw || `/${folder}`

        if (contactId) {
            await db.addToSubcollection("contacts", contactId, "documents", {
                name: displayName,
                url: signedUrl,
                status: "LINK",
                folder,
                // Persist the full hierarchical path (when provided) so these
                // contact-attached docs surface at their nested location in the
                // workspace /documents page — not just the flat `folder` leaf.
                ...(folderPathRaw ? { folderPath } : {}),
                createdAt: new Date(),
                updatedAt: new Date(),
                storagePath,
            })
            revalidatePath("/contacts")
            revalidatePath("/pipeline")
        } else {
            await db.add("documents", {
                name: displayName,
                url: signedUrl,
                status: "LINK",
                folder,
                folderPath,
                storagePath,
                createdBy: session.user.email || "",
                createdAt: new Date(),
                updatedAt: new Date(),
            })
            revalidatePath("/documents")
        }

        return NextResponse.json({
            success: true,
            document: { name: displayName, url: signedUrl, status: "LINK", storagePath },
        })
    } catch (err) {
        console.error("Document record error:", err)
        return NextResponse.json(
            { success: false, error: err instanceof Error ? err.message : "Record failed" },
            { status: 500 }
        )
    }
}
