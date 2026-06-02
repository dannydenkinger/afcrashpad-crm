"use server"

import { adminDb } from "@/lib/firebase-admin"
import { tenantDb } from "@/lib/tenant-db"
import { getAuthSession } from "@/lib/auth-guard"
import { FieldValue } from "firebase-admin/firestore"

/**
 * Persistent setup-checklist state.
 *
 * Lives on the user doc as `setupChecklist: { skipped, dismissed }` so it
 * survives across browsers + can be reset by an admin if someone gets
 * stuck. Completion is computed from real data presence — that way
 * deleting all your contacts un-completes the "Add a contact" task,
 * which is what a user would expect.
 *
 * Skipped state is sticky: once you skip a task, it stays skipped (shown
 * with a strikethrough) until you unskip it. Lets you say "I'm never
 * inviting a teammate" without the checklist nagging you forever.
 */

export interface ChecklistTask {
    id: string
    label: string
    description?: string
    href: string
    completed: boolean
    skipped: boolean
}

interface UserChecklistState {
    skipped?: string[]
    dismissed?: boolean
    completedAt?: string
}

export async function getChecklistState(): Promise<{
    success: boolean
    tasks?: ChecklistTask[]
    dismissed?: boolean
    completedCount?: number
    totalCount?: number
}> {
    try {
        const session = await getAuthSession()
        if (!session?.user) return { success: false }

        const userId = session.user.id
        const workspaceId = session.user.workspaceId
        if (!userId || !workspaceId) return { success: false }

        const userDoc = await adminDb.collection("users").doc(userId).get()
        const checklistState: UserChecklistState =
            userDoc.exists ? (userDoc.data()?.setupChecklist || {}) : {}

        if (checklistState.dismissed) {
            return { success: true, dismissed: true }
        }

        const skipped = new Set(checklistState.skipped || [])
        const db = tenantDb(workspaceId)

        // Parallel reads — keep cheap.
        const [
            workspaceDoc,
            contactsSnap,
            pipelinesSnap,
            opportunitiesSnap,
            calendarSnap,
            gmailDoc,
            integrationsDoc,
            membersSnap,
            workflowsSnap,
        ] = await Promise.all([
            adminDb.collection("workspaces").doc(workspaceId).get(),
            db.collection("contacts").limit(1).get(),
            db.collection("pipelines").limit(1).get(),
            db.collection("opportunities").limit(1).get(),
            adminDb
                .collection("calendar_integrations")
                .where("userId", "==", userId)
                .limit(1)
                .get(),
            adminDb
                .collection("gmail_integrations")
                .doc(`${workspaceId}_${userId}`)
                .get(),
            db.settingsDoc("integrations").get(),
            adminDb
                .collection("workspace_members")
                .where("workspaceId", "==", workspaceId)
                .where("status", "==", "active")
                .get(),
            db.collection("workflows").limit(1).get(),
        ])

        const workspaceData = workspaceDoc.data() || {}
        const integrationsData = integrationsDoc.data() || {}

        const hasWorkspaceName =
            !!workspaceData.name &&
            workspaceData.name !== "My Workspace" &&
            workspaceData.name !== "Workspace"
        const hasContacts = !contactsSnap.empty
        const hasPipelineOrDeal = !pipelinesSnap.empty || !opportunitiesSnap.empty
        const hasCalendar = !calendarSnap.empty
        const hasGmail = gmailDoc.exists && !!gmailDoc.data()?.refreshToken
        const hasEmailSend =
            hasGmail ||
            !!integrationsData?.resend?.apiKey ||
            integrationsData?.ses?.status === "VERIFIED"
        const hasTeamMembers = membersSnap.size > 1
        const hasAI =
            !!integrationsData?.anthropic?.apiKey ||
            !!integrationsData?.openai?.apiKey ||
            !!integrationsData?.gemini?.apiKey
        const hasAutomation = !workflowsSnap.empty

        const tasks: ChecklistTask[] = [
            {
                id: "workspace",
                label: "Name your workspace",
                description: "Set the workspace name shown to your team",
                href: "/settings/workspace/identity",
                completed: hasWorkspaceName,
                skipped: skipped.has("workspace"),
            },
            {
                id: "contact",
                label: "Add your first contact",
                description: "Manually or import a CSV",
                href: "/contacts",
                completed: hasContacts,
                skipped: skipped.has("contact"),
            },
            {
                id: "pipeline",
                label: "Create your first deal",
                description: "Drag it across stages on the kanban",
                href: "/pipeline",
                completed: hasPipelineOrDeal,
                skipped: skipped.has("pipeline"),
            },
            {
                id: "calendar",
                label: "Connect a calendar",
                description: "Google Calendar two-way sync",
                href: "/settings/integrations/services",
                completed: hasCalendar,
                skipped: skipped.has("calendar"),
            },
            {
                id: "email",
                label: "Connect email sending",
                description: "Gmail, SES, or Resend",
                href: "/settings/integrations/services",
                completed: hasEmailSend,
                skipped: skipped.has("email"),
            },
            {
                id: "team",
                label: "Invite a teammate",
                description: "Set roles and access",
                href: "/settings/team/members",
                completed: hasTeamMembers,
                skipped: skipped.has("team"),
            },
            {
                id: "ai",
                label: "Add an AI provider",
                description: "Unlock Write-with-AI + automation nodes",
                href: "/settings/integrations/ai-routing",
                completed: hasAI,
                skipped: skipped.has("ai"),
            },
            {
                id: "automation",
                label: "Build your first automation",
                description: "Auto-follow-ups, AI replies, lead routing",
                href: "/automations",
                completed: hasAutomation,
                skipped: skipped.has("automation"),
            },
        ]

        const completedCount = tasks.filter((t) => t.completed || t.skipped).length

        return {
            success: true,
            dismissed: false,
            tasks,
            completedCount,
            totalCount: tasks.length,
        }
    } catch (error) {
        console.error("Checklist state error:", error)
        return { success: false }
    }
}

