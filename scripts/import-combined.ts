#!/usr/bin/env npx tsx
/**
 * Fresh import from Combined_Contacts_All.csv
 *
 * Each row = 1 contact + optionally 1 opportunity (if Pipeline Stage present)
 * Notes field may contain actual notes, tags, or both separated by " | "
 *
 * Usage:
 *   npx tsx scripts/import-combined.ts --dry-run
 *   npx tsx scripts/import-combined.ts
 */

import * as admin from "firebase-admin"
import { getFirestore, WriteBatch } from "firebase-admin/firestore"
import * as dotenv from "dotenv"
import * as path from "path"
import * as fs from "fs"
import Papa from "papaparse"

const DRY_RUN = process.argv.includes("--dry-run")
const BATCH_SIZE = 400
const CSV_PATH = path.resolve("/Users/dannydenkinger/Downloads/Combined_Contacts_All.csv")

// ── Firebase Init ─────────────────────────────────────────────────────────────

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

// ── Known Tags ────────────────────────────────────────────────────────────────

const KNOWN_TAGS = new Set([
    "direct lead", "new-21 may", "danny", "dakota", "berry",
    "paired with connor brooks", "follow-up", "high priority", "warm lead",
])

// ── Base Aliases ──────────────────────────────────────────────────────────────

const BASE_ALIASES: Record<string, string> = {
    "eglin afb": "Eglin AFB, FL",
    "keesler afb": "Keesler AFB, MS",
    "keelser afb": "Keesler AFB, MS",
    "luke afb": "Luke AFB, AZ",
    "march afb": "March ARB, CA",
    "march arb": "March ARB, CA",
    "kirtland afb": "Kirtland AFB, NM",
    "nellis afb": "Nellis AFB, NV",
    "peterson afb": "Peterson AFB, CO",
    "davis monthan afb": "Davis-Monthan AFB, AZ",
    "davis monthan ang": "Davis-Monthan AFB, AZ",
    "pensacola nas": "Pensacola NAS, FL",
    "hurlburt afb": "Hurlburt Field, FL",
    "hurlburt field": "Hurlburt Field, FL",
    "little rock afb": "Little Rock AFB, AR",
    "barksdale afb": "Barksdale AFB, LA",
    "langley afb": "JB Langley-Eustis, VA",
    "randolph afb": "JB San Antonio (Randolph), TX",
    "elmendorf afb": "JB Elmendorf-Richardson, AK",
    "goodfellow afb": "Goodfellow AFB, TX",
    "duke afb": "Duke Field, FL",
    "duke field": "Duke Field, FL",
    "creech afb": "Creech AFB",
    "morris ang": "Morris ANG",
    "nas corpus cristi": "NAS Corpus Christi",
    "pentagon": "Pentagon",
}

// ── Stage Aliases ─────────────────────────────────────────────────────────────

