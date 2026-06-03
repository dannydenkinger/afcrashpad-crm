/**
 * AFCrashpad single-org → multi-tenant data backfill.
 *
 * Makes every existing AFCrashpad document readable through Vesta's tenantDb
 * (which filters every read by workspaceId) by giving the whole dataset ONE
 * fixed workspaceId, creating the workspace + memberships Vesta's auth needs,
 * and copying settings docs to the workspace-prefixed key convention.
 *
 * DESIGNED to be:
 *   - SAFE BY DEFAULT: dry-run unless you pass --apply.
 *   - IDEMPOTENT: every step is "stamp/create if missing" so re-running after a
 *     partial failure is safe.
 *   - ADDITIVE & NON-DESTRUCTIVE: only adds a `workspaceId` field (never
 *     overwrites other fields) and COPIES settings (keeps the bare docs for
 *     rollback). Nothing is deleted unless you explicitly pass
 *     --delete-bare-settings (post-cutover cleanup only).
 *   - NAMED-DB CORRECT: targets FIREBASE_DATABASE_ID (afcrashpadcrm), NOT the
 *     (default) database. (Vesta's scripts/migrate-to-multi-tenant.ts has a bug
 *     here — it uses admin.firestore(app) which is the default DB.)
 *
 * Usage:
 *   npx tsx scripts/migrate-afcrashpad-workspace.ts              # dry-run (default)
 *   npx tsx scripts/migrate-afcrashpad-workspace.ts --apply      # perform the backfill
 *   npx tsx scripts/migrate-afcrashpad-workspace.ts --verify     # assert post-backfill invariants
 *   npx tsx scripts/migrate-afcrashpad-workspace.ts --apply --delete-bare-settings  # post-cutover only
 *
 * RUN ORDER: staging (--apply, --verify) → confirm app renders data → prod
 * (fresh export first, --apply, --verify). See docs/migration/single-org-gating.md.
 */

import { config } from "dotenv"
config({ path: ".env.local" })

import * as admin from "firebase-admin"
import { getFirestore } from "firebase-admin/firestore"

// ── Config ──
const WORKSPACE_ID = process.env.DEFAULT_WORKSPACE_ID || "afcrashpad"
const WORKSPACE_NAME = "AFCrashpad"
const OWNER_EMAIL = "afcrashpad@gmail.com"
const BATCH_SIZE = 400 // Firestore hard limit is 500/batch

const APPLY = process.argv.includes("--apply")
const VERIFY = process.argv.includes("--verify")
const DELETE_BARE_SETTINGS = process.argv.includes("--delete-bare-settings")
const DRY_RUN = !APPLY && !VERIFY

// Collections that are NOT tenant-scoped data and must be skipped by the
// blanket stamper: `users` is GLOBAL identity (linked to a workspace only via
// workspace_members), `settings` is re-keyed separately, and the multi-tenant
// control collections key off their own ids.
const SKIP_STAMP = new Set([
    "users",
    "settings",
    "workspaces",
    "workspace_members",
])

// Subcollection (parent, sub) pairs that need workspaceId on every LEAF doc.
// Derived from the audit + adversarial verification. The collectionGroup
// targets (messages, documents, stages, document_folders) MUST be stamped or a
// tenant collectionGroup query returns nothing for them.
const SUBCOLLECTIONS: { parent: string; sub: string }[] = [
    { parent: "contacts", sub: "notes" },
    { parent: "contacts", sub: "timeline" },
    { parent: "contacts", sub: "messages" },        // collectionGroup target
    { parent: "contacts", sub: "documents" },       // collectionGroup target
    { parent: "contacts", sub: "document_folders" },// collectionGroup target
    { parent: "opportunities", sub: "payments" },
    { parent: "pipelines", sub: "stages" },         // collectionGroup target
    { parent: "military_bases", sub: "periods" },
    { parent: "tasks", sub: "comments" },
]

// Bare settings doc ids in AFCrashpad (confirmed by audit). Copied to
// settings/${WORKSPACE_ID}_${key}. NOTE: AFCrashpad has NO bare "integrations"
// doc; Vesta's provisionWorkspace expects one, so we seed it. The haro /
// oauth_gmail / reputation keys depend on Phase-5 re-layer code — see TODO.
const SETTINGS_KEYS = [
    "branding",
    "automations",
    "pipeline",
    "follow_up_reminders",
    "referrals",
    "commissions",
    "commission_rates",
]

