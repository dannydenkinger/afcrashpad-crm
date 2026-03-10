#!/usr/bin/env npx tsx
/**
 * Migrate deal statuses: moves "Closed (Won)", "Closed (Lost)", and "Archive"
 * from pipeline stages to the new `status` field on opportunities.
 *
 * Usage:
 *   npx tsx scripts/migrate-deal-statuses.ts --dry-run
 *   npx tsx scripts/migrate-deal-statuses.ts
 */

import * as admin from "firebase-admin"
import { getFirestore } from "firebase-admin/firestore"
import * as dotenv from "dotenv"
import * as path from "path"

const DRY_RUN = process.argv.includes("--dry-run")
const DELETE_STAGES = process.argv.includes("--delete-stages")

dotenv.config({ path: path.resolve(__dirname, "../.env.local") })

if (admin.apps.length === 0) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        }),
    })
}

const db = getFirestore(admin.app(), process.env.FIREBASE_DATABASE_ID || "")

// Stage names that map to statuses
const TERMINAL_STAGE_MAP: Record<string, "closed_won" | "closed_lost" | "archive"> = {
    "Closed (Won)": "closed_won",
    "Closed Won": "closed_won",
    "Closed (Lost)": "closed_lost",
    "Closed Lost": "closed_lost",
    "Archive": "archive",
    "Archived": "archive",
}

async function migrate() {
    console.log(`\n${"=".repeat(60)}`)
    console.log(`  Deal Status Migration`)
    console.log(`  Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`)
    console.log(`${"=".repeat(60)}\n`)

    // 1. Find terminal stage IDs
    const pipelinesSnap = await db.collection("pipelines").get()
    const terminalStageIds: Record<string, "closed_won" | "closed_lost" | "archive"> = {}
    const terminalStageRefs: admin.firestore.DocumentReference[] = []

    for (const pDoc of pipelinesSnap.docs) {
        const stagesSnap = await pDoc.ref.collection("stages").get()
        for (const sDoc of stagesSnap.docs) {
            const name = sDoc.data().name
            if (TERMINAL_STAGE_MAP[name]) {
                terminalStageIds[sDoc.id] = TERMINAL_STAGE_MAP[name]
                terminalStageRefs.push(sDoc.ref)
                console.log(`  Found terminal stage: "${name}" (${sDoc.id}) → ${TERMINAL_STAGE_MAP[name]}`)
            }
        }
    }

    if (Object.keys(terminalStageIds).length === 0) {
        console.log("  No terminal stages found. All opportunities will default to 'open'.")
    }

    // 2. Migrate opportunities
    const oppsSnap = await db.collection("opportunities").get()
    console.log(`\n  Total opportunities: ${oppsSnap.size}`)

    let batch = db.batch()
    let batchCount = 0
    let openCount = 0, closedWonCount = 0, closedLostCount = 0, archiveCount = 0, skippedCount = 0

    for (const doc of oppsSnap.docs) {
        const data = doc.data()

        const stageId = data.pipelineStageId
        const terminalStatus = stageId ? terminalStageIds[stageId] : undefined

        // Skip deals NOT in terminal stages that already have a valid status
        if (!terminalStatus && data.status) {
            skippedCount++
            continue
        }
        // Skip deals in terminal stages that already have the correct status
        if (terminalStatus && data.status === terminalStatus) {
            skippedCount++
            continue
        }

        const update: Record<string, any> = {}

        if (terminalStatus) {
            update.status = terminalStatus

            // Find last non-terminal stage from history for reopening
            const history = Array.isArray(data.stageHistory) ? data.stageHistory : []
            for (let i = history.length - 1; i >= 0; i--) {
                const histStageId = history[i].stageId
                if (histStageId && !terminalStageIds[histStageId]) {
                    update.lastActiveStageId = histStageId
                    break
                }
            }

            if (terminalStatus === "closed_won") closedWonCount++
            else if (terminalStatus === "closed_lost") closedLostCount++
            else archiveCount++
        } else {
            update.status = "open"
            openCount++
        }

        if (!DRY_RUN) {
            batch.update(doc.ref, update)
            batchCount++
            if (batchCount >= 400) {
                await batch.commit()
                batch = db.batch()
                batchCount = 0
            }
        }
    }

    if (!DRY_RUN && batchCount > 0) {
        await batch.commit()
    }

    console.log(`\n  Migration results:`)
    console.log(`    Open:         ${openCount}`)
    console.log(`    Closed (Won): ${closedWonCount}`)
    console.log(`    Closed (Lost):${closedLostCount}`)
    console.log(`    Archived:     ${archiveCount}`)
    console.log(`    Skipped:      ${skippedCount} (already had status)`)

    // 3. Optionally delete terminal stages
    if (DELETE_STAGES && terminalStageRefs.length > 0) {
        console.log(`\n  Deleting ${terminalStageRefs.length} terminal stages...`)
        if (!DRY_RUN) {
            const deleteBatch = db.batch()
            for (const ref of terminalStageRefs) {
                deleteBatch.delete(ref)
            }
            await deleteBatch.commit()
            console.log("  Terminal stages deleted.")
        } else {
            console.log("  [DRY RUN] Would delete terminal stages")
        }
    } else if (terminalStageRefs.length > 0) {
        console.log(`\n  Note: ${terminalStageRefs.length} terminal stages were NOT deleted.`)
        console.log("  Run with --delete-stages to remove them from the pipeline.")
    }

    console.log(`\n${"=".repeat(60)}`)
    console.log(`  Done! ${DRY_RUN ? "(DRY RUN)" : ""}`)
    console.log(`${"=".repeat(60)}\n`)
}

migrate().catch(err => { console.error("\n[FATAL]", err); process.exit(1) })
