"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { Loader2, Plus, Save, Sparkles, Trash2 } from "lucide-react"
import { saveListAction } from "../actions"
import type { SegmentRule } from "@/types"

interface TagOpt { id: string; name: string; color: string }
interface ListOpt { id: string; name: string }

interface RuleRow {
    id: string
    rule: SegmentRule
}

let _ruleIdCounter = 1
function nextRuleId(): string {
    return `r${Date.now().toString(36)}${(_ruleIdCounter++).toString(36)}`
}

function defaultRuleFor(field: SegmentRule["field"]): SegmentRule {
    switch (field) {
        case "tag":
            return { field, op: "has", value: "" }
        case "list":
            return { field, op: "on", value: "" }
        case "status":
            return { field, op: "is", value: "" }
        case "email":
            return { field, op: "exists" }
        case "engagement":
            return { field, op: "opened", value: "any", daysWindow: 30 }
        case "created":
            return { field, op: "after", value: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) }
    }
}

const FIELD_LABELS: Record<SegmentRule["field"], string> = {
    tag: "Has tag",
    list: "On list",
    status: "Status",
    email: "Email",
    engagement: "Email activity",
    created: "Created date",
}

export function SmartSegmentEditor({
    listId,
    initialRules,
    initialCombinator,
    tags,
    otherLists,
}: {
    listId: string
    initialRules: SegmentRule[]
    initialCombinator: "and" | "or"
    tags: TagOpt[]
    otherLists: ListOpt[]
}) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [rows, setRows] = useState<RuleRow[]>(
        initialRules.map((r) => ({ id: nextRuleId(), rule: r })),
    )
    const [combinator, setCombinator] = useState<"and" | "or">(initialCombinator)

    const addRule = (field: SegmentRule["field"]) => {
        setRows((prev) => [
            ...prev,
            { id: nextRuleId(), rule: defaultRuleFor(field) },
        ])
    }

    const updateRule = (id: string, patch: Partial<SegmentRule>) => {
        setRows((prev) =>
            prev.map((r) =>
                r.id === id ? { ...r, rule: { ...r.rule, ...patch } as SegmentRule } : r,
            ),
        )
    }

    const removeRule = (id: string) => {
        setRows((prev) => prev.filter((r) => r.id !== id))
    }

    const handleSave = () => {
        startTransition(async () => {
            const res = await saveListAction({
                id: listId,
                rules: rows.map((r) => r.rule),
                combinator,
            } as Parameters<typeof saveListAction>[0])
            if (!res.success) {
                toast.error(res.error || "Failed to save")
                return
            }
            toast.success("Segment rules updated")
            router.refresh()
        })
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    Segment rules
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {rows.length > 1 && (
                    <div className="flex items-center gap-2 text-xs">
                        <Label className="text-xs text-muted-foreground">Match</Label>
                        <Select
                            value={combinator}
                            onValueChange={(v) => setCombinator(v as "and" | "or")}
                            disabled={isPending}
                        >
                            <SelectTrigger className="h-7 w-32 text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="and">All rules (AND)</SelectItem>
                                <SelectItem value="or">Any rule (OR)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                )}

                {rows.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                        No rules yet — this segment matches no contacts. Add a rule below.
                    </p>
                )}

                <div className="space-y-2">
                    {rows.map((row, idx) => (
                        <RuleRowEditor
                            key={row.id}
                            row={row}
                            onChange={(patch) => updateRule(row.id, patch)}
                            onRemove={() => removeRule(row.id)}
                            tags={tags}
                            otherLists={otherLists}
                            connector={idx > 0 ? combinator : null}
                        />
                    ))}
                </div>

                <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t">
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground mr-1">
                        Add rule:
                    </span>
                    {(["tag", "list", "status", "engagement", "email", "created"] as const).map(
                        (f) => (
                            <Button
                                key={f}
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => addRule(f)}
                                disabled={isPending}
                                className="h-7 text-xs"
                            >
                                <Plus className="w-3 h-3 mr-1" />
                                {FIELD_LABELS[f]}
                            </Button>
                        ),
                    )}
                </div>

                <div className="flex justify-end pt-2 border-t">
                    <Button onClick={handleSave} disabled={isPending} size="sm">
                        {isPending ? (
                            <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                        ) : (
                            <Save className="w-3.5 h-3.5 mr-2" />
                        )}
                        Save rules
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}

