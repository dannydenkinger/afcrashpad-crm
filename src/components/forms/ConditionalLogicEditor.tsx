"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2 } from "lucide-react"
import type { FormField, ConditionalLogic, FieldCondition } from "@/app/settings/lead-forms/types"

interface Props {
    field: FormField
    allFields: FormField[]
    onChange: (logic: ConditionalLogic | undefined) => void
}

const OPERATORS: { value: FieldCondition["operator"]; label: string }[] = [
    { value: "equals", label: "equals" },
    { value: "not_equals", label: "does not equal" },
    { value: "contains", label: "contains" },
    { value: "not_contains", label: "does not contain" },
    { value: "greater_than", label: "is greater than" },
    { value: "less_than", label: "is less than" },
    { value: "is_empty", label: "is empty" },
    { value: "is_not_empty", label: "is not empty" },
]

export function ConditionalLogicEditor({ field, allFields, onChange }: Props) {
    const logic = field.conditionalLogic
    const sourceFields = allFields.filter(f =>
        f.id !== field.id &&
        !["header", "divider", "image", "rich_text", "hidden"].includes(f.type)
    )

    const enable = () => {
        onChange({
            action: "show",
            logicType: "all",
            conditions: [{ fieldId: sourceFields[0]?.id || "", operator: "equals", value: "" }],
        })
    }

    const disable = () => onChange(undefined)

    if (!logic) {
        return (
            <div className="text-center py-2">
                <p className="text-xs text-muted-foreground mb-2">No conditions set</p>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={enable} disabled={sourceFields.length === 0}>
                    <Plus className="h-3 w-3 mr-1" />
                    Add Condition
                </Button>
                {sourceFields.length === 0 && (
                    <p className="text-[10px] text-muted-foreground mt-1">Add other fields first</p>
                )}
            </div>
        )
    }

    const updateCondition = (idx: number, partial: Partial<FieldCondition>) => {
        const newConditions = [...logic.conditions]
        newConditions[idx] = { ...newConditions[idx], ...partial }
        onChange({ ...logic, conditions: newConditions })
    }

    const addCondition = () => {
        onChange({
            ...logic,
            conditions: [...logic.conditions, { fieldId: sourceFields[0]?.id || "", operator: "equals", value: "" }],
        })
    }

    const removeCondition = (idx: number) => {
        const newConditions = logic.conditions.filter((_, i) => i !== idx)
        if (newConditions.length === 0) {
            disable()
        } else {
            onChange({ ...logic, conditions: newConditions })
        }
    }

    return (
        <div className="space-y-2">
            {/* Action + Logic type */}
            <div className="flex items-center gap-2 text-xs">
                <select
                    value={logic.action}
                    onChange={e => onChange({ ...logic, action: e.target.value as "show" | "hide" })}
                    className="h-7 px-2 border rounded text-xs bg-background"
                >
                    <option value="show">Show</option>
                    <option value="hide">Hide</option>
                </select>
                <span className="text-muted-foreground">this field when</span>
                <select
                    value={logic.logicType}
                    onChange={e => onChange({ ...logic, logicType: e.target.value as "all" | "any" })}
                    className="h-7 px-2 border rounded text-xs bg-background"
                >
                    <option value="all">ALL</option>
                    <option value="any">ANY</option>
                </select>
                <span className="text-muted-foreground">of:</span>
            </div>

            {/* Conditions */}
            {logic.conditions.map((cond, idx) => {
                const sourceField = sourceFields.find(f => f.id === cond.fieldId)
                const needsValue = !["is_empty", "is_not_empty"].includes(cond.operator)
                const hasOptions = sourceField && ["dropdown", "radio", "checkbox"].includes(sourceField.type)

                return (
                    <div key={idx} className="flex flex-col gap-1.5 p-2 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-1.5">
                            <select
                                value={cond.fieldId}
                                onChange={e => updateCondition(idx, { fieldId: e.target.value })}
                                className="h-7 flex-1 px-2 border rounded text-xs bg-background min-w-0"
                            >
                                {sourceFields.map(f => (
                                    <option key={f.id} value={f.id}>{f.label}</option>
                                ))}
                            </select>
                            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removeCondition(idx)}>
                                <Trash2 className="h-3 w-3 text-muted-foreground" />
                            </Button>
                        </div>
                        <select
                            value={cond.operator}
                            onChange={e => updateCondition(idx, { operator: e.target.value as FieldCondition["operator"] })}
                            className="h-7 px-2 border rounded text-xs bg-background"
                        >
                            {OPERATORS.map(op => (
                                <option key={op.value} value={op.value}>{op.label}</option>
                            ))}
                        </select>
                        {needsValue && (
                            hasOptions && sourceField.options?.length ? (
                                <select
                                    value={cond.value}
                                    onChange={e => updateCondition(idx, { value: e.target.value })}
                                    className="h-7 px-2 border rounded text-xs bg-background"
                                >
                                    <option value="">Select...</option>
                                    {sourceField.options.map((opt, i) => (
                                        <option key={i} value={opt}>{opt}</option>
                                    ))}
                                </select>
                            ) : (
                                <Input
                                    value={cond.value}
                                    onChange={e => updateCondition(idx, { value: e.target.value })}
                                    placeholder="Value"
                                    className="h-7 text-xs"
                                />
                            )
                        )}
                    </div>
                )
            })}

            <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-7 text-xs flex-1" onClick={addCondition}>
                    <Plus className="h-3 w-3 mr-1" /> Add Condition
                </Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={disable}>
                    Remove All
                </Button>
            </div>
        </div>
    )
}
