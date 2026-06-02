/**
 * Migration script: Convert single-tenant data to multi-tenant.
 *
 * This script:
 * 1. Creates a default workspace for existing data
 * 2. Creates workspace_member records for all existing users
 * 3. Adds workspaceId to all existing documents in all collections
 * 4. Re-keys settings documents with workspace prefix
 *
 * Run: npx tsx scripts/migrate-to-multi-tenant.ts [--dry-run]
 *
 * IMPORTANT: Run against a staging environment first!
 */

import { config } from "dotenv"
config({ path: ".env.local" })

import * as admin from "firebase-admin"

// ── Firebase Admin Init ──
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        }),
    })
}

const dbId = process.env.FIREBASE_DATABASE_ID
if (!dbId) throw new Error("FIREBASE_DATABASE_ID required")
const db = admin.firestore(admin.app())
// Use the named database
const adminDb = db

const DRY_RUN = process.argv.includes("--dry-run")
const BATCH_SIZE = 400 // Firestore limit is 500 per batch

// ── Collections to migrate ──
const TOP_LEVEL_COLLECTIONS = [
    "contacts",
    "opportunities",
    "pipelines",
    "tasks",
    "notifications",
    "tags",
    "contact_statuses",
    "lead_sources",
    "custom_fields",
    "assignment_rules",
    "saved_views",
    "email_sequences",
    "email_sequence_log",
    "email_tracking",
    "email_snippets",
    "email_templates",
    "workflows",
    "stage_automations",
    "audit_log",
    "api_keys",
    "calendar_integrations",
    "oauth_tokens",
    "documents",
    "document_templates",
    "document_folders",
    "document_signature_configs",
    "signature_requests",
    "referrals",
    "commissions",
    "expenses",
    "blog_articles",
    "blog_clusters",
    "seo_keywords",
    "seo_competitors",
    "seo_backlink_entries",
    "seo_snapshots",
    "haro_queries",
    "haro_batches",
    "haro_settings",
    "scheduled_reports",
    "cron_runs",
    "task_templates",
]

// Subcollections that need workspaceId (used in collectionGroup queries)
const SUBCOLLECTIONS_NEEDING_WORKSPACE_ID = [
    { parent: "contacts", sub: "documents" },
    { parent: "contacts", sub: "messages" },
    { parent: "pipelines", sub: "stages" },
]

// Settings docs to re-key
const SETTINGS_KEYS = [
    "branding",
    "integrations",
    "automations",
    "pipeline",
    "commission_rates",
    "follow_up_reminders",
    "referrals",
]

