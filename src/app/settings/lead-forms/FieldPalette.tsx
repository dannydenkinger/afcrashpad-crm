"use client"

import { useState, useMemo } from "react"
import { useDraggable } from "@dnd-kit/core"
import {
    Type, AlignLeft, Mail, Phone, Hash, ChevronDown,
    Circle, CheckSquare, Calendar, Heading, EyeOff,
    Upload, PenTool, Star, SlidersHorizontal, MapPin,
    User, Clock, Minus, Image, FileText, Globe, Search, X,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import type { FieldType } from "./types"
import { FIELD_TYPE_CONFIG } from "./types"
import { cn } from "@/lib/utils"

const ICONS: Record<string, any> = {
    Type, AlignLeft, Mail, Phone, Hash, ChevronDown,
    Circle, CheckSquare, Calendar, Heading, EyeOff,
    Upload, PenTool, Star, SlidersHorizontal, MapPin,
    User, Clock, Minus, Image, FileText, Globe,
}

interface Props {
    onAdd: (type: FieldType) => void
}

const CATEGORIES = ["Input", "Choice", "Layout", "Advanced"] as const

/**
 * Draggable palette tile. Both onClick (append to bottom) and drag (drop
 * at a specific position) are supported — DndContext in FormBuilder watches
 * for `palette:<type>` IDs to detect a palette drop.
 */
function PaletteTile({
    type,
    label,
    icon,
    onAdd,
}: {
    type: FieldType
    label: string
    icon: string
    onAdd: () => void
}) {
    const Icon = ICONS[icon] || FileText
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: `palette:${type}`,
        data: { source: "palette", fieldType: type },
    })

    return (
        <button
            ref={setNodeRef}
            type="button"
            onClick={onAdd}
            {...listeners}
            {...attributes}
            className={cn(
                "group flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs transition-colors text-left border border-transparent",
                "hover:bg-muted hover:border-border cursor-grab active:cursor-grabbing",
                isDragging && "opacity-40",
            )}
            title={`Click to add or drag to position — ${label}`}
        >
            <Icon className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary shrink-0 transition-colors" />
            <span className="truncate">{label}</span>
        </button>
    )
}

export function FieldPalette({ onAdd }: Props) {
    const [search, setSearch] = useState("")

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase()
        return CATEGORIES.map((category) => ({
            category,
            types: (Object.entries(FIELD_TYPE_CONFIG) as [FieldType, typeof FIELD_TYPE_CONFIG[FieldType]][])
                .filter(([type, config]) => {
                    if (config.category !== category) return false
                    if (!q) return true
                    return (
                        config.label.toLowerCase().includes(q) ||
                        type.toLowerCase().includes(q)
                    )
                }),
        })).filter((g) => g.types.length > 0)
    }, [search])

    const totalMatches = filtered.reduce((sum, g) => sum + g.types.length, 0)

    return (
        <div className="space-y-3">
            {/* Search */}
            <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search fields"
                    className="h-7 text-xs pl-7 pr-7"
                />
                {search && (
                    <button
                        type="button"
                        onClick={() => setSearch("")}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label="Clear search"
                    >
                        <X className="h-3 w-3" />
                    </button>
                )}
            </div>

            {/* Drag-or-click hint */}
            {!search && (
                <p className="text-[10px] text-muted-foreground/70 px-1 leading-snug">
                    Click to add or drag onto the canvas.
                </p>
            )}

            {/* Categories */}
            {filtered.map(({ category, types }) => (
                <div key={category}>
                    <p className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider px-1 mb-1.5 flex items-center gap-1.5">
                        <span className="h-1 w-1 rounded-full bg-primary/50" />
                        {category}
                    </p>
                    <div className="space-y-0.5">
                        {types.map(([type, config]) => (
                            <PaletteTile
                                key={type}
                                type={type}
                                label={config.label}
                                icon={config.icon}
                                onAdd={() => onAdd(type)}
                            />
                        ))}
                    </div>
                </div>
            ))}

            {/* Empty search state */}
            {search && totalMatches === 0 && (
                <div className="text-center py-6 text-xs text-muted-foreground">
                    No fields match &ldquo;{search}&rdquo;
                </div>
            )}
        </div>
    )
}