function RuleRowEditor({
    row,
    onChange,
    onRemove,
    tags,
    otherLists,
    connector,
}: {
    row: RuleRow
    onChange: (patch: Partial<SegmentRule>) => void
    onRemove: () => void
    tags: TagOpt[]
    otherLists: ListOpt[]
    connector: "and" | "or" | null
}) {
    const r = row.rule
    return (
        <div className="space-y-1.5">
            {connector && (
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold pl-1">
                    {connector}
                </div>
            )}
            <div className="flex items-center gap-1.5 p-2 border rounded-md bg-muted/20">
                <span className="text-xs font-medium text-muted-foreground w-24 shrink-0">
                    {FIELD_LABELS[r.field]}
                </span>

                {r.field === "tag" && (
                    <>
                        <SelectInline
                            value={r.op}
                            onChange={(v) => onChange({ op: v as "has" | "not_has" })}
                            options={[
                                { value: "has", label: "has" },
                                { value: "not_has", label: "doesn't have" },
                            ]}
                        />
                        <Select
                            value={r.value || ""}
                            onValueChange={(v) => onChange({ value: v })}
                        >
                            <SelectTrigger className="h-7 text-xs flex-1">
                                <SelectValue placeholder="Pick a tag" />
                            </SelectTrigger>
                            <SelectContent>
                                {tags.map((t) => (
                                    <SelectItem key={t.id} value={t.id}>
                                        <span className="flex items-center gap-2">
                                            <span
                                                className="w-2 h-2 rounded-full"
                                                style={{ backgroundColor: t.color }}
                                            />
                                            {t.name}
                                        </span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </>
                )}

                {r.field === "list" && (
                    <>
                        <SelectInline
                            value={r.op}
                            onChange={(v) => onChange({ op: v as "on" | "not_on" })}
                            options={[
                                { value: "on", label: "on" },
                                { value: "not_on", label: "not on" },
                            ]}
                        />
                        <Select
                            value={r.value || ""}
                            onValueChange={(v) => onChange({ value: v })}
                        >
                            <SelectTrigger className="h-7 text-xs flex-1">
                                <SelectValue placeholder="Pick a list" />
                            </SelectTrigger>
                            <SelectContent>
                                {otherLists.map((l) => (
                                    <SelectItem key={l.id} value={l.id}>
                                        {l.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </>
                )}

                {r.field === "status" && (
                    <>
                        <SelectInline
                            value={r.op}
                            onChange={(v) => onChange({ op: v as "is" | "is_not" })}
                            options={[
                                { value: "is", label: "is" },
                                { value: "is_not", label: "is not" },
                            ]}
                        />
                        <Input
                            value={r.value}
                            onChange={(e) => onChange({ value: e.target.value })}
                            placeholder="Lead, Customer, etc."
                            className="h-7 text-xs flex-1"
                        />
                    </>
                )}

                {r.field === "email" && (
                    <SelectInline
                        value={r.op}
                        onChange={(v) => onChange({ op: v as "exists" | "not_exists" })}
                        options={[
                            { value: "exists", label: "is set" },
                            { value: "not_exists", label: "is missing" },
                        ]}
                    />
                )}

                {r.field === "engagement" && (
                    <>
                        <SelectInline
                            value={r.op}
                            onChange={(v) =>
                                onChange({ op: v as "opened" | "clicked" | "not_opened" })
                            }
                            options={[
                                { value: "opened", label: "opened" },
                                { value: "clicked", label: "clicked" },
                                { value: "not_opened", label: "didn't open" },
                            ]}
                        />
                        <Input
                            value={r.value === "any" ? "" : r.value}
                            onChange={(e) => onChange({ value: e.target.value || "any" })}
                            placeholder="campaign id (or any)"
                            className="h-7 text-xs flex-1 font-mono"
                        />
                        <span className="text-[11px] text-muted-foreground shrink-0">in last</span>
                        <Input
                            type="number"
                            value={r.daysWindow ?? 30}
                            onChange={(e) =>
                                onChange({ daysWindow: parseInt(e.target.value) || 30 })
                            }
                            className="h-7 text-xs w-14 tabular-nums"
                        />
                        <span className="text-[11px] text-muted-foreground shrink-0">days</span>
                    </>
                )}

                {r.field === "created" && (
                    <>
                        <SelectInline
                            value={r.op}
                            onChange={(v) => onChange({ op: v as "before" | "after" })}
                            options={[
                                { value: "after", label: "after" },
                                { value: "before", label: "before" },
                            ]}
                        />
                        <Input
                            type="date"
                            value={r.value}
                            onChange={(e) => onChange({ value: e.target.value })}
                            className="h-7 text-xs flex-1"
                        />
                    </>
                )}

                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={onRemove}
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </Button>
            </div>
        </div>
    )
}

function SelectInline({
    value,
    onChange,
    options,
}: {
    value: string
    onChange: (v: string) => void
    options: Array<{ value: string; label: string }>
}) {
    return (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger className="h-7 text-xs w-32 shrink-0">
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {options.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                        {o.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    )
}