async function migrate() {
    console.log(`\n${DRY_RUN ? "🔍 DRY RUN" : "🚀 LIVE RUN"} — Multi-tenant migration\n`)

    // Step 1: Find or create default workspace
    let workspaceId: string
    const existingWs = await adminDb.collection("workspaces").limit(1).get()

    if (!existingWs.empty) {
        workspaceId = existingWs.docs[0].id
        console.log(`✓ Using existing workspace: ${workspaceId}`)
    } else {
        // Find the first user to be the owner
        const usersSnap = await adminDb.collection("users").limit(1).get()
        const ownerUser = usersSnap.empty ? null : usersSnap.docs[0]

        if (DRY_RUN) {
            workspaceId = "DRY_RUN_WORKSPACE_ID"
            console.log(`✓ Would create default workspace`)
        } else {
            const wsRef = await adminDb.collection("workspaces").add({
                name: "Default Workspace",
                slug: "default",
                ownerId: ownerUser?.id || "unknown",
                plan: "free",
                status: "active",
                memberCount: 0,
                contactCount: 0,
                createdAt: new Date(),
                updatedAt: new Date(),
            })
            workspaceId = wsRef.id
            console.log(`✓ Created default workspace: ${workspaceId}`)
        }
    }

    // Step 2: Create workspace_members for all existing users
    console.log("\n── Creating workspace members ──")
    const allUsers = await adminDb.collection("users").get()
    let memberCount = 0

    for (const userDoc of allUsers.docs) {
        // Check if membership already exists
        const existingMember = await adminDb.collection("workspace_members")
            .where("userId", "==", userDoc.id)
            .where("workspaceId", "==", workspaceId)
            .limit(1)
            .get()

        if (!existingMember.empty) {
            console.log(`  ⏭ Member already exists for user ${userDoc.data().email}`)
            continue
        }

        const userData = userDoc.data()
        if (DRY_RUN) {
            console.log(`  Would create member for ${userData.email} (${userData.role || "AGENT"})`)
        } else {
            await adminDb.collection("workspace_members").add({
                workspaceId,
                userId: userDoc.id,
                role: userData.role || "AGENT",
                status: "active",
                joinedAt: new Date(),
                invitedBy: null,
            })
            console.log(`  ✓ Created member for ${userData.email} (${userData.role || "AGENT"})`)
        }
        memberCount++
    }

    // Update workspace member count
    if (!DRY_RUN && memberCount > 0) {
        const existingWsDoc = await adminDb.collection("workspaces").doc(workspaceId).get()
        if (existingWsDoc.exists) {
            await existingWsDoc.ref.update({ memberCount: allUsers.size })
        }
    }
    console.log(`  Total: ${memberCount} members ${DRY_RUN ? "would be " : ""}created`)

    // Step 3: Add workspaceId to all documents in all collections
    console.log("\n── Adding workspaceId to collections ──")
    let totalDocs = 0

    for (const collectionName of TOP_LEVEL_COLLECTIONS) {
        const snap = await adminDb.collection(collectionName).get()
        if (snap.empty) {
            console.log(`  ⏭ ${collectionName}: empty`)
            continue
        }

        // Filter to docs that don't already have workspaceId
        const docsNeedingUpdate = snap.docs.filter(d => !d.data().workspaceId)

        if (docsNeedingUpdate.length === 0) {
            console.log(`  ⏭ ${collectionName}: all ${snap.size} docs already have workspaceId`)
            continue
        }

        if (DRY_RUN) {
            console.log(`  Would update ${docsNeedingUpdate.length}/${snap.size} docs in ${collectionName}`)
            totalDocs += docsNeedingUpdate.length
            continue
        }

        // Batch update
        for (let i = 0; i < docsNeedingUpdate.length; i += BATCH_SIZE) {
            const batch = adminDb.batch()
            const chunk = docsNeedingUpdate.slice(i, i + BATCH_SIZE)
            for (const doc of chunk) {
                batch.update(doc.ref, { workspaceId })
            }
            await batch.commit()
        }

        console.log(`  ✓ ${collectionName}: updated ${docsNeedingUpdate.length}/${snap.size} docs`)
        totalDocs += docsNeedingUpdate.length
    }
    console.log(`  Total: ${totalDocs} documents ${DRY_RUN ? "would be " : ""}updated`)

    // Step 4: Add workspaceId to subcollection documents (for collectionGroup queries)
    console.log("\n── Adding workspaceId to subcollections ──")
    let subDocs = 0

    for (const { parent, sub } of SUBCOLLECTIONS_NEEDING_WORKSPACE_ID) {
        const parentSnap = await adminDb.collection(parent).get()

        for (const parentDoc of parentSnap.docs) {
            const subSnap = await parentDoc.ref.collection(sub).get()
            const subDocsNeedingUpdate = subSnap.docs.filter(d => !d.data().workspaceId)

            if (subDocsNeedingUpdate.length === 0) continue

            if (DRY_RUN) {
                subDocs += subDocsNeedingUpdate.length
                continue
            }

            for (let i = 0; i < subDocsNeedingUpdate.length; i += BATCH_SIZE) {
                const batch = adminDb.batch()
                const chunk = subDocsNeedingUpdate.slice(i, i + BATCH_SIZE)
                for (const doc of chunk) {
                    batch.update(doc.ref, { workspaceId })
                }
                await batch.commit()
            }
            subDocs += subDocsNeedingUpdate.length
        }

        console.log(`  ✓ ${parent}/{id}/${sub}: ${subDocs} docs ${DRY_RUN ? "would be " : ""}updated`)
    }

    // Step 5: Re-key settings documents
    console.log("\n── Re-keying settings documents ──")

    for (const key of SETTINGS_KEYS) {
        const oldDoc = await adminDb.collection("settings").doc(key).get()
        const newDocId = `${workspaceId}_${key}`
        const newDocRef = adminDb.collection("settings").doc(newDocId)
        const newDocSnap = await newDocRef.get()

        if (!oldDoc.exists) {
            console.log(`  ⏭ settings/${key}: doesn't exist`)
            continue
        }

        if (newDocSnap.exists) {
            console.log(`  ⏭ settings/${newDocId}: already exists`)
            continue
        }

        if (DRY_RUN) {
            console.log(`  Would copy settings/${key} → settings/${newDocId}`)
            continue
        }

        // Copy data to new doc with workspaceId
        await newDocRef.set({
            ...oldDoc.data(),
            workspaceId,
        })
        console.log(`  ✓ Copied settings/${key} → settings/${newDocId}`)
        // Don't delete old doc yet — leave it for rollback safety
    }

    console.log(`\n${DRY_RUN ? "🔍 DRY RUN complete" : "✅ Migration complete"}`)
    console.log(`Workspace ID: ${workspaceId}`)
    console.log(`\nNext steps:`)
    console.log(`  1. Deploy the updated code`)
    console.log(`  2. Verify everything works`)
    console.log(`  3. Delete old settings docs (settings/branding, settings/integrations, etc.)`)
}

migrate().catch(console.error)
