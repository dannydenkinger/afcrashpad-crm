/**
 * Auto-Assignment Engine
 *
 * Determines which user should be assigned to a new lead/deal
 * based on configured assignment rules.
 */

import { adminDb } from "@/lib/firebase-admin"

interface LeadContext {
    leadSource?: string | null
    base?: string | null
    source?: string | null
}

interface AssigneeResult {
    userId: string
    userName: string
    email: string
    ruleId: string
    ruleType: string
}

/**
 * Determine the assignee for a new lead based on enabled assignment rules.
 * Returns the first matching rule's result, or null if no rules match.
 *
 * Evaluation order:
 * 1. Rule-based rules are checked first (more specific)
 * 2. Round-robin rules are checked second (catch-all)
 */
export async function determineAssignee(context: LeadContext): Promise<AssigneeResult | null> {
    const snap = await adminDb
        .collection("assignment_rules")
        .where("enabled", "==", true)
        .get()

    if (snap.empty) return null

    const rules = snap.docs.map(doc => ({ id: doc.id, ref: doc.ref, ...(doc.data() as any) }))

    // Sort: rule-based first, then round-robin
    rules.sort((a: any, b: any) => {
        if (a.type === "rule_based" && b.type !== "rule_based") return -1
        if (a.type !== "rule_based" && b.type === "rule_based") return 1
        return 0
    })

    for (const rule of rules as any[]) {
        if (rule.type === "rule_based") {
            const conditions = (rule as any).conditions || []
            const allMatch = conditions.every((cond: any) => {
                const fieldValue = getFieldValue(context, cond.field)
                if (!fieldValue) return false

                switch (cond.operator) {
                    case "equals":
                        return fieldValue.toLowerCase() === (cond.value || "").toLowerCase()
                    case "contains":
                        return fieldValue.toLowerCase().includes((cond.value || "").toLowerCase())
                    default:
                        return false
                }
            })

            if (allMatch && (rule as any).assignToUserId) {
                return {
                    userId: (rule as any).assignToUserId,
                    userName: (rule as any).assignToUserName || "",
                    email: "",
                    ruleId: rule.id,
                    ruleType: "rule_based",
                }
            }
        }

        if (rule.type === "round_robin") {
            const teamMembers = (rule as any).teamMembers || []
            if (teamMembers.length === 0) continue

            const lastIndex = (rule as any).lastAssignedIndex ?? 0
            const nextIndex = (lastIndex + 1) % teamMembers.length
            const assignee = teamMembers[nextIndex]

            // Update the index atomically
            await rule.ref.update({ lastAssignedIndex: nextIndex })

            return {
                userId: assignee.id,
                userName: assignee.name,
                email: assignee.email,
                ruleId: rule.id,
                ruleType: "round_robin",
            }
        }
    }

    return null
}

function getFieldValue(context: LeadContext, field: string): string | null {
    switch (field) {
        case "lead_source":
            return context.leadSource || context.source || null
        case "base":
            return context.base || null
        case "source":
            return context.source || context.leadSource || null
        default:
            return null
    }
}
