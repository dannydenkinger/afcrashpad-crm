"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
    PieChart
} from "lucide-react";

// Dynamically import calculators with SSR disabled to avoid gRPC errors
const BAHCalculator = dynamic(() => import("@/components/calculators/BAHCalculator").then(mod => mod.BAHCalculator), {
    ssr: false,
    loading: () => <div className="h-[400px] flex items-center justify-center bg-muted/20 rounded-xl">Loading BAH Tool...</div>
});


const VALoanCalculator = dynamic(() => import("@/components/calculators/VALoanCalculator").then(mod => mod.VALoanCalculator), {
    ssr: false,
    loading: () => <div className="h-[400px] flex items-center justify-center bg-muted/20 rounded-xl">Loading VA Loan Tool...</div>
});

const OnBaseLodgingCalculator = dynamic(() => import("@/components/calculators/OnBaseLodgingCalculator").then(mod => mod.OnBaseLodgingCalculator), {
    ssr: false,
    loading: () => <div className="h-[400px] flex items-center justify-center bg-muted/20 rounded-xl">Loading On-Base Tool...</div>
});

const HomeAffordabilityCalculator = dynamic(() => import("@/components/calculators/HomeAffordabilityCalculator").then(mod => mod.HomeAffordabilityCalculator), {
    ssr: false,
    loading: () => <div className="h-[400px] flex items-center justify-center bg-muted/20 rounded-xl">Loading Affordability Tool...</div>
});

const OffBaseLodgingCalculator = dynamic(() => import("@/components/calculators/OffBaseLodgingCalculator").then(mod => mod.default), {
    ssr: false,
    loading: () => <div className="h-[400px] flex items-center justify-center bg-muted/20 rounded-xl">Loading Off-Base Tool...</div>
});

type ToolType = "HUB" | "BAH" | "VA" | "ON_BASE" | "OFF_BASE" | "AFFORDABILITY";

export default function ToolsPage() {
    const [activeTool, setActiveTool] = useState<ToolType>("HUB");

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
                <div className="space-y-6 p-4 sm:p-6 lg:p-8 pt-4 sm:pt-6 pb-8 max-w-4xl mx-auto">
                <Button
                    variant="ghost"
                    className="mb-2 sm:mb-4 touch-manipulation"
                    onClick={() => setActiveTool("HUB")}
                >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Tools Hub
                </Button>

                <Card className="border border-border/50 shadow-xl bg-card/50 backdrop-blur-md">
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
            <div className="space-y-6 sm:space-y-8 p-4 sm:p-6 lg:p-8 pt-4 sm:pt-6 pb-8">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Tools Hub</h2>
                        <p className="text-sm sm:text-base text-muted-foreground mt-0.5">Select a specialized tool to get started.</p>
                    </div>
                    <Wrench className="h-8 w-8 text-primary/30 shrink-0 hidden sm:block" />
                </div>

                <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
                {tools.map((tool) => (
                    <Card
                        key={tool.id}
                        className="group relative cursor-pointer overflow-hidden border border-border/50 shadow-md transition-all hover:translate-y-[-4px] hover:shadow-xl bg-card/50 backdrop-blur-md"
                        onClick={() => setActiveTool(tool.id)}
                    >
                        <CardHeader>
                            <div className={`p-3 rounded-xl w-fit mb-3 transition-colors ${tool.bg} ${tool.color} group-hover:bg-primary group-hover:text-primary-foreground`}>
                                <tool.icon className="h-6 w-6" />
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

                <div className="grid gap-4 sm:gap-6 lg:grid-cols-7">
                <Card className="lg:col-span-4 border border-border/50 shadow-lg bg-card/30 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                            <Calculator className="h-4 w-4" />
                            Coming Soon
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 gap-4">
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
        </div>
    );
}
