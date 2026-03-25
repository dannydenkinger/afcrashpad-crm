#!/usr/bin/env npx tsx
/**
 * Patch Migration: Fill gaps from richer CSV exports
 *
 * Updates existing Firestore docs with additional fields from new CSV exports:
 * - Opportunities: notes, host info, financial data, lease dates, special accommodations, priority
 * - Contacts: job title, last note, currently stationed, contact source, military base
 *
 * Usage:
 *   npx tsx scripts/patch-migration.ts --dry-run   # Preview
 *   npx tsx scripts/patch-migration.ts              # Execute
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

const NEW_CONTACTS_CSV = path.resolve(
    "/Users/dannydenkinger/Downloads/Contacts-AFCRASHPAD-05192025 - Contacts-AFCRASHPAD-05192025.csv"
)
const NEW_OPPS_CSV = path.resolve(
    "/Users/dannydenkinger/Downloads/Opportunities-AFCRASHPAD-05192025 - Opportunities-AFCRASHPAD-05192025.csv"
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
    "keelser afb": "Keesler AFB, MS",
    "keeeesler air force base": "Keesler AFB, MS",
    "keesler air force base": "Keesler AFB, MS",
    "luke afb": "Luke AFB, AZ",
    "march afb": "March ARB, CA",
    "march arb": "March ARB, CA",
    "kirtland afb": "Kirtland AFB, NM",
    "nellis afb": "Nellis AFB, NV",
    "peterson afb": "Peterson AFB, CO",
    "davis monthan afb": "Davis-Monthan AFB, AZ",
    "davis monthan ang": "Davis-Monthan AFB, AZ",
    "davis monthan (afb), morris air national guard": "Davis-Monthan AFB, AZ",
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
    "morris air national guard": "Morris ANG",
    "nas corpus cristi": "NAS Corpus Christi",
    "nas corpus christi": "NAS Corpus Christi",
    "pentagon": "Pentagon",
    "canon afb": "Cannon AFB, NM",
    "cannon afb": "Cannon AFB, NM",
    "shaw afb": "Shaw AFB, SC",
    "sheppard afb": "Sheppard AFB, TX",
    "tinker afb": "Tinker AFB, OK",
    "edwards afb": "Edwards AFB, CA",
    "wright patterson afb": "Wright-Patterson AFB, OH",
    "vance afb": "Vance AFB, OK",
    "holloman afb": "Holloman AFB, NM",
    "ellsworth afb": "Ellsworth AFB, SD",
    "offutt afb": "Offutt AFB, NE",
    "columbus afb": "Columbus AFB, MS",
    "mountain home afb": "Mountain Home AFB, ID",
    "hickam afb": "Hickam AFB, HI",
    "jb lewis mcchord": "JB Lewis-McChord, WA",
    "vandenberg sfb": "Vandenberg SFB, CA",
}

// Stage aliases (CSV name → lookup keys for CRM stages)
const STAGE_ALIASES: Record<string, string[]> = {
    "on hold": ["on hold", "on-hold"],
    "closed (lost)": ["closed lost", "closed (lost)"],
    "closed (won)": ["closed won", "closed (won)"],
    "travel started (unaccommodated)": ["travel started (unaccommodated)", "travel started", "unaccommodated"],
    "new lead": ["new lead", "new-lead"],
    "contacted": ["contacted"],
    "selecting property": ["selecting property"],
    "finding properties": ["finding properties"],
    "current tenant": ["current tenant"],
    "review/referral": ["review/referral", "review & referral", "review", "referral"],
    "review & referral": ["review/referral", "review & referral"],
    "archive": ["archive", "archived"],
    "move-in scheduled": ["move-in scheduled", "move in scheduled"],
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeBaseName(source: string, baseNameToCanonical: Record<string, string>): string | null {
    if (!source || !source.trim()) return null
    const key = source.toLowerCase().trim()
    if (BASE_ALIASES[key]) return BASE_ALIASES[key]
    if (baseNameToCanonical[key]) return baseNameToCanonical[key]
    for (const [canonical, name] of Object.entries(baseNameToCanonical)) {
        if (canonical.includes(key) || key.includes(canonical.split(",")[0].toLowerCase())) {
            return name
        }
    }
    return source.trim()
}

function safeISOString(val: string | undefined | null): string | null {
    if (!val || !val.trim()) return null
    const d = new Date(val.trim())
    return isNaN(d.getTime()) ? null : d.toISOString()
}

function safeDateParse(val: string | undefined | null): Date | null {
    if (!val || !val.trim()) return null
    const d = new Date(val.trim())
    return isNaN(d.getTime()) ? null : d
}

function parseFloat0(val: string | undefined | null): number {
    if (!val || !val.trim()) return 0
    const cleaned = val.replace(/[^0-9.\-]/g, "")
    const n = parseFloat(cleaned)
    return isNaN(n) ? 0 : n
}

function trimOrNull(val: string | undefined | null): string | null {
    if (!val) return null
    const trimmed = val.trim()
    return trimmed.length > 0 ? trimmed : null
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
    console.log(`\n${"=".repeat(60)}`)
    console.log(`  AFCrashpad CRM Patch Migration`)
    console.log(`  Mode: ${DRY_RUN ? "DRY RUN (no writes)" : "LIVE"}`)
    console.log(`${"=".repeat(60)}\n`)

    // ── 1. Parse CSVs ─────────────────────────────────────────────────────────

    console.log("--- Parsing new CSVs ---")
    const contactsCsv = fs.readFileSync(NEW_CONTACTS_CSV, "utf-8")
    const oppsCsv = fs.readFileSync(NEW_OPPS_CSV, "utf-8")

    const contactsData = Papa.parse(contactsCsv, { header: true, skipEmptyLines: true }).data as any[]
    const oppsData = Papa.parse(oppsCsv, { header: true, skipEmptyLines: true }).data as any[]

    console.log(`  New contacts CSV: ${contactsData.length} rows`)
    console.log(`  New opportunities CSV: ${oppsData.length} rows`)

    // ── 2. Fetch Existing Firestore Data ──────────────────────────────────────

    console.log("\n--- Fetching existing Firestore data ---")

    // Pipeline stages
    const pipelinesSnap = await db.collection("pipelines").get()
    const stageNameToId: Record<string, string> = {}
    let afcPipelineId: string | null = null

    for (const pDoc of pipelinesSnap.docs) {
        const stagesSnap = await pDoc.ref.collection("stages").get()
        for (const sDoc of stagesSnap.docs) {
            stageNameToId[sDoc.data().name.toLowerCase().trim()] = sDoc.id
        }
        if (pDoc.data().name === "AFCrashpad" || pDoc.id === "ur82OKAdfauofmvJtSUr") {
            afcPipelineId = pDoc.id
        }
    }
    if (!afcPipelineId && pipelinesSnap.docs.length > 0) {
        afcPipelineId = pipelinesSnap.docs[0].id
    }
    console.log(`  Pipeline stages: ${Object.keys(stageNameToId).length} (pipeline: ${afcPipelineId})`)

    // Create missing stages
    const requiredStages = ["Move-In Scheduled"]
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
                console.log(`  [STAGE] Created: "${sName}" (${ref.id})`)
            }
        }
    }

    // Military bases
    const basesSnap = await db.collection("military_bases").get()
    const baseNameToCanonical: Record<string, string> = {}
    for (const doc of basesSnap.docs) {
        const name = doc.data().name
        baseNameToCanonical[name.toLowerCase().trim()] = name
    }
    console.log(`  Military bases: ${basesSnap.size}`)

    // Tags
    const tagsSnap = await db.collection("tags").get()
    const tagNameToObj: Record<string, { tagId: string; name: string; color: string }> = {}
    for (const doc of tagsSnap.docs) {
        const data = doc.data()
        tagNameToObj[data.name.toLowerCase().trim()] = { tagId: doc.id, name: data.name, color: data.color }
    }
    console.log(`  Tags: ${tagsSnap.size}`)
    const TAG_COLORS = ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"]
    let tagColorIndex = tagsSnap.size

    async function resolveTag(tagName: string): Promise<{ tagId: string; name: string; color: string } | null> {
        const key = tagName.toLowerCase().trim()
        if (!key) return null
        if (tagNameToObj[key]) return tagNameToObj[key]
        const color = TAG_COLORS[tagColorIndex % TAG_COLORS.length]
        tagColorIndex++
        const ref = db.collection("tags").doc()
        if (!DRY_RUN) {
            await ref.set({ name: tagName.trim(), color, createdAt: new Date(), updatedAt: new Date() })
        }
        const newTag = { tagId: ref.id, name: tagName.trim(), color }
        tagNameToObj[key] = newTag
        console.log(`  [TAG] Created: "${tagName.trim()}" (${color})`)
        return newTag
    }

    // Users
    const usersSnap = await db.collection("users").get()
    const userNameToId: Record<string, string> = {}
    for (const doc of usersSnap.docs) {
        const data = doc.data()
        if (data.name) userNameToId[data.name.toLowerCase().trim()] = doc.id
    }

    // Existing contacts (for dedup)
    const existingContactsSnap = await db.collection("contacts").get()
    const existingContactIds = new Set<string>()
    const existingContactsByEmail: Record<string, string> = {}
    for (const doc of existingContactsSnap.docs) {
        existingContactIds.add(doc.id)
        const data = doc.data()
        if (data.email) existingContactsByEmail[data.email.toLowerCase().trim()] = doc.id
    }
    console.log(`  Existing contacts: ${existingContactsSnap.size}`)

    // Existing opportunities
    const existingOppsSnap = await db.collection("opportunities").get()
    const existingOppIds = new Set<string>()
    const existingOppData: Record<string, any> = {}
    for (const doc of existingOppsSnap.docs) {
        existingOppIds.add(doc.id)
        existingOppData[doc.id] = doc.data()
    }
    console.log(`  Existing opportunities: ${existingOppsSnap.size}`)

    // ── 3. Batch helpers ──────────────────────────────────────────────────────

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

    // ── 4. Patch Opportunities ────────────────────────────────────────────────

    console.log("\n--- Patching Opportunities ---")
    let oppsPatched = 0
    let oppsCreated = 0
    let notesCreated = 0

    for (const row of oppsData) {
        const oppId = (row["Opportunity ID"] || "").trim()
        if (!oppId) continue

        const existing = existingOppData[oppId]

        // Build update object with new fields
        const update: Record<string, any> = {}

        // Notes (was empty in original export)
        const notes = trimOrNull(row["Notes"])
        if (notes && (!existing || !existing.notes)) {
            update.notes = notes
        }

        // Host info
        const hostName = trimOrNull(row["Host Name"])
        const hostEmail = trimOrNull(row["Host Email"])
        const hostPhone = trimOrNull(row["Host Phone Number"])
        const hostAddress = trimOrNull(row["Host Address"])
        if (hostName) update.hostName = hostName
        if (hostEmail) update.hostEmail = hostEmail
        if (hostPhone) update.hostPhone = hostPhone
        if (hostAddress) update.hostAddress = hostAddress

        // Lease dates
        const leaseSignedDate = safeISOString(row["Lease Signed Date"])
        const leaseStartDate = safeISOString(row["Lease Start Date"])
        const leaseEndDate = safeISOString(row["Lease End Date"])
        if (leaseSignedDate) update.leaseSignedDate = leaseSignedDate

        // Fill stayStartDate/stayEndDate if they were empty
        if (leaseStartDate && (!existing || !existing.stayStartDate)) {
            update.stayStartDate = leaseStartDate
        }
        if (leaseEndDate && (!existing || !existing.stayEndDate)) {
            update.stayEndDate = leaseEndDate
        }

        // Special Accommodations
        const specialAccom = trimOrNull(row["Special Accommodations"])
        if (specialAccom) update.specialAccommodations = specialAccom

        // Priority
        const priority = trimOrNull(row["Priority"])
        if (priority && (!existing || !existing.priority || existing.priority === "MEDIUM")) {
            const priorityMap: Record<string, string> = {
                "low": "LOW", "medium": "MEDIUM", "high": "HIGH"
            }
            update.priority = priorityMap[priority.toLowerCase()] || priority.toUpperCase()
        }

        // Financial data
        const dailyRate = parseFloat0(row["Daily Rate"])
        const monthlyRevenue = parseFloat0(row["Monthly Revenue"])
        const monthlyRent = parseFloat0(row["Monthly Rent (Minus)"])
        const monthlyProfit = parseFloat0(row["Monthly Profit (Pre Tax)"])
        const fees = parseFloat0(row["Fees (Minus)"])
        const dailyTax = parseFloat0(row["Daily Tax (Plus)"])
        const contractValue = parseFloat0(row["Contract Value (Pre Tax)"])
        const totalProfit = parseFloat0(row["Total Profit (Pre Tax)"])
        const contractValuePostTax = parseFloat0(row["Contract Value (Post Tax)"])
        const totalProfitPostTax = parseFloat0(row["Total Profit (Post Tax)"])

        if (dailyRate) update.dailyRate = dailyRate
        if (monthlyRevenue) update.monthlyRevenue = monthlyRevenue
        if (monthlyRent) update.monthlyRent = monthlyRent
        if (monthlyProfit) update.monthlyProfit = monthlyProfit
        if (fees) update.fees = fees
        if (dailyTax) update.dailyTax = dailyTax
        if (contractValue) update.contractValue = contractValue
        if (totalProfit) update.totalProfit = totalProfit
        if (contractValuePostTax) update.contractValuePostTax = contractValuePostTax
        if (totalProfitPostTax) update.totalProfitPostTax = totalProfitPostTax

        // Military Base from dedicated column (normalize)
        const milBase = trimOrNull(row["Military Base"])
        if (milBase && (!existing || !existing.militaryBase)) {
            const normalized = normalizeBaseName(milBase, baseNameToCanonical)
            if (normalized) update.militaryBase = normalized
        }

        // Stage update (check for new stage names like "Move-In Scheduled", "Review & Referral")
        const stageName = trimOrNull(row["stage"])
        if (stageName && existing) {
            const stageKey = stageName.toLowerCase().trim()
            let stageId = stageNameToId[stageKey] || null
            if (!stageId) {
                for (const [csvName, aliases] of Object.entries(STAGE_ALIASES)) {
                    if (csvName === stageKey || aliases.includes(stageKey)) {
                        for (const alias of [csvName, ...aliases]) {
                            if (stageNameToId[alias]) { stageId = stageNameToId[alias]; break }
                        }
                        break
                    }
                }
            }
            if (stageId && stageId !== existing.pipelineStageId) {
                update.pipelineStageId = stageId
            }
        }

        // Apply update
        if (Object.keys(update).length > 0) {
            update.updatedAt = new Date()
            if (existingOppIds.has(oppId)) {
                batch.update(db.collection("opportunities").doc(oppId), update)
                oppsPatched++
            } else {
                // Create new opp (shouldn't happen often)
                const contactId = (row["Contact ID"] || "").trim()
                const fullDoc = {
                    contactId: contactId || null,
                    pipelineStageId: update.pipelineStageId || stageNameToId["new lead"] || "",
                    name: trimOrNull(row["Opportunity Name"]) || "Unknown",
                    opportunityValue: parseFloat0(row["Lead Value"]),
                    estimatedProfit: 0,
                    assigneeId: userNameToId[(row["assigned"] || "").toLowerCase().trim()] || null,
                    specialAccommodationId: null,
                    unread: false,
                    unreadAt: null,
                    lastSeenAt: null,
                    lastSeenBy: null,
                    createdAt: safeDateParse(row["Created on"]) || new Date(),
                    status: trimOrNull(row["status"]) || "open",
                    source: trimOrNull(row["source"]) || null,
                    lostReasonId: trimOrNull(row["lost reason ID"]) || null,
                    lostReasonName: trimOrNull(row["lost reason name"]) || null,
                    _legacyCrmId: oppId,
                    ...update,
                }
                batch.set(db.collection("opportunities").doc(oppId), fullDoc)
                existingOppIds.add(oppId)
                oppsCreated++
            }
            batchCount++
        }

        // Create note in contact subcollection
        if (notes) {
            const contactId = (row["Contact ID"] || "").trim()
            const resolvedContactId = existingContactsByEmail[(row["email"] || "").toLowerCase().trim()] || contactId
            if (resolvedContactId && existingContactIds.has(resolvedContactId)) {
                batch.set(
                    db.collection("contacts").doc(resolvedContactId).collection("notes").doc(),
                    {
                        content: `[Migrated from CRM] ${notes}`,
                        contactId: resolvedContactId,
                        createdAt: safeDateParse(row["Created on"]) || new Date(),
                        updatedAt: safeDateParse(row["Created on"]) || new Date(),
                    }
                )
                batchCount++
                notesCreated++
            }
        }

        if (batchCount >= BATCH_SIZE) await commitBatch()
    }

    await commitBatch()
    console.log(`  Opportunities patched: ${oppsPatched}`)
    console.log(`  Opportunities created: ${oppsCreated}`)
    console.log(`  Opp notes → contact notes: ${notesCreated}`)

    // ── 5. Patch/Create Contacts ──────────────────────────────────────────────

    console.log("\n--- Patching/Creating Contacts ---")
    let contactsPatched = 0
    let contactsCreated = 0
    let contactNotesCreated = 0

    for (const row of contactsData) {
        const csvId = (row["Contact Id"] || "").trim()
        if (!csvId) continue

        const firstName = (row["First Name"] || "").trim()
        const lastName = (row["Last Name"] || "").trim()
        const name = `${firstName} ${lastName}`.trim() || "Unknown"
        const email = (row["Email"] || "").trim().toLowerCase() || null
        const phone = (row["Phone"] || "").trim() || null

        // Skip obvious spam/test contacts
        if (name.toLowerCase().includes("promotion company") || name.toLowerCase() === "meta ai") {
            continue
        }

        // Determine Firestore ID - check by CSV ID first, then by email
        let firestoreId = csvId
        if (!existingContactIds.has(csvId) && email && existingContactsByEmail[email]) {
            firestoreId = existingContactsByEmail[email]
        }

        const isExisting = existingContactIds.has(firestoreId)

        // Build new fields
        const jobTitle = trimOrNull(row["Job Title"])
        const lastNote = trimOrNull(row["Last Note"])
        const currentlyStationed = trimOrNull(row["Currently Stationed"])
        const contactSource = trimOrNull(row["Contact Source"])
        const source = trimOrNull(row["Source"])
        const businessName = trimOrNull(row["Business Name"])
        const companyName = trimOrNull(row["Company Name"])

        // Military base: prefer "Military Base" column, fallback to "Currently Stationed"
        const rawBase = trimOrNull(row["Military Base"]) || currentlyStationed
        const normalizedBase = rawBase ? normalizeBaseName(rawBase, baseNameToCanonical) : null

        // Tags
        const tagStrings = (row["Tags"] || "").split(",").map((t: string) => t.trim()).filter(Boolean)
        const tagObjects = []
        for (const ts of tagStrings) {
            const tagObj = await resolveTag(ts)
            if (tagObj) tagObjects.push(tagObj)
        }

        if (isExisting) {
            // Patch existing contact with new fields
            const update: Record<string, any> = {}

            if (jobTitle) update.jobTitle = jobTitle
            if (currentlyStationed) update.currentlyStationed = currentlyStationed
            if (contactSource) update.contactSource = contactSource
            if (source) update.source = source
            if (businessName) update.businessName = businessName
            if (companyName) update.companyName = companyName
            if (normalizedBase) {
                // Only update militaryBase if currently empty
                const existingDoc = existingContactsSnap.docs.find(d => d.id === firestoreId)
                if (existingDoc && !existingDoc.data().militaryBase) {
                    update.militaryBase = normalizedBase
                }
            }
            if (tagObjects.length > 0) {
                // Merge tags (don't overwrite existing ones)
                const existingDoc = existingContactsSnap.docs.find(d => d.id === firestoreId)
                const existingTags: any[] = existingDoc?.data()?.tags || []
                const existingTagIds = new Set(existingTags.map((t: any) => t.tagId))
                const newTags = tagObjects.filter(t => !existingTagIds.has(t.tagId))
                if (newTags.length > 0) {
                    update.tags = [...existingTags, ...newTags]
                }
            }

            if (Object.keys(update).length > 0) {
                update.updatedAt = new Date()
                batch.update(db.collection("contacts").doc(firestoreId), update)
                batchCount++
                contactsPatched++
            }
        } else {
            // Create new contact
            const createdAt = safeDateParse(row["Created"]) || new Date()
            const contactDoc: Record<string, any> = {
                name,
                email,
                phone,
                businessName: businessName || companyName || null,
                militaryBase: normalizedBase,
                status: "Lead",
                tags: tagObjects,
                stayStartDate: null,
                stayEndDate: null,
                createdAt,
                updatedAt: createdAt,
                _legacyCrmId: csvId,
            }
            if (jobTitle) contactDoc.jobTitle = jobTitle
            if (currentlyStationed) contactDoc.currentlyStationed = currentlyStationed
            if (contactSource) contactDoc.contactSource = contactSource
            if (source) contactDoc.source = source

            batch.set(db.collection("contacts").doc(csvId), contactDoc)
            existingContactIds.add(csvId)
            if (email) existingContactsByEmail[email] = csvId
            batchCount++
            contactsCreated++
        }

        // Create note from "Last Note" field
        if (lastNote && lastNote.length > 2) {
            const targetId = isExisting ? firestoreId : csvId
            batch.set(
                db.collection("contacts").doc(targetId).collection("notes").doc(),
                {
                    content: `[Migrated from CRM] ${lastNote}`,
                    contactId: targetId,
                    createdAt: safeDateParse(row["Created"]) || new Date(),
                    updatedAt: safeDateParse(row["Created"]) || new Date(),
                }
            )
            batchCount++
            contactNotesCreated++
        }

        if (batchCount >= BATCH_SIZE) await commitBatch()
    }

    await commitBatch()
    console.log(`  Contacts patched: ${contactsPatched}`)
    console.log(`  Contacts created: ${contactsCreated}`)
    console.log(`  Contact notes created: ${contactNotesCreated}`)

    // ── 6. Backfill contact fields from patched opportunities ──────────────────

    console.log("\n--- Backfilling contact fields from patched opportunities ---")
    let backfillCount = 0

    // Re-read opportunities to get updated data
    for (const row of oppsData) {
        const oppId = (row["Opportunity ID"] || "").trim()
        if (!oppId) continue

        const contactId = (row["Contact ID"] || "").trim()
        if (!contactId || !existingContactIds.has(contactId)) continue

        const leaseStartDate = safeISOString(row["Lease Start Date"])
        const leaseEndDate = safeISOString(row["Lease End Date"])
        const milBase = trimOrNull(row["Military Base"]) || trimOrNull(row["source"])
        const normalizedBase = milBase ? normalizeBaseName(milBase, baseNameToCanonical) : null

        const existingDoc = existingContactsSnap.docs.find(d => d.id === contactId)
        if (!existingDoc) continue
        const contactData = existingDoc.data()

        const update: Record<string, any> = {}
        if (leaseStartDate && !contactData.stayStartDate) update.stayStartDate = leaseStartDate
        if (leaseEndDate && !contactData.stayEndDate) update.stayEndDate = leaseEndDate
        if (normalizedBase && !contactData.militaryBase) update.militaryBase = normalizedBase

        if (Object.keys(update).length > 0) {
            update.updatedAt = new Date()
            batch.update(db.collection("contacts").doc(contactId), update)
            batchCount++
            backfillCount++
        }

        if (batchCount >= BATCH_SIZE) await commitBatch()
    }

    await commitBatch()
    console.log(`  Contacts backfilled: ${backfillCount}`)

    // ── 7. Summary ────────────────────────────────────────────────────────────

    console.log(`\n${"=".repeat(60)}`)
    console.log(`  PATCH SUMMARY ${DRY_RUN ? "(DRY RUN)" : ""}`)
    console.log(`${"=".repeat(60)}`)
    console.log(`  Opportunities patched:     ${oppsPatched}`)
    console.log(`  Opportunities created:     ${oppsCreated}`)
    console.log(`  Opp notes created:         ${notesCreated}`)
    console.log(`  Contacts patched:          ${contactsPatched}`)
    console.log(`  Contacts created:          ${contactsCreated}`)
    console.log(`  Contact notes created:     ${contactNotesCreated}`)
    console.log(`  Contacts backfilled:       ${backfillCount}`)
    console.log(`${"=".repeat(60)}\n`)
}

main().catch((err) => {
    console.error("\n[FATAL] Patch migration failed:", err)
    process.exit(1)
})
