import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAdminStorageBucket } from "@/lib/firebase-admin";
import { adminDb } from "@/lib/firebase-admin";
import { revalidatePath } from "next/cache";
import { rateLimit } from "@/lib/rate-limit";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
const BLOCKED_TYPES = [
    "application/x-msdownload",  // .exe
    "application/x-msdos-program",
    "application/x-sh",
    "application/x-bat",
];

function sanitizeFileName(name: string): string {
    return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ contactId: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

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
        const fileExt = (file.name || "").split(".").pop()?.toLowerCase() || "";
        if (BLOCKED_TYPES.includes(type) || ["exe", "bat", "cmd", "sh", "msi"].includes(fileExt)) {
            return NextResponse.json(
                { success: false, error: "Executable files are not allowed" },
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

        await adminDb
            .collection("contacts")
            .doc(contactId)
            .collection("documents")
            .add({
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