export async function skipChecklistTask(taskId: string): Promise<{ success: boolean }> {
    try {
        const session = await getAuthSession()
        if (!session?.user) return { success: false }
        const userId = session.user.id
        if (!userId) return { success: false }
        await adminDb.collection("users").doc(userId).set(
            {
                setupChecklist: {
                    skipped: FieldValue.arrayUnion(taskId),
                },
            },
            { merge: true },
        )
        return { success: true }
    } catch {
        return { success: false }
    }
}

export async function unskipChecklistTask(taskId: string): Promise<{ success: boolean }> {
    try {
        const session = await getAuthSession()
        if (!session?.user) return { success: false }
        const userId = session.user.id
        if (!userId) return { success: false }
        await adminDb.collection("users").doc(userId).set(
            {
                setupChecklist: {
                    skipped: FieldValue.arrayRemove(taskId),
                },
            },
            { merge: true },
        )
        return { success: true }
    } catch {
        return { success: false }
    }
}

export async function dismissChecklist(): Promise<{ success: boolean }> {
    try {
        const session = await getAuthSession()
        if (!session?.user) return { success: false }
        const userId = session.user.id
        if (!userId) return { success: false }
        await adminDb.collection("users").doc(userId).set(
            {
                setupChecklist: {
                    dismissed: true,
                    dismissedAt: new Date().toISOString(),
                },
            },
            { merge: true },
        )
        return { success: true }
    } catch {
        return { success: false }
    }
}

export async function resetChecklist(): Promise<{ success: boolean }> {
    try {
        const session = await getAuthSession()
        if (!session?.user) return { success: false }
        const userId = session.user.id
        if (!userId) return { success: false }
        await adminDb.collection("users").doc(userId).set(
            {
                setupChecklist: {
                    dismissed: false,
                    skipped: [],
                },
            },
            { merge: true },
        )
        return { success: true }
    } catch {
        return { success: false }
    }
}

// ── Compatibility shims for files we haven't deleted yet ──

export async function getSetupStatus() {
    const state = await getChecklistState()
    if (!state.success) return { success: false }
    if (state.dismissed) return { success: true, dismissed: true }
    return {
        success: true,
        dismissed: false,
        items: (state.tasks || []).map((t) => ({
            id: t.id,
            label: t.label,
            done: t.completed,
            href: t.href,
        })),
    }
}

export async function dismissSetupChecklist() {
    return dismissChecklist()
}

export async function completeOnboarding() {
    // No-op — onboarding tour was removed.
    return { success: true }
}

export async function getOnboardingCompleted(): Promise<boolean> {
    // Always true — onboarding tour was removed.
    return true
}
