/**
 * Snapshots — industry-specific bundles of CRM seed data.
 *
 * Inspired by GoHighLevel's "snapshots" concept: a snapshot is a named
 * preset that loads pipelines, custom fields, tags, statuses, lead sources,
 * starter automations, and starter email templates tailored to a specific
 * type of business — Real Estate Rental, Med Spa, Agency, etc.
 *
 * The base CRM is industry-agnostic. When a user creates a workspace, they
 * pick a snapshot (or stick with "generic"). When they want to switch
 * industries, they can apply a different snapshot from
 * /settings/workspace — applies are ADDITIVE so existing data isn't
 * destroyed.
 */
import type { AutomationNode, TriggerType, TriggerConfig } from "@/lib/automations/types"

export interface SnapshotPipelineStage {
    name: string
    order: number
    /** 0-100 % chance this stage closes. Used by forecasting. */
    probability: number
}

export interface SnapshotPipeline {
    name: string
    stages: SnapshotPipelineStage[]
}

export interface SnapshotContactStatus {
    name: string
    order: number
    /** Hex color for the status badge. */
    color: string
}

export interface SnapshotCustomField {
    /** Where the field shows up. */
    entity: "contact" | "opportunity"
    /** Label shown in UI. */
    name: string
    /** Internal key (snake_case recommended). */
    key: string
    type: "text" | "number" | "date" | "select"
    /** Required for type "select". */
    options?: string[]
    /** Optional placeholder/help text. */
    description?: string
}

export interface SnapshotAutomation {
    name: string
    description?: string
    /** Whether the automation is on at creation time. Default false (draft). */
    enabled?: boolean
    trigger: { type: TriggerType; config: TriggerConfig }
    nodes: AutomationNode[]
    allowReEnroll?: boolean
}

export interface SnapshotEmailTemplate {
    name: string
    subject: string
    /** Inline-styled HTML, tokens like {{first_name}} supported. */
    renderedHtml: string
    description?: string
}

export interface Snapshot {
    /** Stable identifier — stored on workspace doc as templateSlug. */
    slug: string
    /** Display name (e.g. "Real Estate Rental"). */
    name: string
    /** Short description for the picker UI. */
    description: string
    /** Optional category for grouping in the picker. */
    category?: "Generic" | "Services" | "Real Estate" | "Health" | "Agency" | "Other"
    /** Pipelines to provision. First one becomes the workspace default. */
    pipelines: SnapshotPipeline[]
    /** Free-form labels. */
    tags: string[]
    /** Sources to track where contacts come from. */
    leadSources: string[]
    /** Lifecycle states for contacts. */
    statuses: SnapshotContactStatus[]
    /** Custom fields to add to contact / opportunity records. */
    customFields: SnapshotCustomField[]
    /** Pre-built workflow automations. Created in "draft" (disabled) so users review before turning on. */
    automations?: SnapshotAutomation[]
    /** Pre-built email templates that show up in the marketing module. */
    emailTemplates?: SnapshotEmailTemplate[]
}