// ── Firebase Admin Init (NAMED database) ──
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
if (!dbId) throw new Error("FIREBASE_DATABASE_ID is required (AFCrashpad uses a NAMED database)")
const adminDb = getFirestore(admin.app(), dbId) // ← named DB, the critical fix

function deepEqual(a: unknown, b: unknown): boolean {
    return JSON.stringify(a) === JSON.stringify(b)
}

async function stampCollection(name: string): Promise<{ total: number; stamped: number }> {
    const snap = await adminDb.collection(name).get()
    const need = snap.docs.filter((d) => d.data().workspaceId === undefined)
    if (!DRY_RUN && APPLY) {
        for (let i = 0; i < need.length; i += BATCH_SIZE) {
            const batch = adminDb.batch()
            for (const doc of need.slice(i, i + BATCH_SIZE)) {
                // update() (not set) → additive, never clobbers other fields.
                batch.update(doc.ref, { workspaceId: WORKSPACE_ID })
            }
            await batch.commit()
        }
    }
    return { total: snap.size, stamped: need.length }
}

async function stampSubcollection(parent: string, sub: string): Promise<{ total: number; stamped: number }> {
    const parents = await adminDb.collection(parent).get()
    let total = 0
    let stamped = 0
    for (const p of parents.docs) {
        const subSnap = await p.ref.collection(sub).get()
        total += subSnap.size
        const need = subSnap.docs.filter((d) => d.data().workspaceId === undefined)
        stamped += need.length
        if (!DRY_RUN && APPLY && need.length) {
            for (let i = 0; i < need.length; i += BATCH_SIZE) {
                const batch = adminDb.batch()
                for (const doc of need.slice(i, i + BATCH_SIZE)) {
                    batch.update(doc.ref, { workspaceId: WORKSPACE_ID })
                }
                await batch.commit()
            }
        }
    }
    return { total, stamped }
}

