import crypto from "crypto"
import { adminDb } from "@/lib/firebase-admin"

/**
 * Validate an API key from request headers.
 * Checks the `x-api-key` or `Authorization: Bearer <key>` header.
 * Updates the `lastUsedAt` timestamp on successful validation.
 *
 * Returns the API key document data if valid, null otherwise.
 */
export async function validateApiKey(
    request: Request
): Promise<{ id: string; name: string; userId: string } | null> {
    // Extract key from headers
    let apiKey = request.headers.get("x-api-key")

    if (!apiKey) {
        const authHeader = request.headers.get("authorization")
        if (authHeader?.startsWith("Bearer ")) {
            apiKey = authHeader.slice(7)
        }
    }

    if (!apiKey) return null

    // Hash the provided key
    const keyHash = crypto.createHash("sha256").update(apiKey).digest("hex")

    // Look up the key in Firestore
    const snapshot = await adminDb
        .collection("api_keys")
        .where("keyHash", "==", keyHash)
        .where("active", "==", true)
        .limit(1)
        .get()

    if (snapshot.empty) return null

    const doc = snapshot.docs[0]
    const data = doc.data()

    // Update lastUsedAt (fire-and-forget)
    adminDb
        .collection("api_keys")
        .doc(doc.id)
        .update({ lastUsedAt: new Date() })
        .catch(() => {})

    return {
        id: doc.id,
        name: data.name,
        userId: data.userId,
    }
}
