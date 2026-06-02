/**
 * Automations — unified workflow engine for Vesta CRM.
 *
 * One model handles email drips AND pipeline-stage automations AND tag-based
 * workflows AND form-followup sequences. Email-send is one action type
 * alongside add-tag, wait, branch, etc.
 *
 * Data shapes (Firestore collections):
 *
 *   automations/{automationId}
 *     {
 *       workspaceId, name, description?, enabled,
 *       trigger: { type: TriggerType, config: {...} },
 *       nodes: AutomationNode[],          // ordered linear list (v1)
 *       stats: { runsStarted, runsCompleted, runsErrored, contactsEnrolled },
 *       createdBy, createdAt, updatedAt
 *     }
 *
 *   automation_runs/{runId}
 *     {
 *       workspaceId, automationId, contactId,
 *       contactEmail?,                     // captured at enroll for externals
 *       status: RunStatus,
 *       currentNodeIdx: number,            // index into automation.nodes
 *       scheduledFor?,                     // when status="waiting", wake-up time
 *       contextData: {...},                // accumulated payload from trigger + actions
 *       startedAt, updatedAt, completedAt?, errorMessage?
 *     }
 */

// ── Triggers ───────────────────────────────────────────────────────────────

export type TriggerType =
    | "contact_created"
    | "contact_added_to_list"
    | "tag_added"
    | "tag_removed"
    | "form_submitted"
    | "pipeline_stage_entered"
    | "opportunity_created"
    | "opportunity_won"
    | "opportunity_lost"
    | "opportunity_value_changed"
    | "opportunity_stale"
    | "email_opened"
    | "email_clicked"
    | "contact_field_updated"
    | "sms_replied"
    | "appointment_booked"
    | "birthday"
    | "anniversary"
    | "webhook_in"
    | "manual"

export interface TriggerConfig {
    /** Optional filter: only fire for events matching this id (list, tag, form, stage, campaign). */
    listId?: string
    tagId?: string
    formId?: string
    stageId?: string
    campaignId?: string
    pipelineId?: string
    /** For contact_field_updated: which field path to watch. */
    fieldPath?: string
    /** For opportunity_stale: how many days of inactivity counts as stale (default 14). */
    staleDays?: number
}

export interface Trigger {
    type: TriggerType
    config: TriggerConfig
}

// ── Actions / Nodes ────────────────────────────────────────────────────────

export type ActionType =
    | "send_email"
    | "ai_send_email"
    | "ai_classify"
    | "ai_score"
    | "ai_summarize"
    | "send_sms"
    | "wait"
    | "wait_until"
    | "wait_until_business_hours"
    | "add_tag"
    | "remove_tag"
    | "add_to_list"
    | "remove_from_list"
    | "branch_if"
    | "stop_if"
    | "update_contact_field"
    | "increment_field"
    | "assign_user"
    | "create_task"
    | "send_internal_email"
    | "update_opportunity"
    | "move_opportunity_to_stage"
    | "webhook"
    | "end"

export interface BaseNode {
    /** Stable local id, e.g. "n1". Used for branching destinations. */
    id: string
    type: ActionType
    /**
     * Optional persisted canvas position. When omitted, the canvas auto-lays
     * out by index. Set by drag in canvas view.
     */
    position?: { x: number; y: number }
    /**
     * Explicit next-step pointer. Overrides the implicit "fall through to
     * the next node in the array" behavior.
     *   undefined → linear fallthrough (default; preserves existing automations)
     *   null      → end of path (run completes)
     *   string    → jump to this nodeId
     * Branch_if uses trueNext/falseNext instead of this field.
     */
    next?: string | null
}

export interface SendEmailNode extends BaseNode {
    type: "send_email"
    /** Inline subject (tokens supported). */
    subject: string
    /** Inline HTML body (tokens supported). */
    html: string
    /** Optional: source template id (UI-only — full HTML is denormalized into html). */
    templateId?: string | null
}

/**
 * AI-generated email: Claude writes the body per recipient using the prompt,
 * then sends. Subject is fixed (tokens supported); the body is whatever the
 * model generates.
 *
 * Costs Anthropic API tokens per send (in addition to one email credit).
 * Use Haiku for high-volume / cost-sensitive flows; Sonnet for higher quality.
 */
export interface AiSendEmailNode extends BaseNode {
    type: "ai_send_email"
    /** Subject line (tokens supported, no AI). */
    subject: string
    /** What you want the AI to write. Includes contact context automatically. */
    prompt: string
    /** Anthropic model id. Defaults to claude-haiku-4-5 if omitted. */
    model?: "claude-haiku-4-5" | "claude-sonnet-4-6" | "claude-opus-4-7"
    /** Max tokens in the AI's response. Default 600. */
    maxOutputTokens?: number
}

/**
 * AI Classify — read a contact's data + the prompt, ask the AI which of
 * the listed options applies, and tag the contact with the chosen label.
 * Useful for routing inbound leads ("hot" vs "cold") or marking sentiment.
 */
