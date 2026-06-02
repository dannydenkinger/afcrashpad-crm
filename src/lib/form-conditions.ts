import type { FieldCondition, ConditionalLogic, FormField, FormPage, LeadForm } from "@/app/settings/lead-forms/types"

export function evaluateCondition(condition: FieldCondition, values: Record<string, any>): boolean {
    const val = values[condition.fieldId]
    const strVal = val === undefined || val === null ? "" : String(val)
    const condVal = condition.value || ""

    switch (condition.operator) {
        case "equals":
            return strVal === condVal
        case "not_equals":
            return strVal !== condVal
        case "contains":
            return strVal.toLowerCase().includes(condVal.toLowerCase())
        case "not_contains":
            return !strVal.toLowerCase().includes(condVal.toLowerCase())
        case "greater_than":
            return Number(strVal) > Number(condVal)
        case "less_than":
            return Number(strVal) < Number(condVal)
        case "is_empty":
            return !strVal || (Array.isArray(val) && val.length === 0)
        case "is_not_empty":
            return !!strVal && (!Array.isArray(val) || val.length > 0)
        default:
            return true
    }
}

export function evaluateConditionalLogic(logic: ConditionalLogic, values: Record<string, any>): boolean {
    if (!logic.conditions.length) return true

    const results = logic.conditions.map(c => evaluateCondition(c, values))

    if (logic.logicType === "all") return results.every(Boolean)
    return results.some(Boolean)
}

/**
 * Filter fields based on conditional logic. Returns only fields that should be visible.
 */
export function getVisibleFields(fields: FormField[], values: Record<string, any>): FormField[] {
    return fields.filter(field => {
        if (!field.conditionalLogic?.conditions.length) return true

        const shouldShow = evaluateConditionalLogic(field.conditionalLogic, values)
        return field.conditionalLogic.action === "show" ? shouldShow : !shouldShow
    })
}

/**
 * For multi-step forms, determine the next page index respecting page skip logic.
 */
export function getNextPageIndex(
    form: LeadForm,
    currentPage: number,
    values: Record<string, any>
): number {
    if (!form.pageSkipLogic?.length || !form.pages?.length) {
        return Math.min(currentPage + 1, (form.pages?.length || 1) - 1)
    }

    const currentPageId = form.pages[currentPage]?.id
    const skipRule = form.pageSkipLogic.find(rule => rule.fromPageId === currentPageId)

    if (skipRule) {
        const conditions = skipRule.conditions
        const logicType = skipRule.logicType
        const results = conditions.map(c => evaluateCondition(c, values))
        const shouldSkip = logicType === "all" ? results.every(Boolean) : results.some(Boolean)

        if (shouldSkip) {
            const targetIdx = form.pages.findIndex(p => p.id === skipRule.toPageId)
            if (targetIdx >= 0) return targetIdx
        }
    }

    return Math.min(currentPage + 1, form.pages.length - 1)
}
