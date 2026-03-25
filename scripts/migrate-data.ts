#!/usr/bin/env npx tsx
/**
 * Data Migration Script: Old CRM CSV → AFCrashpad CRM Firestore
 *
 * Usage:
 *   npx tsx scripts/migrate-data.ts           # Execute migration
 *   npx tsx scripts/migrate-data.ts --dry-run  # Preview without writing
 */

import * as admin from "firebase-admin"
import { getFirestore, WriteBatch } from "firebase-admin/firestore"
import * as dotenv from "dotenv"
import * as path from "path"
import * as fs from "fs"
import Papa from "papaparse"

// ── Config ────────────────────────────────────────────────────────────────────

const DRY_RUN = process.argv.includes("--dry-run")
const BATCH_SIZE = 400

const CONTACTS_CSV = path.resolve(
    "/Users/dannydenkinger/Downloads/Export_Contacts_undefined_Mar_2026_2_53_PM.csv"
)
const OPPS_CSV = path.resolve(
    "/Users/dannydenkinger/Downloads/opportunities (1).csv"
)

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

const dbId = process.env.FIREBASE_DATABASE_ID
if (!dbId) throw new Error("FIREBASE_DATABASE_ID environment variable is not set")
const db = getFirestore(admin.app(), dbId)

// ── Base Name Aliases ─────────────────────────────────────────────────────────

const BASE_ALIASES: Record<string, string> = {
    "eglin afb": "Eglin AFB, FL",
    "keesler afb": "Keesler AFB, MS",
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
    "nas corpus christi": "NAS Corpus Christi",
    "pentagon": "Pentagon",
}

// ── Stage Name Aliases (CSV name → CRM name) ─────────────────────────────────
// The old CRM uses parenthesized names; the new CRM may not.

const STAGE_ALIASES: Record<string, string[]> = {
    "on hold": ["on hold", "on-hold"],
    "closed (lost)": ["closed lost", "closed (lost)"],
    "closed (won)": ["closed won", "closed (won)"],
    "travel started (unaccommodated)": [
        "travel started (unaccommodated)",
        "travel started",
        "unaccommodated",
    ],
    "new lead": ["new lead", "new-lead"],
    "contacted": ["contacted"],
    "selecting property": ["selecting property"],
    "finding properties": ["finding properties"],
    "current tenant": ["current tenant"],
    "review/referral": ["review/referral", "review", "referral"],
    "archive": ["archive", "archived"],
}

// ── Tag Colors ────────────────────────────────────────────────────────────────

