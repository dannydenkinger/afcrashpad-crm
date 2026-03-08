"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
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
import { Plus, Trash2, Edit2, UserPlus, Shuffle, GitBranch, ArrowRight } from "lucide-react"
import { toast } from "sonner"
import {
    getAssignmentRules,
    createAssignmentRule,
    updateAssignmentRule,
    deleteAssignmentRule,
} from "./actions"
import type { AssignmentRule, AssignmentRuleCondition } from "./types"

interface UserInfo {
    id: string
    name: string
    email: string
}

interface AutoAssignRulesProps {
    users: UserInfo[]
}

export function AutoAssignRules({ users }: AutoAssignRulesProps) {
    const [rules, setRules] = useState<AssignmentRule[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingRule, setEditingRule] = useState<AssignmentRule | null>(null)
    const [isSaving, setIsSaving] = useState(false)

    // Form state
    const [formType, setFormType] = useState<"round_robin" | "rule_based">("round_robin")
    const [selectedTeamMemberIds, setSelectedTeamMemberIds] = useState<string[]>([])
    const [formConditions, setFormConditions] = useState<AssignmentRuleCondition[]>([])
    const [formAssignToUserId, setFormAssignToUserId] = useState("")

    useEffect(() => {
        async function load() {
            const res = await getAssignmentRules()
            if (res.success && res.rules) setRules(res.rules)
            setIsLoading(false)
        }
        load()
    }, [])

    const handleOpenCreate = () => {
        setEditingRule(null)
        setFormType("round_robin")
        setSelectedTeamMemberIds([])
        setFormConditions([])
        setFormAssignToUserId("")
        setIsDialogOpen(true)
    }

    const handleOpenEdit = (rule: AssignmentRule) => {
        setEditingRule(rule)
        setFormType(rule.type as any)
        setSelectedTeamMemberIds(rule.teamMembers.map(m => m.id))
        setFormConditions([...rule.conditions])
        setFormAssignToUserId(rule.assignToUserId || "")
        setIsDialogOpen(true)
    }

    const handleToggleTeamMember = (userId: string) => {
        setSelectedTeamMemberIds(prev =>
            prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
        )
    }

    const handleAddCondition = () => {
        setFormConditions(prev => [...prev, { field: "lead_source", operator: "equals", value: "" }])
    }

    const handleUpdateCondition = (index: number, key: keyof AssignmentRuleCondition, value: string) => {
        setFormConditions(prev => prev.map((c, i) => i === index ? { ...c, [key]: value } : c))
    }

    const handleRemoveCondition = (index: number) => {
        setFormConditions(prev => prev.filter((_, i) => i !== index))
    }

    const handleSave = async () => {
        if (formType === "round_robin" && selectedTeamMemberIds.length < 2) {
            toast.error("Round-robin requires at least 2 team members.")
            return
        }
        if (formType === "rule_based" && formConditions.length === 0) {
            toast.error("Add at least one condition for rule-based assignment.")
            return
        }
        if (formType === "rule_based" && !formAssignToUserId) {
            toast.error("Select a user to assign to.")
            return
        }

        const teamMembers = users.filter(u => selectedTeamMemberIds.includes(u.id))
        const assignToUser = users.find(u => u.id === formAssignToUserId)

        setIsSaving(true)

        if (editingRule) {
            const res = await updateAssignmentRule(editingRule.id, {
                type: formType,
                teamMembers,
                conditions: formConditions,
                assignToUserId: formAssignToUserId || undefined,
                assignToUserName: assignToUser?.name || undefined,
            })
            if (res.success) {
                setRules(prev =>
                    prev.map(r =>
                        r.id === editingRule.id
                            ? {
                                  ...r,
                                  type: formType,
                                  teamMembers,
                                  conditions: formConditions,
                                  assignToUserId: formAssignToUserId,
                                  assignToUserName: assignToUser?.name,
                              }
                            : r
                    )
                )
                toast.success("Assignment rule updated.")
            } else {
                toast.error(res.error || "Failed to update rule.")
            }
        } else {
            const res = await createAssignmentRule({
                type: formType,
                teamMembers,
                conditions: formConditions,
                assignToUserId: formAssignToUserId || undefined,
                assignToUserName: assignToUser?.name || undefined,
            })
            if (res.success && res.id) {
                setRules(prev => [
                    {
                        id: res.id!,
                        type: formType,
                        teamMembers,
                        conditions: formConditions,
                        assignToUserId: formAssignToUserId,
                        assignToUserName: assignToUser?.name,
                        enabled: true,
                        lastAssignedIndex: 0,
                        createdAt: new Date().toISOString(),
                    },
                    ...prev,
                ])
                toast.success("Assignment rule created.")
            } else {
                toast.error(res.error || "Failed to create rule.")
            }
        }

        setIsSaving(false)
        setIsDialogOpen(false)
    }

    const handleToggle = async (id: string, enabled: boolean) => {
        setRules(prev => prev.map(r => (r.id === id ? { ...r, enabled } : r)))
        const res = await updateAssignmentRule(id, { enabled })
        if (!res.success) {
            setRules(prev => prev.map(r => (r.id === id ? { ...r, enabled: !enabled } : r)))
            toast.error("Failed to toggle rule.")
        }
    }

    const handleDelete = async (id: string) => {
        const res = await deleteAssignmentRule(id)
        if (res.success) {
            setRules(prev => prev.filter(r => r.id !== id))
            toast.success("Assignment rule deleted.")
        } else {
            toast.error(res.error || "Failed to delete rule.")
        }
    }

    if (isLoading) {
        return (
            <Card>
                <CardContent className="p-12 text-center text-muted-foreground">Loading assignment rules...</CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                        <UserPlus className="h-5 w-5 text-pink-500" />
                        Auto-Assignment Rules
                    </CardTitle>
                    <CardDescription>Automatically assign new leads and deals to team members.</CardDescription>
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
                            <UserPlus className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">No auto-assignment rules yet.</p>
                            <Button variant="link" className="mt-1" onClick={handleOpenCreate}>
                                Create your first rule
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {rules.map(rule => (
                            <div
                                key={rule.id}
                                className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                            >
                                <div className="flex-1 min-w-0 space-y-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {rule.type === "round_robin" ? (
                                            <Badge variant="outline" className="text-xs flex items-center gap-1">
                                                <Shuffle className="h-3 w-3" />
                                                Round Robin
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="text-xs flex items-center gap-1">
                                                <GitBranch className="h-3 w-3" />
                                                Rule-Based
                                            </Badge>
                                        )}
                                        {rule.type === "round_robin" ? (
                                            <span className="text-xs text-muted-foreground">
                                                Distribute across {rule.teamMembers.length} members
                                            </span>
                                        ) : (
                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                {rule.conditions.map((c, i) => (
                                                    <span key={i}>
                                                        {i > 0 && " & "}
                                                        {c.field} {c.operator} &quot;{c.value}&quot;
                                                    </span>
                                                ))}
                                                <ArrowRight className="h-3 w-3" />
                                                <span className="font-medium text-foreground">{rule.assignToUserName || "Unassigned"}</span>
                                            </div>
                                        )}
                                    </div>
                                    {rule.type === "round_robin" && (
                                        <p className="text-xs text-muted-foreground">
                                            Members: {rule.teamMembers.map(m => m.name).join(", ")}
                                        </p>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <Switch checked={rule.enabled} onCheckedChange={v => handleToggle(rule.id, v)} />
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenEdit(rule)}>
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
                <DialogContent className="sm:max-w-[550px] max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingRule ? "Edit Assignment Rule" : "Create Assignment Rule"}</DialogTitle>
                        <DialogDescription>
                            Define how new leads and deals are automatically assigned to team members.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-5 pt-2">
                        {/* Rule Type */}
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Assignment Type</Label>
                            <Select value={formType} onValueChange={v => setFormType(v as any)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="round_robin">
                                        <div className="flex items-center gap-2">
                                            <Shuffle className="h-3.5 w-3.5" />
                                            Round Robin - distribute evenly
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="rule_based">
                                        <div className="flex items-center gap-2">
                                            <GitBranch className="h-3.5 w-3.5" />
                                            Rule-Based - assign by conditions
                                        </div>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Round Robin: Team Member Selection */}
                        {formType === "round_robin" && (
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Team Members</Label>
                                <p className="text-xs text-muted-foreground">Select at least 2 members for round-robin distribution.</p>
                                <div className="space-y-1.5 max-h-[200px] overflow-y-auto border rounded-md p-2">
                                    {users.map(user => (
                                        <label
                                            key={user.id}
                                            className="flex items-center gap-2.5 p-2 rounded hover:bg-muted/50 cursor-pointer"
                                        >
                                            <Checkbox
                                                checked={selectedTeamMemberIds.includes(user.id)}
                                                onCheckedChange={() => handleToggleTeamMember(user.id)}
                                            />
                                            <div className="flex-1 min-w-0">
                                                <span className="text-sm font-medium">{user.name}</span>
                                                <span className="text-xs text-muted-foreground ml-2">{user.email}</span>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Rule-Based: Conditions */}
                        {formType === "rule_based" && (
                            <>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-sm font-medium">Conditions</Label>
                                        <Button variant="outline" size="sm" className="text-xs h-7" onClick={handleAddCondition}>
                                            <Plus className="h-3 w-3 mr-1" /> Add Condition
                                        </Button>
                                    </div>
                                    {formConditions.length === 0 ? (
                                        <p className="text-xs text-muted-foreground text-center py-4 border rounded-md">
                                            No conditions. Click &quot;Add Condition&quot; to define matching criteria.
                                        </p>
                                    ) : (
                                        <div className="space-y-2">
                                            {formConditions.map((cond, i) => (
                                                <div key={i} className="flex items-center gap-2 p-2 border rounded-md bg-muted/20">
                                                    <Select value={cond.field} onValueChange={v => handleUpdateCondition(i, "field", v)}>
                                                        <SelectTrigger className="w-[130px] h-8 text-xs">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="lead_source">Lead Source</SelectItem>
                                                            <SelectItem value="base">Military Base</SelectItem>
                                                            <SelectItem value="source">Source</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <Select value={cond.operator} onValueChange={v => handleUpdateCondition(i, "operator", v)}>
                                                        <SelectTrigger className="w-[110px] h-8 text-xs">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="equals">equals</SelectItem>
                                                            <SelectItem value="contains">contains</SelectItem>
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
                                                        className="h-7 w-7 shrink-0 text-red-500"
                                                        onClick={() => handleRemoveCondition(i)}
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-sm font-medium">Assign To</Label>
                                    <Select value={formAssignToUserId} onValueChange={setFormAssignToUserId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a team member" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {users.map(u => (
                                                <SelectItem key={u.id} value={u.id}>
                                                    {u.name} ({u.email})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </>
                        )}
                    </div>

                    <DialogFooter className="pt-4">
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving ? "Saving..." : editingRule ? "Save Changes" : "Create Rule"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    )
}