export interface AiClassifyNode extends BaseNode {
    type: "ai_classify"
    /** Free-form instructions for the AI. e.g. "Classify this contact's intent". */
    prompt: string
    /** The list of allowed labels. AI picks one (and only one) of these. */
    options: string[]
    /** When true, the AI's chosen label is added to the contact as a tag. */
    addAsTag?: boolean
    /** When set, the chosen label is also stored in this custom field key. */
    storeInCustomField?: string | null
}

/**
 * AI Score — read a contact's data + the prompt, return an integer 0-100.
 * Stored on the contact as `aiScore` (or a custom field key) so other
 * nodes can branch on it. Conventional read: higher = better fit.
 */
export interface AiScoreNode extends BaseNode {
    type: "ai_score"
    /** What the score should reflect. e.g. "Score 0-100 how qualified this lead is for premium tier". */
    prompt: string
    /** Custom field key to store the score under. Defaults to "aiScore". */
    storeInCustomField?: string | null
}

/**
 * AI Summarize — collapses notes / messages / a chosen field into a short
 * summary stored back on the contact (or a custom field). Useful before
 * a sales call: one paragraph that captures everything the rep needs.
 */
export interface AiSummarizeNode extends BaseNode {
    type: "ai_summarize"
    /** What to summarize. The runtime substitutes contact tokens like {{notes}}. */
    sourceText: string
    /** Custom field key to store the summary in. Defaults to "aiSummary". */
    storeInCustomField?: string | null
    /** Max output length, in tokens. Default 200. */
    maxOutputTokens?: number
}

/** SMS via Twilio. Workspace must have Twilio creds in Settings. */
export interface SendSmsNode extends BaseNode {
    type: "send_sms"
    /** Message body. Tokens supported. Capped at 1600 chars on send. */
    body: string
}

export interface WaitNode extends BaseNode {
    type: "wait"
    /** Total minutes to wait. UI lets users enter days/hours/minutes; we store minutes. */
    delayMinutes: number
}

/** Wait until a specific calendar time (ISO string). */
export interface WaitUntilNode extends BaseNode {
    type: "wait_until"
    /** ISO 8601 datetime — the run resumes at or after this moment. */
    until: string
}

/**
 * Wait until the next business-hours window. If currently inside the window,
 * the run resumes immediately. Otherwise pauses until the next window open.
 */
export interface WaitUntilBusinessHoursNode extends BaseNode {
    type: "wait_until_business_hours"
    /** Hour (0-23) when the window opens, in the configured timezone. Default 9. */
    startHour?: number
    /** Hour (0-23) when the window closes. Default 17. */
    endHour?: number
    /** Days of week considered business days (0 = Sunday). Default [1,2,3,4,5]. */
    businessDays?: number[]
    /** IANA timezone name (e.g. "America/New_York"). Default UTC. */
    timezone?: string
}

export interface AddTagNode extends BaseNode {
    type: "add_tag"
    tagId: string
    tagName?: string
}

export interface RemoveTagNode extends BaseNode {
    type: "remove_tag"
    tagId: string
}

export interface AddToListNode extends BaseNode {
    type: "add_to_list"
    listId: string
}

export interface RemoveFromListNode extends BaseNode {
    type: "remove_from_list"
    listId: string
}

export type ConditionField =
    | "tag"
    | "list_membership"
    | "email_opened"
    | "email_clicked"

export interface BranchCondition {
    field: ConditionField
    /** For tag/list/campaign conditions, which id to test against. */
    targetId: string
}

export interface BranchIfNode extends BaseNode {
    type: "branch_if"
    condition: BranchCondition
    /**
     * Node id to jump to when condition is true.
     *   string    → jump to that node
     *   ""        → fall through to next-in-array (legacy behavior, preserved)
     *   null      → severed end-of-path (run completes on this branch)
     */
    trueNext: string | null
    /** Same shape as trueNext for the false branch. */
    falseNext: string | null
}

/** Exit the run early if the condition is true. Otherwise continue. */
export interface StopIfNode extends BaseNode {
    type: "stop_if"
    condition: BranchCondition
}

/** Set a single field on the contact. */
export interface UpdateContactFieldNode extends BaseNode {
    type: "update_contact_field"
    /** Field path on the contact doc. Supports nested via dots, e.g. "customFields.lead_score". */
    fieldPath: string
    /** Literal value to write (string/number/null — UI keeps this simple in v1). */
    value: string | number | null
}

/** Add (or subtract via negative delta) from a numeric contact field. Lead-score style. */
export interface IncrementFieldNode extends BaseNode {
    type: "increment_field"
    fieldPath: string
    delta: number
}

/** Set the contact's assigneeId to a specific workspace user. */
export interface AssignUserNode extends BaseNode {
    type: "assign_user"
    /** Workspace user id (member id from workspace_members). Empty = unassign. */
    userId: string
}

