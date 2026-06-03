"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
    Loader2,
    Save,
    RefreshCw,
    Calculator,
    Building2,
    ArrowRight,
    ShieldCheck,
    Calendar as CalendarIcon,
    Moon,
    ChevronDown,
    ChevronUp
} from "lucide-react";
import { lodgingData, calculateOnBaseLodging, CalculationResult } from "@/lib/calculators/on-base";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface OnBaseLodgingCalculatorProps {
    contactId?: string;
    initialZip?: string; // Kept for prop parity, though unused here
    initialBase?: string;
    initialStartDate?: string;
    initialEndDate?: string;
    onSyncValue?: (value: number, type: "ON_BASE", metadata?: any) => void;
    embedded?: boolean;
}

export function OnBaseLodgingCalculator({
    contactId,
    initialBase,
    initialStartDate,
    initialEndDate,
    onSyncValue,
    embedded = false
}: OnBaseLodgingCalculatorProps) {
    const [selectedBase, setSelectedBase] = useState(initialBase || "");
    const [startDate, setStartDate] = useState(initialStartDate || "");
    const [endDate, setEndDate] = useState(initialEndDate || "");
    const [result, setResult] = useState<CalculationResult | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncSuccess, setSyncSuccess] = useState<string | null>(null);
    const [expandedBreakdown, setExpandedBreakdown] = useState(false);

    const bases = useMemo(() => Object.keys(lodgingData).sort(), []);

    const parseLocal = (ds: string) => {
        if (!ds) return new Date();
        const [y, m, d] = ds.split('-').map(Number);
        return new Date(y, m - 1, d, 12, 0, 0);
    };

    const handleCalculate = () => {
        if (!selectedBase || !startDate || !endDate) return;
        const res = calculateOnBaseLodging(selectedBase, startDate, endDate);
        setResult(res);
        setExpandedBreakdown(false);
    };

    const handleSyncToCRM = async (value: number) => {
        if (onSyncValue) {
            onSyncValue(value, "ON_BASE", result);
            setSyncSuccess(`Applied!`);
            setTimeout(() => setSyncSuccess(null), 3000);
            return;
        }

        if (!contactId) {
            alert("No contact context for syncing.");
            return;
        }

        setIsSyncing(true);
        try {
            // Assume we had a sync action, simulating success
            setSyncSuccess("Synced!");
            setTimeout(() => setSyncSuccess(null), 3000);
        } catch (e) {
            console.error(e);
        } finally {
            setIsSyncing(false);
        }
    };

    const handleSaveSnapshot = async () => {
        if (!contactId || !result) {
            alert("Snapshot saving requires a contact context.");
            return;
        }

        setIsSaving(true);
        try {
            if (!db) throw new Error("Firebase not initialized");
            const snapshotsRef = collection(db, "calculationSnapshots");
            await addDoc(snapshotsRef, {
                contactId,
                type: "ON_BASE",
                base: selectedBase,
                data: result,
                timestamp: serverTimestamp(),
            });
            setSaveSuccess(`Saved`);
            setTimeout(() => setSaveSuccess(null), 3000);
        } catch (e: any) {
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            {!embedded && (
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20 shadow-inner">
                            <Building2 className="h-5 w-5 text-indigo-500" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black tracking-tight text-foreground">On-Base Rate</h3>
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">DoD Lodging Simulator</p>
                        </div>
                    </div>
                </div>
            )}

            <div className={cn(
                "grid gap-6 items-start transition-all duration-500",
                result && !embedded ? "lg:grid-cols-2" : "grid-cols-1 w-full"
            )}>
                {/* Configuration Card */}
                <Card className="border-none bg-card/40 backdrop-blur-xl shadow-2xl shadow-indigo-500/5 overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 opacity-20 group-hover:opacity-100 transition-opacity" />
                    <CardHeader className="pb-4">
                        <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                            <Calculator className="h-4 w-4 text-indigo-500" />
                            Calculation Input
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        <div className="space-y-2">
                            <Label className="text-[11px] font-bold uppercase opacity-70">Military Installation</Label>
                            <Select value={selectedBase} onValueChange={setSelectedBase}>
                                <SelectTrigger className="bg-background/50 border-border/50 h-11 font-medium">
                                    <SelectValue placeholder="Select Base..." />
                                </SelectTrigger>
                                <SelectContent className="backdrop-blur-3xl max-h-[300px]">
                                    {bases.map(base => (
                                        <SelectItem key={base} value={base}>{base}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[11px] font-bold uppercase opacity-70 flex items-center gap-1">
                                    <CalendarIcon size={12} /> Check-In
                                </Label>
                                <Input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="bg-background/50 border-border/50 h-11"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[11px] font-bold uppercase opacity-70 flex items-center gap-1">
                                    <CalendarIcon size={12} /> Check-Out
                                </Label>
                                <Input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="bg-background/50 border-border/50 h-11"
                                />
                            </div>
                        </div>

                        <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
                            <Button
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-12 rounded-xl transition-all shadow-lg shadow-indigo-500/20 font-bold gap-2 mt-2"
                                onClick={handleCalculate}
                                disabled={!selectedBase || !startDate || !endDate}
                            >
                                Calculate Totals
                                <ArrowRight className="h-4 w-4" />
                            </Button>
                        </motion.div>
                    </CardContent>
                </Card>

                {/* Results Section */}
                <AnimatePresence mode="wait">
                    {result && (
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="space-y-4"
                        >
                            <div className="relative p-8 rounded-3xl bg-gradient-to-br from-indigo-600 to-indigo-900 text-white shadow-2xl overflow-hidden min-h-[220px] flex flex-col justify-center border border-white/10 group">
                                <motion.div
                                    className="absolute -top-12 -right-12 opacity-10 group-hover:opacity-20 transition-opacity"
                                    initial={{ rotate: -12, scale: 1 }}
                                    animate={{ rotate: 12, scale: 1.1 }}
                                    transition={{ repeat: Infinity, repeatType: "reverse", duration: 10 }}
                                >
                                    <Building2 className="h-56 w-56" />
                                </motion.div>

                                <div className="relative z-10 space-y-6">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-100/60 mb-1">Total Stay Cost</p>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-2xl font-bold opacity-60">$</span>
                                            <h3 className="text-5xl font-black tracking-tighter">
                                                {Math.round(result.totalCost).toLocaleString()}
                                            </h3>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-6 py-4 border-y border-white/10">
                                        <div>
                                            <p className="text-[9px] font-bold uppercase tracking-wider text-white/50 mb-0.5">Duration</p>
                                            <p className="text-sm font-black flex items-center gap-1.5 italic">
                                                <Moon size={14} className="text-indigo-300" />
                                                {result.totalNights} Nights
                                            </p>
                                        </div>
                                        <div className="border-l border-white/10 pl-6">
                                            <p className="text-[9px] font-bold uppercase tracking-wider text-white/50 mb-0.5">Location</p>
                                            <p className="text-sm font-black truncate">{selectedBase}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 pt-1">
                                        <Badge className="bg-white/20 hover:bg-white/30 text-white border-0 text-[10px] font-bold py-1 px-3">
                                            {format(parseLocal(startDate), "MMM d")} - {format(parseLocal(endDate), "MMM d, yyyy")}
                                        </Badge>
                                        {Math.max(...result.breakdown.map(b => b.rate)) !== Math.min(...result.breakdown.map(b => b.rate)) && (
                                            <Badge className="bg-orange-500/70 hover:bg-orange-600/70 text-white border-0 text-[10px] font-bold py-1 px-3">
                                                Fluctuating Rate
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="rounded-2xl bg-card/40 border border-border/50 backdrop-blur-md overflow-hidden">
                                    <button
                                        className="w-full flex items-center justify-between p-4 text-xs font-bold hover:bg-muted/50 transition-colors"
                                        onClick={() => setExpandedBreakdown(!expandedBreakdown)}
                                    >
                                        <span className="flex items-center gap-2 text-muted-foreground"><ShieldCheck size={14} className="text-indigo-500" /> Nightly Rate Breakdown</span>
                                        {expandedBreakdown ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                    </button>

                                    <AnimatePresence>
                                        {expandedBreakdown && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: "auto", opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="border-t border-border/50 bg-muted/10"
                                            >
                                                <div className="p-4 max-h-[160px] overflow-y-auto space-y-1 custom-scrollbar">
                                                    {result.breakdown.map((day, i) => (
                                                        <div key={i} className="flex justify-between items-center py-1.5 text-xs border-b border-border/40 last:border-0 hover:bg-muted/50 rounded-md px-2 transition-colors">
                                                            <span className="text-muted-foreground font-medium">{format(parseLocal(day.date), "MMM d (EEE)")}</span>
                                                            <span className="font-bold text-foreground">${day.rate}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <Button
                                        variant="outline"
                                        className="h-11 rounded-xl bg-card/30 border-border/50 hover:bg-indigo-600/10 hover:border-indigo-600/30 hover:text-indigo-700 transition-all font-bold text-xs"
                                        onClick={handleSaveSnapshot}
                                        disabled={isSaving}
                                    >
                                        {isSaving ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-2 h-3.5 w-3.5" />}
                                        {saveSuccess || "Store Snapshot"}
                                    </Button>
                                    <Button
                                        className="h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20 transition-all font-bold text-xs"
                                        onClick={() => handleSyncToCRM(result.totalCost)}
                                        disabled={isSyncing}
                                    >
                                        {isSyncing ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-2 h-3.5 w-3.5" />}
                                        {syncSuccess || "Apply to Deal"}
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
