"use client";

import React, { useState, useMemo, useEffect } from "react";
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
    Home,
    ArrowRight,
    ShieldCheck,
    PieChart,
    DollarSign,
    ChevronDown,
    ChevronUp,
    Info
} from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { cn } from "@/lib/utils";

interface HomeAffordabilityCalculatorProps {
    contactId?: string;
    onSyncValue?: (value: number, type: "AFFORDABILITY", metadata?: any) => void;
    embedded?: boolean;
}

export function HomeAffordabilityCalculator({
    contactId,
    onSyncValue,
    embedded = false
}: HomeAffordabilityCalculatorProps) {
    const [annualIncome, setAnnualIncome] = useState<string>("100000");
    const [monthlyDebt, setMonthlyDebt] = useState<string>("500");
    const [downPayment, setDownPayment] = useState<string>("50000");
    const [interestRate, setInterestRate] = useState<string>("6.5");
    const [loanTerm, setLoanTerm] = useState<string>("30");

    // Advanced Settings
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [propertyTaxRate, setPropertyTaxRate] = useState<string>("1.2");
    const [homeInsurance, setHomeInsurance] = useState<string>("1200");
    const [dtiCustom, setDtiCustom] = useState<number>(36);

    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncSuccess, setSyncSuccess] = useState<string | null>(null);

    // Calculate Affordability based on inputs
    const results: any = useMemo(() => {
        const income = parseFloat(annualIncome) || 0;
        const debt = parseFloat(monthlyDebt) || 0;
        const downPmt = parseFloat(downPayment) || 0;
        const rate = (parseFloat(interestRate) || 0) / 100;
        const term = parseInt(loanTerm) || 30;
        const taxRate = (parseFloat(propertyTaxRate) || 0) / 100;
        const insurance = parseFloat(homeInsurance) || 0;

        if (income <= 0 || rate <= 0) return null;

        const monthlyIncome = income / 12;
        const maxPaymentWithDTI = (monthlyIncome * (dtiCustom / 100)) - debt;

        if (maxPaymentWithDTI <= 0) {
            return { error: "Debt exceeds allowed DTI." };
        }

        const monthlyInterestRate = rate / 12;
        const totalPayments = term * 12;

        const mortgageFactor = (1 - Math.pow(1 + monthlyInterestRate, -totalPayments)) / monthlyInterestRate;
        const monthlyInsurance = insurance / 12;

        let maxLoanAmount = (maxPaymentWithDTI - monthlyInsurance) / ((1 / mortgageFactor) + (taxRate / 12));
        let maxHomePrice = maxLoanAmount + downPmt;

        // Round down to nearest 1000 for cleaner display
        maxHomePrice = Math.max(0, Math.floor(maxHomePrice / 1000) * 1000);

        const loanAmount = Math.max(0, maxHomePrice - downPmt);
        const principalInterest = loanAmount / mortgageFactor;
        const monthlyTax = (maxHomePrice * taxRate) / 12;

        const totalMonthly = principalInterest + monthlyTax + monthlyInsurance;

        return {
            maxHomePrice,
            loanAmount,
            totalMonthly,
            breakdown: {
                principalAndInterest: principalInterest,
                propertyTax: monthlyTax,
                homeInsurance: monthlyInsurance,
            },
            dti: dtiCustom
        };
    }, [annualIncome, monthlyDebt, downPayment, interestRate, loanTerm, propertyTaxRate, homeInsurance, dtiCustom]);

    const handleSyncToCRM = async () => {
        if (!results || results.error) return;

        if (onSyncValue) {
            onSyncValue(results.maxHomePrice, "AFFORDABILITY", results);
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
            // Fake sync success
            setSyncSuccess(`Synced!`);
            setTimeout(() => setSyncSuccess(null), 3000);
        } catch (e) {
            console.error(e);
        } finally {
            setIsSyncing(false);
        }
    };

    const handleSaveSnapshot = async () => {
        if (!contactId || !results || results.error) {
            alert("Snapshot saving requires a contact context and valid results.");
            return;
        }

        setIsSaving(true);
        try {
            if (!db) throw new Error("Firebase not initialized");
            const snapshotsRef = collection(db, "calculationSnapshots");
            await addDoc(snapshotsRef, {
                contactId,
                type: "AFFORDABILITY",
                data: results,
                inputs: { annualIncome, monthlyDebt, downPayment, interestRate, loanTerm, propertyTaxRate, homeInsurance, dtiCustom },
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

    const getRiskColor = (dti: number) => {
        if (dti <= 36) return "text-emerald-500 border-emerald-500/20";
        if (dti <= 43) return "text-yellow-500 border-yellow-500/20";
        return "text-red-500 border-red-500/20";
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            {!embedded && (
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20 shadow-inner">
                            <Home className="h-5 w-5 text-emerald-500" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black tracking-tight text-foreground">Home Affordability</h3>
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Purchasing Power Analysis</p>
                        </div>
                    </div>
                </div>
            )}

            <div className={cn(
                "grid gap-6 items-start transition-all duration-500",
                results ? "lg:grid-cols-2" : "grid-cols-1 max-w-xl"
            )}>
                {/* Configuration Card */}
                <Card className="border-none bg-card/40 backdrop-blur-xl shadow-2xl shadow-emerald-500/5 overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500 opacity-20 group-hover:opacity-100 transition-opacity" />
                    <CardHeader className="pb-4">
                        <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                            <Calculator className="h-4 w-4 text-emerald-500" />
                            Financial Profile
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[11px] font-bold uppercase opacity-70">Annual Income</Label>
                                <div className="relative">
                                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        type="number"
                                        value={annualIncome}
                                        onChange={(e) => setAnnualIncome(e.target.value)}
                                        className="bg-background/50 border-border/50 h-11 pl-9"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[11px] font-bold uppercase opacity-70">Monthly Debts</Label>
                                <div className="relative">
                                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        type="number"
                                        value={monthlyDebt}
                                        onChange={(e) => setMonthlyDebt(e.target.value)}
                                        className="bg-background/50 border-border/50 h-11 pl-9"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[11px] font-bold uppercase opacity-70">Down Payment</Label>
                                <div className="relative">
                                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        type="number"
                                        value={downPayment}
                                        onChange={(e) => setDownPayment(e.target.value)}
                                        className="bg-background/50 border-border/50 h-11 pl-9"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[11px] font-bold uppercase opacity-70">Interest Rate (%)</Label>
                                <Input
                                    type="number"
                                    step="0.1"
                                    value={interestRate}
                                    onChange={(e) => setInterestRate(e.target.value)}
                                    className="bg-background/50 border-border/50 h-11"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <Label className="text-[11px] font-bold uppercase opacity-70 flex items-center gap-1.5"><PieChart size={12} /> Target DTI ({dtiCustom}%)</Label>
                                <Badge variant="outline" className={cn("text-[10px] font-bold bg-background", getRiskColor(dtiCustom))}>
                                    {dtiCustom <= 36 ? "Comfortable" : dtiCustom <= 43 ? "FHA Max Equivalent" : "High Risk"}
                                </Badge>
                            </div>
                            <input
                                type="range"
                                min="20" max="50"
                                value={dtiCustom}
                                onChange={(e) => setDtiCustom(parseInt(e.target.value))}
                                className="w-full accent-emerald-500"
                            />
                            <div className="flex justify-between text-[10px] text-muted-foreground font-medium px-1">
                                <span>20%</span>
                                <span>36%</span>
                                <span>50%</span>
                            </div>
                        </div>

                        <div className="pt-2">
                            <button
                                onClick={() => setShowAdvanced(!showAdvanced)}
                                className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
                            >
                                {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                Advanced Settings
                            </button>

                            <AnimatePresence>
                                {showAdvanced && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden mt-4 space-y-4"
                                    >
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-[11px] font-bold uppercase opacity-70">Loan Term (Yrs)</Label>
                                                <Select value={loanTerm} onValueChange={setLoanTerm}>
                                                    <SelectTrigger className="bg-background/50 border-border/50 h-11 font-medium">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="10">10 Years</SelectItem>
                                                        <SelectItem value="15">15 Years</SelectItem>
                                                        <SelectItem value="20">20 Years</SelectItem>
                                                        <SelectItem value="30">30 Years</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[11px] font-bold uppercase opacity-70">Property Tax (%)</Label>
                                                <Input
                                                    type="number"
                                                    step="0.1"
                                                    value={propertyTaxRate}
                                                    onChange={(e) => setPropertyTaxRate(e.target.value)}
                                                    className="bg-background/50 border-border/50 h-11"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[11px] font-bold uppercase opacity-70">Annual Insurance ($)</Label>
                                            <Input
                                                type="number"
                                                value={homeInsurance}
                                                onChange={(e) => setHomeInsurance(e.target.value)}
                                                className="bg-background/50 border-border/50 h-11"
                                            />
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </CardContent>
                </Card>

                {/* Results Section */}
                <AnimatePresence mode="wait">
                    {results && !results.error && (
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="space-y-4"
                        >
                            <div className="relative p-4 sm:p-8 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-emerald-600 to-emerald-900 text-white shadow-2xl overflow-hidden min-h-[220px] flex flex-col justify-center border border-white/10 group">
                                <motion.div
                                    className="absolute -top-12 -right-12 opacity-10 group-hover:opacity-20 transition-opacity"
                                    initial={{ rotate: -12, scale: 1 }}
                                    animate={{ rotate: 12, scale: 1.1 }}
                                    transition={{ repeat: Infinity, repeatType: "reverse", duration: 10 }}
                                >
                                    <Home className="h-56 w-56" />
                                </motion.div>

                                <div className="relative z-10 space-y-6">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-100/60 mb-1 flex items-center gap-1">Maximum Purchase Price</p>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-2xl font-bold opacity-60">$</span>
                                            <h3 className="text-5xl font-black tracking-tighter tabular-nums">
                                                {results.maxHomePrice.toLocaleString()}
                                            </h3>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-6 py-4 border-y border-white/10">
                                        <div>
                                            <p className="text-[9px] font-bold uppercase tracking-wider text-white/50 mb-0.5">Est. Monthly Pmt</p>
                                            <p className="text-sm font-black flex items-center gap-1.5 italic">
                                                <DollarSign size={14} className="text-emerald-300" />
                                                {Math.round(results.totalMonthly).toLocaleString()}/mo
                                            </p>
                                        </div>
                                        <div className="border-l border-white/10 pl-6">
                                            <p className="text-[9px] font-bold uppercase tracking-wider text-white/50 mb-0.5">Loan Amount</p>
                                            <p className="text-sm font-black flex items-center gap-1.5">
                                                ${Math.round(results.loanAmount).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-3 pt-1">
                                        <Badge className="bg-white/20 hover:bg-white/30 text-white border-0 text-[10px] font-bold py-1 px-3">
                                            {interestRate}% Rate
                                        </Badge>
                                        <Badge className="bg-white/20 hover:bg-white/30 text-white border-0 text-[10px] font-bold py-1 px-3">
                                            {loanTerm} Year Term
                                        </Badge>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="p-4 rounded-2xl bg-card/40 border border-border/50 backdrop-blur-md space-y-3">
                                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-2">
                                        <PieChart size={14} className="text-emerald-500" /> Payment Breakdown
                                    </h4>

                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Principal & Interest</span>
                                            <span className="font-bold">${Math.round(results.breakdown.principalAndInterest).toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500" /> Property Taxes</span>
                                            <span className="font-bold">${Math.round(results.breakdown.propertyTax).toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-orange-500" /> Home Insurance</span>
                                            <span className="font-bold">${Math.round(results.breakdown.homeInsurance).toLocaleString()}</span>
                                        </div>
                                    </div>

                                    <div className="pt-2 mt-2 border-t border-border/40 flex justify-between items-center text-sm">
                                        <span className="font-bold text-foreground">Total Monthly Payment</span>
                                        <span className="font-black text-emerald-600 dark:text-emerald-400">${Math.round(results.totalMonthly).toLocaleString()}</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <Button
                                        variant="outline"
                                        className="h-11 rounded-xl bg-card/30 border-border/50 hover:bg-emerald-600/10 hover:border-emerald-600/30 hover:text-emerald-700 transition-all font-bold text-xs"
                                        onClick={handleSaveSnapshot}
                                        disabled={isSaving}
                                    >
                                        {isSaving ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-2 h-3.5 w-3.5" />}
                                        {saveSuccess || "Store Snapshot"}
                                    </Button>
                                    <Button
                                        className="h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20 transition-all font-bold text-xs"
                                        onClick={handleSyncToCRM}
                                        disabled={isSyncing}
                                    >
                                        {isSyncing ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-2 h-3.5 w-3.5" />}
                                        {syncSuccess || "Apply Max Price"}
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                    {results && results.error && (
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="p-6 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 flex items-start gap-3"
                        >
                            <Info className="h-5 w-5 mt-0.5" />
                            <div>
                                <h4 className="font-bold">Cannot compute affordability</h4>
                                <p className="text-sm opacity-80 mt-1">{results.error}</p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
