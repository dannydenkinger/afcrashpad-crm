# Vesta CRM — Pre-Launch Manual QA Checklist

A repeatable smoke test you (or a test user) can run through to catch what
code-only review misses. Run this on `main` before any launch. Each section
is one workflow; tick the boxes as you go. Note expected outcomes vs what
you actually see.

**How to use this doc:**
- Sections are ordered by user importance (auth first, marketing last)
- Each box is a discrete user action with an explicit expected result
- "🐞 Known issue" items are tracked in our punch list — don't re-flag
- "💡 Watch for" items are subtler things that often break
- Test on **both desktop and mobile** for every section. Mobile
  responsiveness is where most CRMs die.

---

## 0. Environment sanity check

Before any user-facing testing:

- [ ] Firebase Storage smoke test passes: `npx tsx scripts/smoke-upload.ts`
- [ ] App builds cleanly: `npm run build` (no warnings beyond noise)
- [ ] Type-check is green: `npx tsc --noEmit`
- [ ] CORS is applied: re-run `npx tsx scripts/setup-storage-cors.ts` and verify output
- [ ] Verify the Vercel deployment matches the latest `main` SHA

---

## 1. First-run setup

**Goal:** A brand-new owner can register, get into the app, and see something useful.

- [ ] Hit `/register` from a logged-out browser
- [ ] Submit form with email + password + workspace name → redirects to `/setup` (or `/dashboard` if marked complete)
- [ ] Setup wizard renders with steps; pick a snapshot template → seeds pipeline + statuses + custom fields without errors
- [ ] Skip Google connection step → can still proceed
- [ ] Connect Google → redirects back to wizard, shows connected state, picks GA4 property + GSC site
- [ ] Finishing wizard lands on `/dashboard` with default widgets visible
- [ ] Refresh the page mid-wizard — does it remember the step you were on? (Known: doesn't)
- [ ] Sign out → sign back in → `/setup` doesn't re-fire

**💡 Watch for:** the snapshot picker silently failing; setup status mismatch between cookie and Firestore; missing "skip for now" affordances.

---

## 2. Login + Auth

- [ ] `/login` with valid credentials → `/dashboard`
- [ ] Wrong password → clear error, password field preserved
- [ ] "Forgot password?" link opens explanatory modal (no real reset flow yet — confirm copy is honest)
- [ ] Google sign-in flow → consent screen → callback → `/dashboard`
- [ ] Logout from any page → `/login`
- [ ] Hit a protected URL while logged out → redirects to `/login` with `?callbackUrl=` preserved

**💡 Watch for:** workspace context bleed across tabs (open two workspaces in two tabs — actions in one shouldn't leak to the other).

---

## 3. Contact lifecycle

**Create**
- [ ] `/contacts` → "New contact" → fill name + email + phone → save → row appears at top of list
- [ ] Quick-add via header search (if it exists) → contact created
- [ ] CSV import via `/settings/data` → upload a 5-row CSV → all rows imported with correct field mapping
- [ ] Form submission via `/forms/[id]` (test publicly) → contact created with `source: "form"`

**Edit**
- [ ] Click a contact row → detail sheet opens
- [ ] Inline edit name/email/phone → tab away → auto-saves
- [ ] Add a tag → persists across reload
- [ ] Toggle DND with each preset (1h / today / 3d / 1w) → moon icon shows on row
- [ ] Set custom date for DND → persists

**Activity**
- [ ] Add a note → appears at top of timeline
- [ ] Edit a note → updates in place
- [ ] Delete a note → "Note deleted" entry appears in timeline
- [ ] Click "Call" → tel: link opens (test on a real phone) + log dialog pops
- [ ] Save call log with each outcome → appears on timeline with right icon
- [ ] "Request review" button → only visible if a review URL is set in `/settings/reputation`
- [ ] Send review request → email actually arrives at the contact's address
- [ ] Bulk select 3 contacts → "Send email" → BulkEmailDialog opens with 3 recipients (filters out DND)
- [ ] Bulk delete → confirms, removes from list

**Convert to opportunity**
- [ ] From contact detail → "New opportunity" → opens deal sheet pre-linked
- [ ] Save deal → appears on `/pipeline` in the right stage

---

## 4. Pipeline lifecycle

- [ ] `/pipeline` → kanban renders with all stages
- [ ] Stage column headers show count + value rollup + % of pipeline
- [ ] Drag a deal between stages → updates server-side (refresh confirms)
- [ ] Click deal → sheet opens, shows correct values
- [ ] Edit deal value → save → kanban card and stage rollup both update
- [ ] Edit profit margin → auto-fills 25% if blank, locks to custom if user typed
- [ ] Status dropdown (top of sheet) → mark Won → card disappears from open stages, shows in Closed Won filter
- [ ] Mark Lost → same treatment
- [ ] Mark Archive → hidden from default view
- [ ] Switch to List view → same data, table layout, sortable columns
- [ ] Bulk select → bulk move stage → all deals update
- [ ] Bulk delete → confirms, removes
- [ ] Click "Analytics" → sheet opens, shows funnel + win rate; padding looks right

**💡 Watch for:** drag-drop on touch devices; horizontal scroll buttons on long pipelines; density picker actually changes column widths.

---

## 5. Calendar + Appointments

- [ ] `/calendar` → month view renders with current month
- [ ] Switch to week / day → views actually change
- [ ] Click a cell → "New event" dialog opens with the date pre-filled
- [ ] Create a task with due date → appears as orange chip on the calendar
- [ ] Create an event with start + end → appears as indigo chip
- [ ] Drag a task to a different day → reschedules (touch on mobile too)
- [ ] Click an event → modal opens with details
- [ ] Tasks tab → renders the full tasks page inside the calendar shell
- [ ] Bookings tab → renders the bookings calendar
- [ ] Appointments tab → lists all booking-page appointments
  - [ ] Filter chips (Upcoming / Past / All) work
  - [ ] Search by name or email filters live
  - [ ] "New appointment" → dialog with name/email/time/duration/notes → saves and shows in list + on calendar
  - [ ] Cancel an appointment → status flips, event disappears from calendar (after refresh)
  - [ ] "Open contact" link goes to the right contact

---

## 6. Communications

- [ ] `/communications` → conversation list renders, shows unread count
- [ ] Click a conversation → thread loads
- [ ] If thread fails → error panel with Try again button
- [ ] Type a message + send → appears in thread, conversation moves to top
- [ ] Switch to Email type → subject field appears
- [ ] Insert a snippet → text appears in composer
- [ ] Schedule a message → toast says "Scheduled for [readable time]"
- [ ] Open snippets manager → create/edit/delete a snippet → reflected in composer dropdown
- [ ] Send fails (e.g., kill internet) → toast surfaces actual error, draft is preserved

**💡 Watch for:** message ordering when send + receive interleave; attachment URLs that 404 after re-deploy; the realtime refresh actually picking up new messages within ~30s.

---

## 7. Documents

- [ ] `/documents` → list renders
- [ ] "Upload document" → pick a file → uploads via signed URL flow → appears in list with "Uploaded" status
- [ ] Try a 10MB file → confirms the Vercel-bypass works
- [ ] Try a wrong file type (e.g., .exe) → rejected with clear error
- [ ] Click an uploaded doc → preview / download works
- [ ] Create a folder → appears in tree
- [ ] Drag a doc into the folder → moves
- [ ] Generate from template → opens editor, save, status = Draft
- [ ] Send for e-signature → recipient gets email with link → opens at `/sign/[token]`
- [ ] Sign on mobile → signature persists, status flips to Signed
- [ ] Same upload flow on contact detail Documents tab → works
- [ ] Same upload flow on opportunity Docs tab → works

**💡 Watch for:** the upload progress indicator (currently shows spinner only — no per-file progress); partial-batch failures showing the right toast; upload dialog staying open on partial failure for retry.

---

## 8. Email Marketing

- [ ] `/marketing/email` → hub renders with KPIs, quick links, campaigns list
- [ ] If SES not verified → amber "SES is not set up" banner with Configure link
- [ ] `/marketing/email/sequences` → renders email-led automations only (filters out non-email triggers)
- [ ] `/marketing/email/templates` → list, create new, drag-drop editor saves
- [ ] `/marketing/email/lists` → create list, add contacts, view list members
- [ ] Import members via CSV → success/failure counts accurate
- [ ] `/marketing/email/suppressions` → bulk add suppressions
- [ ] Create a campaign → pick template, pick list, schedule → preflight checks fire (no SES → blocks send)
- [ ] After send → stats (sent / opens / clicks) update within ~30s

---

## 9. Marketing Analytics / SEO / Blog / HARO / Social

- [ ] `/marketing/analytics` → if GA4 connected, charts render; if not, "Connect Google Analytics" empty state
- [ ] `/marketing/seo` → if GSC connected, overview shows clicks/impressions; if not, dismissible amber banner
- [ ] Keywords / Competitors / Backlinks tabs → each works without GSC
- [ ] `/marketing/blog` → if WordPress not connected, dismissible banner; can still write articles
- [ ] AI Generate dialog → produces content, saves as draft
- [ ] Publish to WordPress (only if connected)
- [ ] `/marketing/haro` → if Gmail not connected, dismissible banner; if connected, fetch fires
- [ ] `/marketing/social` → if Zernio not connected, "Connect accounts" prompt

---

## 10. Automations engine

This is the highest-risk area — automations send emails to real people on a
schedule. **Test in a sandbox workspace with test-only contacts.**

- [ ] `/automations` → list of existing automations
- [ ] Create new → builder opens
- [ ] Pick a trigger (e.g. contact_created)
- [ ] Add an email step → save → toast confirms
- [ ] Toggle enable → button reflects state
- [ ] **Trigger fires:** create a new contact via `/contacts` → automation enrolls them within ~10s
- [ ] **Wait step works:** add a 1-minute wait + second email → second email arrives ~1 minute later (NOT instantly)
- [ ] **Branch_if works:** add an if-then on tag → contact with tag goes one path, without goes another
- [ ] **Stop_if works:** unsubscribed contact halts mid-sequence
- [ ] **Re-enrollment off:** add same contact twice via two triggers → only one run
- [ ] **Re-enrollment on:** same as above → two runs
- [ ] **Move-to-stage action:** verify the deal actually moved
- [ ] Delete the contact mid-run → run doesn't crash the engine; check run history shows what happened
- [ ] Disable automation while runs in flight → runs stop cleanly
- [ ] Run history page → shows recent runs with status (running / waiting / completed / errored)
- [ ] Click a run → can see which step it's on / which step failed

**🐞 Known issues to watch for** (engine audit found these):
- Race condition on simultaneous trigger fires can create duplicate runs
- Goal exit only fires at trigger time, not mid-run
- Webhook node failures silently advance instead of halting
- Stats counters can get stale on crash mid-update
- `isContactEnrolled` counts completed runs too — re-enrollment is blocked unless toggled on

---

## 11. Settings

- [ ] `/settings` → all tiles render based on role
- [ ] **Profile** → name, photo, notification prefs save
- [ ] **Branding** → logo upload, colors, footer save and apply to email previews
- [ ] **Workspace** → snapshot picker; pipeline edit; custom fields CRUD; required docs CRUD; statuses CRUD; tags CRUD; lead sources CRUD
- [ ] **Team** → invite by email → invitation email sends, link works, new user lands at sign-up
- [ ] **Team** → set role (Owner / Admin / Agent) → permissions actually enforced (try restricted action as Agent)
- [ ] **Team** → audit log shows recent admin actions
- [ ] **Integrations** → connect Google → status flips to Connected
- [ ] **Integrations** → SES verify → DNS records shown, verification status updates
- [ ] **Integrations** → API keys → create, copy, revoke
- [ ] **Booking** → save config; add multiple appointment types; test public URL; confirm confirmation email arrives
- [ ] **Reputation** → save review URLs; "Request review" button on contact uses them
- [ ] **Data** → CSV imports work; full JSON backup downloads

---

## 12. Mobile

For each of the above sections, repeat on a phone (or Chrome DevTools mobile
emulation):

- [ ] Sidebar collapses into a hamburger menu
- [ ] Detail sheets open as full-screen sheets, not narrow drawers
- [ ] Touch drag-and-drop works (kanban, calendar)
- [ ] Forms don't get cut off by the keyboard
- [ ] Status bar overlap doesn't hide top buttons (`safe-top` should handle this)
- [ ] Pull-to-refresh doesn't break inside scroll containers

---

## 13. Multi-tenant isolation

**Critical for any multi-workspace setup.** Sign in as User A in Workspace 1,
then User B in Workspace 2 (separate browser profiles).

- [ ] User A cannot see User B's contacts (confirm via direct URL `/contacts/<contactId>` from B's workspace)
- [ ] User A cannot see User B's automations
- [ ] User A cannot edit User B's settings
- [ ] User A cannot see User B's documents
- [ ] User A cannot enroll User B's contacts in their automations

If any of these leak, that's a 🚨 ship-stopper.

---

## When something fails

1. Note the workflow + step + actual vs expected
2. Check browser console for errors (often the real story)
3. Check Vercel function logs if it's a server action
4. File against the punch list — don't fix in-place during QA

---

## Sign-off

When all sections pass without 🚨 blockers and 🔴 functional bugs are
either fixed or accepted as known limitations, you're ready to soft-launch
to the test-user list (Google OAuth verification stays in test mode for
now — see `verify with Google` notes).
