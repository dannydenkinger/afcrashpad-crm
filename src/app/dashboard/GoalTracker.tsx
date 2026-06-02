"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Target, Plus, X, Check, Pencil } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

interface Goal {
    id: string
    label: string
    target: number
    current: number
    metric: "revenue" | "deals" | "contacts" | "conversion" | "custom"
    period: "monthly" | "quarterly" | "yearly"
}

interface GoalTrackerProps {
    kpi: {
        monthlyRevenue: number
        totalPipelineValue: number
        conversionRate: number
        totalContacts: number
        activeStayCount: number
        openInquiries: number
    }
}

const defaultGoals: Goal[] = [
    { id: "1", label: "Monthly Revenue", target: 50000, current: 0, metric: "revenue", period: "monthly" },
    { id: "2", label: "New Deals Closed", target: 20, current: 0, metric: "deals", period: "monthly" },
]

export function GoalTracker({ kpi }: GoalTrackerProps) {
    const [goals, setGoals] = useState<Goal[]>([])
    const [showAdd, setShowAdd] = useState(false)
    const [editingGoal, setEditingGoal] = useState<Goal | null>(null)
    const [newLabel, setNewLabel] = useState("")
    const [newTarget, setNewTarget] = useState("")
    const [newMetric, setNewMetric] = useState<Goal["metric"]>("custom")
    const [newPeriod, setNewPeriod] = useState<Goal["period"]>("monthly")

    useEffect(() => {
        try {
            const saved = localStorage.getItem("dashboard-goals")
            if (saved) {
                setGoals(JSON.parse(saved))
            } else {
                setGoals(defaultGoals)
                localStorage.setItem("dashboard-goals", JSON.stringify(defaultGoals))
            }
        } catch {
            setGoals(defaultGoals)
        }
    }, [])

    // Auto-map KPI values to goals
    const getGoalCurrent = (goal: Goal): number => {
        switch (goal.metric) {
            case "revenue": return kpi.monthlyRevenue
            case "deals": return kpi.activeStayCount
            case "contacts": return kpi.totalContacts
            case "conversion": return kpi.conversionRate
            default: return goal.current
        }
    }

    const saveGoals = (updated: Goal[]) => {
        setGoals(updated)
        localStorage.setItem("dashboard-goals", JSON.stringify(updated))
    }

    const handleSaveGoal = () => {
        if (!newLabel.trim() || !newTarget) return
        if (editingGoal) {
            saveGoals(goals.map(g => g.id === editingGoal.id
                ? { ...g, label: newLabel.trim(), target: Number(newTarget), metric: newMetric, period: newPeriod }
                : g
            ))
        } else {
            const goal: Goal = {
                id: crypto.randomUUID(),
                label: newLabel.trim(),
                target: Number(newTarget),
                current: 0,
                metric: newMetric,
                period: newPeriod,
            }
            saveGoals([...goals, goal])
        }
        resetForm()
    }

    const resetForm = () => {
        setShowAdd(false)
        setEditingGoal(null)
        setNewLabel("")
        setNewTarget("")
        setNewMetric("custom")
        setNewPeriod("monthly")
    }

    const handleEdit = (goal: Goal) => {
        setEditingGoal(goal)
        setNewLabel(goal.label)
        setNewTarget(String(goal.target))
        setNewMetric(goal.metric)
        setNewPeriod(goal.period)
        setShowAdd(true)
    }

    const handleDelete = (id: string) => {
        saveGoals(goals.filter(g => g.id !== id))
    }

    return (
        <>
        <Card className="border-none shadow-md bg-card/40 backdrop-blur-md h-full w-full flex flex-col overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 sm:p-5 pb-3 shrink-0">
                <div className="space-y-1">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <Target className="h-4 w-4 text-primary" />
                        Goals
                    </CardTitle>
                    <CardDescription className="text-xs">Track progress toward targets</CardDescription>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { resetForm(); setShowAdd(true); }}>
                    <Plus className="h-4 w-4" />
                </Button>
            </CardHeader>
            <CardContent className="px-4 sm:px-5 pt-0 pb-4 flex-1 min-h-0 overflow-auto">
                <div className="space-y-4">
                    {goals.length === 0 && (
                        <div className="text-center py-6 text-muted-foreground text-sm">
                            <p>No goals set yet</p>
                            <Button variant="outline" size="sm" className="mt-2 h-7 text-xs" onClick={() => setShowAdd(true)}>
                                <Plus className="h-3 w-3 mr-1" /> Add Goal
                            </Button>
                        </div>
                    )}
                    {goals.map((goal) => {
                        const current = getGoalCurrent(goal)
                        const pct = goal.target > 0 ? Math.min(100, Math.round((current / goal.target) * 100)) : 0
                        const isComplete = pct >= 100
                        return (
                            <div key={goal.id} className="group">
                                <div className="flex items-center justify-between mb-1.5">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold">{goal.label}</span>
                                        <Badge variant="outline" className="text-[9px] h-4 px-1.5 capitalize">{goal.period}</Badge>
                                        {isComplete && <Check className="h-3.5 w-3.5 text-emerald-500" />}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className={`text-xs font-bold ${isComplete ? "text-emerald-500" : "text-foreground"}`}>
                                            {goal.metric === "revenue" ? `$${current.toLocaleString()}` : current.toLocaleString()}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground">
                                            / {goal.metric === "revenue" ? `$${goal.target.toLocaleString()}` : goal.target.toLocaleString()}
                                        </span>
                                        <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity ml-1" onClick={() => handleEdit(goal)}>
                                            <Pencil className="h-2.5 w-2.5" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity text-destructive" onClick={() => handleDelete(goal.id)}>
                                            <X className="h-2.5 w-2.5" />
                                        </Button>
                                    </div>
                                </div>
                                <div className="h-2 w-full bg-muted/30 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-700 ease-out ${isComplete ? "bg-emerald-500" : pct > 60 ? "bg-primary" : pct > 30 ? "bg-amber-500" : "bg-rose-500"}`}
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>
                                <span className="text-[10px] text-muted-foreground font-medium">{pct}% complete</span>
                            </div>
                        )
                    })}
                </div>
            </CardContent>
        </Card>

        <Dialog open={showAdd} onOpenChange={(open) => { if (!open) resetForm(); }}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{editingGoal ? "Edit Goal" : "Add Goal"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <div>
                        <label className="text-xs font-medium mb-1.5 block">Goal Name</label>
                        <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="e.g. Monthly Revenue Target" className="h-9" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-medium mb-1.5 block">Target Value</label>
                            <Input type="number" value={newTarget} onChange={(e) => setNewTarget(e.target.value)} placeholder="50000" className="h-9" />
                        </div>
                        <div>
                            <label className="text-xs font-medium mb-1.5 block">Period</label>
                            <Select value={newPeriod} onValueChange={(v) => setNewPeriod(v as Goal["period"])}>
                                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="monthly">Monthly</SelectItem>
                                    <SelectItem value="quarterly">Quarterly</SelectItem>
                                    <SelectItem value="yearly">Yearly</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-medium mb-1.5 block">Auto-track Metric</label>
                        <Select value={newMetric} onValueChange={(v) => setNewMetric(v as Goal["metric"])}>
                            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="revenue">Monthly Revenue</SelectItem>
                                <SelectItem value="deals">Active Stays</SelectItem>
                                <SelectItem value="contacts">Total Contacts</SelectItem>
                                <SelectItem value="conversion">Conversion Rate %</SelectItem>
                                <SelectItem value="custom">Manual Entry</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={resetForm}>Cancel</Button>
                    <Button onClick={handleSaveGoal} disabled={!newLabel.trim() || !newTarget}>
                        {editingGoal ? "Update" : "Add"} Goal
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        </>
    )
}
