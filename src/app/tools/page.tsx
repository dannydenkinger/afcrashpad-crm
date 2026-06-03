"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Calculator,
    Home,
    MapPin,
    DollarSign,
    ChevronRight,
    Wrench,
    ArrowLeft,
    Lightbulb,
    Building2,
    PieChart,
    Star,
    Clock,
    History,
    Trash2,
    Printer,
} from "lucide-react";

// Dynamically import calculators with SSR disabled to avoid gRPC errors
const CalcSkeleton = () => (
    <div className="h-[400px] flex flex-col items-center justify-center bg-muted/20 rounded-xl gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <span className="text-sm text-muted-foreground">Loading calculator...</span>
    </div>
);

const BAHCalculator = dynamic(() => import("@/components/calculators/BAHCalculator").then(mod => mod.BAHCalculator), {
    ssr: false,
    loading: CalcSkeleton,
});

const VALoanCalculator = dynamic(() => import("@/components/calculators/VALoanCalculator").then(mod => mod.VALoanCalculator), {
    ssr: false,
    loading: CalcSkeleton,
});

const OnBaseLodgingCalculator = dynamic(() => import("@/components/calculators/OnBaseLodgingCalculator").then(mod => mod.OnBaseLodgingCalculator), {
    ssr: false,
    loading: CalcSkeleton,
});

const HomeAffordabilityCalculator = dynamic(() => import("@/components/calculators/HomeAffordabilityCalculator").then(mod => mod.HomeAffordabilityCalculator), {
    ssr: false,
    loading: CalcSkeleton,
});

const OffBaseLodgingCalculator = dynamic(() => import("@/components/calculators/OffBaseLodgingCalculator").then(mod => mod.default), {
    ssr: false,
    loading: CalcSkeleton,
});

type ToolType = "HUB" | "BAH" | "VA" | "ON_BASE" | "OFF_BASE" | "AFFORDABILITY";

interface CalcHistoryEntry {
    id: string
    tool: ToolType
    toolName: string
    timestamp: string
    summary: string
}

