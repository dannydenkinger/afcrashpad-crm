"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Braces, Check } from "lucide-react"

interface Token {
    label: string
    value: string
    description: string
}

const TOKENS: Token[] = [
    { label: "First name", value: "{{first_name}}", description: "Recipient's first name (split from name)" },
    { label: "Last name", value: "{{last_name}}", description: "Recipient's last name" },
    { label: "Full name", value: "{{name}}", description: "Recipient's full name" },
    { label: "Email", value: "{{email}}", description: "Recipient's email address" },
    { label: "Phone", value: "{{phone}}", description: "Recipient's phone number" },
    { label: "Company / Workspace", value: "{{company}}", description: "Your workspace name" },
]

interface Props {
    /** Called with the token value (e.g. "{{first_name}}") when picked. */
    onInsert: (token: string) => void
    /** Optional: called with token in clipboard form when "copy" is used. */
    onCopy?: (token: string) => void
    align?: "start" | "center" | "end"
    size?: "sm" | "default" | "lg" | "icon"
    label?: string
    disabled?: boolean
}

export function TokenInserter({
    onInsert,
    align = "end",
    size = "sm",
    label = "Insert token",
    disabled,
}: Props) {
    const [copiedValue, setCopiedValue] = useState<string | null>(null)

    const handleCopy = async (value: string) => {
        try {
            await navigator.clipboard.writeText(value)
            setCopiedValue(value)
            setTimeout(() => setCopiedValue(null), 1200)
        } catch {
            // Clipboard may be blocked — non-fatal
        }
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size={size} disabled={disabled}>
                    <Braces className="w-3.5 h-3.5 mr-1.5" />
                    {label}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={align} className="w-72">
                <DropdownMenuLabel className="text-xs">
                    Insert at cursor — replaced per-recipient at send time
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {TOKENS.map((t) => (
                    <DropdownMenuItem
                        key={t.value}
                        onSelect={(e) => {
                            e.preventDefault()
                            onInsert(t.value)
                            handleCopy(t.value)
                        }}
                        className="flex flex-col items-start gap-0.5 py-2 cursor-pointer"
                    >
                        <div className="flex items-center justify-between w-full">
                            <span className="text-sm font-medium">{t.label}</span>
                            <code className="text-[11px] text-muted-foreground">
                                {t.value}
                            </code>
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                            {t.description}
                        </span>
                        {copiedValue === t.value && (
                            <span className="text-[10px] text-emerald-600 flex items-center gap-1 mt-0.5">
                                <Check className="w-3 h-3" />
                                Inserted + copied
                            </span>
                        )}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

/**
 * Helper: insert text into a textarea/input at the current cursor position.
 * Returns the new value and the new cursor position to apply.
 */
export function insertAtCursor(
    el: HTMLTextAreaElement | HTMLInputElement | null,
    insertion: string,
    currentValue: string,
): { value: string; cursor: number } {
    if (!el) {
        return { value: currentValue + insertion, cursor: currentValue.length + insertion.length }
    }
    const start = el.selectionStart ?? currentValue.length
    const end = el.selectionEnd ?? currentValue.length
    const next = currentValue.slice(0, start) + insertion + currentValue.slice(end)
    return { value: next, cursor: start + insertion.length }
}
