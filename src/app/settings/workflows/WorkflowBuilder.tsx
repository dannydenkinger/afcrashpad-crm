"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Plus,
    Trash2,
    Edit2,
    GitBranch,
    Zap,
    ArrowDown,
    Mail,
    CheckSquare,
    Bell,
    Pencil,
    UserPlus,
    Filter,
} from "lucide-react"
import { toast } from "sonner"
import {
    getWorkflows,
    createWorkflow,
    updateWorkflow,
    deleteWorkflow,
} from "./actions"
import type { Workflow, WorkflowCondition, WorkflowAction } from "./types"

// ── Trigger definitions ──

const TRIGGERS = [
    { value: "deal_stage_changed", label: "Deal stage changed" },
    { value: "new_contact_created", label: "New contact created" },
    { value: "deal_value_updated", label: "Deal value updated" },
    { value: "task_completed", label: "Task completed" },
] as const

// ── Condition definitions ──

const CONDITION_FIELDS = [
    { value: "stage", label: "Stage" },
    { value: "value", label: "Deal Value" },
    { value: "tag", label: "Tag" },
    { value: "source", label: "Lead Source" },
    { value: "base", label: "Military Base" },
] as const

const CONDITION_OPERATORS = [
    { value: "equals", label: "equals" },
    { value: "not_equals", label: "does not equal" },
    { value: "greater_than", label: "is greater than" },
    { value: "less_than", label: "is less than" },
    { value: "contains", label: "contains" },
] as const

// ── Action definitions ──

const ACTION_TYPES = [
    { value: "send_email", label: "Send email template", icon: Mail, color: "text-blue-500 bg-blue-500/10" },
    { value: "create_task", label: "Create task", icon: CheckSquare, color: "text-emerald-500 bg-emerald-500/10" },
    { value: "send_notification", label: "Send notification", icon: Bell, color: "text-amber-500 bg-amber-500/10" },
    { value: "update_field", label: "Update field", icon: Pencil, color: "text-violet-500 bg-violet-500/10" },
    { value: "assign_to_user", label: "Assign to user", icon: UserPlus, color: "text-pink-500 bg-pink-500/10" },
] as const

type TriggerType = (typeof TRIGGERS)[number]["value"]
type ActionType = (typeof ACTION_TYPES)[number]["value"]

function getTriggerLabel(t: string) {
    return TRIGGERS.find(tr => tr.value === t)?.label || t
}

function getActionLabel(t: string) {
    return ACTION_TYPES.find(a => a.value === t)?.label || t
}

function getActionMeta(t: string) {
    return ACTION_TYPES.find(a => a.value === t)
}

function defaultActionConfig(type: ActionType): Record<string, string> {
    switch (type) {
        case "send_email": return { templateName: "" }
        case "create_task": return { taskTitle: "", priority: "MEDIUM" }
        case "send_notification": return { message: "" }
        case "update_field": return { fieldName: "", fieldValue: "" }
        case "assign_to_user": return { userName: "" }
    }
}