/** Create a task linked to the contact, optionally assigned to a user. */
export interface CreateTaskNode extends BaseNode {
    type: "create_task"
    /** Task title. Tokens like {{first_name}} are rendered. */
    title: string
    /** Optional description (tokens supported). */
    description?: string
    /** Optional assignee user id. */
    assigneeId?: string
    /** Optional due offset in days from "now" (when the action fires). */
    dueOffsetDays?: number
}

/**
 * Update one or more fields on the opportunity associated with this run's
 * trigger. Only fires when the trigger payload includes an opportunityId
 * (pipeline_stage_entered, opportunity_*, etc.). Otherwise no-ops.
 */
export interface UpdateOpportunityNode extends BaseNode {
    type: "update_opportunity"
    /** Field path on the opportunity doc. */
    fieldPath: string
    /** Literal value to write. */
    value: string | number | null
}

/**
 * Move the trigger's opportunity to a specific pipeline stage. Sugar over
 * update_opportunity with a stage picker UX. Only fires when the trigger
 * payload includes an opportunityId.
 *
 * If pipelineId is set, the opportunity moves to that pipeline + stage.
 * If pipelineId is empty, only the stage is changed (within the deal's
 * existing pipeline).
 */
export interface MoveOpportunityToStageNode extends BaseNode {
    type: "move_opportunity_to_stage"
    /** Optional. If set, the opportunity is moved to this pipeline. */
    pipelineId?: string
    /** Required. Target stage id (within pipelineId, or the current pipeline). */
    stageId: string
    /** Display-only hint set by the editor when the user picks a stage.
     *  The runtime ignores this — it only reads stageId. Used by canvas
     *  summaries / toasts so they show readable names instead of IDs. */
    stageName?: string
    pipelineName?: string
}

/** Send an email to a workspace user (e.g. internal lead notification). */
export interface SendInternalEmailNode extends BaseNode {
    type: "send_internal_email"
    /** Comma-separated email addresses (workspace teammates). Tokens supported. */
    to: string
    subject: string
    body: string
}

/** POST the run context to an arbitrary URL. The escape hatch for power users. */
export interface WebhookNode extends BaseNode {
    type: "webhook"
    url: string
    /** Optional Authorization header value (sent verbatim). */
    authHeader?: string
    /** When true, a non-2xx response or network error halts the run instead
     *  of skipping the node. Defaults to false (legacy soft-fail behavior). */
    stopOnFailure?: boolean
}

export interface EndNode extends BaseNode {
    type: "end"
}

export type AutomationNode =
    | SendEmailNode
    | AiSendEmailNode
    | AiClassifyNode
    | AiScoreNode
    | AiSummarizeNode
    | SendSmsNode
    | WaitNode
    | WaitUntilNode
    | WaitUntilBusinessHoursNode
    | AddTagNode
    | RemoveTagNode
    | AddToListNode
    | RemoveFromListNode
    | BranchIfNode
    | StopIfNode
    | UpdateContactFieldNode
    | IncrementFieldNode
    | AssignUserNode
    | CreateTaskNode
    | SendInternalEmailNode
    | UpdateOpportunityNode
    | MoveOpportunityToStageNode
    | WebhookNode
    | EndNode

// ── Automation envelope ───────────────────────────────────────────────────

export interface AutomationStats {
    runsStarted: number
    runsCompleted: number
    runsErrored: number
    contactsEnrolled: number
    /** Runs that hit the goal condition before completion. */
    goalsReached?: number
}

/**
 * A goal: when this trigger fires for a contact in a running automation,
 * the run is short-circuited as "goal_reached" and counted as a conversion.
 * Same trigger schema as the main trigger, just used as an end condition.
 */
export interface AutomationGoal {
    type: TriggerType
    config: TriggerConfig
}

export interface Automation {
    id: string
    workspaceId: string
    name: string
    description?: string
    enabled: boolean
    trigger: Trigger
    nodes: AutomationNode[]
    stats: AutomationStats
    /** Allow contacts to re-enter when the trigger fires again. Default false. */
    allowReEnroll?: boolean
    /** Optional goal — when reached, run terminates early as `goal_reached`. */
    goal?: AutomationGoal
    /** Token for webhook_in trigger (set on save when trigger.type === "webhook_in"). */
    webhookToken?: string
    createdBy: string | null
    createdAt: string
    updatedAt: string
}

// ── Runs ───────────────────────────────────────────────────────────────────

export type RunStatus =
    | "running"
    | "waiting"
    | "completed"
    | "errored"
    | "stopped"
    | "goal_reached"

export interface AutomationRun {
    id: string
    workspaceId: string
    automationId: string
    /** Contact this run belongs to. Empty string for external email enrollments. */
    contactId: string
    /** Captured at enrollment so we can still email externals (no contact). */
    contactEmail?: string
    status: RunStatus
    /** Index into automation.nodes — where the run is currently paused. */
    currentNodeIdx: number
    /** When status="waiting", the cron job wakes the run at this time. */
    scheduledFor?: string
    /** Trigger payload + accumulated context from past actions. */
    contextData: Record<string, unknown>
    startedAt: string
    updatedAt: string
    completedAt?: string
    errorMessage?: string
}