async function run() {
    console.log(`\n${DRY_RUN ? "🔍 DRY RUN" : VERIFY ? "✅ VERIFY" : "🚀 APPLY"} — AFCrashpad workspace backfill`)
    console.log(`   project=${process.env.FIREBASE_PROJECT_ID}  database=${dbId}  workspaceId=${WORKSPACE_ID}\n`)

    if (VERIFY) return verify()

    // ── Step 1: workspaces/afcrashpad (idempotent, merge) ──
    console.log("── Step 1: workspace doc ──")
    const ownerSnap = await adminDb.collection("users").where("email", "==", OWNER_EMAIL).limit(1).get()
    const ownerId = ownerSnap.empty ? null : ownerSnap.docs[0].id
    if (!ownerId) console.warn(`  ⚠ owner ${OWNER_EMAIL} has no users doc — ownerId will be null (set it after inviting).`)
    const wsDoc = {
        name: WORKSPACE_NAME,
        slug: WORKSPACE_ID,
        ownerId: ownerId || "unknown",
        plan: "max",           // unlimited internal plan — every feature/cap unlocked
        planStatus: "active",  // never set planExpiresAt (would trigger soft-demote to free)
        status: "active",
        templateSlug: "afcrashpad-traveler-placement",
        email_credit_balance: 25000,
        marketing_tier: "none",
        updatedAt: new Date(),
    }
    if (DRY_RUN) console.log(`  would set workspaces/${WORKSPACE_ID} (plan=max, ownerId=${ownerId})`)
    else if (APPLY) {
        await adminDb.collection("workspaces").doc(WORKSPACE_ID).set(
            { ...wsDoc, createdAt: new Date() }, { merge: true },
        )
        console.log(`  ✓ workspaces/${WORKSPACE_ID} (plan=max, ownerId=${ownerId})`)
    }

    // ── Step 2: workspace_members for every user (idempotent) ──
    console.log("\n── Step 2: memberships ──")
    const users = await adminDb.collection("users").get()
    // Only REAL accounts have an email (sign-in looks users up by email). Some
    // docs in `users` are stray preference fragments (only onboardingCompleted /
    // setupChecklistDismissed, written under a non-user id by old client code) —
    // they are NOT real users and must not get memberships.
    const realUsers = users.docs.filter((u) => typeof u.data().email === "string" && u.data().email)
    const junk = users.size - realUsers.length
    if (junk) console.log(`  ⏭ skipping ${junk} non-user pref fragment(s) in users/ (no email)`)
    let members = 0
    for (const u of realUsers) {
        const exists = await adminDb.collection("workspace_members")
            .where("userId", "==", u.id).where("workspaceId", "==", WORKSPACE_ID).limit(1).get()
        if (!exists.empty) continue
        const email = u.data().email
        const role = email === OWNER_EMAIL ? "OWNER" : (u.data().role || "AGENT")
        members++
        if (DRY_RUN) console.log(`  would add member ${email} (${role})`)
        else if (APPLY) {
            await adminDb.collection("workspace_members").add({
                workspaceId: WORKSPACE_ID, userId: u.id, role,
                status: "active", joinedAt: u.data().createdAt || new Date(), invitedBy: null,
            })
            console.log(`  ✓ member ${email} (${role})`)
        }
    }
    console.log(`  ${members} membership(s) ${DRY_RUN ? "would be " : ""}created (of ${realUsers.length} real user(s); ${users.size} total docs)`)

    // ── Step 3: stamp every tenant-scoped top-level collection (DYNAMIC) ──
    // Discover collections at runtime so we can never miss one (the verifier's
    // key fix — the hand-written lists missed pipelines, document_folders, etc.)
    console.log("\n── Step 3: top-level collections ──")
    const rootCols = await adminDb.listCollections()
    let topTotal = 0
    for (const col of rootCols.sort((a, b) => a.id.localeCompare(b.id))) {
        if (SKIP_STAMP.has(col.id)) { console.log(`  ⏭ ${col.id} (skipped)`); continue }
        const { total, stamped } = await stampCollection(col.id)
        topTotal += stamped
        console.log(`  ${stamped ? "✓" : "·"} ${col.id}: ${stamped}/${total} ${DRY_RUN ? "to stamp" : "stamped"}`)
    }
    console.log(`  ${topTotal} top-level docs ${DRY_RUN ? "to stamp" : "stamped"}`)

    // ── Step 4: stamp subcollection leaves (collectionGroup-critical) ──
    console.log("\n── Step 4: subcollection leaves ──")
    let subTotal = 0
    for (const { parent, sub } of SUBCOLLECTIONS) {
        const { total, stamped } = await stampSubcollection(parent, sub)
        subTotal += stamped
        console.log(`  ${stamped ? "✓" : "·"} ${parent}/{id}/${sub}: ${stamped}/${total} ${DRY_RUN ? "to stamp" : "stamped"}`)
    }
    console.log(`  ${subTotal} subcollection docs ${DRY_RUN ? "to stamp" : "stamped"}`)

    // ── Step 5: copy settings → ${ws}_${key} (KEEP bare docs for rollback) ──
    console.log("\n── Step 5: settings re-key (copy, keep bare) ──")
    for (const key of [...SETTINGS_KEYS, "integrations"]) {
        const bare = await adminDb.collection("settings").doc(key).get()
        const targetRef = adminDb.collection("settings").doc(`${WORKSPACE_ID}_${key}`)
        const target = await targetRef.get()
        if (target.exists) { console.log(`  ⏭ settings/${WORKSPACE_ID}_${key} exists`); continue }
        if (!bare.exists) {
            // 'integrations' has no bare doc in AFCrashpad — seed the placeholder Vesta expects.
            if (key === "integrations") {
                if (DRY_RUN) console.log(`  would seed settings/${WORKSPACE_ID}_integrations`)
                else if (APPLY) { await targetRef.set({ setupCompleted: false, workspaceId: WORKSPACE_ID, createdAt: new Date() }); console.log(`  ✓ seeded settings/${WORKSPACE_ID}_integrations`) }
            } else console.log(`  ⏭ settings/${key}: no bare doc`)
            continue
        }
        if (DRY_RUN) console.log(`  would copy settings/${key} → settings/${WORKSPACE_ID}_${key}`)
        else if (APPLY) {
            await targetRef.set({ ...bare.data(), workspaceId: WORKSPACE_ID })
            console.log(`  ✓ copied settings/${key} → settings/${WORKSPACE_ID}_${key} (bare kept)`)
        }
    }
    // TODO (Phase 5 re-layer): confirm whether ported AF code reads
    // settings/${ws}_haro (vs haro_settings/default), settings/${ws}_oauth_gmail
    // (vs oauth_tokens/gmail → gmail_integrations/${ws}_${ownerId}), and
    // settings/${ws}_reputation. Migrate/seed those once the code path is known.

    // ── Step 6: derived counters ──
    console.log("\n── Step 6: counters ──")
    const contactCount = (await adminDb.collection("contacts").count().get()).data().count
    if (DRY_RUN) console.log(`  would set contactCount=${contactCount}, memberCount=${realUsers.length}`)
    else if (APPLY) {
        await adminDb.collection("workspaces").doc(WORKSPACE_ID).set(
            { contactCount, memberCount: realUsers.length }, { merge: true },
        )
        console.log(`  ✓ contactCount=${contactCount}, memberCount=${realUsers.length}`)
    }

    // ── Optional post-cutover cleanup: delete bare settings (deep-equal gated) ──
    if (DELETE_BARE_SETTINGS && APPLY) {
        console.log("\n── (post-cutover) deleting bare settings docs ──")
        for (const key of SETTINGS_KEYS) {
            const bare = await adminDb.collection("settings").doc(key).get()
            if (!bare.exists) continue
            const target = await adminDb.collection("settings").doc(`${WORKSPACE_ID}_${key}`).get()
            const bareData = { ...bare.data() }; delete (bareData as Record<string, unknown>).workspaceId
            const tgtData = { ...target.data() }; delete (tgtData as Record<string, unknown>).workspaceId
            if (target.exists && deepEqual(bareData, tgtData)) {
                await bare.ref.delete()
                console.log(`  ✓ deleted bare settings/${key}`)
            } else console.log(`  ⏭ settings/${key}: target missing or differs — NOT deleting`)
        }
    }

    console.log(`\n${DRY_RUN ? "🔍 DRY RUN complete — no writes made. Re-run with --apply on STAGING first." : "✅ APPLY complete. Now run --verify."}\n`)
}

