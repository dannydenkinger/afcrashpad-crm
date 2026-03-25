#!/usr/bin/env npx tsx
/**
 * Wipes all contacts (+ notes subcollections) and opportunities from Firestore.
 */
import * as admin from "firebase-admin"
import { getFirestore } from "firebase-admin/firestore"
import * as dotenv from "dotenv"
import * as path from "path"

dotenv.config({ path: path.resolve(__dirname, "../.env.local") })

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        }),
    })
}

const db = getFirestore(admin.app(), process.env.FIREBASE_DATABASE_ID!)

async function deleteCollection(collectionPath: string, subcollections?: string[]) {
    const snap = await db.collection(collectionPath).get()
    console.log(`  ${collectionPath}: ${snap.size} documents to delete`)

    let batch = db.batch()
    let count = 0

    for (const doc of snap.docs) {
        // Delete subcollections first
        if (subcollections) {
            for (const sub of subcollections) {
                const subSnap = await doc.ref.collection(sub).get()
                for (const subDoc of subSnap.docs) {
                    batch.delete(subDoc.ref)
                    count++
                    if (count >= 400) { await batch.commit(); batch = db.batch(); count = 0 }
                }
            }
        }
        batch.delete(doc.ref)
        count++
        if (count >= 400) { await batch.commit(); batch = db.batch(); count = 0 }
    }

    if (count > 0) await batch.commit()
    console.log(`  ✓ ${collectionPath} wiped`)
}

async function main() {
    console.log("\n=== Wiping contacts and opportunities ===\n")

    await deleteCollection("contacts", ["notes", "documents"])
    await deleteCollection("opportunities")

    // Also wipe auto-created tags from migration
    const tagsSnap = await db.collection("tags").get()
    if (tagsSnap.size > 0) {
        const batch = db.batch()
        for (const doc of tagsSnap.docs) batch.delete(doc.ref)
        await batch.commit()
        console.log(`  ✓ tags wiped (${tagsSnap.size})`)
    }

    console.log("\nDone. Ready for fresh import.\n")
}

main().catch(err => { console.error("Error:", err); process.exit(1) })
