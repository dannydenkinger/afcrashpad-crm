import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth-guard";
import { getAdminStorageBucket } from "@/lib/firebase-admin";
import { tenantDb } from "@/lib/tenant-db";
import { revalidatePath } from "next/cache";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(req: NextRequest) {
    try {
        const session = await getAuthSession();
        if (!session?.user?.email) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }
        const workspaceId = (session.user as any).workspaceId;
        if (!workspaceId) {
            return NextResponse.json({ success: false, error: "No workspace found" }, { status: 403 });
        }
        const db = tenantDb(workspaceId);

        const formData = await req.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
        }

        if (!ALLOWED_TYPES.includes(file.type)) {
            return NextResponse.json({ success: false, error: "Only JPEG, PNG, WebP, and GIF images are allowed" }, { status: 400 });
        }

        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json({ success: false, error: "File must be under 5MB" }, { status: 400 });
        }

        // Find user doc
        const usersSnap = await db.collection('users').where('email', '==', session.user.email).limit(1).get();
        if (usersSnap.empty) {
            return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
        }
        const userDocId = usersSnap.docs[0].id;

        // Upload to Firebase Storage
        const bucket = getAdminStorageBucket();
        const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
        const storagePath = `users/${userDocId}/avatar.${ext}`;
        const fileRef = bucket.file(storagePath);

        const buffer = Buffer.from(await file.arrayBuffer());
        await fileRef.save(buffer, {
            metadata: { contentType: file.type },
        });

        // Generate signed URL (long-lived)
        const [signedUrl] = await fileRef.getSignedUrl({
            action: 'read',
            expires: '2030-01-01',
        });

        // Update user doc with avatar URL
        await db.doc('users', userDocId).update({
            profileImageUrl: signedUrl,
            updatedAt: new Date(),
        });

        revalidatePath("/settings");
        return NextResponse.json({ success: true, url: signedUrl });
    } catch (error: any) {
        console.error("Avatar upload failed:", error);
        return NextResponse.json({ success: false, error: "Upload failed" }, { status: 500 });
    }
}
