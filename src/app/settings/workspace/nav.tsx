import {
    BadgeCheck, Layers, Sparkles, GitBranch, Boxes, FileCheck, Tag, Activity, Calendar, ShieldAlert, ShieldCheck, MapPin,
} from "lucide-react"
import type { SubPageItem } from "../SettingsSubPageLayout"

/**
 * Shared Workspace settings nav. Most items are real sub-routes under
 * /settings/workspace/<slug>; a couple (e.g. "Military bases & lodging")
 * use an `href` override because they live at their own top-level
 * /settings route but logically belong in the Workspace area's sidebar.
 *
 * Exported so pages outside /settings/workspace (e.g. /settings/bases) can
 * render the identical sidebar via SettingsSubPageLayout.
 */
export const WORKSPACE_NAV: SubPageItem[] = [
    {
        slug: "identity",
        label: "Identity",
        description: "Workspace name",
        icon: <BadgeCheck className="w-4 h-4" />,
        accent: "blue",
    },
    {
        slug: "template",
        label: "Industry template",
        description: "Pipelines, fields, statuses by industry",
        icon: <Layers className="w-4 h-4" />,
        accent: "violet",
    },
    {
        slug: "sample-data",
        label: "Sample data",
        description: "Demo dataset for trying out the CRM",
        icon: <Sparkles className="w-4 h-4" />,
        accent: "amber",
    },
    {
        slug: "pipeline",
        label: "Pipeline",
        description: "Stages, probabilities, defaults",
        icon: <GitBranch className="w-4 h-4" />,
        accent: "emerald",
    },
    {
        slug: "fields",
        label: "Custom fields",
        description: "Contacts + opportunities",
        icon: <Boxes className="w-4 h-4" />,
        accent: "sky",
    },
    {
        slug: "required-docs",
        label: "Required docs",
        description: "Per-deal paperwork checklist",
        icon: <FileCheck className="w-4 h-4" />,
        accent: "rose",
    },
    {
        slug: "tags",
        label: "Tags & lead sources",
        description: "Labels and where contacts come from",
        icon: <Tag className="w-4 h-4" />,
        accent: "violet",
    },
    {
        slug: "statuses",
        label: "Custom statuses",
        description: "Lifecycle labels + special accommodations",
        icon: <Activity className="w-4 h-4" />,
        accent: "emerald",
    },
    {
        slug: "bases",
        label: "Military bases & lodging",
        description: "Bases, zip codes, seasonal rates",
        icon: <MapPin className="w-4 h-4" />,
        accent: "sky",
        // Lives at /settings/bases (its own route), not under /workspace.
        href: "/settings/bases",
    },
    {
        slug: "booking",
        label: "Booking page",
        description: "Public scheduling link",
        icon: <Calendar className="w-4 h-4" />,
        accent: "amber",
    },
    {
        slug: "support-access",
        label: "Support access",
        description: "Grant AFCrashpad support a time-bound login",
        icon: <ShieldCheck className="w-4 h-4" />,
        accent: "violet",
    },
    {
        slug: "danger-zone",
        label: "Danger zone",
        description: "Delete workspace (owner only)",
        icon: <ShieldAlert className="w-4 h-4" />,
        accent: "rose",
    },
]
