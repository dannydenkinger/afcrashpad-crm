"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
    Zap,
    Mail,
    CheckSquare,
    UserPlus,
    DollarSign,
    ArrowRight,
    Bell,
} from "lucide-react"
import { toast } from "sonner"
import {
    getStageAutomationRules,
    createStageAutomationRule,
    updateStageAutomationRule,
    deleteStageAutomationRule,
    toggleStageAutomationRule,
} from "./stage-automation-actions"
import type { StageAutomationAction, StageAutomationRule } from "@/lib/stage-automation-types"

interface StageInfo {
    id: string
    name: string
}

interface PipelineInfo {
    id: string
    name: string
    stages: StageInfo[]
}

interface UserInfo {
    id: string
    name: string
    email: string
}

interface TemplateInfo {
    id: string
    name: string
}

interface StageAutomationsProps {
    pipelines: PipelineInfo[]
    users: UserInfo[]
    templates: TemplateInfo[]
}

const ACTION_TYPES = [
    { value: "send_email", label: "Send Email", icon: Mail, color: "text-blue-500" },
    { value: "create_task", label: "Create Task", icon: CheckSquare, color: "text-emerald-500" },
    { value: "send_notification", label: "Send Notification", icon: Bell, color: "text-orange-500" },
    { value: "assign_user", label: "Assign to User", icon: UserPlus, color: "text-violet-500" },
    { value: "create_commission", label: "Create Commission", icon: DollarSign, color: "text-amber-500" },
] as const

type ActionType = (typeof ACTION_TYPES)[number]["value"]

function getActionLabel(type: string) {
    return ACTION_TYPES.find((a) => a.value === type)?.label || type
}

function getActionIcon(type: string) {
    const found = ACTION_TYPES.find((a) => a.value === type)
    if (!found) return Zap
    return found.icon
}

function getActionColor(type: string) {
    return ACTION_TYPES.find((a) => a.value === type)?.color || "text-muted-foreground"
}

function defaultConfigForType(type: ActionType): Record<string, string> {
    switch (type) {
        case "send_email":
            return { templateId: "" }
        case "create_task":
            return { taskTitle: "", taskDescription: "", dueDays: "1", priority: "MEDIUM", assigneeId: "" }
        case "send_notification":
            return { message: "Deal {{deal_name}} moved to this stage", recipientId: "" }
        case "assign_user":
            return { assigneeId: "" }
        case "create_commission":
            return {}
    }
}

