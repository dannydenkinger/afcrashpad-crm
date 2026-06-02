"use client"

import * as React from "react"
import {
    Activity, BarChart3, Briefcase, Calendar, CheckSquare, DollarSign,
    Flame, Home, Inbox, LayoutGrid, ListChecks, MapPin, Megaphone,
    Newspaper, PieChart, Sparkles, Target, TrendingUp, Trophy, Users,
    Wallet, Workflow,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

/**
 * Single source of truth for every dashboard widget. Each entry has:
 *   - id: stable key persisted to user layouts.
 *   - title / description / Icon / accent: shown in the Add Widget gallery.
 *   - defaultSize: w/h on the 12-column grid (h is in row units).
 *   - minW / minH: smallest a user can shrink the widget to.
 *
 * Render fn for each widget lives in page.tsx (it closes over component
 * state like `data`, `router`, `timeframe`). This file is just metadata.
 *
 * Adding a widget:
 *   1. Append a const here with a unique id.
 *   2. Add a `case "your-id":` to renderWidget() in page.tsx.
 *   3. Optionally include in one of DASHBOARD_TEMPLATES below.
 */

export type WidgetAccent = "primary" | "emerald" | "blue" | "violet" | "amber" | "rose" | "sky"

export type WidgetCategory = "Metrics" | "Charts" | "Lists" | "Other"

export interface WidgetMeta {
    id: string
    title: string
    description: string
    Icon: LucideIcon
    accent: WidgetAccent
    category: WidgetCategory
    defaultSize: { w: number; h: number }
    minSize: { w: number; h: number }
}

/** Grid uses 12 columns; row height ~80px so h:4 ≈ 320px. */
export const GRID_COLS = 12
export const GRID_ROW_HEIGHT = 80

export const WIDGET_REGISTRY: WidgetMeta[] = [
    // ─── Metrics (small stat cards) ───
    {
        id: "kpi-pipeline-value",
        title: "Pipeline value",
        description: "Total value of all open opportunities.",
        Icon: DollarSign,
        accent: "primary",
        category: "Metrics",
        defaultSize: { w: 3, h: 2 },
        minSize: { w: 2, h: 2 },
    },
    {
        id: "kpi-monthly-revenue",
        title: "Monthly revenue",
        description: "Closed-won revenue this month, with month-over-month trend.",
        Icon: Wallet,
        accent: "emerald",
        category: "Metrics",
        defaultSize: { w: 3, h: 2 },
        minSize: { w: 2, h: 2 },
    },
    {
        id: "kpi-conversion-rate",
        title: "Conversion rate",
        description: "Percent of opportunities that close as won.",
        Icon: TrendingUp,
        accent: "violet",
        category: "Metrics",
        defaultSize: { w: 3, h: 2 },
        minSize: { w: 2, h: 2 },
    },
    {
        id: "kpi-open-inquiries",
        title: "Open inquiries",
        description: "Active opportunities awaiting follow-up.",
        Icon: Inbox,
        accent: "rose",
        category: "Metrics",
        defaultSize: { w: 3, h: 2 },
        minSize: { w: 2, h: 2 },
    },
    {
        id: "kpi-active-customers",
        title: "Active customers",
        description: "Contacts currently flagged as Customer.",
        Icon: Home,
        accent: "primary",
        category: "Metrics",
        defaultSize: { w: 3, h: 2 },
        minSize: { w: 2, h: 2 },
    },
    {
        id: "kpi-closed-profit",
        title: "Total closed profit",
        description: "Lifetime profit across all signed deals.",
        Icon: Wallet,
        accent: "emerald",
        category: "Metrics",
        defaultSize: { w: 3, h: 2 },
        minSize: { w: 2, h: 2 },
    },
    {
        id: "kpi-weighted-forecast",
        title: "Weighted forecast",
        description: "Probability-adjusted pipeline value.",
        Icon: Target,
        accent: "sky",
        category: "Metrics",
        defaultSize: { w: 3, h: 2 },
        minSize: { w: 2, h: 2 },
    },
    {
        id: "kpi-lead-velocity",
        title: "Lead velocity",
        description: "New contacts in the last 30 days, with trend.",
        Icon: Users,
        accent: "amber",
        category: "Metrics",
        defaultSize: { w: 3, h: 2 },
        minSize: { w: 2, h: 2 },
    },
    {
        id: "kpi-avg-deal-value",
        title: "Avg deal value",
        description: "Average value across active opportunities.",
        Icon: DollarSign,
        accent: "blue",
        category: "Metrics",
        defaultSize: { w: 3, h: 2 },
        minSize: { w: 2, h: 2 },
    },
    {
        id: "kpi-tasks-due-today",
        title: "Tasks due today",
        description: "Pending tasks with a due date of today.",
        Icon: CheckSquare,
        accent: "amber",
        category: "Metrics",
        defaultSize: { w: 3, h: 2 },
        minSize: { w: 2, h: 2 },
    },

    // ─── Charts ───
    {
        id: "chart",
        title: "Pipeline value over time",
        description: "Trend chart of pipeline value across the selected timeframe.",
        Icon: BarChart3,
        accent: "primary",
        category: "Charts",
        defaultSize: { w: 12, h: 5 },
        minSize: { w: 6, h: 4 },
    },
    {
        id: "stages",
        title: "Stage distribution",
        description: "Volume and value of deals by pipeline stage.",
        Icon: BarChart3,
        accent: "violet",
        category: "Charts",
        defaultSize: { w: 6, h: 5 },
        minSize: { w: 4, h: 4 },
    },
    {
        id: "donut",
        title: "Opportunity status",
        description: "Open vs closed-won vs closed-lost breakdown.",
        Icon: PieChart,
        accent: "sky",
        category: "Charts",
        defaultSize: { w: 4, h: 5 },
        minSize: { w: 3, h: 4 },
    },
    {
        id: "bases",
        title: "Inquiry tracker",
        description: "Where your deals come from — by location or base.",
        Icon: MapPin,
        accent: "rose",
        category: "Charts",
        defaultSize: { w: 6, h: 5 },
        minSize: { w: 4, h: 4 },
    },
    {
        id: "source-attribution",
        title: "Lead source attribution",
        description: "Pipeline volume + value broken out by lead source.",
        Icon: Megaphone,
        accent: "amber",
        category: "Charts",
        defaultSize: { w: 6, h: 5 },
        minSize: { w: 4, h: 4 },
    },

    // ─── Lists ───
    {
        id: "tasks",
        title: "Priority tasks",
        description: "The 5 most-pressing pending tasks.",
        Icon: ListChecks,
        accent: "emerald",
        category: "Lists",
        defaultSize: { w: 6, h: 5 },
        minSize: { w: 4, h: 4 },
    },
    {
        id: "hot-deals",
        title: "Hot deals",
        description: "Top open opportunities by value, ready to follow up.",
        Icon: Flame,
        accent: "rose",
        category: "Lists",
        defaultSize: { w: 6, h: 5 },
        minSize: { w: 4, h: 4 },
    },
    {
        id: "recent-contacts",
        title: "Recent contacts",
        description: "The latest contacts added across all sources.",
        Icon: Users,
        accent: "blue",
        category: "Lists",
        defaultSize: { w: 6, h: 5 },
        minSize: { w: 4, h: 4 },
    },
    {
        id: "activity",
        title: "Recent activity",
        description: "Live feed of opportunities, contacts, and notes.",
        Icon: Activity,
        accent: "primary",
        category: "Lists",
        defaultSize: { w: 8, h: 6 },
        minSize: { w: 4, h: 4 },
    },

    // ─── Other ───
    {
        id: "goals",
        title: "Goal tracker",
        description: "Track revenue, deal count, and conversion goals.",
        Icon: Target,
        accent: "amber",
        category: "Other",
        defaultSize: { w: 6, h: 5 },
        minSize: { w: 4, h: 4 },
    },
    {
        id: "calendar",
        title: "Mini calendar",
        description: "Quick date overview with task due dates highlighted.",
        Icon: Calendar,
        accent: "blue",
        category: "Other",
        defaultSize: { w: 4, h: 5 },
        minSize: { w: 3, h: 4 },
    },
    {
        id: "setup-checklist",
        title: "Setup checklist",
        description: "First-run guidance — connect integrations, invite team.",
        Icon: Sparkles,
        accent: "primary",
        category: "Other",
        defaultSize: { w: 12, h: 3 },
        minSize: { w: 6, h: 2 },
    },
    {
        id: "team-leaderboard",
        title: "Team leaderboard",
        description: "Rank teammates by deals, revenue, and conversion.",
        Icon: Trophy,
        accent: "amber",
        category: "Other",
        defaultSize: { w: 12, h: 6 },
        minSize: { w: 6, h: 4 },
    },
]

export const WIDGETS_BY_ID: Record<string, WidgetMeta> = Object.fromEntries(
    WIDGET_REGISTRY.map((w) => [w.id, w]),
)

export function getWidget(id: string): WidgetMeta | undefined {
    return WIDGETS_BY_ID[id]
}

// ─── Dashboard Templates ───────────────────────────────────────────────────────

/**
 * Pre-built dashboard layouts that users can apply via the "Apply template"
 * menu. Each template specifies which widgets to show and where they go on
 * the 12-column grid.
 */

export interface GridLayoutItem {
    i: string
    x: number
    y: number
    w: number
    h: number
}

export interface DashboardTemplate {
    id: string
    name: string
    description: string
    Icon: LucideIcon
    accent: WidgetAccent
    /** Sample audience this fits. */
    audience: string
    layout: GridLayoutItem[]
}

export const DASHBOARD_TEMPLATES: DashboardTemplate[] = [
    {
        id: "default",
        name: "Default",
        description: "Balanced overview — KPIs, pipeline chart, tasks, activity. Good starting point.",
        Icon: LayoutGrid,
        accent: "primary",
        audience: "Anyone",
        layout: [
            // KPI row
            { i: "kpi-pipeline-value", x: 0, y: 0, w: 3, h: 2 },
            { i: "kpi-monthly-revenue", x: 3, y: 0, w: 3, h: 2 },
            { i: "kpi-conversion-rate", x: 6, y: 0, w: 3, h: 2 },
            { i: "kpi-open-inquiries", x: 9, y: 0, w: 3, h: 2 },
            // Hero chart
            { i: "chart", x: 0, y: 2, w: 12, h: 5 },
            // Tasks + activity
            { i: "tasks", x: 0, y: 7, w: 6, h: 5 },
            { i: "activity", x: 6, y: 7, w: 6, h: 5 },
            // Charts row
            { i: "stages", x: 0, y: 12, w: 6, h: 5 },
            { i: "donut", x: 6, y: 12, w: 6, h: 5 },
        ],
    },
    {
        id: "sales-manager",
        name: "Sales Manager",
        description: "Pipeline-focused view for managing a team's deal flow.",
        Icon: Briefcase,
        accent: "primary",
        audience: "Sales Manager",
        layout: [
            { i: "kpi-pipeline-value", x: 0, y: 0, w: 3, h: 2 },
            { i: "kpi-weighted-forecast", x: 3, y: 0, w: 3, h: 2 },
            { i: "kpi-conversion-rate", x: 6, y: 0, w: 3, h: 2 },
            { i: "kpi-avg-deal-value", x: 9, y: 0, w: 3, h: 2 },
            { i: "chart", x: 0, y: 2, w: 8, h: 5 },
            { i: "donut", x: 8, y: 2, w: 4, h: 5 },
            { i: "stages", x: 0, y: 7, w: 6, h: 5 },
            { i: "hot-deals", x: 6, y: 7, w: 6, h: 5 },
            { i: "team-leaderboard", x: 0, y: 12, w: 12, h: 6 },
        ],
    },
    {
        id: "sdr",
        name: "SDR / Lead Gen",
        description: "Volume-focused view for top-of-funnel prospecting.",
        Icon: Megaphone,
        accent: "amber",
        audience: "SDR / Outreach",
        layout: [
            { i: "kpi-lead-velocity", x: 0, y: 0, w: 3, h: 2 },
            { i: "kpi-active-customers", x: 3, y: 0, w: 3, h: 2 },
            { i: "kpi-open-inquiries", x: 6, y: 0, w: 3, h: 2 },
            { i: "kpi-tasks-due-today", x: 9, y: 0, w: 3, h: 2 },
            { i: "tasks", x: 0, y: 2, w: 6, h: 6 },
            { i: "recent-contacts", x: 6, y: 2, w: 6, h: 6 },
            { i: "source-attribution", x: 0, y: 8, w: 6, h: 5 },
            { i: "activity", x: 6, y: 8, w: 6, h: 5 },
        ],
    },
    {
        id: "executive",
        name: "Executive",
        description: "Revenue-focused snapshot for owners and leadership.",
        Icon: TrendingUp,
        accent: "emerald",
        audience: "Founder / Exec",
        layout: [
            { i: "kpi-monthly-revenue", x: 0, y: 0, w: 3, h: 2 },
            { i: "kpi-closed-profit", x: 3, y: 0, w: 3, h: 2 },
            { i: "kpi-weighted-forecast", x: 6, y: 0, w: 3, h: 2 },
            { i: "kpi-conversion-rate", x: 9, y: 0, w: 3, h: 2 },
            { i: "chart", x: 0, y: 2, w: 12, h: 5 },
            { i: "donut", x: 0, y: 7, w: 4, h: 5 },
            { i: "stages", x: 4, y: 7, w: 8, h: 5 },
            { i: "team-leaderboard", x: 0, y: 12, w: 12, h: 6 },
        ],
    },
    {
        id: "csm",
        name: "Account Manager",
        description: "Customer-focused view for ongoing relationship management.",
        Icon: Users,
        accent: "blue",
        audience: "CSM / Account Mgr",
        layout: [
            { i: "kpi-active-customers", x: 0, y: 0, w: 3, h: 2 },
            { i: "kpi-open-inquiries", x: 3, y: 0, w: 3, h: 2 },
            { i: "kpi-tasks-due-today", x: 6, y: 0, w: 3, h: 2 },
            { i: "kpi-lead-velocity", x: 9, y: 0, w: 3, h: 2 },
            { i: "tasks", x: 0, y: 2, w: 6, h: 6 },
            { i: "calendar", x: 6, y: 2, w: 6, h: 6 },
            { i: "activity", x: 0, y: 8, w: 12, h: 6 },
        ],
    },
    {
        id: "blank",
        name: "Blank",
        description: "Start from scratch — drag widgets in from the gallery.",
        Icon: LayoutGrid,
        accent: "violet",
        audience: "Custom",
        layout: [],
    },
]

export const TEMPLATES_BY_ID: Record<string, DashboardTemplate> = Object.fromEntries(
    DASHBOARD_TEMPLATES.map((t) => [t.id, t]),
)
