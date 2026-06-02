/**
 * One-time setup: apply CORS rules to the Firebase Storage bucket so the
 * browser can PUT files directly to signed upload URLs. Run this once after
 * adding signed-URL document uploads, or whenever the bucket changes.
 *
 *   npx tsx scripts/setup-storage-cors.ts
 *
 * Reads cors config from ../storage-cors.json. Bucket name from
 * FIREBASE_STORAGE_BUCKET env (or NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET).
 */

import * as admin from "firebase-admin"
import { getStorage } from "firebase-admin/storage"
import * as dotenv from "dotenv"
import * as path from "path"
import * as fs from "fs"

dotenv.config({ path: path.resolve(__dirname, "../.env.local") })

if (admin.apps.length === 0) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        }),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    })
}

async function main() {
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    if (!bucketName) {
        console.error("FIREBASE_STORAGE_BUCKET env not set")
        process.exit(1)
    }

    const corsPath = path.resolve(__dirname, "../storage-cors.json")
    const corsRaw = fs.readFileSync(corsPath, "utf8")
    const corsConfig = JSON.parse(corsRaw)

    const bucket = getStorage().bucket(bucketName)
    console.log(`Applying CORS to ${bucketName}…`)
    await bucket.setCorsConfiguration(corsConfig)

    const [metadata] = await bucket.getMetadata()
    console.log("Done. Current CORS:")
    console.log(JSON.stringify(metadata.cors, null, 2))
}

main().catch((err) => {
    console.error(err)
    process.exit(1)
})
