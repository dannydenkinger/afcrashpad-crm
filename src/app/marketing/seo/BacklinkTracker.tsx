"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Plus,
    Trash2,
    Link2,
    Loader2,
    ArrowUpRight,
    ArrowDownRight,
    TrendingUp,
} from "lucide-react"
import {
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area,
    BarChart,
    Bar,
    Cell,
} from "recharts"
import { toast } from "sonner"
import { addBacklinkEntry, removeBacklinkEntry } from "./actions"
import type { BacklinkEntry } from "./types"

interface BacklinkTrackerProps {
    entries: BacklinkEntry[]
    onEntriesChange: (entries: BacklinkEntry[]) => void
}

export default function BacklinkTracker({
    entries,
    onEntriesChange,
}: BacklinkTrackerProps) {
    const [showAddForm, setShowAddForm] = useState(false)
    const [isAdding, setIsAdding] = useState(false)
    const [formData, setFormData] = useState({
        totalBacklinks: "",
        referringDomains: "",
        domainRating: "",
        notes: "",
    })

    async function handleAdd() {
        if (!formData.totalBacklinks || !formData.referringDomains) {
            toast.error("Backlinks and referring domains are required")
            return
        }

        setIsAdding(true)
        const result = await addBacklinkEntry({
            date: new Date().toISOString().split("T")[0],
            totalBacklinks: parseInt(formData.totalBacklinks),
            referringDomains: parseInt(formData.referringDomains),
            domainRating: formData.domainRating ? parseFloat(formData.domainRating) : null,
            notes: formData.notes,
        })

        if (result.success && result.data) {
            onEntriesChange([result.data, ...entries])
            setFormData({ totalBacklinks: "", referringDomains: "", domainRating: "", notes: "" })
            setShowAddForm(false)
            toast.success("Backlink entry added")
        } else {
            toast.error(result.error || "Failed to add entry")
        }
        setIsAdding(false)
    }

    async function handleRemove(id: string) {
        const result = await removeBacklinkEntry(id)
        if (result.success) {
            onEntriesChange(entries.filter((e) => e.id !== id))
            toast.success("Entry removed")
        } else {
            toast.error(result.error || "Failed to remove entry")
        }
    }

    // Chart data (chronological order)
    const chartEntries = [...entries].reverse()
    const backlinkChart = chartEntries.map((e) => ({
        date: new Date(e.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        backlinks: e.totalBacklinks,
        domains: e.referringDomains,
    }))

    const drChart = chartEntries
        .filter((e) => e.domainRating !== null)
        .map((e) => ({
            date: new Date(e.date).toLocaleDateString("en-US", { month: "short" }),
            dr: e.domainRating!,
        }))

    const latest = entries[0]
    const previous = entries[1]

    function getDelta(field: "totalBacklinks" | "referringDomains" | "domainRating") {
        if (!latest || !previous) return null
        const curr = latest[field]
        const prev = previous[field]
        if (curr === null || prev === null) return null
        return (curr as number) - (prev as number)
    }

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card className="border-none shadow-sm bg-card/40 backdrop-blur-md">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Backlinks</CardTitle>
                        <Link2 className="h-4 w-4 text-primary opacity-70" />
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-end gap-2">
                            <span className="text-2xl font-bold">
                                {latest ? latest.totalBacklinks.toLocaleString() : "---"}
                            </span>
                            {getDelta("totalBacklinks") !== null && (
                                <span className={`text-[10px] font-bold mb-1 ${getDelta("totalBacklinks")! >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                                    {getDelta("totalBacklinks")! >= 0 ? "+" : ""}{getDelta("totalBacklinks")}
                                </span>
                            )}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1 font-medium">Manual tracking from Ahrefs/Moz</p>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-card/40 backdrop-blur-md">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Referring Domains</CardTitle>
                        <TrendingUp className="h-4 w-4 text-blue-500 opacity-70" />
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-end gap-2">
                            <span className="text-2xl font-bold">
                                {latest ? latest.referringDomains.toLocaleString() : "---"}
                            </span>
                            {getDelta("referringDomains") !== null && (
                                <span className={`text-[10px] font-bold mb-1 ${getDelta("referringDomains")! >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                                    {getDelta("referringDomains")! >= 0 ? "+" : ""}{getDelta("referringDomains")}
                                </span>
                            )}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1 font-medium">Unique linking domains</p>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-card/40 backdrop-blur-md">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Domain Rating</CardTitle>
                        <TrendingUp className="h-4 w-4 text-amber-500 opacity-70" />
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-end gap-2">
                            <span className="text-2xl font-bold">
                                {latest?.domainRating !== null && latest?.domainRating !== undefined ? latest.domainRating : "---"}
                            </span>
                            {getDelta("domainRating") !== null && (
                                <span className={`text-[10px] font-bold mb-1 ${getDelta("domainRating")! >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                                    {getDelta("domainRating")! >= 0 ? "+" : ""}{getDelta("domainRating")}
                                </span>
                            )}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1 font-medium">Ahrefs DR / Moz DA</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* Backlink Growth Chart */}
                <Card className="border-none shadow-md bg-card/40 backdrop-blur-md">
                    <CardHeader>
                        <CardTitle className="text-base font-semibold">Backlink Growth</CardTitle>
                        <CardDescription className="text-xs">Backlinks & referring domains over time</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[250px]">
                        {backlinkChart.length > 1 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={backlinkChart}>
                                    <defs>
                                        <linearGradient id="colorBacklinks" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#666" }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#666" }} />
                                    <Tooltip contentStyle={{ backgroundColor: "#18181b", border: "none", borderRadius: "8px", color: "#fff", fontSize: "11px" }} />
                                    <Area type="monotone" dataKey="backlinks" stroke="#3b82f6" fillOpacity={1} fill="url(#colorBacklinks)" strokeWidth={2} />
                                    <Area type="monotone" dataKey="domains" stroke="#10b981" fill="transparent" strokeWidth={2} strokeDasharray="5 5" />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                                <Link2 className="h-8 w-8 mb-2 opacity-30" />
                                <p className="text-xs">Add at least 2 entries to see trends</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* DR History Chart */}
                <Card className="border-none shadow-md bg-card/40 backdrop-blur-md">
                    <CardHeader>
                        <CardTitle className="text-base font-semibold">Domain Rating History</CardTitle>
                        <CardDescription className="text-xs">DR/DA score progression</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[250px]">
                        {drChart.length > 1 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={drChart}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#666" }} />
                                    <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#666" }} />
                                    <Tooltip contentStyle={{ backgroundColor: "#18181b", border: "none", borderRadius: "8px", color: "#fff", fontSize: "11px" }} />
                                    <Bar dataKey="dr" radius={[4, 4, 0, 0]} barSize={20}>
                                        {drChart.map((_, index) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={index === drChart.length - 1 ? "#f59e0b" : "#f59e0b80"}
                                            />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                                <TrendingUp className="h-8 w-8 mb-2 opacity-30" />
                                <p className="text-xs">Add entries with DR to see history</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Entry Log & Add Form */}
            <Card className="border-none shadow-md bg-card/40 backdrop-blur-md">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-base font-semibold">Backlink Log</CardTitle>
                            <CardDescription className="text-xs">
                                Manually log backlink data from Ahrefs, Moz, or other tools
                            </CardDescription>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-[10px] gap-1"
                            onClick={() => setShowAddForm(!showAddForm)}
                        >
                            <Plus className="h-3 w-3" />
                            Add Entry
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Add Form */}
                    {showAddForm && (
                        <div className="p-4 rounded-lg bg-background/30 border border-white/5 space-y-3">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div>
                                    <label className="text-[10px] text-muted-foreground font-bold uppercase mb-1 block">Backlinks *</label>
                                    <Input
                                        type="number"
                                        placeholder="2400"
                                        value={formData.totalBacklinks}
                                        onChange={(e) => setFormData({ ...formData, totalBacklinks: e.target.value })}
                                        className="h-8 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] text-muted-foreground font-bold uppercase mb-1 block">Ref. Domains *</label>
                                    <Input
                                        type="number"
                                        placeholder="180"
                                        value={formData.referringDomains}
                                        onChange={(e) => setFormData({ ...formData, referringDomains: e.target.value })}
                                        className="h-8 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] text-muted-foreground font-bold uppercase mb-1 block">DR/DA Score</label>
                                    <Input
                                        type="number"
                                        placeholder="42"
                                        value={formData.domainRating}
                                        onChange={(e) => setFormData({ ...formData, domainRating: e.target.value })}
                                        className="h-8 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] text-muted-foreground font-bold uppercase mb-1 block">Notes</label>
                                    <Input
                                        placeholder="Optional notes..."
                                        value={formData.notes}
                                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                        onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                                        className="h-8 text-sm"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={() => setShowAddForm(false)}>
                                    Cancel
                                </Button>
                                <Button
                                    size="sm"
                                    className="h-7 text-[10px]"
                                    onClick={handleAdd}
                                    disabled={isAdding}
                                >
                                    {isAdding ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                                    Save Entry
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Entry List */}
                    {entries.length > 0 ? (
                        <div className="overflow-x-auto">
                        <div className="min-w-[550px] space-y-1">
                            <div className="grid grid-cols-12 gap-2 px-3 py-2 text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                                <div className="col-span-2">Date</div>
                                <div className="col-span-2 text-right">Backlinks</div>
                                <div className="col-span-2 text-right">Ref. Domains</div>
                                <div className="col-span-2 text-right">DR/DA</div>
                                <div className="col-span-3">Notes</div>
                                <div className="col-span-1" />
                            </div>
                            {entries.map((entry) => (
                                <div
                                    key={entry.id}
                                    className="grid grid-cols-12 gap-2 px-3 py-2.5 rounded-lg hover:bg-muted/10 transition-colors items-center"
                                >
                                    <div className="col-span-2 text-xs">
                                        {new Date(entry.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                    </div>
                                    <div className="col-span-2 text-right text-xs font-bold">{entry.totalBacklinks.toLocaleString()}</div>
                                    <div className="col-span-2 text-right text-xs font-medium">{entry.referringDomains.toLocaleString()}</div>
                                    <div className="col-span-2 text-right">
                                        {entry.domainRating !== null ? (
                                            <Badge variant="secondary" className="text-[10px] font-bold h-5 px-1.5">{entry.domainRating}</Badge>
                                        ) : (
                                            <span className="text-[10px] text-muted-foreground">--</span>
                                        )}
                                    </div>
                                    <div className="col-span-3 text-[10px] text-muted-foreground truncate">{entry.notes || "--"}</div>
                                    <div className="col-span-1 flex justify-end">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 w-6 p-0 text-muted-foreground hover:text-rose-500"
                                            onClick={() => handleRemove(entry.id)}
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        </div>
                    ) : (
                        <div className="py-6 flex flex-col items-center justify-center text-muted-foreground">
                            <Link2 className="h-8 w-8 mb-2 opacity-30" />
                            <p className="text-xs">No backlink data yet</p>
                            <p className="text-[10px] mt-1">Log your backlink metrics from Ahrefs or Moz to track growth</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