const TAG_COLORS = [
    "#3b82f6", "#ef4444", "#22c55e", "#f59e0b",
    "#8b5cf6", "#ec4899", "#06b6d4", "#f97316",
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeBaseName(
    source: string,
    baseNameToCanonical: Record<string, string>
): string | null {
    if (!source || !source.trim()) return null
    const key = source.toLowerCase().trim()
    if (BASE_ALIASES[key]) return BASE_ALIASES[key]
    if (baseNameToCanonical[key]) return baseNameToCanonical[key]
    // Fuzzy: check if any canonical name contains the key
    for (const [canonical, name] of Object.entries(baseNameToCanonical)) {
        if (canonical.includes(key) || key.includes(canonical.split(",")[0].toLowerCase())) {
            return name
        }
    }
    console.warn(`  [WARN] Unknown base: "${source}" — storing as-is`)
    return source
}

function isExampleContact(row: any): boolean {
    const firstName = (row["First Name"] || "").trim()
    return firstName.toLowerCase().startsWith("(example)")
}

function safeDateParse(val: string | undefined | null): Date | null {
    if (!val || !val.trim()) return null
    const d = new Date(val.trim())
    return isNaN(d.getTime()) ? null : d
}

function safeISOString(val: string | undefined | null): string | null {
    const d = safeDateParse(val)
    return d ? d.toISOString() : null
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
    console.log(`\n${"=".repeat(60)}`)
    console.log(`  AFCrashpad CRM Data Migration`)
    console.log(`  Mode: ${DRY_RUN ? "DRY RUN (no writes)" : "LIVE"}`)
    console.log(`${"=".repeat(60)}\n`)

    // ── 1. Parse CSVs ─────────────────────────────────────────────────────────

    console.log("--- Parsing CSVs ---")
    const contactsCsv = fs.readFileSync(CONTACTS_CSV, "utf-8")
    const oppsCsv = fs.readFileSync(OPPS_CSV, "utf-8")

    const contactsData = Papa.parse(contactsCsv, {
        header: true,
        skipEmptyLines: true,
    }).data as any[]
    const oppsData = Papa.parse(oppsCsv, {
        header: true,
        skipEmptyLines: true,
    }).data as any[]

    console.log(`  Contacts CSV: ${contactsData.length} rows`)
    console.log(`  Opportunities CSV: ${oppsData.length} rows`)

    // ── 2. Fetch Existing Firestore Data ──────────────────────────────────────

    console.log("\n--- Fetching existing Firestore data ---")

    // 2a. Pipeline stages
    const pipelinesSnap = await db.collection("pipelines").get()
    const stageNameToId: Record<string, string> = {}
    let afcPipelineId: string | null = null

    for (const pDoc of pipelinesSnap.docs) {
        const stagesSnap = await pDoc.ref.collection("stages").get()
        for (const sDoc of stagesSnap.docs) {
            stageNameToId[sDoc.data().name.toLowerCase().trim()] = sDoc.id
        }
        // Check if this is the AFCrashpad pipeline
        if (
            pDoc.data().name === "AFCrashpad" ||
            pDoc.id === "ur82OKAdfauofmvJtSUr"
        ) {
            afcPipelineId = pDoc.id
        }
    }
    console.log(
        `  Pipeline stages: ${Object.keys(stageNameToId).length} found${afcPipelineId ? ` (pipeline: ${afcPipelineId})` : ""}`
    )

    // If no pipeline found, use the first one
    if (!afcPipelineId && pipelinesSnap.docs.length > 0) {
        afcPipelineId = pipelinesSnap.docs[0].id
        console.log(`  Using first pipeline: ${afcPipelineId}`)
    }

    // If still no stages mapped, create defaults
    if (Object.keys(stageNameToId).length === 0 && afcPipelineId) {
        console.log("  No stages found — creating default stages...")
        const defaultStages = [
            "New Lead", "Contacted", "Selecting Property", "Finding Properties",
            "Travel Started (Unaccommodated)", "Current Tenant", "Review/Referral",
            "On Hold", "Archive", "Closed (Won)", "Closed (Lost)",
        ]
        for (let i = 0; i < defaultStages.length; i++) {
            const ref = db.collection("pipelines").doc(afcPipelineId).collection("stages").doc()
            if (!DRY_RUN) {
                await ref.set({ name: defaultStages[i], order: i })
            }
            stageNameToId[defaultStages[i].toLowerCase()] = ref.id
            console.log(`    Created stage: ${defaultStages[i]} (${ref.id})`)
        }
    }

    // Create missing stages that exist in CSV but not in CRM
    const requiredStages = [
        "On Hold", "Travel Started (Unaccommodated)",
    ]
    if (afcPipelineId) {
        const existingStageCount = Object.keys(stageNameToId).length
        for (let i = 0; i < requiredStages.length; i++) {
            const sName = requiredStages[i]
            if (!stageNameToId[sName.toLowerCase()]) {
                const ref = db.collection("pipelines").doc(afcPipelineId).collection("stages").doc()
                if (!DRY_RUN) {
                    await ref.set({ name: sName, order: existingStageCount + i })
                }
                stageNameToId[sName.toLowerCase()] = ref.id
                console.log(`  [STAGE] Created missing stage: "${sName}" (${ref.id})`)
            }
        }
    }

    const defaultStageId = stageNameToId["new lead"] || Object.values(stageNameToId)[0] || ""

    // Log all mapped stages
    console.log("  Stage mapping:")
    for (const [name, id] of Object.entries(stageNameToId)) {
        console.log(`    ${name} → ${id}`)
    }

    // 2b. Military bases
    const basesSnap = await db.collection("military_bases").get()
    const baseNameToCanonical: Record<string, string> = {}
    for (const doc of basesSnap.docs) {
        const name = doc.data().name
        baseNameToCanonical[name.toLowerCase().trim()] = name
    }
    console.log(`  Military bases: ${basesSnap.size} in Firestore`)

    // 2c. Tags
    const tagsSnap = await db.collection("tags").get()
    const tagNameToObj: Record<string, { tagId: string; name: string; color: string }> = {}
    for (const doc of tagsSnap.docs) {
        const data = doc.data()
        tagNameToObj[data.name.toLowerCase().trim()] = {
            tagId: doc.id,
            name: data.name,
            color: data.color,
        }
    }
    console.log(`  Tags: ${tagsSnap.size} in Firestore`)
    let tagColorIndex = 0

    async function resolveTag(tagName: string): Promise<{ tagId: string; name: string; color: string }> {
        const key = tagName.toLowerCase().trim()
        if (!key) return { tagId: "", name: "", color: "" }
        if (tagNameToObj[key]) return tagNameToObj[key]

        const color = TAG_COLORS[tagColorIndex % TAG_COLORS.length]
        tagColorIndex++

        const ref = db.collection("tags").doc()
        if (!DRY_RUN) {
            await ref.set({
                name: tagName.trim(),
                color,
                createdAt: new Date(),
                updatedAt: new Date(),
            })
        }
        const newTag = { tagId: ref.id, name: tagName.trim(), color }
        tagNameToObj[key] = newTag
        console.log(`  [TAG] Created: "${tagName.trim()}" (${color})`)
        return newTag
    }

    // 2d. Users
    const usersSnap = await db.collection("users").get()
    const userNameToId: Record<string, string> = {}
    for (const doc of usersSnap.docs) {
        const data = doc.data()
        if (data.name) userNameToId[data.name.toLowerCase().trim()] = doc.id
    }
    console.log(`  Users: ${usersSnap.size} in Firestore`)
    for (const [name, id] of Object.entries(userNameToId)) {
        console.log(`    ${name} → ${id}`)
    }

    function resolveUserId(name: string): string | null {
        if (!name || !name.trim()) return null
        const key = name.toLowerCase().trim()
        return userNameToId[key] || null
    }

    // 2e. Existing contacts (for dedup)
    const existingContactsSnap = await db.collection("contacts").get()
    const existingContactsByEmail: Record<string, string> = {}
    const existingContactIds = new Set<string>()
    for (const doc of existingContactsSnap.docs) {
        existingContactIds.add(doc.id)
        const data = doc.data()
        if (data.email) {
            existingContactsByEmail[data.email.toLowerCase().trim()] = doc.id
        }
    }
    console.log(`  Existing contacts: ${existingContactsSnap.size}`)

    // Also check existing opportunities to avoid re-importing
    const existingOppsSnap = await db.collection("opportunities").get()
    const existingOppIds = new Set<string>()
    for (const doc of existingOppsSnap.docs) {
        existingOppIds.add(doc.id)
    }
    console.log(`  Existing opportunities: ${existingOppsSnap.size}`)

    // ── 3. Process Contacts ───────────────────────────────────────────────────

    console.log("\n--- Processing Contacts ---")
    const csvIdToFirestoreId: Record<string, string> = {}
    let contactsCreated = 0
    let contactsSkipped = 0
    let contactsDuped = 0

    let batch: WriteBatch = db.batch()
    let batchCount = 0

    async function commitBatch() {
        if (batchCount > 0) {
            if (!DRY_RUN) {
                await batch.commit()
            } else {
                console.log(`  [DRY RUN] Would commit batch of ${batchCount} operations`)
            }
            batch = db.batch()
            batchCount = 0
        }
    }

    for (const row of contactsData) {
        const csvId = (row["Contact Id"] || "").trim()
        if (!csvId) { contactsSkipped++; continue }

        if (isExampleContact(row)) {
            contactsSkipped++
            continue
        }

        const email = (row["Email"] || "").trim().toLowerCase() || null

        // Check if already exists in Firestore by email
        if (email && existingContactsByEmail[email]) {
            csvIdToFirestoreId[csvId] = existingContactsByEmail[email]
            contactsDuped++
            continue
        }

        // Check if doc with this ID already exists
        if (existingContactIds.has(csvId)) {
            csvIdToFirestoreId[csvId] = csvId
            contactsDuped++
            continue
        }

        const firstName = (row["First Name"] || "").trim()
        const lastName = (row["Last Name"] || "").trim()
        const name = `${firstName} ${lastName}`.trim() || "Unknown"

        // Resolve tags
        const tagStrings = (row["Tags"] || "")
            .split(",")
            .map((t: string) => t.trim())
            .filter(Boolean)
        const tagObjects = []
        for (const ts of tagStrings) {
            const tagObj = await resolveTag(ts)
            if (tagObj.tagId) tagObjects.push(tagObj)
        }

        const createdAt = safeDateParse(row["Created"]) || new Date()

        const contactDoc: Record<string, any> = {
            name,
            email,
            phone: (row["Phone"] || "").trim() || null,
            businessName: (row["Business Name"] || "").trim() || null,
            militaryBase: null,
            status: "Lead",
            tags: tagObjects,
            stayStartDate: null,
            stayEndDate: null,
            createdAt,
            updatedAt: createdAt,
            _legacyCrmId: csvId,
            _lastActivityRaw: (row["Last Activity"] || "").trim() || null,
        }

        batch.set(db.collection("contacts").doc(csvId), contactDoc)
        csvIdToFirestoreId[csvId] = csvId
        if (email) existingContactsByEmail[email] = csvId
        existingContactIds.add(csvId)
        contactsCreated++
        batchCount++

        if (batchCount >= BATCH_SIZE) await commitBatch()
    }

    await commitBatch()
    console.log(`  Created: ${contactsCreated}`)
    console.log(`  Skipped (example/invalid): ${contactsSkipped}`)
    console.log(`  Skipped (duplicate): ${contactsDuped}`)

    // ── 4. Process Opportunities ──────────────────────────────────────────────

    console.log("\n--- Processing Opportunities ---")
    let oppsCreated = 0
    let oppsSkipped = 0
    let stageMissCount = 0
    let baseMissCount = 0
    const createdOppIds: string[] = []
    const contactBaseBackfill: Record<string, string> = {}
    const contactDatesBackfill: Record<string, { startDate: string | null; endDate: string | null; createdAt: Date }> = {}

    for (const row of oppsData) {
        const csvOppId = (row["Opportunity ID"] || "").trim()
        if (!csvOppId) { oppsSkipped++; continue }

        // Skip if already exists
        if (existingOppIds.has(csvOppId)) {
            oppsSkipped++
            continue
        }

        // Resolve contact ID
        const csvContactId = (row["Contact ID"] || "").trim()
        let firestoreContactId = csvIdToFirestoreId[csvContactId] || null

        // If contact wasn't in CSV, check if it exists in Firestore already
        if (!firestoreContactId && csvContactId) {
            if (existingContactIds.has(csvContactId)) {
                firestoreContactId = csvContactId
                csvIdToFirestoreId[csvContactId] = csvContactId
            } else {
                // Create minimal contact from opportunity data
                const contactName = (row["Contact Name"] || "").trim() || "Unknown"
                const contactEmail = (row["email"] || "").trim().toLowerCase() || null
                const contactPhone = (row["phone"] || "").trim() || null
                const rawSource = (row["source"] || "").trim()
                const normalizedBase = normalizeBaseName(rawSource, baseNameToCanonical)
                const oppCreatedAt = safeDateParse(row["Created on"]) || new Date()

                batch.set(db.collection("contacts").doc(csvContactId), {
                    name: contactName,
                    email: contactEmail,
                    phone: contactPhone,
                    militaryBase: normalizedBase,
                    businessName: null,
                    status: "Lead",
                    tags: [],
                    stayStartDate: null,
                    stayEndDate: null,
                    createdAt: oppCreatedAt,
                    updatedAt: oppCreatedAt,
                    _createdFromOpportunity: true,
                    _legacyCrmId: csvContactId,
                })
                firestoreContactId = csvContactId
                csvIdToFirestoreId[csvContactId] = csvContactId
                existingContactIds.add(csvContactId)
                if (contactEmail) existingContactsByEmail[contactEmail] = csvContactId
                batchCount++
                console.log(`  [CONTACT] Auto-created from opp: "${contactName}"`)
            }
        }

        // Resolve stage (try exact match, then aliases)
        const stageName = (row["stage"] || "").trim()
        const stageKey = stageName.toLowerCase().trim()
        let stageId = stageNameToId[stageKey] || null
        if (!stageId) {
            // Try aliases: find which CSV stage maps to which CRM stage
            for (const [csvName, aliases] of Object.entries(STAGE_ALIASES)) {
                if (csvName === stageKey || aliases.includes(stageKey)) {
                    // Now find a CRM stage that matches any of the aliases
                    for (const alias of [csvName, ...aliases]) {
                        if (stageNameToId[alias]) {
                            stageId = stageNameToId[alias]
                            break
                        }
                    }
                    break
                }
            }
        }
        if (!stageId) {
            stageMissCount++
            console.warn(`  [WARN] Unknown stage "${stageName}" for "${row["Opportunity Name"]}" — using default`)
            stageId = defaultStageId
        }

        // Resolve base
        const rawSource = (row["source"] || "").trim()
        const normalizedBase = normalizeBaseName(rawSource, baseNameToCanonical)
        if (rawSource && !BASE_ALIASES[rawSource.toLowerCase().trim()] && !baseNameToCanonical[rawSource.toLowerCase().trim()]) {
            baseMissCount++
        }

        // Resolve assignee
        const assignedName = (row["assigned"] || "").trim()
        const assigneeId = resolveUserId(assignedName)

        // Parse dates
        const startDate = safeISOString(row["Start Date"])
        const endDate = safeISOString(row["End Date"])
        const notes = (row["Notes"] || "").trim() || null
        const oppCreatedAt = safeDateParse(row["Created on"]) || new Date()
        const oppUpdatedAt = safeDateParse(row["Updated on"]) || oppCreatedAt

        // Parse "Days Since" fields (strip " Days " wrapper)
        const parseDays = (val: string | undefined) => {
            if (!val) return null
            const n = parseInt(val.replace(/[^0-9]/g, ""))
            return isNaN(n) ? null : n
        }

        const oppDoc: Record<string, any> = {
            contactId: firestoreContactId || csvContactId,
            pipelineStageId: stageId,
            name: (row["Opportunity Name"] || "").trim() || "Unknown",
            opportunityValue: parseFloat(row["Lead Value"] || "0") || 0,
            estimatedProfit: 0,
            priority: "MEDIUM",
            assigneeId: assigneeId,
            specialAccommodationId: null,
            militaryBase: normalizedBase,
            stayStartDate: startDate,
            stayEndDate: endDate,
            notes: notes,
            unread: false,
            unreadAt: null,
            lastSeenAt: null,
            lastSeenBy: null,
            createdAt: oppCreatedAt,
            updatedAt: oppUpdatedAt,
            // Preserved metadata
            status: (row["status"] || "").trim() || "open",
            source: rawSource || null,
            dealOwner: (row["Deal Owner"] || "").trim() || null,
            engagementScore: parseInt(row["Engagement Score"] || "0") || 0,
            lostReasonId: (row["lost reason ID"] || "").trim() || null,
            lostReasonName: (row["lost reason name"] || "").trim() || null,
            followers: (row["Followers"] || "").trim() || null,
            _legacyCrmId: csvOppId,
            _legacyContactId: csvContactId,
            _legacyStageId: (row["Pipeline Stage ID"] || "").trim() || null,
            _legacyPipelineId: (row["Pipeline ID"] || "").trim() || null,
            _daysSinceLastStageChange: parseDays(row["Days Since Last Stage Change Date "]),
            _daysSinceLastStatusChange: parseDays(row["Days Since Last Status Change Date "]),
            _daysSinceLastUpdated: parseDays(row["Days Since Last Updated "]),
        }

        batch.set(db.collection("opportunities").doc(csvOppId), oppDoc)
        createdOppIds.push(csvOppId)
        oppsCreated++
        batchCount++

        // Create note in contact subcollection if Notes is present
        if (notes && firestoreContactId) {
            batch.set(
                db.collection("contacts").doc(firestoreContactId).collection("notes").doc(),
                {
                    content: `[Migrated] ${notes}`,
                    contactId: firestoreContactId,
                    createdAt: oppCreatedAt,
                    updatedAt: oppCreatedAt,
                }
            )
            batchCount++
        }

        // Track for backfill
        if (firestoreContactId) {
            if (normalizedBase) {
                contactBaseBackfill[firestoreContactId] = normalizedBase
            }
            const existing = contactDatesBackfill[firestoreContactId]
            if (!existing || oppCreatedAt > existing.createdAt) {
                contactDatesBackfill[firestoreContactId] = { startDate, endDate, createdAt: oppCreatedAt }
            }
        }

        if (batchCount >= BATCH_SIZE) await commitBatch()
    }

    await commitBatch()
    console.log(`  Created: ${oppsCreated}`)
    console.log(`  Skipped: ${oppsSkipped}`)
    console.log(`  Stage warnings: ${stageMissCount}`)
    console.log(`  Base warnings: ${baseMissCount}`)

    // ── 5. Backfill Contact Fields ────────────────────────────────────────────

    console.log("\n--- Backfilling contact fields from opportunities ---")
    let backfillCount = 0

    for (const [contactId, base] of Object.entries(contactBaseBackfill)) {
        const update: Record<string, any> = { updatedAt: new Date() }
        if (base) update.militaryBase = base
        const dates = contactDatesBackfill[contactId]
        if (dates?.startDate) update.stayStartDate = dates.startDate
        if (dates?.endDate) update.stayEndDate = dates.endDate

        batch.update(db.collection("contacts").doc(contactId), update)
        backfillCount++
        batchCount++

        if (batchCount >= BATCH_SIZE) await commitBatch()
    }

    await commitBatch()
    console.log(`  Backfilled ${backfillCount} contacts`)

    // ── 6. Summary ────────────────────────────────────────────────────────────

    console.log(`\n${"=".repeat(60)}`)
    console.log(`  MIGRATION SUMMARY ${DRY_RUN ? "(DRY RUN)" : ""}`)
    console.log(`${"=".repeat(60)}`)
    console.log(`  Contacts CSV rows:        ${contactsData.length}`)
    console.log(`    Created:                ${contactsCreated}`)
    console.log(`    Skipped (example):      ${contactsSkipped}`)
    console.log(`    Skipped (duplicate):    ${contactsDuped}`)
    console.log(`  Opportunities CSV rows:   ${oppsData.length}`)
    console.log(`    Created:                ${oppsCreated}`)
    console.log(`    Skipped:                ${oppsSkipped}`)
    console.log(`  Tags auto-created:        ${tagColorIndex}`)
    console.log(`  Contacts backfilled:      ${backfillCount}`)
    console.log(`  Stage mapping warnings:   ${stageMissCount}`)
    console.log(`  Base mapping warnings:    ${baseMissCount}`)
    console.log(`${"=".repeat(60)}\n`)

    // ── 7. Save Rollback Manifest ─────────────────────────────────────────────

    const rollbackData = {
        contactIds: Object.values(csvIdToFirestoreId),
        opportunityIds: createdOppIds,
        tagIds: Object.values(tagNameToObj)
            .filter((t) => t.tagId)
            .map((t) => t.tagId),
        migratedAt: new Date().toISOString(),
        dryRun: DRY_RUN,
    }

    const rollbackPath = path.resolve(__dirname, "migration-rollback.json")
    fs.writeFileSync(rollbackPath, JSON.stringify(rollbackData, null, 2))
    console.log(`Rollback manifest saved to: ${rollbackPath}`)
}

main().catch((err) => {
    console.error("\n[FATAL] Migration failed:", err)
    process.exit(1)
})
