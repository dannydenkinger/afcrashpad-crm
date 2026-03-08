"use client"

import { useState, useRef, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface InlineEditProps {
    value: string
    onSave: (value: string) => void
    className?: string
    inputClassName?: string
    type?: "text" | "number"
    placeholder?: string
}

/**
 * Click-to-edit inline text field.
 * Displays as plain text, becomes an input on click.
 * Saves on Enter or blur, cancels on Escape.
 */
export function InlineEdit({
    value,
    onSave,
    className,
    inputClassName,
    type = "text",
    placeholder = "Click to edit",
}: InlineEditProps) {
    const [editing, setEditing] = useState(false)
    const [editValue, setEditValue] = useState(value)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (editing && inputRef.current) {
            inputRef.current.focus()
            inputRef.current.select()
        }
    }, [editing])

    // Sync external value changes
    useEffect(() => {
        if (!editing) setEditValue(value)
    }, [value, editing])

    const handleSave = () => {
        setEditing(false)
        if (editValue !== value) {
            onSave(editValue)
        }
    }

    const handleCancel = () => {
        setEditing(false)
        setEditValue(value)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            e.preventDefault()
            handleSave()
        } else if (e.key === "Escape") {
            handleCancel()
        }
    }

    if (editing) {
        return (
            <Input
                ref={inputRef}
                type={type}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={handleSave}
                onKeyDown={handleKeyDown}
                className={cn("h-7 text-sm px-1.5 py-0", inputClassName)}
            />
        )
    }

    return (
        <span
            role="button"
            tabIndex={0}
            onClick={() => setEditing(true)}
            onKeyDown={(e) => { if (e.key === "Enter") setEditing(true) }}
            className={cn(
                "cursor-pointer rounded px-1 py-0.5 -mx-1 hover:bg-muted/50 transition-colors truncate",
                !value && "text-muted-foreground italic",
                className
            )}
        >
            {value || placeholder}
        </span>
    )
}
