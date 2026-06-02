"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
    LayersProvider,
    SelectorsProvider,
    StylesProvider,
    TraitsProvider,
    useEditorMaybe,
} from "@grapesjs/react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Paintbrush,
    Settings2,
    Layers,
    X,
    ChevronDown,
    ChevronRight,
    Box,
    Type,
    Heading,
    Image as ImageIcon,
    Link as LinkIcon,
    Square,
    Table,
    List,
    Minus,
    Rows,
    Columns,
    Move3d,
    AlignVerticalJustifyCenter,
    Frame,
    PaintBucket,
    SquareDashed,
    Sparkles,
    Layout,
    Eraser,
    Link2,
    Unlink2,
} from "lucide-react"
import type { Component, Property, Sector } from "grapesjs"

export function RightPanel() {
    const editor = useEditorMaybe()
    const [selectedLabel, setSelectedLabel] = useState<string | null>(null)
    const [selectedTag, setSelectedTag] = useState<string | null>(null)

    useEffect(() => {
        if (!editor) return
        const onSelected = (component: unknown) => {
            try {
                const cmp = component as {
                    get?: (key: string) => unknown
                }
                const tag = (cmp.get?.("tagName") as string) || ""
                const name =
                    (cmp.get?.("name") as string) ||
                    prettifyTag(tag) ||
                    "Element"
                setSelectedLabel(name)
                setSelectedTag(tag)
            } catch {
                setSelectedLabel(null)
                setSelectedTag(null)
            }
        }
        const onDeselected = () => {
            setSelectedLabel(null)
            setSelectedTag(null)
        }
        editor.on("component:selected", onSelected)
        editor.on("component:deselected", onDeselected)
        return () => {
            editor.off("component:selected", onSelected)
            editor.off("component:deselected", onDeselected)
        }
    }, [editor])

    const HeaderIcon = selectedTag ? iconForTag(selectedTag) : Box

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="px-3 py-2.5 border-b bg-muted/30">
                <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Properties
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <HeaderIcon className="w-3 h-3 text-muted-foreground/70 shrink-0" />
                            <span className="text-[11px] text-muted-foreground/70 truncate">
                                {selectedLabel ?? "Nothing selected"}
                            </span>
                        </div>
                    </div>
                    {selectedLabel && (
                        <ResetStylesButton />
                    )}
                </div>
            </div>

            <Tabs defaultValue="style" className="flex-1 flex flex-col min-h-0">
                <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-1 h-9 shrink-0">
                    <TabsTrigger value="style" className="gap-1.5 text-xs">
                        <Paintbrush className="w-3.5 h-3.5" />
                        Style
                    </TabsTrigger>
                    <TabsTrigger value="traits" className="gap-1.5 text-xs">
                        <Settings2 className="w-3.5 h-3.5" />
                        Settings
                    </TabsTrigger>
                    <TabsTrigger value="layers" className="gap-1.5 text-xs">
                        <Layers className="w-3.5 h-3.5" />
                        Layers
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="style" className="flex-1 overflow-y-auto m-0 p-3">
                    <SelectorBar />
                    <StylesPanel />
                </TabsContent>
                <TabsContent value="traits" className="flex-1 overflow-y-auto m-0 p-3">
                    <TraitsPanel />
                </TabsContent>
                <TabsContent value="layers" className="flex-1 overflow-y-auto m-0 p-0">
                    <LayersPanel />
                </TabsContent>
            </Tabs>
        </div>
    )
}

function ResetStylesButton() {
    const editor = useEditorMaybe()
    return (
        <button
            type="button"
            onClick={() => {
                const selected = editor?.getSelected()
                if (!selected) return
                if (!confirm("Clear all styles on this element?")) return
                try {
                    selected.setStyle({})
                    selected.setAttributes({
                        ...(selected.getAttributes() as Record<string, unknown>),
                        style: undefined,
                    })
                } catch {
                    // ignore
                }
            }}
            title="Reset all styles"
            className="text-muted-foreground/50 hover:text-destructive transition-colors p-1 rounded hover:bg-destructive/10"
        >
            <Eraser className="w-3.5 h-3.5" />
        </button>
    )
}

function SelectorBar() {
    return (
        <SelectorsProvider>
            {({ selectors, targets, addSelector }) => (
                <div className="mb-3 pb-3 border-b">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Selectors
                    </Label>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                        {selectors.length === 0 && (
                            <span className="text-xs text-muted-foreground">
                                {targets.length > 0 ? "(none)" : "Select an element first"}
                            </span>
                        )}
                        {selectors.map((sel, idx) => (
                            <span
                                key={idx}
                                className="text-[11px] px-1.5 py-0.5 rounded bg-muted font-mono"
                            >
                                {sel.toString()}
                            </span>
                        ))}
                        <AddSelectorInput onAdd={addSelector} />
                    </div>
                </div>
            )}
        </SelectorsProvider>
    )
}

