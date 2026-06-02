# Vesta CRM — Post-Launch Roadmap

Planning doc for features sketched out but not yet built. Each item is
implementable as-is — when you're ready, give it the green light and
the plan walks the implementer through scope, data model, and risks.

Last updated: 2026-05-18.

---

## Plan A — Support access grant

**Goal:** A workspace owner can hand a tightly-scoped, time-bound key
to your support team. Support uses it to act inside the workspace,
every action is logged, owner can revoke any time.

### Data model

New collection `support_grants/{grantId}`:

```ts
{
  workspaceId: string
  grantedBy: { userId, email, name }
  grantedAt: timestamp
  expiresAt: timestamp                   // owner picks 1h / 8h / 24h / 7d
  status: "active" | "revoked" | "expired"
  revokedAt?: timestamp
  revokedBy?: { userId, email }
  scope: "read" | "full"                 // v1 ships "full" only; "read" is future
  supportEmail?: string                   // optional: lock to one agent email
  lastUsedAt?: timestamp
  useCount: number
  tokenHash: string                       // sha256 of the token, never the raw token
}
```

Audit collection `support_audit_log/{eventId}`:

```ts
{
  grantId, workspaceId,
  agentUserId, agentEmail,
  action: "session_start" | "session_end" | "page_view" | "mutation"
  entity?: string                         // e.g. "contact", "deal"
  entityId?: string
  method?: string                         // "update" | "delete" | "create"
  path?: string                           // route or server-action name
  ip, userAgent,
  at: timestamp
}
```

### API surface

**Owner side** (`/settings/workspace/support-access`):

- `POST /api/support-grants` — owner-only. Body: `{ duration: "1h"|"8h"|"24h"|"7d", scope, supportEmail? }`. Returns the raw token ONCE (rest of the codebase only sees the hash).
- `GET /api/support-grants` — list active + expired grants for this workspace.
- `DELETE /api/support-grants/[id]` — revoke immediately; kicks any active session.

**Support side** (`/support/login` route, allowlisted by `SUPPORT_AGENT_EMAILS` env var):

- Agent signs in via Google (normal auth) → lands on a page where they paste the grant token.
- `POST /api/support-grants/redeem` — validates token hash, expiry, agent email match (if scoped). On success, sets a new JWT claim `supportingWorkspaceId` alongside the agent's normal session.

### Server enforcement

Modify `getAuthSession()` / `requireAuth()` to return `{ user, actAsWorkspaceId }`. Wherever code reads `session.user.workspaceId`, swap in `actAsWorkspaceId` if present.

The `tenantDb` Proxy from the prelaunch audit already covers cross-workspace writes — support sessions are tenant-scoped to the supported workspace automatically, so existing IDOR protection still applies. The only NEW work is logging: wrap mutation paths with a write to `support_audit_log` whenever the session is a support session.

### UI surface

- **Banner**: red bar across the top of every authed page when `actAsWorkspaceId` is set: *"Support session — agent@vesta.com helping until 4:32 PM. [End session]"*
- **Owner dashboard**: `/settings/workspace/support-access` shows active grants, revoke buttons, and an audit-log viewer (last 100 actions taken by support).
- **Setup**: "Grant support access" button → modal with duration picker → shows token in a one-time-reveal box with copy button.

### Security & gotchas

- Token is HMAC-signed with `SUPPORT_GRANT_SECRET`; validates against `tokenHash` in the doc on redeem.
- Owner can email the token directly (modal has a "Send to support@vestacrm.com" button) so the agent never sees a raw paste flow that risks phishing.
- Auto-expire enforced both by the cron purge and by every request check.
- Support agents are gated by email allowlist — workspace owners can't grant access to arbitrary external addresses.
- Audit log retention: 1 year minimum for compliance.
- The grant token is shown exactly ONCE; if lost, owner regenerates.

### Phased delivery

1. **v1 (1–2 days):** full-scope grant only, support agents via email allowlist, audit log writes on all mutations, banner UI, revoke button.
2. **v2:** read-only scope, granular per-resource scopes, support-agent dashboard for handling multiple workspaces.
3. **v3:** video-call session link integrated, screen co-pilot.

### New env vars

- `SUPPORT_GRANT_SECRET` — HMAC signing key. Generate: `openssl rand -base64 32`.
- `SUPPORT_AGENT_EMAILS` — comma-separated allowlist (e.g. `support@vestacrm.com,danny@vesta.com`).

---

## Plan B — Product analytics + admin insights

**Goal:** Know what users do, where they get stuck, and which workspaces
are healthy vs about to churn. Two layers: event tracking (PostHog) and
an internal `/admin/insights` dashboard.

### Tooling choice

**PostHog Cloud** — pick over Mixpanel/Amplitude because:

- Generous free tier (1M events/mo).
- Self-hostable later if you want.
- Includes session replay, feature flags, funnels, retention cohorts in one tool.
- 5-minute install.