async function verify() {
    let failures = 0
    const fail = (m: string) => { console.error(`  ❌ ${m}`); failures++ }
    const ok = (m: string) => console.log(`  ✓ ${m}`)

    // Every top-level tenant collection: all docs carry the workspaceId.
    const rootCols = await adminDb.listCollections()
    for (const col of rootCols) {
        if (SKIP_STAMP.has(col.id)) continue
        const total = (await col.count().get()).data().count
        const scoped = (await adminDb.collection(col.id).where("workspaceId", "==", WORKSPACE_ID).count().get()).data().count
        if (total !== scoped) fail(`${col.id}: ${scoped}/${total} carry workspaceId`)
        else if (total) ok(`${col.id}: ${scoped}/${total}`)
    }

    // collectionGroup targets: every leaf carries workspaceId. Fetch via an
    // UNFILTERED collectionGroup query (no custom index needed) and check in
    // memory — avoids requiring a single-field COLLECTION_GROUP index on
    // workspaceId (which the app's real queries don't need, since they filter
    // with a composite index).
    for (const sub of ["messages", "documents", "stages", "document_folders"]) {
        const snap = await adminDb.collectionGroup(sub).get()
        const raw = snap.size
        const scoped = snap.docs.filter((d) => d.data().workspaceId === WORKSPACE_ID).length
        if (raw !== scoped) fail(`collectionGroup(${sub}): ${scoped}/${raw} carry workspaceId`)
        else ok(`collectionGroup(${sub}): ${scoped}/${raw} (${raw} leaves)`)
    }

    // Memberships ≥ real users (email-bearing); settings copied; workspace on max.
    const usersSnap = await adminDb.collection("users").get()
    const realUsers = usersSnap.docs.filter((u) => typeof u.data().email === "string" && u.data().email).length
    const mem = (await adminDb.collection("workspace_members").where("workspaceId", "==", WORKSPACE_ID).where("status", "==", "active").count().get()).data().count
    if (mem < realUsers) fail(`memberships ${mem} < real users ${realUsers}`); else ok(`memberships ${mem} ≥ real users ${realUsers}`)
    // Only flag a settings key if a BARE doc exists but its workspace-scoped
    // copy is missing. Keys with no bare doc (never configured in AFCrashpad)
    // are correctly absent — Vesta uses defaults for those.
    for (const key of SETTINGS_KEYS) {
        const bare = (await adminDb.collection("settings").doc(key).get()).exists
        const scoped = (await adminDb.collection("settings").doc(`${WORKSPACE_ID}_${key}`).get()).exists
        if (bare && !scoped) fail(`settings/${WORKSPACE_ID}_${key} missing (bare settings/${key} exists but wasn't copied)`)
        else if (scoped) ok(`settings/${WORKSPACE_ID}_${key}`)
    }
    const ws = (await adminDb.collection("workspaces").doc(WORKSPACE_ID).get()).data()
    if (ws?.plan !== "max") fail(`workspace plan is ${ws?.plan}, expected max`); else ok(`workspace plan=max`)

    console.log(`\n${failures ? `❌ VERIFY FAILED: ${failures} issue(s)` : "✅ VERIFY PASSED"}\n`)
    if (failures) process.exitCode = 1
}

run().catch((e) => { console.error(e); process.exit(1) })