function AddSelectorInput({ onAdd }: { onAdd: (name: string) => void }) {
    const [value, setValue] = useState("")
    return (
        <Input
            placeholder="+ class"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
                if (e.key === "Enter" && value.trim()) {
                    onAdd(value.trim().replace(/^\.+/, ""))
                    setValue("")
                }
            }}
            className="h-6 text-[11px] px-2 w-20 border-dashed"
        />
    )
}

function StylesPanel() {
    return (
        <StylesProvider>
            {({ sectors }) => {
                if (sectors.length === 0) {
                    return (
                        <div className="text-xs text-muted-foreground text-center py-6">
                            Select an element to edit styles
                        </div>
                    )
                }
                return (
                    <div className="space-y-1">
                        {sectors.map((sector) => (
                            <SectorBlock key={sector.getId()} sector={sector} />
                        ))}
                    </div>
                )
            }}
        </StylesProvider>
    )
}

const SECTOR_COLLAPSED_KEY = "vesta:editor:collapsedSectors"

function loadCollapsedSectors(): Set<string> {
    if (typeof window === "undefined") return new Set()
    try {
        const raw = localStorage.getItem(SECTOR_COLLAPSED_KEY)
        if (!raw) return new Set()
        const arr = JSON.parse(raw)
        return new Set(Array.isArray(arr) ? arr : [])
    } catch {
        return new Set()
    }
}

function iconForSector(name: string) {
    const n = name.toLowerCase()
    if (/dimens|size|width|height/.test(n)) return Move3d
    if (/typo|font|text/.test(n)) return Type
    if (/decora|background|border|color/.test(n)) return PaintBucket
    if (/extra|effect|shadow|opacity/.test(n)) return Sparkles
    if (/flex|layout|position|display/.test(n)) return Layout
    if (/align/.test(n)) return AlignVerticalJustifyCenter
    if (/space|padding|margin/.test(n)) return Frame
    return SquareDashed
}

function SectorBlock({ sector }: { sector: Sector }) {
    const [collapsed, setCollapsed] = useState<Set<string>>(loadCollapsedSectors)
    const sectorId = sector.getId()
    const sectorName = sector.getName()
    const isCollapsed = collapsed.has(sectorId)

    const toggle = () => {
        setCollapsed((prev) => {
            const next = new Set(prev)
            if (next.has(sectorId)) next.delete(sectorId)
            else next.add(sectorId)
            try {
                localStorage.setItem(SECTOR_COLLAPSED_KEY, JSON.stringify([...next]))
            } catch {
                // ignore
            }
            return next
        })
    }

    const properties = sector.getProperties()
    if (properties.length === 0) return null

    const Icon = iconForSector(sectorName)

    // Group spacing properties (padding/margin) into a visual box editor
    const { spacingGroup, otherProps } = groupSpacingProps(properties)

    return (
        <div>
            <button
                type="button"
                onClick={toggle}
                aria-expanded={!isCollapsed}
                className="flex items-center gap-1.5 w-full text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80 hover:text-foreground transition-colors py-1.5 px-1 rounded hover:bg-muted/50"
            >
                {isCollapsed ? (
                    <ChevronRight className="w-3 h-3 shrink-0" />
                ) : (
                    <ChevronDown className="w-3 h-3 shrink-0" />
                )}
                <Icon className="w-3 h-3 shrink-0 opacity-70" />
                <span className="flex-1 text-left">{sectorName}</span>
                <span className="opacity-50 tabular-nums normal-case font-normal">
                    {properties.length}
                </span>
            </button>
            {!isCollapsed && (
                <div className="space-y-2 mb-3 pl-1 pt-1">
                    {spacingGroup.padding && (
                        <SpacingBox label="Padding" props={spacingGroup.padding} />
                    )}
                    {spacingGroup.margin && (
                        <SpacingBox label="Margin" props={spacingGroup.margin} />
                    )}
                    {otherProps.map((prop) => (
                        <PropertyInput key={prop.getId()} property={prop} />
                    ))}
                </div>
            )}
        </div>
    )
}