Env vars to add: `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com`.

### Events to instrument (v1, ~25 events)

**Onboarding funnel** — most important:

- `signup_started` (page view)
- `signup_completed` (after registerUser success) — props: `plan_intent`
- `setup_completed` — props: `path: "demo"|"fresh"`
- `first_contact_created`
- `first_deal_created`
- `first_email_sent`
- `first_automation_created`

**Plan + billing:**

- `pricing_page_viewed`
- `upgrade_clicked` — props: `from_tier`, `to_tier`, `cadence`
- `checkout_started`
- `checkout_completed`
- `customer_portal_opened`
- `plan_changed` (server-side from Stripe webhook → POST to PostHog server-side API)
- `subscription_canceled`

**Feature adoption** (one per major feature):

- `automation_published`, `automation_enrolled_run`
- `campaign_sent`, `campaign_opened` (server-side, from tracking)
- `ai_write_used` — props: `feature: "inline_email"|"sms"|"subject"`, `tokens_used`
- `csv_import_completed` — props: `created`, `restored`, `skipped`
- `contact_merged`
- `document_signed`

**Health signals:**

- `error_displayed` (whenever `toast.error` fires — wrap `toast.error` to also capture)
- `feedback_submitted` — props: `kind: "bug"|"idea"|"other"`
- `support_grant_created` (when it ships)

### User + workspace identification

```ts
posthog.identify(userId, {
    email, name, role,
    workspace_id: workspaceId,
    workspace_name,
    plan, plan_status,
    workspace_created_at,
})
posthog.group("workspace", workspaceId, {
    name, plan, member_count, contact_count, created_at,
})
```

The `group` identification lets you build cohorts like "all Pro workspaces" or "workspaces with <10 contacts."

### Privacy considerations (this part matters for a CRM)

- **Never send contact/deal contents to PostHog** — no names, emails of CRM records, deal values, message bodies. Only counts and aggregate metadata.
- **Mask form inputs** in session replay — PostHog auto-masks `<input>` by default; verify and lock down.
- **Disable session replay** on `/communications`, `/contacts/[id]`, `/sign/[token]`, `/marketing/email/templates/*` — these surface customer data.
- Add a `data-ph-no-capture` attribute to any element rendering customer data.
- Workspaces should be able to opt out via Settings → Privacy → "Disable usage analytics."
- Document the analytics behavior in the privacy policy update.

### `/admin/insights` dashboard (operator-only)

Gated by `OPERATOR_EMAILS` env var allowlist (your team only). Pulls from Firestore + Stripe directly, no PostHog dependency:

**Top-level metrics:**

- MRR / ARR (from Stripe subscriptions)
- Active workspaces (signed in last 7d)
- New signups this week / month
- Free → Paid conversion rate (cohorted by signup week)

**Workspace list table** with columns:

- Workspace name + owner email
- Plan + status
- Contact count vs cap
- Last active timestamp
- MRR contribution
- Health flag: `churn_risk` (no activity 14d), `cap_approaching` (>80% contacts), `engaged` (used core feature this week)

Each row links to a workspace detail page with:

- Audit log of recent activity
- Plan history
- Feature adoption checklist
- Stripe customer link
- (If support grant feature ships) "Grant support access" button if owner has invited you

**Funnel views** (built on top of PostHog data):

- Signup → setup_completed → first_contact → first_deal → first_email → first_paid
- Pricing page → upgrade_clicked → checkout_started → checkout_completed
- Free → Pro conversion by signup week

### Phased delivery

1. **v1 (half day):** install PostHog, instrument the 7 onboarding-funnel events, identify users + groups, ship.
2. **v2 (one day):** instrument the rest (feature adoption + billing + health signals), wrap `toast.error` for `error_displayed`.
3. **v3 (one to two days):** build `/admin/insights` dashboard with workspace table + health flags, gated by operator email allowlist.
4. **v4:** PostHog feature flags integrated for gradual rollouts + A/B testing of onboarding copy.

### New env vars

- `NEXT_PUBLIC_POSTHOG_KEY` — PostHog project API key (public).
- `NEXT_PUBLIC_POSTHOG_HOST` — usually `https://us.i.posthog.com`.
- `POSTHOG_API_KEY` — server-side personal API key (for the server-side webhook events).
- `OPERATOR_EMAILS` — comma-separated allowlist for `/admin/insights`.

---

## Suggested order

1. **Analytics v1** (half day) — install PostHog and instrument the 7 onboarding events. Immediate value during the tester phase, low scope.
2. **Tester feedback synthesis** — let real submissions through the feedback portal shape what's actually broken / missing.
3. **Support access grant v1** (1–2 days) — ship when you have a paying customer asking for it OR when tester feedback shows you're spending too much time getting context to help debug.
4. **Analytics v2 + admin insights** (2 days) — once you have ≥10 paying workspaces and need a real "who's healthy / who's churning" view.
