# Phase 2 — Deploy Firestore indexes to the named DB

AFCrashpad currently has **no composite indexes**. Vesta's code issues `workspaceId`-first
tenant queries that REQUIRE composite indexes — without them, every list page throws
"needs index" and renders empty. This deploys the 68 indexes (incl. 5 collectionGroup) to
the **named** database `afcrashpadcrm` (NOT `(default)`).

Config is already set: `firebase.json` → `firestore.database = "afcrashpadcrm"`, and
`.firebaserc` → default project `afcrashpad-crm-6c216`. CLI v15.17.0 supports this.

## Steps (you run these — they need your Google login)

```bash
cd "<repo path>"          # ~/Desktop/AFCrashpad CRM (or ~/Projects/... if you moved it)

# 1. Authenticate with the Google account that owns afcrashpad-crm-6c216
firebase login

# 2. Sanity-check the project + that the named DB exists
firebase projects:list
firebase firestore:databases:list --project afcrashpad-crm-6c216
#    → confirm a database named "afcrashpadcrm" is listed

# 3. Deploy ONLY the indexes (scoped — does NOT touch storage rules or data)
firebase deploy --only firestore:indexes --project afcrashpad-crm-6c216
#    If it asks to DELETE indexes not in the file: there should be none to delete
#    (AFCrashpad had no indexes). Review the list before confirming.

# 4. Confirm every index is Enabled (not Building) BEFORE the backfill verify / smoke test
#    NOTE: requires --database (without it, defaults to nonexistent (default) DB → 404)
firebase firestore:indexes --project afcrashpad-crm-6c216 --database afcrashpadcrm
#    (or console: https://console.firebase.google.com/project/afcrashpad-crm-6c216/firestore/databases/afcrashpadcrm/indexes )
```

## Important notes
- **Indexes only.** We deliberately scope to `firestore:indexes`. Do **NOT** run a bare
  `firebase deploy` yet — `firebase.json` also references `storage.rules` (Vesta's
  default-deny rules), and deploying those could change/break AFCrashpad's existing client
  upload paths (DocumentManager). Storage rules get reviewed separately in Phase 5.
- **No Firestore security rules** are deployed (there's no `firestore.rules` file and
  `firebase.json` doesn't reference one) — your existing console rules are untouched.
- **CollectionGroup indexes** (`documents`, `messages`, `members`) will only contain entries
  once those leaf docs carry `workspaceId` (Phase 3 backfill). Creating the index
  definitions now is correct — deploy them before the backfill.
- **`stages` collectionGroup index is NOT in Vesta's file.** AFCrashpad's reporting uses
  `collectionGroup("stages")`; we'll add that index when we re-layer AF reporting in Phase 5.
- Deploying indexes is **additive and safe** — it creates index definitions, never touches
  documents.

## After this
Indexes Enabled → ready for Phase 3 (run the backfill `--apply` + `--verify` on a staging
copy, then prod). See `scripts/migrate-afcrashpad-workspace.ts`.