function groupSpacingProps(properties: Property[]): {
    spacingGroup: { padding?: Property[]; margin?: Property[] }
    otherProps: Property[]
} {
    const padding: Property[] = []
    const margin: Property[] = []
    const other: Property[] = []
    for (const p of properties) {
        const name = p.getName()
        if (/^padding-(top|right|bottom|left)$/.test(name)) padding.push(p)
        else if (/^margin-(top|right|bottom|left)$/.test(name)) margin.push(p)
        else other.push(p)
    }
    const ordered = (arr: Property[]) =>
        ["top", "right", "bottom", "left"]
            .map((side) => arr.find((p) => p.getName().endsWith("-" + side)))
            .filter(Boolean) as Property[]
    return {
        spacingGroup: {
            padding: padding.length === 4 ? ordered(padding) : undefined,
            margin: margin.length === 4 ? ordered(margin) : undefined,
        },
        otherProps: other.concat(padding.length !== 4 ? padding : []).concat(
            margin.length !== 4 ? margin : [],
        ),
    }
}

function SpacingBox({ label, props }: { label: string; props: Property[] }) {
    const editor = useEditorMaybe()
    const [linked, setLinked] = useState(true)
    const selected = editor?.getSelected()
    const componentStyle = (selected?.getStyle?.() ?? {}) as Record<string, string>
    const expanded = useMemo(
        () => expandStyles(componentStyle, selected),
        [componentStyle, selected],
    )

    const values = props.map((p) => readStyleValue(selected, expanded, p.getName(), p))
    const [top, right, bottom, left] = [
        values[0] ?? "",
        values[1] ?? "",
        values[2] ?? "",
        values[3] ?? "",
    ]

    const updateSide = (idx: number, next: string) => {
        const cleaned = next.trim()
        const writeValue = cleaned ? formatLength(cleaned) : ""
        try {
            const newStyle = { ...componentStyle }
            if (linked) {
                props.forEach((p) => {
                    if (writeValue) newStyle[p.getName()] = writeValue
                    else delete newStyle[p.getName()]
                    try { p.upValue(writeValue) } catch { /* ignore */ }
                })
            } else {
                if (writeValue) newStyle[props[idx].getName()] = writeValue
                else delete newStyle[props[idx].getName()]
                try { props[idx].upValue(writeValue) } catch { /* ignore */ }
            }
            selected?.setStyle(newStyle)
        } catch { /* ignore */ }
    }

    const isPadding = label.toLowerCase() === "padding"

    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between">
                <Label className="text-[11px] text-muted-foreground">{label}</Label>
                <button
                    type="button"
                    onClick={() => setLinked((v) => !v)}
                    title={linked ? "Per-side editing (unlink)" : "Link all sides"}
                    className={`text-[10px] p-1 rounded transition-colors flex items-center justify-center ${
                        linked
                            ? "bg-primary/10 text-primary hover:bg-primary/20"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                    aria-pressed={linked}
                >
                    {linked ? (
                        <Link2 className="w-3 h-3" />
                    ) : (
                        <Unlink2 className="w-3 h-3" />
                    )}
                </button>
            </div>

            <div
                className={`relative rounded-md p-1.5 ${
                    isPadding
                        ? "bg-primary/[0.04] border border-dashed border-primary/30"
                        : "bg-muted/40 border border-dashed border-muted-foreground/25"
                }`}
            >
                {/* Top */}
                <div className="flex justify-center">
                    <SpacingInput
                        value={top}
                        onChange={(v) => updateSide(0, v)}
                        ariaLabel={`${label} top`}
                    />
                </div>

                {/* Middle row: left, label, right */}
                <div className="flex items-center gap-1 my-1">
                    <SpacingInput
                        value={left}
                        onChange={(v) => updateSide(3, v)}
                        ariaLabel={`${label} left`}
                    />
                    <div
                        className={`flex-1 h-7 rounded-sm flex items-center justify-center text-[9px] uppercase tracking-wider font-semibold ${
                            isPadding
                                ? "bg-background border border-dashed border-primary/20 text-primary/60"
                                : "bg-background/70 border border-dashed border-muted-foreground/20 text-muted-foreground/60"
                        }`}
                    >
                        {isPadding ? "Inner" : "Outer"}
                    </div>
                    <SpacingInput
                        value={right}
                        onChange={(v) => updateSide(1, v)}
                        ariaLabel={`${label} right`}
                    />
                </div>

                {/* Bottom */}
                <div className="flex justify-center">
                    <SpacingInput
                        value={bottom}
                        onChange={(v) => updateSide(2, v)}
                        ariaLabel={`${label} bottom`}
                    />
                </div>
            </div>

            {/* Quick presets */}
            <div className="flex items-center gap-1 pt-0.5">
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60 mr-0.5">
                    Quick
                </span>
                {[0, 8, 16, 24, 32].map((n) => (
                    <button
                        key={n}
                        type="button"
                        onClick={() => {
                            // Apply to all sides — effectively a "set all" preset
                            const writeValue = n === 0 ? "" : `${n}px`
                            try {
                                const newStyle = { ...componentStyle }
                                props.forEach((p) => {
                                    if (writeValue) newStyle[p.getName()] = writeValue
                                    else delete newStyle[p.getName()]
                                    try { p.upValue(writeValue) } catch { /* ignore */ }
                                })
                                selected?.setStyle(newStyle)
                            } catch { /* ignore */ }
                        }}
                        className="text-[10px] tabular-nums px-1.5 py-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        title={`Set all sides to ${n}px`}
                    >
                        {n}
                    </button>
                ))}
            </div>
        </div>
    )
}

function SpacingInput({
    value,
    onChange,
    ariaLabel,
}: {
    value: string
    onChange: (next: string) => void
    ariaLabel: string
}) {
    // Strip trailing "px" for cleaner display; user can still type units.
    const display = value ? value.replace(/^(-?\d+(?:\.\d+)?)px$/, "$1") : ""
    return (
        <input
            type="text"
            value={display}
            onChange={(e) => onChange(e.target.value)}
            placeholder="0"
            aria-label={ariaLabel}
            className="w-12 h-6 text-[11px] text-center font-mono rounded border bg-background hover:border-primary/40 focus:border-primary focus:ring-1 focus:ring-primary/20 focus:outline-none transition-colors tabular-nums"
        />
    )
}

function formatLength(v: string): string {
    const trimmed = v.trim()
    if (!trimmed) return ""
    // Number-only → assume px
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) return trimmed + "px"
    return trimmed
}

function PropertyInput({ property }: { property: Property }) {
    const editor = useEditorMaybe()
    const label = property.getLabel() || property.getName()
    const type = property.getType() as string
    const name = property.getName()

    const selected = editor?.getSelected()
    const componentStyle = (selected?.getStyle?.() ?? {}) as Record<string, string>
    // Expand inline shorthand to longhand via browser CSS engine.
    // This is the fix for the Hero badge bug — model has `background:#4f46e5`
    // but the StyleManager asks for `background-color`. Expansion picks it up.
    const expanded = useMemo(
        () => expandStyles(componentStyle, selected),
        [componentStyle, selected],
    )
    const value = readStyleValue(selected, expanded, name, property)

    const updateValue = (next: string) => {
        try {
            property.upValue(next)
        } catch {
            // ignore
        }
        try {
            if (selected) {
                selected.setStyle({ ...componentStyle, [name]: next })
            }
        } catch {
            // ignore
        }
        if (isColorProp(name) && next) {
            pushRecentColor(next)
        }
    }

    const clearValue = () => {
        try {
            if (selected) {
                const remaining: Record<string, string> = { ...componentStyle }
                delete remaining[name]
                // Also delete the parent shorthand if we're clearing a longhand
                const shorthand = SHORTHAND_OF[name]
                if (shorthand && remaining[shorthand]) {
                    delete remaining[shorthand]
                }
                selected.setStyle(remaining)
            }
        } catch {
            // ignore
        }
        try {
            property.upValue("")
        } catch {
            // ignore
        }
    }

    const isColor = isColorProp(name) || type === "color"
    const hasValue = !!value

    if (isColor) {
        return (
            <PropRow label={label} onClear={hasValue ? clearValue : undefined}>
                <ColorInput value={value} onChange={updateValue} />
            </PropRow>
        )
    }

    if (type === "select" || type === "radio") {
        const options = ((property as unknown as { getOptions?: () => SelectOption[] }).getOptions?.() ?? []) as SelectOption[]
        if (options.length > 0) {
            return (
                <PropRow label={label} onClear={hasValue ? clearValue : undefined}>
                    <select
                        value={value}
                        onChange={(e) => updateValue(e.target.value)}
                        className="h-7 text-xs flex-1 min-w-0 rounded-md border bg-background px-2"
                    >
                        <option value="">—</option>
                        {options.map((opt, idx) => (
                            <option
                                key={String(opt.id ?? opt.value ?? idx)}
                                value={String(opt.id ?? opt.value ?? "")}
                            >
                                {String(opt.label ?? opt.name ?? opt.id ?? opt.value ?? "")}
                            </option>
                        ))}
                    </select>
                </PropRow>
            )
        }
    }

    if (type === "slider" || type === "integer" || type === "number") {
        const min = numberOrNull((property as unknown as { getMin?: () => number }).getMin?.())
        const max = numberOrNull((property as unknown as { getMax?: () => number }).getMax?.())
        const step = numberOrNull((property as unknown as { getStep?: () => number }).getStep?.()) ?? 1
        if (type === "slider" && min !== null && max !== null) {
            return (
                <PropRow label={label} onClear={hasValue ? clearValue : undefined}>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        <input
                            type="range"
                            min={min}
                            max={max}
                            step={step}
                            value={parseFloat(value) || 0}
                            onChange={(e) => updateValue(e.target.value)}
                            className="flex-1 min-w-0 accent-primary"
                        />
                        <span className="text-[11px] tabular-nums text-muted-foreground w-8 text-right">
                            {parseFloat(value) || 0}
                        </span>
                    </div>
                </PropRow>
            )
        }
        return (
            <PropRow label={label} onClear={hasValue ? clearValue : undefined}>
                <Input
                    type="text"
                    value={value}
                    onChange={(e) => updateValue(e.target.value)}
                    placeholder="0"
                    className="h-7 text-xs flex-1 min-w-0"
                />
            </PropRow>
        )
    }

    return (
        <PropRow label={label} onClear={hasValue ? clearValue : undefined}>
            <Input
                type="text"
                value={value}
                onChange={(e) => updateValue(e.target.value)}
                className="h-7 text-xs flex-1 min-w-0"
            />
        </PropRow>
    )
}

function ColorInput({
    value,
    onChange,
}: {
    value: string
    onChange: (next: string) => void
}) {
    const [open, setOpen] = useState(false)
    const [recent, setRecent] = useState<string[]>(loadRecentColors)
    const containerRef = useRef<HTMLDivElement | null>(null)
    const hex = normalizeColor(value) || ""

    useEffect(() => {
        const onSync = () => setRecent(loadRecentColors())
        window.addEventListener("storage", onSync)
        return () => window.removeEventListener("storage", onSync)
    }, [])

    // Click outside / Esc closes the popover
    useEffect(() => {
        if (!open) return
        const onDown = (e: MouseEvent) => {
            if (!containerRef.current) return
            if (!containerRef.current.contains(e.target as Node)) setOpen(false)
        }
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false)
        }
        document.addEventListener("mousedown", onDown)
        document.addEventListener("keydown", onKey)
        return () => {
            document.removeEventListener("mousedown", onDown)
            document.removeEventListener("keydown", onKey)
        }
    }, [open])

    const apply = (next: string) => {
        onChange(next)
        setRecent(loadRecentColors())
    }

    return (
        <div ref={containerRef} className="flex items-center gap-1 flex-1 min-w-0 relative">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="w-7 h-7 rounded border shrink-0 cursor-pointer overflow-hidden hover:ring-2 hover:ring-primary/20 transition-shadow"
                style={{
                    backgroundColor: hex || "transparent",
                    backgroundImage: hex
                        ? "none"
                        : "linear-gradient(45deg,#e5e7eb 25%,transparent 25%),linear-gradient(-45deg,#e5e7eb 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e5e7eb 75%),linear-gradient(-45deg,transparent 75%,#e5e7eb 75%)",
                    backgroundSize: "8px 8px",
                    backgroundPosition: "0 0, 0 4px, 4px -4px, -4px 0",
                }}
                aria-label="Pick a color"
            />
            <Input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="transparent"
                className="h-7 text-xs flex-1 min-w-0 font-mono"
            />
            {open && (
                <div
                    className="absolute z-50 top-full mt-1 right-0 w-56 max-w-[calc(var(--right-panel-width,288px)-24px)] rounded-lg border bg-popover shadow-lg p-2 space-y-2"
                >
                    <input
                        type="color"
                        value={hex || "#000000"}
                        onChange={(e) => apply(e.target.value)}
                        className="w-full h-8 rounded border cursor-pointer p-0 bg-transparent"
                        aria-label="Color picker"
                    />
                    <div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-1">
                            Brand
                        </div>
                        <div className="grid grid-cols-8 gap-1">
                            {BRAND_COLORS.map((c) => (
                                <Swatch key={c} color={c} onClick={() => apply(c)} />
                            ))}
                        </div>
                    </div>
                    {recent.length > 0 && (
                        <div>
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-1">
                                Recent
                            </div>
                            <div className="grid grid-cols-8 gap-1">
                                {recent.map((c) => (
                                    <Swatch key={c} color={c} onClick={() => apply(c)} />
                                ))}
                            </div>
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={() => apply("transparent")}
                        className="w-full text-[11px] py-1 rounded border hover:bg-muted transition-colors flex items-center justify-center gap-1"
                    >
                        <X className="w-3 h-3" />
                        No fill
                    </button>
                </div>
            )}
        </div>
    )
}

function Swatch({ color, onClick }: { color: string; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            title={color}
            className="w-5 h-5 rounded border hover:scale-110 transition-transform shrink-0"
            style={{ backgroundColor: color }}
            aria-label={color}
        />
    )
}

function PropRow({
    label,
    children,
    onClear,
}: {
    label: string
    children: React.ReactNode
    onClear?: () => void
}) {
    return (
        <div className="flex items-center gap-2 group/prop">
            <Label className="text-[11px] text-muted-foreground w-20 truncate shrink-0">
                {label}
            </Label>
            {children}
            {onClear ? (
                <button
                    type="button"
                    onClick={onClear}
                    title="Clear value"
                    className="text-muted-foreground/40 hover:text-destructive opacity-0 group-hover/prop:opacity-100 transition-opacity shrink-0"
                >
                    <X className="w-3 h-3" />
                </button>
            ) : (
                <span className="w-3 shrink-0" />
            )}
        </div>
    )
}

// ── Style resolution ────────────────────────────────────────────────────────

const BRAND_COLORS = [
    "#4f46e5", "#4338ca", "#eef2ff", "#0f172a",
    "#64748b", "#94a3b8", "#e2e8f0", "#f8fafc",
    "#ffffff", "#f59e0b", "#16a34a", "#dc2626",
    "#0ea5e9", "#8b5cf6", "#ec4899", "#000000",
]

const RECENT_COLORS_KEY = "vesta:editor:recentColors"

function loadRecentColors(): string[] {
    if (typeof window === "undefined") return []
    try {
        const raw = localStorage.getItem(RECENT_COLORS_KEY)
        const parsed = raw ? JSON.parse(raw) : []
        return Array.isArray(parsed) ? parsed.slice(0, 16) : []
    } catch {
        return []
    }
}

function pushRecentColor(color: string) {
    if (typeof window === "undefined") return
    const c = color.trim()
    if (!c || c === "transparent" || c === "inherit") return
    try {
        const current = loadRecentColors()
        const next = [c, ...current.filter((x) => x !== c)].slice(0, 16)
        localStorage.setItem(RECENT_COLORS_KEY, JSON.stringify(next))
    } catch {
        // ignore
    }
}

function isColorProp(name: string): boolean {
    return /color$|background-color|border-color/i.test(name) || name === "color"
}

const SHORTHAND_OF: Record<string, string> = {
    "background-color": "background",
    "background-image": "background",
    "background-repeat": "background",
    "background-position": "background",
    "background-size": "background",
    "background-attachment": "background",
    "border-top-color": "border-top",
    "border-right-color": "border-right",
    "border-bottom-color": "border-bottom",
    "border-left-color": "border-left",
}

/**
 * Expand any shorthand styles in the model into their longhand equivalents
 * using the browser's CSS engine (a temporary, off-DOM element). This makes
 * properties like `background:#4f46e5` resolve when the StyleManager asks
 * for `background-color`.
 */
function expandStyles(
    styles: Record<string, string>,
    selected?: Component,
): Record<string, string> {
    const out: Record<string, string> = { ...styles }
    if (typeof document === "undefined") return out

    // Source 1: model styles
    const temp = document.createElement("div")
    Object.entries(styles).forEach(([k, v]) => {
        try { temp.style.setProperty(k, v) } catch { /* ignore */ }
    })

    // Source 2: raw inline style attribute (in case GrapesJS didn't parse it
    // into the model — happens with newly-loaded HTML containing shorthand)
    try {
        const attrs = selected?.getAttributes?.() as Record<string, unknown> | undefined
        const rawStyle = attrs?.style
        if (typeof rawStyle === "string" && rawStyle) {
            // Apply on top of the temp element so longhand expansion happens
            temp.style.cssText = (temp.style.cssText || "") + ";" + rawStyle
        }
    } catch {
        // ignore
    }

    const longhands = [
        "background-color", "background-image", "background-repeat", "background-position",
        "background-size", "background-attachment",
        "border-top-color", "border-top-style", "border-top-width",
        "border-right-color", "border-right-style", "border-right-width",
        "border-bottom-color", "border-bottom-style", "border-bottom-width",
        "border-left-color", "border-left-style", "border-left-width",
        "border-color", "border-style", "border-width",
        "padding-top", "padding-right", "padding-bottom", "padding-left",
        "margin-top", "margin-right", "margin-bottom", "margin-left",
        "border-top-left-radius", "border-top-right-radius",
        "border-bottom-left-radius", "border-bottom-right-radius",
        "border-radius",
        "font-family", "font-size", "font-weight", "font-style", "line-height",
        "color", "text-align", "letter-spacing", "text-transform", "text-decoration",
        "display", "width", "height", "min-width", "min-height", "max-width", "max-height",
        "opacity", "box-shadow",
    ]
    longhands.forEach((p) => {
        if (!out[p]) {
            const v = temp.style.getPropertyValue(p)
            if (v) out[p] = v
        }
    })
    return out
}

function readStyleValue(
    selected: Component | undefined,
    expanded: Record<string, string>,
    name: string,
    property: Property,
): string {
    // 1. From the expanded model styles (covers model + parsed inline + shorthand expansion)
    if (expanded[name]) return expanded[name]

    // 2. Live DOM inline style (for elements where styles aren't in the model)
    try {
        const el = selected?.getEl?.() as HTMLElement | undefined
        if (el) {
            const inline = el.style.getPropertyValue(name)
            if (inline) return inline

            // 3. Computed style (resolves CSS rules) — only when this element
            // overrides its parent (avoids leaking inherited / initial values
            // for every property on every element).
            if (typeof window !== "undefined") {
                const win = el.ownerDocument?.defaultView ?? window
                const elComputed = win.getComputedStyle(el).getPropertyValue(name)
                if (elComputed && !isInitialDefault(name, elComputed)) {
                    if (el.parentElement) {
                        const parentComputed = win
                            .getComputedStyle(el.parentElement)
                            .getPropertyValue(name)
                        if (elComputed !== parentComputed) return elComputed
                    } else {
                        return elComputed
                    }
                }
            }
        }
    } catch {
        // ignore
    }

    // 4. Property API fallback
    try {
        const v = property.getValue() as string
        if (v) return v
    } catch {
        // ignore
    }

    return ""
}

function isInitialDefault(name: string, value: string): boolean {
    const v = value.trim().toLowerCase()
    if (isColorProp(name)) {
        return v === "rgba(0, 0, 0, 0)" || v === "transparent"
    }
    if (/border.*-style/.test(name)) return v === "none"
    if (/border.*-width|outline-width/.test(name)) return v === "0px"
    if (/^(padding|margin)-/.test(name)) return v === "0px"
    if (name === "background-image") return v === "none"
    if (name === "box-shadow") return v === "none"
    if (name === "opacity") return v === "1"
    return false
}

function iconForTag(tag: string) {
    const t = (tag || "").toLowerCase()
    if (/^h[1-6]$/.test(t)) return Heading
    if (t === "p") return Type
    if (t === "img") return ImageIcon
    if (t === "a") return LinkIcon
    if (t === "button") return Square
    if (t === "table") return Table
    if (t === "tr") return Rows
    if (t === "td" || t === "th") return Columns
    if (t === "ul" || t === "ol") return List
    if (t === "li") return Minus
    if (t === "span") return Type
    return Box
}

function prettifyTag(tag: string): string {
    const t = (tag || "").toLowerCase()
    const map: Record<string, string> = {
        h1: "Heading 1",
        h2: "Heading 2",
        h3: "Heading 3",
        h4: "Heading 4",
        h5: "Heading 5",
        h6: "Heading 6",
        p: "Paragraph",
        div: "Container",
        span: "Text",
        a: "Link",
        img: "Image",
        button: "Button",
        table: "Section",
        tr: "Row",
        td: "Cell",
        th: "Header cell",
        ul: "Bullet list",
        ol: "Numbered list",
        li: "List item",
        body: "Body",
        section: "Section",
        article: "Article",
        header: "Header",
        footer: "Footer",
    }
    return map[t] ?? t
}

interface SelectOption {
    id?: string
    value?: string
    name?: string
    label?: string
}

function normalizeColor(v: string): string {
    if (!v) return ""
    const trimmed = v.trim()
    if (trimmed.startsWith("#")) {
        if (trimmed.length === 4) {
            return "#" + trimmed.slice(1).split("").map((c) => c + c).join("")
        }
        return trimmed.slice(0, 7)
    }
    if (trimmed.startsWith("rgb")) {
        return rgbToHex(trimmed)
    }
    return ""
}

function rgbToHex(rgb: string): string {
    const m = rgb.match(/^rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
    if (!m) return ""
    const toHex = (n: number) =>
        Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0")
    return "#" + toHex(+m[1]) + toHex(+m[2]) + toHex(+m[3])
}

function numberOrNull(v: number | undefined): number | null {
    return typeof v === "number" && Number.isFinite(v) ? v : null
}

function TraitsPanel() {
    return (
        <TraitsProvider>
            {({ traits }) => {
                if (traits.length === 0) {
                    return (
                        <div className="text-xs text-muted-foreground text-center py-6">
                            Select an element to edit its attributes
                        </div>
                    )
                }
                return (
                    <div className="space-y-3">
                        {traits.map((trait) => (
                            <TraitInput
                                key={String(trait.getId())}
                                trait={trait as unknown as TraitLike}
                            />
                        ))}
                    </div>
                )
            }}
        </TraitsProvider>
    )
}

interface TraitLike {
    getId: () => string | number
    getName: () => string
    getLabel: () => string
    getValue: () => unknown
    setValue: (v: string) => void
    getType?: () => string
    get: (key: string) => unknown
}

function TraitInput({ trait }: { trait: TraitLike }) {
    const name = trait.getName()
    const label = trait.getLabel() || prettifyTrait(name)
    const value = (trait.getValue() as string) ?? ""
    const type = trait.getType?.() ?? "text"
    const placeholder = (trait.get("placeholder") as string) ?? defaultPlaceholder(name)
    const helpText = (trait.get("description") as string) ?? defaultHelp(name)

    return (
        <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">{label}</Label>
            {type === "checkbox" ? (
                <label className="flex items-center gap-2 text-xs">
                    <input
                        type="checkbox"
                        checked={value === "true" || value === "1"}
                        onChange={(e) =>
                            trait.setValue(e.target.checked ? "true" : "")
                        }
                        className="rounded border"
                    />
                    {placeholder || label}
                </label>
            ) : (
                <Input
                    type={type === "number" ? "number" : "text"}
                    value={value}
                    onChange={(e) => trait.setValue(e.target.value)}
                    placeholder={placeholder}
                    className="h-7 text-xs"
                />
            )}
            {helpText && (
                <p className="text-[10px] text-muted-foreground/70 leading-snug">
                    {helpText}
                </p>
            )}
        </div>
    )
}

function prettifyTrait(name: string): string {
    const map: Record<string, string> = {
        href: "Link URL",
        src: "Image source",
        alt: "Alt text",
        target: "Open in",
        title: "Title (tooltip)",
        id: "HTML id",
        name: "Name",
        placeholder: "Placeholder",
    }
    return map[name] ?? name.replace(/-/g, " ")
}

function defaultPlaceholder(name: string): string {
    const map: Record<string, string> = {
        href: "https://example.com",
        src: "https://example.com/image.jpg",
        alt: "Describe the image for screen readers",
        target: "_blank",
        title: "Tooltip text",
    }
    return map[name] ?? ""
}

function defaultHelp(name: string): string {
    const map: Record<string, string> = {
        alt: "Required for accessibility — what would someone see if the image didn't load?",
        target: "Use _blank to open in a new tab.",
        href: "Make sure the URL is absolute (starts with https://).",
    }
    return map[name] ?? ""
}

function LayersPanel() {
    return (
        <LayersProvider>
            {({ root }) => {
                if (!root) {
                    return (
                        <div className="text-xs text-muted-foreground text-center py-6">
                            No layers to show
                        </div>
                    )
                }
                return <LayerNode componentId={root.getId()} depth={0} />
            }}
        </LayersProvider>
    )
}

function LayerNode({ componentId, depth }: { componentId: string; depth: number }) {
    const editor = useEditorMaybe()
    const [expanded, setExpanded] = useState(true)
    if (!editor) return null
    const cmp = editor.Components.getById(componentId)
    if (!cmp) return null

    const tagName = (cmp.get("tagName") as string) || "div"
    const label =
        (cmp.get("name") as string) ||
        (cmp.get("custom-name") as string) ||
        prettifyTag(tagName)
    const children = cmp.components()
    const hasChildren = children.length > 0
    const Icon = iconForTag(tagName)
    const isSelected = editor.getSelected()?.getId?.() === componentId

    const highlight = (on: boolean) => {
        try {
            const el = cmp.getEl?.() as HTMLElement | undefined
            if (!el) return
            if (on) {
                el.style.outline = "2px solid #4f46e5"
                el.style.outlineOffset = "2px"
                el.scrollIntoView({ block: "nearest", behavior: "smooth" })
            } else {
                el.style.outline = ""
                el.style.outlineOffset = ""
            }
        } catch {
            // ignore
        }
    }

    return (
        <div>
            <button
                type="button"
                onClick={() => editor.select(cmp)}
                onMouseEnter={() => highlight(true)}
                onMouseLeave={() => highlight(false)}
                className={`flex items-center gap-1.5 py-1 w-full text-left text-xs truncate transition-colors ${
                    isSelected
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-muted/50 text-foreground/80"
                }`}
                style={{ paddingLeft: 8 + depth * 12, paddingRight: 8 }}
            >
                {hasChildren ? (
                    <span
                        role="button"
                        tabIndex={-1}
                        onClick={(e) => {
                            e.stopPropagation()
                            setExpanded((v) => !v)
                        }}
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                    >
                        {expanded ? (
                            <ChevronDown className="w-3 h-3" />
                        ) : (
                            <ChevronRight className="w-3 h-3" />
                        )}
                    </span>
                ) : (
                    <span className="w-3 shrink-0" />
                )}
                <Icon className="w-3 h-3 shrink-0 opacity-70" />
                <span className="truncate">{label}</span>
            </button>
            {expanded &&
                (children as unknown as Component[]).map((child) => (
                    <LayerNode
                        key={child.getId()}
                        componentId={child.getId()}
                        depth={depth + 1}
                    />
                ))}
        </div>
    )
}
