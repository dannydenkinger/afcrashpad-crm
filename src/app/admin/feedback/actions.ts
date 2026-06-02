"use server"

import { z } from "zod"
import { adminDb } from "@/lib/firebase-admin"
import { requireOperator } from "@/lib/admin/guard"

export type FeedbackStatus = "new" | "triaged" | "resolved"
export type FeedbackKind = "bug" | "idea" | "other"

export interface FeedbackEntry {
    id: string
    kind: FeedbackKind
    status: FeedbackStatus
    userId: string
    userEmail: string
    userName: string
    workspaceId: string
    workspaceName: string
    message: string
    pageUrl: string
    userAgent: string
    viewport: string
    ip: string
    createdAt: string | null
}

function toIso(ts: unknown): string | null {
    if (!ts) return null
    if (typeof ts === "string") return ts
    if (ts instanceof Date) return ts.toISOString()
    const t = ts as { toDate?: () => Date }
    if (typeof t.toDate === "function") return t.toDate().toISOString()
    return null
}

function rowToEntry(id: string, data: FirebaseFirestore.DocumentData): FeedbackEntry {
    return {
        id,
        kind: (data.kind as FeedbackKind) || "other",
        status: (data.status as FeedbackStatus) || "new",
        userId: (data.userId as string) || "",
        userEmail: (data.userEmail as string) || "",
        userName: (data.userName as string) || "",
        workspaceId: (data.workspaceId as string) || "",
        workspaceName: (data.workspaceName as string) || "",
        message: (data.message as string) || "",
        pageUrl: (data.pageUrl as string) || "",
        userAgent: (data.userAgent as string) || "",
        viewport: (data.viewport as string) || "",
        ip: (data.ip as string) || "",
        createdAt: toIso(data.createdAt),
    }
}

export async function listFeedback(): Promise<FeedbackEntry[]> {
    await requireOperator()
    const snap = await adminDb
        .collection("feedback")
        .orderBy("createdAt", "desc")
        .limit(500)
        .get()
    return snap.docs.map((d) => rowToEntry(d.id, d.data()))
}

const updateSchema = z.object({
    id: z.string().min(1).max(128),
    status: z.enum(["new", "triaged", "resolved"]),
})

export async function updateFeedbackStatus(input: z.infer<typeof updateSchema>) {
    const session = await requireOperator()
    const parsed = updateSchema.safeParse(input)
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }

    await adminDb.collection("feedback").doc(parsed.data.id).update({
        status: parsed.data.status,
        triagedBy: session.user?.email ?? null,
        triagedAt: new Date(),
    })
    return { success: true }
}
