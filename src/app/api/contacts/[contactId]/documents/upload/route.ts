import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth-guard";
import { getAdminStorageBucket } from "@/lib/firebase-admin";
import { tenantDb } from "@/lib/tenant-db";
import { revalidatePath } from "next/cache";
import { rateLimit } from "@/lib/rate-limit";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
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
];

function sanitizeFileName(name: string): string {
    return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ contactId: string }> }
) {
    try {
        const session = await getAuthSession();
        if (!session?.user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }
        const workspaceId = (session.user as any).workspaceId;
        if (!workspaceId) {
            return NextResponse.json({ success: false, error: "No workspace found" }, { status: 403 });
        }
        const db = tenantDb(workspaceId);

        // Rate limit: 20 uploads per minute per user
        const { allowed } = rateLimit(`upload:${session.user.id}`, 20);
        if (!allowed) {
            return NextResponse.json({ success: false, error: "Upload rate limit exceeded" }, { status: 429 });
        }

        const { contactId } = await params;
        if (!contactId) {
            return NextResponse.json({ success: false, error: "Missing contactId" }, { status: 400 });
        }

        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        const nameOverride = (formData.get("name") as string)?.trim();

        if (!file || !file.size) {
            return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
        }

        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json(
                { success: false, error: "File too large (max 25 MB)" },
                { status: 400 }
            );
        }

        const type = file.type || "application/octet-stream";
        if (!ALLOWED_TYPES.includes(type) && !type.startsWith("image/")) {
            return NextResponse.json(
                { success: false, error: "File type not allowed" },
                { status: 400 }
            );
        }

        const bucket = getAdminStorageBucket();
        const baseName = nameOverride || file.name || "document";
        const safeName = sanitizeFileName(baseName);
        const ext = safeName.includes(".") ? safeName.slice(safeName.lastIndexOf(".")) : "";
        const storagePath = `contacts/${contactId}/documents/${Date.now()}-${safeName}`;

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const storageFile = bucket.file(storagePath);
        await storageFile.save(buffer, {
            metadata: {
                contentType: type,
            },
        });

        const [signedUrl] = await storageFile.getSignedUrl({
            action: "read",
            expires: new Date("2030-01-01"),
        });

        const displayName = nameOverride || file.name || "Uploaded document";
        const folder = (formData.get("folder") as string)?.trim() || "General";

        await db.addToSubcollection("contacts", contactId, "documents", {
            name: displayName,
            url: signedUrl,
            status: "LINK",
            folder,
            createdAt: new Date(),
            updatedAt: new Date(),
            storagePath,
        });

        revalidatePath("/contacts");
        revalidatePath("/pipeline");

        return NextResponse.json({
            success: true,
            document: {
                name: displayName,
                url: signedUrl,
                status: "LINK",
            },
        });
    } catch (err) {
        console.error("Document upload error:", err);
        return NextResponse.json(
            { success: false, error: err instanceof Error ? err.message : "Upload failed" },
            { status: 500 }
        );
    }
}
