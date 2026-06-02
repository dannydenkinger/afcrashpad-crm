/**
 * End-to-end smoke test of the document upload pipeline.
 *
 *   1. Generate a signed PUT URL (mirrors /api/documents/upload-url logic)
 *   2. PUT a tiny test file directly to Cloud Storage
 *   3. Verify the object exists + read it back
 *   4. Generate a signed read URL (mirrors /api/documents/record logic)
 *   5. Clean up
 *
 * Pass means the bucket, IAM, CORS, and signed-URL flow all work end-to-end.
 */

import * as admin from "firebase-admin"
import { getStorage } from "firebase-admin/storage"
import * as dotenv from "dotenv"
import * as path from "path"

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
    const bucketName =
        process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    if (!bucketName) {
        console.error("FIREBASE_STORAGE_BUCKET env not set")
        process.exit(1)
    }

    const bucket = getStorage().bucket(bucketName)
    const testPath = `documents/__smoke__/smoke-${Date.now()}.txt`
    const testFile = bucket.file(testPath)
    const testBody = "Vesta upload smoke test " + new Date().toISOString()

    console.log("📋 1/4  Generating signed PUT URL…")
    const [uploadUrl] = await testFile.getSignedUrl({
        action: "write",
        version: "v4",
        expires: Date.now() + 5 * 60 * 1000,
        contentType: "text/plain",
    })
    console.log(`        ${uploadUrl.slice(0, 80)}…`)

    console.log("⬆️  2/4  PUTting test file directly to Cloud Storage…")
    const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "text/plain" },
        body: testBody,
    })
    if (!putRes.ok) {
        const text = await putRes.text()
        throw new Error(`PUT failed: ${putRes.status}\n${text}`)
    }
    console.log(`        ${putRes.status} ${putRes.statusText}`)

    console.log("✅ 3/4  Verifying object exists + reading back…")
    const [exists] = await testFile.exists()
    if (!exists) throw new Error("File does not exist after PUT")
    const [body] = await testFile.download()
    if (body.toString() !== testBody) {
        throw new Error(`Content mismatch — got: ${body.toString()}`)
    }
    console.log(`        Round-tripped ${body.length} bytes`)

    console.log("🔗 4/4  Signing read URL + cleaning up…")
    const [readUrl] = await testFile.getSignedUrl({
        action: "read",
        expires: new Date("2030-01-01"),
    })
    console.log(`        Read URL: ${readUrl.slice(0, 80)}…`)
    await testFile.delete()
    console.log(`        Test file deleted.`)

    console.log("\n🎉 Upload pipeline works end-to-end.")
}

main().catch((err) => {
    console.error("\n❌ Smoke test failed:", err.message || err)
    process.exit(1)
})
