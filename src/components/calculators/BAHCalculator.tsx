"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
    Loader2,
    Save,
    RefreshCw,
    Calculator,
    Home,
    ArrowRight,
    ShieldCheck,
    TrendingUp,
    MapPin
} from "lucide-react";
import { BAHData } from "@/lib/calculators/bah";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { syncBAHToRent, calculateBAHAction } from "@/app/calculators/actions";
import { cn } from "@/lib/utils";

interface BAHCalculatorProps {
    contactId?: string;
    initialZip?: string;
    onSyncValue?: (value: number, type: "BAH") => void;
    embedded?: boolean;
}

export function BAHCalculator({
    contactId,
    initialZip,
    onSyncValue,
    embedded = false
}: BAHCalculatorProps) {
    const [bahZip, setBahZip] = useState(initialZip || "");
    const [bahGrade, setBahGrade] = useState("E01");
    const [bahDeps, setBahDeps] = useState(false);
    const [bahResult, setBahResult] = useState<BAHData | null>(null);
    const [bahLoading, setBahLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncSuccess, setSyncSuccess] = useState<string | null>(null);

    const handleCalculateBAH = async () => {
        setBahLoading(true);
        try {
            const res = await calculateBAHAction(bahZip, bahGrade, bahDeps);
            setBahResult(res);
        } catch (e) {
            console.error(e);
        } finally {
            setBahLoading(false);
        }
    };

    const handleSyncToCRM = async (value: number) => {
        if (onSyncValue) {
            onSyncValue(value, "BAH");
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
            const res = await syncBAHToRent(contactId, value);
            if (res.success) {
                setSyncSuccess(`Synced!`);
                setTimeout(() => setSyncSuccess(null), 3000);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsSyncing(false);
        }
    };

    const handleSaveSnapshot = async () => {
        if (!contactId || !bahResult) {
            alert("Snapshot saving requires a contact context.");
            return;
        }

        setIsSaving(true);
        try {
            if (!db) throw new Error("Firebase not initialized");
            const snapshotsRef = collection(db, "calculationSnapshots");
            await addDoc(snapshotsRef, {
                contactId,
                type: "BAH",
                data: bahResult,
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
                        <div className="p-2.5 bg-blue-500/10 rounded-xl border border-blue-500/20 shadow-inner">
                            <Home className="h-5 w-5 text-blue-500" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black tracking-tight text-foreground">BAH Calculator</h3>
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Basic Allowance for Housing</p>
                        </div>
                    </div>
                </div>
            )}

            <div className={cn(
                "grid gap-6 items-start transition-all duration-500",
                bahResult ? "lg:grid-cols-2" : "grid-cols-1 max-w-xl"
            )}>
                {/* Configuration Card */}
                <Card className="border-none bg-card/40 backdrop-blur-xl shadow-2xl shadow-blue-500/5 overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 opacity-20 group-hover:opacity-100 transition-opacity" />
                    <CardHeader className="pb-4">
                        <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                            <Calculator className="h-4 w-4 text-blue-500" />
                            Calculation Input
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[11px] font-bold uppercase opacity-70 flex items-center gap-1.5"><MapPin size={12} /> Station ZIP</Label>
                                <Input
                                    value={bahZip}
                                    onChange={(e) => setBahZip(e.target.value)}
                                    placeholder="e.g. 73521"
                                    className="bg-background/50 border-border/50 h-11"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[11px] font-bold uppercase opacity-70">Pay Grade</Label>
                                <Select value={bahGrade} onValueChange={setBahGrade}>
                                    <SelectTrigger className="bg-background/50 border-border/50 h-11 font-medium">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="backdrop-blur-3xl max-h-[300px]">
                                        {["E01", "E02", "E03", "E04", "E05", "E06", "E07", "E08", "E09", "W01", "W02", "W03", "W04", "W05", "O01E", "O02E", "O03E", "O01", "O02", "O03", "O04", "O05", "O06", "O07"].map(grade => (
                                            <SelectItem key={grade} value={grade}>{grade.replace(/^([A-Z])0/, "$1-").replace(/^([A-Z])(\d)/, "$1-$2")}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/30 border border-border/50 transition-all hover:bg-muted/50 group/switch">
                            <div className="space-y-1">
                                <Label htmlFor="bah-deps" className="font-bold text-sm cursor-pointer">Dependents</Label>
                                <p className="text-[10px] text-muted-foreground leading-none">Calculate rate with dependents</p>
                            </div>
                            <Switch
                                id="bah-deps"
                                checked={bahDeps}
                                onCheckedChange={setBahDeps}
                                className="data-[state=checked]:bg-blue-600"
                            />
                        </div>

                        <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
                            <Button
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 rounded-xl transition-all shadow-lg shadow-blue-500/20 font-bold gap-2 mt-2"
                                onClick={handleCalculateBAH}
                                disabled={bahLoading || !bahZip}
                            >
                                {bahLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Compute Allowance"}
                                <ArrowRight className="h-4 w-4" />
                            </Button>
                        </motion.div>
                    </CardContent>
                </Card>

                {/* Results Section */}
                <AnimatePresence mode="wait">
                    {bahResult && (
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="space-y-4"
                        >
                            <div className="relative p-4 sm:p-8 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-blue-600 to-blue-800 text-white shadow-2xl overflow-hidden min-h-[220px] flex flex-col justify-center border border-white/10 group">
                                <motion.div
                                    className="absolute -top-12 -right-12 opacity-10 group-hover:opacity-20 transition-opacity"
                                    initial={{ rotate: -12, scale: 1 }}
                                    animate={{ rotate: 5, scale: 1.1 }}
                                    transition={{ repeat: Infinity, repeatType: "reverse", duration: 10 }}
                                >
                                    <Home className="h-56 w-56" />
                                </motion.div>

                                <div className="relative z-10 space-y-6">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-100/60 mb-1 flex items-center gap-1">Monthly Allowance</p>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-2xl font-bold opacity-60">$</span>
                                            <h3 className="text-5xl font-black tracking-tighter tabular-nums">
                                                {bahResult.monthlyRate.toLocaleString()}
                                            </h3>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 sm:gap-6 py-4 border-y border-white/10">
                                        <div>
                                            <p className="text-[9px] font-bold uppercase tracking-wider text-white/50 mb-0.5">Annual Total</p>
                                            <p className="text-sm font-black flex items-center gap-1.5 italic">
                                                <TrendingUp size={14} className="text-blue-300" />
                                                ${bahResult.yearlyRate?.toLocaleString() || (bahResult.monthlyRate * 12).toLocaleString()}
                                            </p>
                                        </div>
                                        <div className="border-l border-white/10 pl-3 sm:pl-6">
                                            <p className="text-[9px] font-bold uppercase tracking-wider text-white/50 mb-0.5">Status</p>
                                            <p className="text-sm font-black flex items-center gap-1.5">
                                                <ShieldCheck size={14} className="text-emerald-400" /> FY25 Active
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-3 pt-1">
                                        <Badge className="bg-white/20 hover:bg-white/30 text-white border-0 text-[10px] font-bold py-1 px-3">
                                            {bahGrade} Grade
                                        </Badge>
                                        <Badge className="bg-white/20 hover:bg-white/30 text-white border-0 text-[10px] font-bold py-1 px-3">
                                            {bahDeps ? "With Dependents" : "Single"}
                                        </Badge>
                                        {bahResult.mha && (
                                            <Badge className="bg-white/10 hover:bg-white/20 text-white border-0 text-[10px] font-bold py-1 px-3">
                                                MHA: {bahResult.mha}
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="p-4 rounded-2xl bg-card/40 border border-border/50 backdrop-blur-md space-y-3">
                                    <div className="flex items-center justify-between text-xs border-b border-border/20 pb-3">
                                        <span className="text-muted-foreground font-bold flex items-center gap-1.5"><MapPin size={14} /> Full Location Name</span>
                                        <span className="font-black text-foreground truncate max-w-[60%] text-right">{bahResult.location}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs pt-1">
                                        <span className="text-muted-foreground font-bold flex items-center gap-1.5"><ShieldCheck size={14} className="text-blue-500" /> Official Station Record</span>
                                        <span className="font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest text-[10px]">VERIFIED OK</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <Button
                                        variant="outline"
                                        className="h-11 rounded-xl bg-card/30 border-border/50 hover:bg-blue-600/10 hover:border-blue-600/30 hover:text-blue-700 transition-all font-bold text-xs"
                                        onClick={handleSaveSnapshot}
                                        disabled={isSaving}
                                    >
                                        {isSaving ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-2 h-3.5 w-3.5" />}
                                        {saveSuccess || "Store Snapshot"}
                                    </Button>
                                    <Button
                                        className="h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20 transition-all font-bold text-xs"
                                        onClick={() => handleSyncToCRM(bahResult.monthlyRate)}
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
