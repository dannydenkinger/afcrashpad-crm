# Your action items (Vesta → AFCrashpad migration)

Three tasks. Do them in this order. Each says how to know it worked.
Project: `afcrashpad-crm-6c216` · Named database: `afcrashpadcrm`

---

## ✅ Task 1 — Back up your live data (do this first)

A point-in-time snapshot you can restore from. Nothing else touches production until this exists.

### Easiest: Google Cloud Console (no CLI)
NOTE: AFCrashpad uses a NAMED database `afcrashpadcrm` (there is NO `(default)` database — a
link to the default DB will say "database not found"). Use the database-scoped link:
1. Open the database list: https://console.cloud.google.com/firestore/databases?project=afcrashpad-crm-6c216
2. Click the **afcrashpadcrm** database.
3. Left sidebar → **Import/Export** → **Export**.
4. Scope: **Entire database**. Destination: **Browse** → create/select bucket `afcrashpad-crm-6c216-backups` → **Export**.
5. **Worked?** The **Operations** tab shows the export with state **Succeeded**.

   (Direct link: https://console.cloud.google.com/firestore/databases/afcrashpadcrm/import-export?project=afcrashpad-crm-6c216 )

### Or via CLI (if you have gcloud installed)
```bash
gcloud --version          # if "command not found", use the Console method above
gcloud config set project afcrashpad-crm-6c216
gcloud firestore export gs://afcrashpad-crm-6c216-backups/pre-migration --database=afcrashpadcrm
gcloud firestore operations list --database=afcrashpadcrm   # look for done: true
```

---

## ✅ Task 2 — Deploy the database indexes (Phase 2)

Your DB currently has no composite indexes; the new code needs them or pages render empty.
Config is already set to target the named DB.

```bash
cd ~/Desktop/"AFCrashpad CRM"

firebase login

firebase deploy --only firestore:indexes --project afcrashpad-crm-6c216

firebase firestore:indexes --project afcrashpad-crm-6c216 --database afcrashpadcrm
```
- If asked to **delete** any indexes: choose **No** — those are your existing single-tenant indexes; keep them so `main` stays a working rollback.
- NOTE: `firestore:indexes` needs `--database afcrashpadcrm` (without it, it 404s on the nonexistent `(default)` DB).
- **Worked?** The last command lists indexes and they read **READY/Enabled** (not "Building"). Large index sets can take a few minutes to finish building.
- ⚠️ Run exactly `--only firestore:indexes`. Do **not** run a bare `firebase deploy` (that would also push storage rules, which we haven't reviewed yet).

---

## ✅ Task 3 — Move the project off iCloud (before the data backfill)

Your Desktop is iCloud-synced, which keeps creating `"name 2"` duplicate folders and already
corrupted `node_modules` once. Move it to stable storage before we run the real data migration.

```bash
mkdir -p ~/Projects
mv ~/Desktop/"AFCrashpad CRM" ~/Projects/

cd ~/Projects/"AFCrashpad CRM"
rm -rf node_modules
npm ci
```
- **Worked?** `npm ci` finishes without errors and `git status` still shows branch `migrate/duplicate-vesta`.
- Then **reopen the project in Claude Code from the new path** (`~/Projects/AFCrashpad CRM`) and tell me — we'll continue with the backfill from there.

Alternative if you'd rather not move it: System Settings → Apple ID → iCloud → "Desktop & Documents Folders" → turn **off**.

---

## After these three
Tell me when Task 2 shows indexes Enabled and you've reopened from the new path. Then we'll:
- Phase 3: run the backfill on a staging copy (`--apply` + `--verify`), confirm the app shows your data
- Phase 4: production cutover
- Phase 5/6 (I can start anytime): re-layer your military calculators/pipeline/fields + branding