export function WorkflowBuilder() {
    const [workflows, setWorkflows] = useState<Workflow[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null)
    const [isSaving, setIsSaving] = useState(false)

    // Form state
    const [formName, setFormName] = useState("")
    const [formTrigger, setFormTrigger] = useState<TriggerType>("deal_stage_changed")
    const [formConditions, setFormConditions] = useState<WorkflowCondition[]>([])
    const [formActions, setFormActions] = useState<WorkflowAction[]>([])

    useEffect(() => {
        async function load() {
            const res = await getWorkflows()
            if (res.success && res.workflows) setWorkflows(res.workflows)
            setIsLoading(false)
        }
        load()
    }, [])

    const handleOpenCreate = () => {
        setEditingWorkflow(null)
        setFormName("")
        setFormTrigger("deal_stage_changed")
        setFormConditions([])
        setFormActions([])
        setIsDialogOpen(true)
    }

    const handleOpenEdit = (wf: Workflow) => {
        setEditingWorkflow(wf)
        setFormName(wf.name)
        setFormTrigger(wf.trigger as TriggerType)
        setFormConditions([...wf.conditions])
        setFormActions([...wf.actions])
        setIsDialogOpen(true)
    }

    // Conditions
    const handleAddCondition = () => {
        setFormConditions(prev => [...prev, { field: "stage", operator: "equals", value: "" }])
    }

    const handleUpdateCondition = (index: number, key: keyof WorkflowCondition, value: string) => {
        setFormConditions(prev => prev.map((c, i) => i === index ? { ...c, [key]: value } : c))
    }

    const handleRemoveCondition = (index: number) => {
        setFormConditions(prev => prev.filter((_, i) => i !== index))
    }

    // Actions
    const handleAddAction = (type: ActionType) => {
        setFormActions(prev => [...prev, { type, config: defaultActionConfig(type) }])
    }

    const handleUpdateActionConfig = (index: number, key: string, value: string) => {
        setFormActions(prev => prev.map((a, i) => i === index ? { ...a, config: { ...a.config, [key]: value } } : a))
    }

    const handleRemoveAction = (index: number) => {
        setFormActions(prev => prev.filter((_, i) => i !== index))
    }

    const handleSave = async () => {
        if (!formName.trim()) {
            toast.error("Enter a workflow name.")
            return
        }
        if (formActions.length === 0) {
            toast.error("Add at least one action.")
            return
        }

        setIsSaving(true)

        if (editingWorkflow) {
            const res = await updateWorkflow(editingWorkflow.id, {
                name: formName,
                trigger: formTrigger,
                conditions: formConditions,
                actions: formActions,
            })
            if (res.success) {
                setWorkflows(prev =>
                    prev.map(w =>
                        w.id === editingWorkflow.id
                            ? { ...w, name: formName, trigger: formTrigger, conditions: formConditions, actions: formActions }
                            : w
                    )
                )
                toast.success("Workflow updated.")
            } else {
                toast.error(res.error || "Failed to update workflow.")
            }
        } else {
            const res = await createWorkflow({
                name: formName,
                trigger: formTrigger,
                conditions: formConditions,
                actions: formActions,
            })
            if (res.success && res.id) {
                setWorkflows(prev => [
                    {
                        id: res.id!,
                        name: formName,
                        trigger: formTrigger,
                        conditions: formConditions,
                        actions: formActions,
                        enabled: true,
                        createdAt: new Date().toISOString(),
                    },
                    ...prev,
                ])
                toast.success("Workflow created.")
            } else {
                toast.error(res.error || "Failed to create workflow.")
            }
        }

        setIsSaving(false)
        setIsDialogOpen(false)
    }

    const handleToggle = async (id: string, enabled: boolean) => {
        setWorkflows(prev => prev.map(w => (w.id === id ? { ...w, enabled } : w)))
        const res = await updateWorkflow(id, { enabled })
        if (!res.success) {
            setWorkflows(prev => prev.map(w => (w.id === id ? { ...w, enabled: !enabled } : w)))
            toast.error("Failed to toggle workflow.")
        }
    }

    const handleDelete = async (id: string) => {
        const res = await deleteWorkflow(id)
        if (res.success) {
            setWorkflows(prev => prev.filter(w => w.id !== id))
            toast.success("Workflow deleted.")
        } else {
            toast.error(res.error || "Failed to delete workflow.")
        }
    }

    if (isLoading) {
        return (
            <Card>
                <CardContent className="p-12 text-center text-muted-foreground">Loading workflows...</CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                        <GitBranch className="h-5 w-5 text-violet-500" />
                        Workflow Builder
                    </CardTitle>
                    <CardDescription>Create automated workflows with triggers, conditions, and actions.</CardDescription>
                </div>
                <Button size="sm" onClick={handleOpenCreate}>
                    <Plus className="mr-2 h-4 w-4" />
                    New Workflow
                </Button>
            </CardHeader>
            <CardContent>
                {workflows.length === 0 ? (
                    <div className="flex items-center justify-center py-12 border-2 border-dashed rounded-lg bg-muted/10">
                        <div className="text-center">
                            <GitBranch className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">No workflows yet.</p>
                            <Button variant="link" className="mt-1" onClick={handleOpenCreate}>
                                Create your first workflow
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {workflows.map(wf => (
                            <div
                                key={wf.id}
                                className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                            >
                                <div className="flex-1 min-w-0 space-y-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-sm font-semibold">{wf.name}</span>
                                        <Badge variant="outline" className="text-xs font-normal">
                                            <Zap className="h-3 w-3 mr-1" />
                                            {getTriggerLabel(wf.trigger)}
                                        </Badge>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                                        {wf.conditions.length > 0 && (
                                            <span className="flex items-center gap-1">
                                                <Filter className="h-3 w-3" />
                                                {wf.conditions.length} condition{wf.conditions.length !== 1 ? "s" : ""}
                                            </span>
                                        )}
                                        <span>
                                            {wf.actions.length} action{wf.actions.length !== 1 ? "s" : ""}
                                        </span>
                                        <span>|</span>
                                        <span>{wf.enabled ? "Active" : "Paused"}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <Switch checked={wf.enabled} onCheckedChange={v => handleToggle(wf.id, v)} />
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenEdit(wf)}>
                                        <Edit2 className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/20"
                                        onClick={() => handleDelete(wf.id)}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>

            {/* Workflow Editor Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[650px] max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingWorkflow ? "Edit Workflow" : "Create Workflow"}</DialogTitle>
                        <DialogDescription>
                            Define a trigger, optional conditions, and one or more actions.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 pt-2">
                        {/* Workflow Name */}
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Workflow Name</Label>
                            <Input
                                placeholder="e.g. Welcome new leads"
                                value={formName}
                                onChange={e => setFormName(e.target.value)}
                            />
                        </div>

                        {/* ── Visual Flow ── */}
                        <div className="space-y-1">
                            {/* TRIGGER */}
                            <div className="relative">
                                <div className="rounded-lg border-2 border-amber-500/30 bg-amber-500/5 p-4">
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-500/10 text-amber-500">
                                            <Zap className="h-4 w-4" />
                                        </div>
                                        <Label className="text-sm font-semibold text-amber-700 dark:text-amber-400">Trigger</Label>
                                    </div>
                                    <Select value={formTrigger} onValueChange={v => setFormTrigger(v as TriggerType)}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {TRIGGERS.map(t => (
                                                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                {/* Connector line */}
                                <div className="flex justify-center py-1">
                                    <ArrowDown className="h-5 w-5 text-muted-foreground/50" />
                                </div>
                            </div>

                            {/* CONDITIONS */}
                            <div className="relative">
                                <div className="rounded-lg border-2 border-blue-500/30 bg-blue-500/5 p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-500/10 text-blue-500">
                                                <Filter className="h-4 w-4" />
                                            </div>
                                            <Label className="text-sm font-semibold text-blue-700 dark:text-blue-400">
                                                Conditions <span className="font-normal text-xs text-muted-foreground">(optional)</span>
                                            </Label>
                                        </div>
                                        <Button variant="outline" size="sm" className="text-xs h-7" onClick={handleAddCondition}>
                                            <Plus className="h-3 w-3 mr-1" /> Add
                                        </Button>
                                    </div>

                                    {formConditions.length === 0 ? (
                                        <p className="text-xs text-muted-foreground text-center py-2">No conditions -- workflow will run for every trigger event.</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {formConditions.map((cond, i) => (
                                                <div key={i} className="flex items-center gap-2 bg-background/50 rounded-md p-2 border">
                                                    <Select value={cond.field} onValueChange={v => handleUpdateCondition(i, "field", v)}>
                                                        <SelectTrigger className="w-[120px] h-8 text-xs">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {CONDITION_FIELDS.map(f => (
                                                                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <Select value={cond.operator} onValueChange={v => handleUpdateCondition(i, "operator", v)}>
                                                        <SelectTrigger className="w-[140px] h-8 text-xs">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {CONDITION_OPERATORS.map(o => (
                                                                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <Input
                                                        className="flex-1 h-8 text-xs"
                                                        placeholder="Value"
                                                        value={cond.value}
                                                        onChange={e => handleUpdateCondition(i, "value", e.target.value)}
                                                    />
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 shrink-0 text-red-500 hover:text-red-700"
                                                        onClick={() => handleRemoveCondition(i)}
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                {/* Connector line */}
                                <div className="flex justify-center py-1">
                                    <ArrowDown className="h-5 w-5 text-muted-foreground/50" />
                                </div>
                            </div>

                            {/* ACTIONS */}
                            <div className="rounded-lg border-2 border-emerald-500/30 bg-emerald-500/5 p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-500">
                                            <Zap className="h-4 w-4" />
                                        </div>
                                        <Label className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Actions</Label>
                                    </div>
                                </div>

                                {formActions.length > 0 && (
                                    <div className="space-y-2 mb-3">
                                        {formActions.map((action, i) => {
                                            const meta = getActionMeta(action.type)
                                            const Icon = meta?.icon || Zap
                                            return (
                                                <div key={i} className="bg-background/50 rounded-md p-3 border space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2 text-sm font-medium">
                                                            <div className={`flex h-6 w-6 items-center justify-center rounded-md ${meta?.color || ""}`}>
                                                                <Icon className="h-3.5 w-3.5" />
                                                            </div>
                                                            {getActionLabel(action.type)}
                                                        </div>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7 text-red-500 hover:text-red-700"
                                                            onClick={() => handleRemoveAction(i)}
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                    {/* Action config fields */}
                                                    {action.type === "send_email" && (
                                                        <Input
                                                            className="h-8 text-xs"
                                                            placeholder="Email template name"
                                                            value={action.config.templateName || ""}
                                                            onChange={e => handleUpdateActionConfig(i, "templateName", e.target.value)}
                                                        />
                                                    )}
                                                    {action.type === "create_task" && (
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <Input
                                                                className="h-8 text-xs"
                                                                placeholder="Task title"
                                                                value={action.config.taskTitle || ""}
                                                                onChange={e => handleUpdateActionConfig(i, "taskTitle", e.target.value)}
                                                            />
                                                            <Select
                                                                value={action.config.priority || "MEDIUM"}
                                                                onValueChange={v => handleUpdateActionConfig(i, "priority", v)}
                                                            >
                                                                <SelectTrigger className="h-8 text-xs">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="LOW">Low</SelectItem>
                                                                    <SelectItem value="MEDIUM">Medium</SelectItem>
                                                                    <SelectItem value="HIGH">High</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    )}
                                                    {action.type === "send_notification" && (
                                                        <Input
                                                            className="h-8 text-xs"
                                                            placeholder="Notification message"
                                                            value={action.config.message || ""}
                                                            onChange={e => handleUpdateActionConfig(i, "message", e.target.value)}
                                                        />
                                                    )}
                                                    {action.type === "update_field" && (
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <Input
                                                                className="h-8 text-xs"
                                                                placeholder="Field name"
                                                                value={action.config.fieldName || ""}
                                                                onChange={e => handleUpdateActionConfig(i, "fieldName", e.target.value)}
                                                            />
                                                            <Input
                                                                className="h-8 text-xs"
                                                                placeholder="New value"
                                                                value={action.config.fieldValue || ""}
                                                                onChange={e => handleUpdateActionConfig(i, "fieldValue", e.target.value)}
                                                            />
                                                        </div>
                                                    )}
                                                    {action.type === "assign_to_user" && (
                                                        <Input
                                                            className="h-8 text-xs"
                                                            placeholder="User name or email"
                                                            value={action.config.userName || ""}
                                                            onChange={e => handleUpdateActionConfig(i, "userName", e.target.value)}
                                                        />
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}

                                {/* Add action buttons */}
                                <div className="flex flex-wrap gap-1.5">
                                    {ACTION_TYPES.map(at => {
                                        const Icon = at.icon
                                        return (
                                            <Button
                                                key={at.value}
                                                variant="outline"
                                                size="sm"
                                                className="text-xs h-7"
                                                onClick={() => handleAddAction(at.value as ActionType)}
                                            >
                                                <Icon className="h-3 w-3 mr-1" />
                                                {at.label}
                                            </Button>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="pt-4">
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving ? "Saving..." : editingWorkflow ? "Save Changes" : "Create Workflow"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    )
}
