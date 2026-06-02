# Single-Org Gating Plan (Vesta → AFCrashpad)

Reference for Phase 1 gating edits. Decisions: single workspace `afcrashpad`, plan `max` (unlimited), Stripe dormant, SaaS surface gated off. KEEP all multi-tenant plumbing.

## Plan gating = ONE field
`src/lib/billing/plans-server.ts` `getWorkspacePlan()` reads `workspaces.<id>.plan` (default `free`). `"max"` = every feature true, every cap null (`src/lib/billing/plans.ts` PLANS.max).
- **Set `workspaces/afcrashpad` = `{ plan:"max", planStatus:"active", status:"active", name:"AFCrashpad" }`. Do NOT set `planExpiresAt`.**
- ⚠️ Soft-demote trap (`plans-server.ts:48-66`): `planStatus` `past_due`>14d or `canceled` past expiry silently demotes to `free`. Keep `planStatus:"active"` (or absent) and never write `planExpiresAt`.

## MUST DO BEFORE ANY LOGIN (workspace-minting landmines)
Four paths mint a NEW workspace; all must be pinned to `DEFAULT_WORKSPACE_ID="afcrashpad"`:
1. **`src/auth.ts` (245-293)** — Google auto-create branch: mints workspace (261-271) + OWNER membership (274-281) + `provisionWorkspace` (286). FIX: pin `token.workspaceId = process.env.DEFAULT_WORKSPACE_ID`, write membership against it, skip provisionWorkspace.
2. **`src/lib/auth-guard.ts` `ensureUserAndWorkspace` (47-85)** — fires from `getAuthSession()` (102) when no membership; mints workspace + provisionWorkspace (76-77). FIX: create membership against `DEFAULT_WORKSPACE_ID`, return it, never `add()` a workspace.
3. **`src/app/register/actions.ts` `registerUser` (88-114)** — mints workspace. FIX: disable self-signup (keep only invited-user password-set branch 57-64 if wanted). `register/page.tsx` → `redirect("/login")`; remove `/register` from `middleware.ts:11` publicRoutes.
4. **`src/app/settings/users/workspace-actions.ts` `createWorkspace` (18-99)** — gated by `requirePlan(...,"max")` (30) which SUCCEEDS at max → reachable. FIX: return `{success:false}` unconditionally.

⚠️ **`provisionWorkspace` clobber (`src/lib/workspace-defaults.ts:41`)**: `batch.set(settingsRef, {...data, createdAt})` WITHOUT `{merge:true}` over branding/integrations/automations/pipeline/commission_rates/follow_up_reminders/referrals → re-running wipes settings. Mitigation: never re-provision afcrashpad (handled by pinning 1-4). Defense-in-depth: add `{merge:true}`. Same caveat in `snapshots/apply.ts` (.set without merge).

Env / data: set `DEFAULT_WORKSPACE_ID=afcrashpad`; create `workspaces/afcrashpad`; run `provisionWorkspace("afcrashpad","AFCrashpad")` ONCE to seed; create OWNER `users` + `workspace_members`. Leave `OPERATOR_EMAILS`, `SUPPORT_AGENT_EMAILS`, `STRIPE_*` unset (admin/support/billing already fail-safe).

## SAFE BY DEFAULT (env-allowlist gated — just leave env unset)
- `/admin/**` — `admin/layout.tsx:11` `requireOperator()` → redirects to /dashboard when `OPERATOR_EMAILS` unset.
- `/support` — gates on `SUPPORT_AGENT_EMAILS`.
- Stripe webhook / checkout — dormant without keys.
- `/setup` WelcomeScreen — only loads sample data into existing workspace, does NOT mint one. Safe.

## GATE OFF (cosmetic / nav — after login works)
- `src/app/page.tsx` (Vesta marketing homepage) → `redirect("/login")`.
- `(public)/pricing` → notFound; remove from `middleware.ts:14` + `AppShell.tsx:35`. (privacy/terms/changelog/status/help low priority.)
- `settings/billing/page.tsx` → notFound (KEEP `actions.ts` getPlanStatus/openCustomerPortal — used by PaymentStatusBanner/useWorkspacePlan). Remove nav: `SettingsSubNav.tsx:40`, `settings/page.tsx:91-98`.
- `settings/reputation/page.tsx` → notFound; remove `SettingsSubNav.tsx:43`, `settings/page.tsx:107-114`.
- Zernio: `settings/integrations/zernio/page.tsx` → notFound; remove card `IntegrationsTab.tsx:216-227`.
- Feedback triggers: `Sidebar.tsx:286-289` (+import 8, render 297).
- `WorkspaceSwitcher.tsx` (`Sidebar.tsx:147`): remove "Create new workspace" (201-219); ideally replace switcher with static brand header.
- `login/page.tsx:172`: remove "Sign up" → /register link.

## KEEP UNTOUCHED
`tenant-db.ts`, `auth.ts` session config, `auth-guard.ts` (requireAuth/Admin/Role), `role-permissions.ts`, `feature-flags.ts`, `middleware.ts`, `snapshots/*`, observability. Booking/payout/sign/invite/forms/unsub = customer-facing CRM, keep enabled.