const STAGE_ALIASES: Record<string, string[]> = {
    "new lead": ["new lead"],
    "contacted": ["contacted"],
    "selecting property": ["selecting property"],
    "finding properties": ["finding properties"],
    "move-in scheduled": ["move-in scheduled", "move in scheduled"],
    "current tenant": ["current tenant"],
    "review/referral": ["review/referral", "review & referral"],
    "on hold": ["on hold"],
    "archive": ["archive", "archived"],
    "closed (won)": ["closed won", "closed (won)"],
    "closed (lost)": ["closed lost", "closed (lost)"],
    "travel started (unaccommodated)": ["travel started (unaccommodated)", "travel started"],
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeBase(raw: string, canonicalMap: Record<string, string>): string | null {
    if (!raw || !raw.trim()) return null
    const key = raw.toLowerCase().trim()
    if (BASE_ALIASES[key]) return BASE_ALIASES[key]
    if (canonicalMap[key]) return canonicalMap[key]
    // Fuzzy match
    for (const [canonical, name] of Object.entries(canonicalMap)) {
        if (canonical.includes(key) || key.includes(canonical.split(",")[0].toLowerCase())) {
            return name
        }
    }
    return raw.trim() // Store as-is if no match
}

function resolveStage(raw: string, stageNameToId: Record<string, string>): string | null {
    if (!raw || !raw.trim()) return null
    const key = raw.toLowerCase().trim()
    // Direct match
    if (stageNameToId[key]) return stageNameToId[key]
    // Alias match
    for (const [, aliases] of Object.entries(STAGE_ALIASES)) {
        if (aliases.includes(key)) {
            for (const alias of aliases) {
                if (stageNameToId[alias]) return stageNameToId[alias]
            }
        }
    }
    return null
}

function parsePhone(raw: string | undefined): string | null {
    if (!raw || !raw.trim()) return null
    let phone = raw.trim().replace(/\.0$/, "") // Strip ".0" from spreadsheet float
    if (/^\d{10,}$/.test(phone)) phone = "+" + phone
    return phone || null
}

function safeISO(val: string | undefined): string | null {
    if (!val || !val.trim()) return null
    const d = new Date(val.trim())
    return isNaN(d.getTime()) ? null : d.toISOString()
}

/**
 * Parse the Notes field into { notes: string | null, tagNames: string[] }
 *
 * Rules:
 * - Split by " | " separator
 * - Check each segment: if ALL comma-separated items are known tags → tags
 * - Otherwise → notes content
 * - Deduplicate notes (sometimes duplicated after " | ")
 */
function parseNotesAndTags(raw: string): { notes: string | null; tagNames: string[] } {
    if (!raw || !raw.trim()) return { notes: null, tagNames: [] }

    const segments = raw.split(" | ")
    const tagNames: string[] = []
    const notesParts: string[] = []

    for (const seg of segments) {
        const trimmed = seg.trim()
        if (!trimmed) continue

        // Check if this segment is entirely comma-separated known tags
        const candidates = trimmed.split(",").map(s => s.trim().toLowerCase()).filter(Boolean)
        const allTags = candidates.length > 0 && candidates.every(c => KNOWN_TAGS.has(c))

        if (allTags) {
            for (const c of candidates) tagNames.push(c)
        } else {
            // Check if it's a duplicate of an existing notes part (truncated)
            const isDuplicate = notesParts.some(existing =>
                existing.startsWith(trimmed) || trimmed.startsWith(existing.substring(0, 50))
            )
            if (!isDuplicate) {
                notesParts.push(trimmed)
            }
        }
    }

    // Deduplicate tag names
    const uniqueTags = [...new Set(tagNames)]

    return {
        notes: notesParts.length > 0 ? notesParts.join("\n\n") : null,
        tagNames: uniqueTags,
    }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
    console.log(`\n${"=".repeat(60)}`)
    console.log(`  Fresh Import: Combined_Contacts_All.csv`)
    console.log(`  Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`)
    console.log(`${"=".repeat(60)}\n`)

    // Parse CSV
    const csvData = fs.readFileSync(CSV_PATH, "utf-8")
    const rows = Papa.parse(csvData, { header: true, skipEmptyLines: true }).data as any[]
    console.log(`CSV rows: ${rows.length}`)

    // Fetch Firestore data
    console.log("\n--- Fetching Firestore data ---")

    // Pipeline stages
    const pipelinesSnap = await db.collection("pipelines").get()
    const stageNameToId: Record<string, string> = {}
    let pipelineId: string | null = null

    for (const pDoc of pipelinesSnap.docs) {
        const stagesSnap = await pDoc.ref.collection("stages").get()
        for (const sDoc of stagesSnap.docs) {
            stageNameToId[sDoc.data().name.toLowerCase().trim()] = sDoc.id
        }
        if (!pipelineId) pipelineId = pDoc.id
    }
    console.log(`  Stages: ${Object.keys(stageNameToId).length} (pipeline: ${pipelineId})`)

    // Create missing stages
    const requiredStages = [
        "New Lead", "Contacted", "Selecting Property", "Finding Properties",
        "Move-In Scheduled", "Current Tenant", "Review/Referral", "On Hold",
        "Travel Started (Unaccommodated)", "Archive", "Closed (Won)", "Closed (Lost)",
    ]
    if (pipelineId) {
        let order = Object.keys(stageNameToId).length
        for (const sName of requiredStages) {
            if (!stageNameToId[sName.toLowerCase()]) {
                const ref = db.collection("pipelines").doc(pipelineId).collection("stages").doc()
                if (!DRY_RUN) await ref.set({ name: sName, order: order++ })
                stageNameToId[sName.toLowerCase()] = ref.id
                console.log(`  [STAGE] Created: "${sName}"`)
            }
        }
    }

    const defaultStageId = stageNameToId["new lead"] || Object.values(stageNameToId)[0] || ""

    // Bases
    const basesSnap = await db.collection("military_bases").get()
    const baseCanonical: Record<string, string> = {}
    for (const doc of basesSnap.docs) {
        const name = doc.data().name
        baseCanonical[name.toLowerCase().trim()] = name
    }

    // Users
    const usersSnap = await db.collection("users").get()
    const userNameToId: Record<string, string> = {}
    for (const doc of usersSnap.docs) {
        const data = doc.data()
        if (data.name) userNameToId[data.name.toLowerCase().trim()] = doc.id
    }

    // Tags (pre-create all known ones)
    const TAG_COLORS = ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"]
    const tagNameToObj: Record<string, { tagId: string; name: string; color: string }> = {}
    let tagColorIdx = 0

    // Check existing tags
    const tagsSnap = await db.collection("tags").get()
    for (const doc of tagsSnap.docs) {
        const d = doc.data()
        tagNameToObj[d.name.toLowerCase().trim()] = { tagId: doc.id, name: d.name, color: d.color }
        tagColorIdx++
    }

    async function getOrCreateTag(name: string): Promise<{ tagId: string; name: string; color: string }> {
        const key = name.toLowerCase().trim()
        if (tagNameToObj[key]) return tagNameToObj[key]
        const color = TAG_COLORS[tagColorIdx % TAG_COLORS.length]
        tagColorIdx++
        const ref = db.collection("tags").doc()
        if (!DRY_RUN) await ref.set({ name: name.trim(), color, createdAt: new Date(), updatedAt: new Date() })
        const obj = { tagId: ref.id, name: name.trim(), color }
        tagNameToObj[key] = obj
        console.log(`  [TAG] Created: "${name.trim()}" (${color})`)
        return obj
    }

    // ── Process rows ──────────────────────────────────────────────────────────

    console.log("\n--- Processing rows ---")
    let batch: WriteBatch = db.batch()
    let batchCount = 0
    let contactsCreated = 0, oppsCreated = 0, notesCreated = 0, skipped = 0

    const emailToContactId: Record<string, string> = {}

    async function commitBatch() {
        if (batchCount > 0) {
            if (!DRY_RUN) await batch.commit()
            else console.log(`  [DRY RUN] Would commit ${batchCount} ops`)
            batch = db.batch()
            batchCount = 0
        }
    }

    for (const row of rows) {
        const fullName = (row["Full Name"] || "").trim()

        // Skip examples and empty rows
        if (!fullName || fullName.toLowerCase().startsWith("(example)")) { skipped++; continue }
        // Skip spam
        if (fullName.toLowerCase().includes("promotion company") || fullName === "M S raza" ||
            fullName === "Ak Photography ð¥°ð¼") { skipped++; continue }

        const email = (row["Email"] || "").trim().toLowerCase() || null
        const phone = parsePhone(row["Phone Number"])
        const rawBase = (row["Base"] || "").trim()
        const rawStage = (row["Pipeline Stage"] || "").trim()
        const startDate = safeISO(row["Start Date"])
        const endDate = safeISO(row["End Date"])

        // Parse notes and tags
        const { notes, tagNames } = parseNotesAndTags(row["Notes"] || "")
        const tagObjects = []
        for (const tn of tagNames) {
            tagObjects.push(await getOrCreateTag(tn))
        }

        // Normalize base
        const militaryBase = normalizeBase(rawBase, baseCanonical)

        // Dedup by email
        let contactId: string
        if (email && emailToContactId[email]) {
            contactId = emailToContactId[email]
            // Still update the contact with any new data
            const update: Record<string, any> = { updatedAt: new Date() }
            if (militaryBase) update.militaryBase = militaryBase
            if (startDate) update.stayStartDate = startDate
            if (endDate) update.stayEndDate = endDate
            if (tagObjects.length > 0) update.tags = tagObjects
            batch.update(db.collection("contacts").doc(contactId), update)
            batchCount++
        } else {
            contactId = db.collection("contacts").doc().id
            const contactDoc: Record<string, any> = {
                name: fullName,
                email,
                phone,
                businessName: null,
                militaryBase,
                status: "Lead",
                tags: tagObjects,
                stayStartDate: startDate,
                stayEndDate: endDate,
                createdAt: new Date(),
                updatedAt: new Date(),
            }
            batch.set(db.collection("contacts").doc(contactId), contactDoc)
            batchCount++
            contactsCreated++
            if (email) emailToContactId[email] = contactId
        }

        // Create opportunity if there's a pipeline stage
        if (rawStage && rawStage !== "open Marketing Pipeline New Lead") {
            const stageId = resolveStage(rawStage, stageNameToId) || defaultStageId
            const oppDoc: Record<string, any> = {
                contactId,
                pipelineStageId: stageId,
                name: fullName,
                opportunityValue: 0,
                estimatedProfit: 0,
                priority: "MEDIUM",
                assigneeId: null,
                specialAccommodationId: null,
                militaryBase,
                stayStartDate: startDate,
                stayEndDate: endDate,
                notes,
                unread: false,
                unreadAt: null,
                lastSeenAt: null,
                lastSeenBy: null,
                status: "open",
                source: rawBase || null,
                createdAt: new Date(),
                updatedAt: new Date(),
            }
            const oppId = db.collection("opportunities").doc().id
            batch.set(db.collection("opportunities").doc(oppId), oppDoc)
            batchCount++
            oppsCreated++
        }

        // Create note in contact subcollection if there are notes
        if (notes) {
            batch.set(
                db.collection("contacts").doc(contactId).collection("notes").doc(),
                {
                    content: notes,
                    contactId,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                }
            )
            batchCount++
            notesCreated++
        }

        if (batchCount >= BATCH_SIZE) await commitBatch()
    }

    await commitBatch()

    console.log(`\n${"=".repeat(60)}`)
    console.log(`  IMPORT SUMMARY ${DRY_RUN ? "(DRY RUN)" : ""}`)
    console.log(`${"=".repeat(60)}`)
    console.log(`  CSV rows:            ${rows.length}`)
    console.log(`  Skipped:             ${skipped}`)
    console.log(`  Contacts created:    ${contactsCreated}`)
    console.log(`  Opportunities:       ${oppsCreated}`)
    console.log(`  Notes created:       ${notesCreated}`)
    console.log(`  Tags:                ${Object.keys(tagNameToObj).length}`)
    console.log(`${"=".repeat(60)}\n`)
}

main().catch(err => { console.error("\n[FATAL]", err); process.exit(1) })
