"use client"

import { useState, useEffect } from "react"
import { Layers } from "lucide-react"
import { getCustomFields } from "@/app/settings/custom-fields/actions"
import type { CustomField } from "@/app/settings/custom-fields/types"
import { CustomFieldRenderer } from "./CustomFieldRenderer"

interface CustomFieldsSectionProps {
    entityType: "contact" | "deal"
    /** Current custom field values from the entity document */
    values: Record<string, any>
    /** Called when a custom field value changes */
    onChange: (fieldId: string, value: any) => void
    disabled?: boolean
}

/**
 * Renders all custom fields for an entity type.
 * Reads field definitions from the server on mount.
 * Values are stored on the entity document as `customFields: { [fieldId]: value }`.
 */
export function CustomFieldsSection({ entityType, values, onChange, disabled }: CustomFieldsSectionProps) {
    const [fields, setFields] = useState<CustomField[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let cancelled = false
        async function load() {
            try {
                const data = await getCustomFields(entityType)
                if (!cancelled) setFields(data)
            } catch {
                // silently fail - custom fields are optional
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        load()
        return () => { cancelled = true }
    }, [entityType])

    if (loading) return null
    if (fields.length === 0) return null

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Custom Fields</h3>
            </div>
            <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-sm">
                {fields.map((field) => (
                    <div key={field.id} className={`space-y-1 ${field.type === "text" || field.type === "url" ? "col-span-2" : ""}`}>
                        <span className="text-muted-foreground text-xs">
                            {field.name}
                            {field.required && <span className="text-destructive ml-0.5">*</span>}
                        </span>
                        <CustomFieldRenderer
                            field={field}
                            value={values[field.id] ?? null}
                            onChange={(val) => onChange(field.id, val === "__clear__" ? null : val)}
                            disabled={disabled}
                        />
                    </div>
                ))}
            </div>
        </div>
    )
}
