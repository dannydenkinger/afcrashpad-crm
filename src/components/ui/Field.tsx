import * as React from "react"
import { AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Lightweight form field wrapper used in dialogs and forms.
 *
 *   <Field label="Title" required error={titleError} hint="Shown to your team">
 *       <Input value={title} onChange={(e) => setTitle(e.target.value)} />
 *   </Field>
 *
 * - Renders label with a small red asterisk when `required`.
 * - Hint sits below in muted text; replaced by an inline error message
 *   (with icon) when `error` is set.
 * - Wraps children with a red ring class so individual inputs/selects pick
 *   up an obvious invalid style without each form re-implementing it.
 */
export interface FieldProps {
    label: string
    required?: boolean
    error?: string | null
    hint?: string
    htmlFor?: string
    className?: string
    children: React.ReactNode
}

export function Field({ label, required, error, hint, htmlFor, className, children }: FieldProps) {
    return (
        <div className={cn("flex flex-col gap-1.5", className)}>
            <label
                htmlFor={htmlFor}
                className="text-sm font-medium text-foreground flex items-center gap-1"
            >
                {label}
                {required && (
                    <span aria-hidden className="text-destructive font-semibold">*</span>
                )}
            </label>
            <div className={error ? "[&_input]:border-destructive [&_input]:focus-visible:ring-destructive/30 [&_button[role=combobox]]:border-destructive [&_textarea]:border-destructive" : ""}>
                {children}
            </div>
            {error ? (
                <p className="text-xs text-destructive flex items-center gap-1 mt-0.5">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    {error}
                </p>
            ) : hint ? (
                <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>
            ) : null}
        </div>
    )
}

/** Tiny inline required marker for ad-hoc labels that don't use Field. */
export function RequiredMark() {
    return <span aria-hidden className="text-destructive font-semibold ml-0.5">*</span>
}