export function StageAutomations({ pipelines, users, templates }: StageAutomationsProps) {
    const [rules, setRules] = useState<StageAutomationRule[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingRule, setEditingRule] = useState<StageAutomationRule | null>(null)
    const [isSaving, setIsSaving] = useState(false)

    // Form state
    const [selectedPipelineId, setSelectedPipelineId] = useState("")
    const [selectedStageId, setSelectedStageId] = useState("")
    const [formActions, setFormActions] = useState<StageAutomationAction[]>([])

    const selectedPipeline = pipelines.find((p) => p.id === selectedPipelineId)
    const selectedStage = selectedPipeline?.stages.find((s) => s.id === selectedStageId)

    const loadRules = useCallback(async () => {
        const res = await getStageAutomationRules()
        if (res.success && res.rules) setRules(res.rules)
        setIsLoading(false)
    }, [])

    useEffect(() => {
        loadRules()
    }, [loadRules])

    const handleOpenCreate = () => {
        setEditingRule(null)
        setSelectedPipelineId(pipelines[0]?.id || "")
        setSelectedStageId("")
        setFormActions([])
        setIsDialogOpen(true)
    }

    const handleOpenEdit = (rule: StageAutomationRule) => {
        setEditingRule(rule)
        setSelectedPipelineId(rule.pipelineId)
        setSelectedStageId(rule.stageId)
        setFormActions([...rule.actions])
        setIsDialogOpen(true)
    }

    const handleAddAction = (type: ActionType) => {
        setFormActions((prev) => [...prev, { type, config: defaultConfigForType(type) }])
    }

    const handleRemoveAction = (index: number) => {
        setFormActions((prev) => prev.filter((_, i) => i !== index))
    }

    const handleUpdateActionConfig = (index: number, key: string, value: string) => {
        setFormActions((prev) =>
            prev.map((a, i) =>
                i === index ? { ...a, config: { ...a.config, [key]: value } } : a
            )
        )
    }

    const handleSave = async () => {
        if (!selectedStageId) {
            toast.error("Please select a pipeline stage.")
            return
        }
        if (formActions.length === 0) {
            toast.error("Add at least one action.")
            return
        }

        // Validate action configs
        for (const action of formActions) {
            if (action.type === "send_email" && !action.config.templateId) {
                toast.error("Select an email template for the Send Email action.")
                return
            }
            if (action.type === "create_task" && !action.config.taskTitle?.trim()) {
                toast.error("Enter a task title for the Create Task action.")
                return
            }
            if (action.type === "send_notification" && !action.config.message?.trim()) {
                toast.error("Enter a notification message for the Send Notification action.")
                return
            }
            if (action.type === "assign_user" && !action.config.assigneeId) {
                toast.error("Select a user for the Assign to User action.")
                return
            }
        }

        setIsSaving(true)

        const pipeline = pipelines.find((p) => p.id === selectedPipelineId)
        const stage = pipeline?.stages.find((s) => s.id === selectedStageId)

        if (editingRule) {
            const res = await updateStageAutomationRule(editingRule.id, {
                stageId: selectedStageId,
                stageName: stage?.name || "",
                pipelineId: selectedPipelineId,
                pipelineName: pipeline?.name || "",
                actions: formActions,
            })
            if (res.success) {
                toast.success("Automation rule updated.")
                await loadRules()
            } else {
                toast.error(res.error || "Failed to update rule.")
            }
        } else {
            const res = await createStageAutomationRule({
                stageId: selectedStageId,
                stageName: stage?.name || "",
                pipelineId: selectedPipelineId,
                pipelineName: pipeline?.name || "",
                actions: formActions,
            })
            if (res.success) {
                toast.success("Automation rule created.")
                await loadRules()
            } else {
                toast.error(res.error || "Failed to create rule.")
            }
        }

        setIsSaving(false)
        setIsDialogOpen(false)
    }

    const handleDelete = async (id: string) => {
        const res = await deleteStageAutomationRule(id)
        if (res.success) {
            setRules((prev) => prev.filter((r) => r.id !== id))
            toast.success("Automation rule deleted.")
        } else {
            toast.error(res.error || "Failed to delete rule.")
        }
    }

    const handleToggle = async (id: string, enabled: boolean) => {
        // Optimistic update
        setRules((prev) => prev.map((r) => (r.id === id ? { ...r, enabled } : r)))
        const res = await toggleStageAutomationRule(id, enabled)
        if (!res.success) {
            setRules((prev) => prev.map((r) => (r.id === id ? { ...r, enabled: !enabled } : r)))
            toast.error("Failed to toggle rule.")
        }
    }

    if (isLoading) {
        return (
            <Card>
                <CardContent className="p-12 text-center text-muted-foreground">
                    Loading stage automations...
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                        <Zap className="h-5 w-5 text-amber-500" />
                        Pipeline Stage Automations
                    </CardTitle>
                    <CardDescription>
                        Trigger actions automatically when a deal moves to a specific pipeline stage.
                    </CardDescription>
                </div>
                <Button size="sm" onClick={handleOpenCreate}>
                    <Plus className="mr-2 h-4 w-4" />
                    New Rule
                </Button>
            </CardHeader>
            <CardContent>
                {rules.length === 0 ? (
                    <div className="flex items-center justify-center py-12 border-2 border-dashed rounded-lg bg-muted/10">
                        <div className="text-center">
                            <Zap className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">No stage automation rules yet.</p>
                            <Button variant="link" className="mt-1" onClick={handleOpenCreate}>
                                Create your first rule
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {rules.map((rule) => (
                            <div
                                key={rule.id}
                                className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                            >
                                <div className="flex-1 min-w-0 space-y-2">
                                    <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                                        <div className="flex items-center gap-1.5 text-muted-foreground bg-secondary/50 px-2.5 py-1 rounded border">
                                            <span className="text-xs uppercase tracking-wider font-bold">
                                                WHEN
                                            </span>
                                            <span className="truncate">
                                                {rule.pipelineName} / {rule.stageName}
                                            </span>
                                        </div>
                                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                        <div className="flex flex-wrap gap-1.5">
                                            {rule.actions.map((action, i) => {
                                                const Icon = getActionIcon(action.type)
                                                return (
                                                    <Badge
                                                        key={i}
                                                        variant="outline"
                                                        className="flex items-center gap-1"
                                                    >
                                                        <Icon className={`h-3 w-3 ${getActionColor(action.type)}`} />
                                                        {getActionLabel(action.type)}
                                                    </Badge>
                                                )
                                            })}
                                        </div>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        {rule.actions.length} action{rule.actions.length !== 1 ? "s" : ""}
                                        {" | "}
                                        {rule.enabled ? "Active" : "Paused"}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <Switch
                                        checked={rule.enabled}
                                        onCheckedChange={(v) => handleToggle(rule.id, v)}
                                    />
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => handleOpenEdit(rule)}
                                    >
                                        <Edit2 className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/20"
                                        onClick={() => handleDelete(rule.id)}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>

            {/* Create / Edit Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {editingRule ? "Edit Automation Rule" : "Create Stage Automation Rule"}
                        </DialogTitle>
                        <DialogDescription>
                            Define what happens when a deal enters a specific pipeline stage.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 pt-2">
                        {/* Stage Selection */}
                        <div className="space-y-3">
                            <Label className="text-sm font-semibold">
                                When deal enters stage...
                            </Label>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label className="text-xs text-muted-foreground mb-1 block">Pipeline</Label>
                                    <Select
                                        value={selectedPipelineId}
                                        onValueChange={(val) => {
                                            setSelectedPipelineId(val)
                                            setSelectedStageId("")
                                        }}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select pipeline" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {pipelines.map((p) => (
                                                <SelectItem key={p.id} value={p.id}>
                                                    {p.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label className="text-xs text-muted-foreground mb-1 block">Stage</Label>
                                    <Select
                                        value={selectedStageId}
                                        onValueChange={setSelectedStageId}
                                        disabled={!selectedPipelineId}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select stage" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {selectedPipeline?.stages.map((s) => (
                                                <SelectItem key={s.id} value={s.id}>
                                                    {s.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="space-y-3">
                            <Label className="text-sm font-semibold">Then perform these actions...</Label>

                            {formActions.length > 0 && (
                                <div className="space-y-3">
                                    {formActions.map((action, index) => (
                                        <ActionConfigCard
                                            key={index}
                                            action={action}
                                            index={index}
                                            templates={templates}
                                            users={users}
                                            onUpdateConfig={handleUpdateActionConfig}
                                            onRemove={handleRemoveAction}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* Add Action Buttons */}
                            <div className="flex flex-wrap gap-2 pt-1">
                                {ACTION_TYPES.map((at) => {
                                    const Icon = at.icon
                                    return (
                                        <Button
                                            key={at.value}
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleAddAction(at.value)}
                                            className="text-xs"
                                        >
                                            <Icon className={`h-3.5 w-3.5 mr-1.5 ${at.color}`} />
                                            {at.label}
                                        </Button>
                                    )
                                })}
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="pt-4">
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving
                                ? "Saving..."
                                : editingRule
                                  ? "Save Changes"
                                  : "Create Rule"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    )
}

// ── Action Config Sub-Component ──────────────────────────────────────────────

function ActionConfigCard({
    action,
    index,
    templates,
    users,
    onUpdateConfig,
    onRemove,
}: {
    action: StageAutomationAction
    index: number
    templates: TemplateInfo[]
    users: UserInfo[]
    onUpdateConfig: (index: number, key: string, value: string) => void
    onRemove: (index: number) => void
}) {
    const Icon = getActionIcon(action.type)
    const color = getActionColor(action.type)

    return (
        <div className="relative p-4 rounded-lg border bg-muted/20 space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                    <Icon className={`h-4 w-4 ${color}`} />
                    {getActionLabel(action.type)}
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/20"
                    onClick={() => onRemove(index)}
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </Button>
            </div>

            {action.type === "send_email" && (
                <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Email Template</Label>
                    <Select
                        value={action.config.templateId || ""}
                        onValueChange={(val) => onUpdateConfig(index, "templateId", val)}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select template" />
                        </SelectTrigger>
                        <SelectContent>
                            {templates.map((t) => (
                                <SelectItem key={t.id} value={t.id}>
                                    {t.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}

            {action.type === "create_task" && (
                <div className="space-y-3">
                    <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">Task Title</Label>
                        <Input
                            placeholder='e.g. "Follow up with {{name}}"'
                            value={action.config.taskTitle || ""}
                            onChange={(e) => onUpdateConfig(index, "taskTitle", e.target.value)}
                        />
                    </div>
                    <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">
                            Description (optional)
                        </Label>
                        <Textarea
                            placeholder="Task description..."
                            className="min-h-[60px]"
                            value={action.config.taskDescription || ""}
                            onChange={(e) =>
                                onUpdateConfig(index, "taskDescription", e.target.value)
                            }
                        />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <Label className="text-xs text-muted-foreground mb-1 block">
                                Due in (days)
                            </Label>
                            <Input
                                type="number"
                                min="0"
                                value={action.config.dueDays || "1"}
                                onChange={(e) =>
                                    onUpdateConfig(index, "dueDays", e.target.value)
                                }
                            />
                        </div>
                        <div>
                            <Label className="text-xs text-muted-foreground mb-1 block">Priority</Label>
                            <Select
                                value={action.config.priority || "MEDIUM"}
                                onValueChange={(val) => onUpdateConfig(index, "priority", val)}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="LOW">Low</SelectItem>
                                    <SelectItem value="MEDIUM">Medium</SelectItem>
                                    <SelectItem value="HIGH">High</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label className="text-xs text-muted-foreground mb-1 block">Assign to</Label>
                            <Select
                                value={action.config.assigneeId || "auto"}
                                onValueChange={(val) =>
                                    onUpdateConfig(index, "assigneeId", val === "auto" ? "" : val)
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Auto" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="auto">Deal owner</SelectItem>
                                    {users.map((u) => (
                                        <SelectItem key={u.id} value={u.id}>
                                            {u.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                        Use {"{{name}}"} for contact name and {"{{deal_name}}"} for deal name in title
                        and description.
                    </p>
                </div>
            )}

            {action.type === "assign_user" && (
                <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Assign to User</Label>
                    <Select
                        value={action.config.assigneeId || ""}
                        onValueChange={(val) => onUpdateConfig(index, "assigneeId", val)}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select user" />
                        </SelectTrigger>
                        <SelectContent>
                            {users.map((u) => (
                                <SelectItem key={u.id} value={u.id}>
                                    {u.name} ({u.email})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}

            {action.type === "send_notification" && (
                <div className="space-y-3">
                    <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">Notification Message</Label>
                        <Input
                            placeholder='e.g. "{{deal_name}} needs attention"'
                            value={action.config.message || ""}
                            onChange={(e) => onUpdateConfig(index, "message", e.target.value)}
                        />
                    </div>
                    <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">Send to</Label>
                        <Select
                            value={action.config.recipientId || "auto"}
                            onValueChange={(val) =>
                                onUpdateConfig(index, "recipientId", val === "auto" ? "" : val)
                            }
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Deal owner" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="auto">Deal owner</SelectItem>
                                {users.map((u) => (
                                    <SelectItem key={u.id} value={u.id}>
                                        {u.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                        Use {"{{name}}"} for contact name and {"{{deal_name}}"} for deal name in the
                        message.
                    </p>
                </div>
            )}

            {action.type === "create_commission" && (
                <p className="text-xs text-muted-foreground">
                    Automatically creates a commission record for the deal owner based on the deal
                    value and configured commission rates.
                </p>
            )}
        </div>
    )
}
