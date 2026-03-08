"use client"

import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { CustomField } from "@/app/settings/custom-fields/types"

interface CustomFieldRendererProps {
    field: CustomField
    value: any
    onChange: (value: any) => void
    disabled?: boolean
}

/**
 * Renders a single custom field input based on its type.
 */
export function CustomFieldRenderer({ field, value, onChange, disabled }: CustomFieldRendererProps) {
    switch (field.type) {
        case "text":
            return (
                <Input
                    value={value || ""}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={field.name}
                    className="h-8 text-sm"
                    disabled={disabled}
                />
            )

        case "number":
            return (
                <Input
                    type="number"
                    value={value ?? ""}
                    onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
                    placeholder={field.name}
                    className="h-8 text-sm"
                    disabled={disabled}
                />
            )

        case "date":
            return (
                <Input
                    type="date"
                    value={value || ""}
                    onChange={(e) => onChange(e.target.value || null)}
                    className="h-8 text-sm"
                    disabled={disabled}
                />
            )

        case "dropdown":
            return (
                <Select value={value || ""} onValueChange={(v) => onChange(v)} disabled={disabled}>
                    <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder={`Select ${field.name}`} />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="__clear__">-- None --</SelectItem>
                        {field.options.map((option) => (
                            <SelectItem key={option} value={option}>
                                {option}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            )

        case "checkbox":
            return (
                <div className="flex items-center gap-2">
                    <Checkbox
                        checked={!!value}
                        onCheckedChange={(checked) => onChange(!!checked)}
                        disabled={disabled}
                    />
                    <span className="text-sm text-muted-foreground">{value ? "Yes" : "No"}</span>
                </div>
            )

        case "url":
            return (
                <Input
                    type="url"
                    value={value || ""}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder="https://..."
                    className="h-8 text-sm"
                    disabled={disabled}
                />
            )

        case "email":
            return (
                <Input
                    type="email"
                    value={value || ""}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder="email@example.com"
                    className="h-8 text-sm"
                    disabled={disabled}
                />
            )

        default:
            return (
                <Input
                    value={value || ""}
                    onChange={(e) => onChange(e.target.value)}
                    className="h-8 text-sm"
                    disabled={disabled}
                />
            )
    }
}