export default function ToolsPage() {
    const [activeTool, setActiveTool] = useState<ToolType>("HUB");
    const [favorites, setFavorites] = useState<ToolType[]>([]);
    const [recentTools, setRecentTools] = useState<ToolType[]>([]);
    const [calcHistory, setCalcHistory] = useState<CalcHistoryEntry[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [showClearHistoryConfirm, setShowClearHistoryConfirm] = useState(false);

    useEffect(() => {
        try {
            const savedFavs = localStorage.getItem("tools-favorites");
            if (savedFavs) setFavorites(JSON.parse(savedFavs));
            const savedRecent = localStorage.getItem("tools-recent");
            if (savedRecent) setRecentTools(JSON.parse(savedRecent));
            const savedHistory = localStorage.getItem("tools-calc-history");
            if (savedHistory) setCalcHistory(JSON.parse(savedHistory));
        } catch {}
    }, []);

    // Listen for calculator results via custom events
    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail
            if (!detail?.tool || !detail?.summary) return
            const entry: CalcHistoryEntry = {
                id: crypto.randomUUID(),
                tool: detail.tool,
                toolName: tools.find(t => t.id === detail.tool)?.title || detail.tool,
                timestamp: new Date().toISOString(),
                summary: detail.summary,
            }
            setCalcHistory(prev => {
                const updated = [entry, ...prev].slice(0, 50)
                localStorage.setItem("tools-calc-history", JSON.stringify(updated))
                return updated
            })
        }
        window.addEventListener("calc-result", handler)
        return () => window.removeEventListener("calc-result", handler)
    }, []);

    const openTool = (id: ToolType) => {
        setActiveTool(id);
        const updated = [id, ...recentTools.filter(t => t !== id)].slice(0, 3);
        setRecentTools(updated);
        localStorage.setItem("tools-recent", JSON.stringify(updated));
    };

    const toggleFavorite = (e: React.MouseEvent, id: ToolType) => {
        e.stopPropagation();
        const updated = favorites.includes(id) ? favorites.filter(f => f !== id) : [...favorites, id];
        setFavorites(updated);
        localStorage.setItem("tools-favorites", JSON.stringify(updated));
    };

    const tools = [
        {
            id: "BAH" as ToolType,
            title: "BAH Calculator",
            description: "Calculate Basic Allowance for Housing by ZIP and Grade.",
            icon: Home,
            color: "text-blue-500",
            bg: "bg-blue-500/10"
        },

        {
            id: "VA" as ToolType,
            title: "VA Loan Estimator",
            description: "Calculate mortgage payments and VA funding fees.",
            icon: DollarSign,
            color: "text-green-500",
            bg: "bg-green-500/10"
        },
        {
            id: "ON_BASE" as ToolType,
            title: "On-Base Lodging",
            description: "Official FY25 on-base lodging rates for military installations.",
            icon: Building2,
            color: "text-[#002868]",
            bg: "bg-[#002868]/10"
        },
        {
            id: "OFF_BASE" as ToolType,
            title: "Off-Base Lodging",
            description: "Official GSA lodging and M&IE per diem rates.",
            icon: Building2,
            color: "text-blue-500",
            bg: "bg-blue-500/10"
        },
        {
            id: "AFFORDABILITY" as ToolType,
            title: "Home Affordability",
            description: "Purchasing power analysis based on income and DTI.",
            icon: PieChart,
            color: "text-emerald-500",
            bg: "bg-emerald-500/10"
        }
    ];

    if (activeTool !== "HUB") {
        return (
            <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="space-y-6 p-4 sm:p-6 lg:p-8 pt-4 sm:pt-6 pb-28 md:pb-8 max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-2 sm:mb-4">
                    <Button
                        variant="ghost"
                        className="touch-manipulation"
                        onClick={() => setActiveTool("HUB")}
                    >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Tools Hub
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 text-xs"
                        onClick={() => {
                            const printWindow = window.open("", "_blank")
                            if (!printWindow) return
                            const toolCard = document.querySelector("[data-calc-content]")
                            const content = toolCard?.innerHTML || ""
                            const toolName = tools.find(t => t.id === activeTool)?.title || "Calculator"
                            printWindow.document.write(`<!DOCTYPE html><html><head><title>${toolName} Results</title><style>body{font-family:system-ui,-apple-system,sans-serif;padding:24px;color:#1a1a1a}table{border-collapse:collapse;width:100%}th,td{border:1px solid #e5e7eb;padding:8px 12px;text-align:left;font-size:13px}th{background:#f9fafb;font-weight:600}h2{margin:0 0 12px}button,.no-print{display:none!important}@media print{body{padding:0}}</style></head><body><h2>${toolName}</h2><p style="color:#6b7280;font-size:12px;margin-bottom:16px">Exported on ${new Date().toLocaleDateString()}</p>${content}</body></html>`)
                            printWindow.document.close()
                            printWindow.print()
                        }}
                    >
                        <Printer className="h-3.5 w-3.5" />
                        Print / PDF
                    </Button>
                </div>

                <Card className="border border-border/50 shadow-xl bg-card/50 backdrop-blur-md" data-calc-content>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            {activeTool === "BAH" && <Home className="h-5 w-5 text-blue-500" />}
                            {activeTool === "VA" && <DollarSign className="h-5 w-5 text-green-500" />}
                            {activeTool === "ON_BASE" && <Building2 className="h-5 w-5 text-[#002868]" />}
                            {activeTool === "OFF_BASE" && <Building2 className="h-5 w-5 text-blue-500" />}
                            {activeTool === "AFFORDABILITY" && <PieChart className="h-5 w-5 text-emerald-500" />}
                            {tools.find(t => t.id === activeTool)?.title}
                        </CardTitle>
                        <CardDescription>
                            {tools.find(t => t.id === activeTool)?.description}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {activeTool === "BAH" && <BAHCalculator />}
                        {activeTool === "VA" && <VALoanCalculator />}
                        {activeTool === "ON_BASE" && <OnBaseLodgingCalculator />}
                        {activeTool === "OFF_BASE" && <OffBaseLodgingCalculator />}
                        {activeTool === "AFFORDABILITY" && <HomeAffordabilityCalculator />}
                    </CardContent>
                </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="space-y-6 sm:space-y-8 p-4 sm:p-6 lg:p-8 pt-4 sm:pt-6 pb-28 md:pb-8">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Tools Hub</h2>
                        <p className="text-sm sm:text-base text-muted-foreground mt-0.5">Select a specialized tool to get started.</p>
                    </div>
                    <Wrench className="h-8 w-8 text-primary/30 shrink-0 hidden sm:block" />
                </div>

                {recentTools.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" /> Recent:
                        </span>
                        {recentTools.map(id => {
                            const t = tools.find(tool => tool.id === id);
                            if (!t) return null;
                            return (
                                <Badge
                                    key={id}
                                    variant="secondary"
                                    className="cursor-pointer hover:bg-secondary/80 text-xs gap-1"
                                    onClick={() => openTool(id)}
                                >
                                    <t.icon className="h-3 w-3" />
                                    {t.title}
                                </Badge>
                            );
                        })}
                    </div>
                )}

                <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
                {tools.map((tool) => (
                    <Card
                        key={tool.id}
                        className={`group relative cursor-pointer overflow-hidden border shadow-md transition-all hover:translate-y-[-4px] hover:shadow-xl bg-card/50 backdrop-blur-md ${favorites.includes(tool.id) ? "border-primary/30 ring-1 ring-primary/10" : "border-border/50"}`}
                        onClick={() => openTool(tool.id)}
                    >
                        <CardHeader>
                            <div className="flex items-start justify-between">
                                <div className={`p-3 rounded-xl w-fit mb-3 transition-colors ${tool.bg} ${tool.color} group-hover:bg-primary group-hover:text-primary-foreground`}>
                                    <tool.icon className="h-6 w-6" />
                                </div>
                                <button
                                    onClick={(e) => toggleFavorite(e, tool.id)}
                                    className="p-1 rounded-md hover:bg-muted/50 transition-colors"
                                    title={favorites.includes(tool.id) ? "Remove from favorites" : "Add to favorites"}
                                >
                                    <Star className={`h-4 w-4 ${favorites.includes(tool.id) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                                </button>
                            </div>
                            <CardTitle>{tool.title}</CardTitle>
                            <CardDescription className="line-clamp-2">
                                {tool.description}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex justify-between items-center text-sm">
                            <Badge variant="secondary" className="bg-muted/30 group-hover:bg-primary/20 transition-colors">
                                Ready to use
                            </Badge>
                            <span className="flex items-center text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                Launch Tool <ChevronRight className="h-4 w-4 ml-1" />
                            </span>
                        </CardContent>
                    </Card>
                ))}

                <Card className="border-dashed border-2 bg-transparent flex flex-col items-center justify-center p-8 text-center text-muted-foreground opacity-60">
                    <div className="p-4 rounded-full bg-muted mb-4 text-muted-foreground/50">
                        <Wrench className="h-8 w-8" />
                    </div>
                    <CardTitle className="text-lg">Need more?</CardTitle>
                    <CardDescription>New calculators are added regularly</CardDescription>
                </Card>
            </div>

                {calcHistory.length > 0 && (
                    <Card className="border border-border/50 shadow-lg bg-card/30 backdrop-blur-sm">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                    <History className="h-4 w-4" />
                                    Calculation History
                                </CardTitle>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs text-muted-foreground"
                                        onClick={() => setShowHistory(!showHistory)}
                                    >
                                        {showHistory ? "Collapse" : `Show All (${calcHistory.length})`}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                        onClick={() => setShowClearHistoryConfirm(true)}
                                        title="Clear history"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {(showHistory ? calcHistory : calcHistory.slice(0, 5)).map((entry) => (
                                    <div
                                        key={entry.id}
                                        className="flex items-center justify-between p-2.5 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors cursor-pointer"
                                        onClick={() => openTool(entry.tool)}
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <Badge variant="secondary" className="text-[10px] shrink-0">{entry.toolName}</Badge>
                                            <span className="text-xs font-medium truncate">{entry.summary}</span>
                                        </div>
                                        <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                                            {new Date(entry.timestamp).toLocaleDateString()} {new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                <div className="grid gap-4 sm:gap-6 lg:grid-cols-7">
                <Card className="lg:col-span-4 border border-border/50 shadow-lg bg-card/30 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                            <Calculator className="h-4 w-4" />
                            Coming Soon
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="p-4 rounded-lg bg-muted/30 border border-dashed border-muted flex flex-col gap-1">
                                <span className="font-bold text-sm">PCS Mileage</span>
                                <span className="text-xs text-muted-foreground">Estimate MALT and Flat Rate Per Diem for moves.</span>
                            </div>
                            <div className="p-4 rounded-lg bg-muted/30 border border-dashed border-muted flex flex-col gap-1">
                                <span className="font-bold text-sm">DLA Estimator</span>
                                <span className="text-xs text-muted-foreground">Calculate Dislocation Allowance for upcoming PCS.</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="lg:col-span-3 border-none shadow-premium bg-primary text-primary-foreground relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Lightbulb size={120} />
                    </div>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            Power Tip
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 relative z-10">
                        <p className="text-sm opacity-90">
                            Launch these tools directly from the
                            <span className="font-bold mx-1">Pipeline</span>
                            to automatically update deal values and expected margins.
                        </p>
                        <div className="p-3 rounded-lg bg-primary-foreground/10 text-xs border border-primary-foreground/20 backdrop-blur-sm">
                            Look for the <span className="font-bold mx-1">Calculate Opportunity Cost</span>
                            trigger in deal details.
                        </div>
                    </CardContent>
                </Card>
            </div>
            </div>

            <AlertDialog open={showClearHistoryConfirm} onOpenChange={setShowClearHistoryConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Clear calculation history?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete all {calcHistory.length} calculation history entries. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-white hover:bg-destructive/90"
                            onClick={() => { setCalcHistory([]); localStorage.removeItem("tools-calc-history"); }}
                        >
                            Clear History
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
