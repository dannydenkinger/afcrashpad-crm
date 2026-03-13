"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, RefreshCw, Info, Home, Calculator, PieChart, DollarSign, CalendarDays, ChevronDown, ChevronUp } from "lucide-react";
import { calculateVALoan, VALoanResult, AmortizationSlot } from "@/lib/calculators/va-loan";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { syncVALoanToDeal } from "@/app/calculators/actions";
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface VALoanCalculatorProps {
    contactId?: string;
    onSyncValue?: (value: number, type: "VA") => void;
    embedded?: boolean;
}

export function VALoanCalculator({
    contactId,
    onSyncValue,
    embedded = false
}: VALoanCalculatorProps) {
    const [vaPrice, setVaPrice] = useState<string>("604999");
    const [vaDown, setVaDown] = useState<string>("0");
    const [vaRate, setVaRate] = useState<string>("6.5");
    const [vaTerm, setVaTerm] = useState("30");

    // Eligibility Details
    const [hasVaBefore, setHasVaBefore] = useState<"no" | "yes">("no");
    const [exemptDisabled, setExemptDisabled] = useState(false);
    const [exemptPurple, setExemptPurple] = useState(false);
    const [exemptSpouse, setExemptSpouse] = useState(false);

    // Advanced Settings
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [propertyTaxRate, setPropertyTaxRate] = useState<string>("1.2");
    const [homeInsurance, setHomeInsurance] = useState<string>("600");

    const [vaResult, setVaResult] = useState<VALoanResult | null>(null);
    const [yearlySchedule, setYearlySchedule] = useState<AmortizationSlot[]>([]);

    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncSuccess, setSyncSuccess] = useState<string | null>(null);
    const [amortizationView, setAmortizationView] = useState<string>("monthly");

    useEffect(() => {
        const price = parseFloat(vaPrice) || 0;
        const down = parseFloat(vaDown) || 0;
        const taxRate = parseFloat(propertyTaxRate) || 0;

        const res = calculateVALoan({
            homePrice: price,
            downPayment: down,
            interestRate: parseFloat(vaRate) || 0,
            loanTerm: parseInt(vaTerm) || 30,
            propertyTaxYearly: price * (taxRate / 100),
            homeInsuranceYearly: parseFloat(homeInsurance) || 0,
            hadVaLoanBefore: hasVaBefore === "yes",
            isExempt: exemptDisabled || exemptPurple || exemptSpouse
        });
        setVaResult(res);

        // Manually build Yearly array to guarantee it renders
        if (res?.amortizationSchedule) {
            const yearlyOpts: AmortizationSlot[] = [];
            let currentYear = 1;
            let currentPrincipal = 0;
            let currentInterest = 0;
            let currentPayment = 0;

            for (let i = 0; i < res.amortizationSchedule.length; i++) {
                const s = res.amortizationSchedule[i];
                currentPrincipal += s.principal;
                currentInterest += s.interest;
                currentPayment += s.payment;

                if ((i + 1) % 12 === 0 || i === res.amortizationSchedule.length - 1) {
                    yearlyOpts.push({
                        period: currentYear,
                        principal: currentPrincipal,
                        interest: currentInterest,
                        payment: currentPayment,
                        remainingBalance: s.remainingBalance
                    });
                    currentYear++;
                    currentPrincipal = 0;
                    currentInterest = 0;
                    currentPayment = 0;
                }
            }
            setYearlySchedule(yearlyOpts);
        } else {
            setYearlySchedule([]);
        }

    }, [vaPrice, vaDown, vaRate, vaTerm, hasVaBefore, exemptDisabled, exemptPurple, exemptSpouse, propertyTaxRate, homeInsurance]);

    const handleSyncToCRM = async (value: number) => {
        if (onSyncValue) {
            onSyncValue(value, "VA");
            setSyncSuccess(`Value Applied!`);
            setTimeout(() => setSyncSuccess(null), 3000);
            return;
        }

        if (!contactId) {
            alert("No contact context for syncing. Use this as a standalone calculator.");
            return;
        }

        setIsSyncing(true);
        setSyncSuccess(null);
        try {
            const res = await syncVALoanToDeal(contactId, value);
            if (res.success) {
                setSyncSuccess(`Synced to CRM!`);
                setTimeout(() => setSyncSuccess(null), 3000);
            } else {
                alert(res.error);
            }
        } catch (e) {
            console.error(e);
            alert("Sync failed.");
        } finally {
            setIsSyncing(false);
        }
    };

    const handleSaveSnapshot = async (data: any) => {
        if (!contactId) {
            alert("Snapshot saving requires a contact context.");
            return;
        }

        setIsSaving(true);
        setSaveSuccess(null);
        try {
            if (!db) throw new Error("Firebase not initialized");
            const snapshotsRef = collection(db, "calculationSnapshots");
            await addDoc(snapshotsRef, {
                contactId,
                type: "VA",
                data,
                timestamp: serverTimestamp(),
            });
            setSaveSuccess(`Saved VA Quote!`);
            setTimeout(() => setSaveSuccess(null), 3000);
        } catch (e: any) {
            console.error(e);
            alert("Failed to save to Firestore.");
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
                            <Calculator className="h-5 w-5 text-blue-500" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black tracking-tight text-foreground">VA Loan Calculator</h3>
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Veterans Affairs Mortgage Options</p>
                        </div>
                    </div>
                </div>
            )}

            <div className={cn(
                "grid gap-6 items-start transition-all duration-500",
                vaResult ? "lg:grid-cols-2" : "grid-cols-1 max-w-xl"
            )}>
                {/* Configuration Card */}
                <Card className="border-none bg-card/40 backdrop-blur-xl shadow-2xl overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 opacity-20 group-hover:opacity-100 transition-opacity" />
                    <CardHeader className="pb-4">
                        <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                            <Calculator className="h-4 w-4 text-blue-500" />
                            Calculation Input
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">

                        <div className="space-y-4">
                            <div className="flex justify-between items-center text-sm">
                                <Label className="font-bold text-muted-foreground">Home Price</Label>
                                <Input
                                    type="number"
                                    value={vaPrice}
                                    onChange={(e) => setVaPrice(e.target.value)}
                                    className="w-32 bg-background/50 h-9 font-semibold text-right"
                                />
                            </div>
                            <Slider
                                value={[parseFloat(vaPrice) || 0]}
                                onValueChange={(v) => setVaPrice(v[0].toString())}
                                max={1500000}
                                step={1000}
                                className="py-2"
                            />
                        </div>

                        <div className="space-y-4 pt-4 border-t border-border/50">
                            <div className="flex justify-between items-center text-sm">
                                <Label className="font-bold text-muted-foreground">Down Payment</Label>
                                <Input
                                    type="number"
                                    value={vaDown}
                                    onChange={(e) => setVaDown(e.target.value)}
                                    className="w-32 bg-background/50 h-9 font-semibold text-right"
                                />
                            </div>
                            <Slider
                                value={[parseFloat(vaDown) || 0]}
                                onValueChange={(v) => setVaDown(v[0].toString())}
                                max={parseFloat(vaPrice) || 600000}
                                step={1000}
                                className="py-2"
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border/50">
                            <div className="space-y-2">
                                <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Rate (%)</Label>
                                <Input
                                    type="number"
                                    step="0.1"
                                    value={vaRate}
                                    onChange={(e) => setVaRate(e.target.value)}
                                    className="bg-background/50 h-10 font-bold"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Term (Years)</Label>
                                <Select value={vaTerm} onValueChange={setVaTerm}>
                                    <SelectTrigger className="bg-background/50 h-10 font-bold">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="15">15 years</SelectItem>
                                        <SelectItem value="30">30 years</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-border/50 space-y-4">
                            <Label className="font-bold text-sm">Have you had a VA loan before?</Label>
                            <div className="flex gap-2 p-1.5 rounded-xl bg-background/50 border border-border/50">
                                <Button
                                    variant={hasVaBefore === "no" ? "default" : "ghost"}
                                    className={hasVaBefore === "no" ? "flex-1 rounded-lg bg-blue-600 hover:bg-blue-700 shadow-sm transition-all" : "flex-1 rounded-lg hover:bg-transparent transition-all"}
                                    onClick={() => setHasVaBefore("no")}
                                >
                                    No
                                </Button>
                                <Button
                                    variant={hasVaBefore === "yes" ? "default" : "ghost"}
                                    className={hasVaBefore === "yes" ? "flex-1 rounded-lg bg-blue-600 hover:bg-blue-700 shadow-sm transition-all" : "flex-1 rounded-lg hover:bg-transparent transition-all"}
                                    onClick={() => setHasVaBefore("yes")}
                                >
                                    Yes
                                </Button>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-border/50 space-y-4">
                            <Label className="font-bold text-sm">Funding Fee Exemption</Label>
                            <div className="space-y-2 bg-background/30 p-3 rounded-xl border border-border/30">
                                <div className="flex items-center space-x-3 p-2 rounded-lg hover:bg-background/50 transition-colors">
                                    <Checkbox id="exempt-1" checked={exemptDisabled} onCheckedChange={(c) => setExemptDisabled(c as boolean)} />
                                    <label htmlFor="exempt-1" className="text-sm font-medium leading-none cursor-pointer flex-1">
                                        VA Disabled (10%+)
                                    </label>
                                </div>
                                <div className="flex items-center space-x-3 p-2 rounded-lg hover:bg-background/50 transition-colors">
                                    <Checkbox id="exempt-2" checked={exemptPurple} onCheckedChange={(c) => setExemptPurple(c as boolean)} />
                                    <label htmlFor="exempt-2" className="text-sm font-medium leading-none cursor-pointer flex-1">
                                        Purple Heart
                                    </label>
                                </div>
                                <div className="flex items-center space-x-3 p-2 rounded-lg hover:bg-background/50 transition-colors">
                                    <Checkbox id="exempt-3" checked={exemptSpouse} onCheckedChange={(c) => setExemptSpouse(c as boolean)} />
                                    <label htmlFor="exempt-3" className="text-sm font-medium leading-none cursor-pointer flex-1">
                                        Surviving Spouse
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-border/50 space-y-4 bg-muted/20 p-4 rounded-xl">
                            <button
                                onClick={() => setShowAdvanced(!showAdvanced)}
                                className="w-full flex items-center justify-between text-sm font-bold text-muted-foreground hover:text-foreground transition-colors group"
                            >
                                <span className="flex items-center gap-2">
                                    Advanced Estimates
                                </span>
                                {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>

                            <AnimatePresence>
                                {showAdvanced && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3">
                                            <div className="space-y-2">
                                                <Label className="text-[11px] font-bold uppercase opacity-70">Tax Rate (%)</Label>
                                                <Input
                                                    type="number"
                                                    step="0.1"
                                                    value={propertyTaxRate}
                                                    onChange={(e) => setPropertyTaxRate(e.target.value)}
                                                    className="bg-background/50 border-border/50 h-10"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[11px] font-bold uppercase opacity-70">Yearly Ins. ($)</Label>
                                                <Input
                                                    type="number"
                                                    value={homeInsurance}
                                                    onChange={(e) => setHomeInsurance(e.target.value)}
                                                    className="bg-background/50 border-border/50 h-10"
                                                />
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </CardContent>
                </Card>

                {/* Results Section */}
                <AnimatePresence mode="wait">
                    {vaResult && (
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="space-y-6"
                        >
                            <div className="relative p-4 sm:p-8 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-blue-700 to-blue-900 text-white shadow-2xl overflow-hidden min-h-[260px] flex flex-col justify-center border border-white/10 group">
                                <motion.div
                                    className="absolute -top-10 -right-10 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none"
                                    initial={{ rotate: -12, scale: 1 }}
                                    animate={{ rotate: 5, scale: 1.1 }}
                                    transition={{ repeat: Infinity, repeatType: "reverse", duration: 10 }}
                                >
                                    <DollarSign className="h-56 w-56 text-blue-100" />
                                </motion.div>

                                <div className="relative z-10 space-y-6">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-100/60 mb-1">Est. Monthly Payment</p>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-2xl font-bold opacity-60">$</span>
                                            <h3 className="text-5xl font-black tracking-tighter tabular-nums text-transparent bg-clip-text bg-gradient-to-br from-white to-blue-100">
                                                {vaResult.monthlyPayment.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                            </h3>
                                        </div>
                                    </div>

                                    <div className="flex flex-row items-center justify-between py-4 border-y border-white/10">
                                        <div className="flex flex-wrap gap-x-4 sm:gap-x-8 gap-y-3 sm:gap-y-4 flex-1">
                                            <div>
                                                <p className="text-[9px] font-bold uppercase tracking-wider text-blue-200/70 mb-0.5">Prin. & Int.</p>
                                                <p className="text-sm font-black flex items-center text-white">
                                                    ${vaResult.principalAndInterest.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-bold uppercase tracking-wider text-blue-200/70 mb-0.5">Prop. Taxes</p>
                                                <p className="text-sm font-black flex items-center text-white">
                                                    ${vaResult.monthlyTax.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-bold uppercase tracking-wider text-blue-200/70 mb-0.5">Home Ins.</p>
                                                <p className="text-sm font-black flex items-center text-white">
                                                    ${vaResult.monthlyInsurance.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                </p>
                                            </div>
                                            {vaResult.monthlyFundingFee > 0 && (
                                                <div>
                                                    <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-300/80 mb-0.5">VA Fee</p>
                                                    <p className="text-sm font-black flex items-center text-white">
                                                        ${vaResult.monthlyFundingFee.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Pie Chart Component */}
                                        <div className="h-24 w-24 shrink-0 opacity-90 drop-shadow-md hidden sm:block">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <RechartsPie>
                                                    <Pie
                                                        data={[
                                                            { name: "P&I", value: vaResult.principalAndInterest },
                                                            { name: "Taxes", value: vaResult.monthlyTax },
                                                            { name: "Insurance", value: vaResult.monthlyInsurance },
                                                            ...(vaResult.monthlyFundingFee > 0 ? [{ name: "VA Fee", value: vaResult.monthlyFundingFee }] : [])
                                                        ]}
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={25}
                                                        outerRadius={40}
                                                        dataKey="value"
                                                        stroke="none"
                                                    >
                                                        <Cell fill="#60a5fa" /> {/* blue-400 */}
                                                        <Cell fill="#f87171" /> {/* red-400 */}
                                                        <Cell fill="#facc15" /> {/* yellow-400 */}
                                                        {vaResult.monthlyFundingFee > 0 && <Cell fill="#34d399" />} {/* emerald-400 */}
                                                    </Pie>
                                                    <Tooltip
                                                        contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: 'none', borderRadius: '8px', color: 'white', fontSize: '12px', fontWeight: 'bold' }}
                                                        itemStyle={{ color: 'white' }}
                                                        formatter={(value: any) => `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                                                    />
                                                </RechartsPie>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <Card className="border-none bg-card/40 backdrop-blur-xl shadow-xl overflow-hidden group">
                                <CardContent className="p-6 space-y-4">
                                    <div className="flex justify-between items-center text-sm border-b border-border/50 pb-3">
                                        <span className="text-muted-foreground font-medium flex items-center gap-2">Purchase Price</span>
                                        <span className="font-bold">${(parseFloat(vaPrice) || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm border-b border-border/50 pb-3">
                                        <span className="text-muted-foreground font-medium flex items-center gap-2">Down Payment</span>
                                        <span className="font-bold">${(parseFloat(vaDown) || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm border-b border-border/50 pb-3">
                                        <span className="text-muted-foreground font-medium flex items-center gap-2">VA Funding Fee</span>
                                        <span className={`font-bold ${vaResult.fundingFeeAmount === 0 ? "text-green-500" : ""}`}>
                                            {vaResult.fundingFeeAmount === 0 ? "Exempt" : `$${vaResult.fundingFeeAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-base pt-1">
                                        <span className="text-foreground font-black tracking-tight">Total Financed</span>
                                        <span className="font-black text-blue-600 dark:text-blue-400">${vaResult.totalFinanced.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                                    </div>
                                </CardContent>
                            </Card>

                            <div className="flex flex-col gap-3">
                                {/* Amortization Trigger */}
                                <Dialog>
                                    <DialogTrigger asChild>
                                        <Button variant="outline" className="w-full h-12 rounded-xl bg-card/40 border-border/50 hover:bg-primary/10 transition-all font-bold text-sm tracking-wide flex justify-between px-5 shadow-sm">
                                            <span className="flex items-center gap-2"><CalendarDays size={16} className="opacity-70 text-primary" /> View Amortization Schedule</span>
                                            <Info size={16} className="opacity-50" />
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto w-[95vw]">
                                        <DialogHeader>
                                            <DialogTitle className="text-xl">Amortization Schedule</DialogTitle>
                                        </DialogHeader>

                                        <Tabs value={amortizationView} onValueChange={setAmortizationView} className="w-full mt-4">
                                            <TabsList className="grid w-full grid-cols-2 h-11">
                                                <TabsTrigger value="monthly" className="font-bold">Monthly Breakdown</TabsTrigger>
                                                <TabsTrigger value="yearly" className="font-bold">Yearly Summary</TabsTrigger>
                                            </TabsList>

                                            <TabsContent value="monthly" className="mt-4">
                                                <div className="rounded-xl border border-border/50 overflow-hidden">
                                                    <Table>
                                                        <TableHeader className="bg-muted/50">
                                                            <TableRow>
                                                                <TableHead className="font-bold">Month</TableHead>
                                                                <TableHead className="font-bold">Payment</TableHead>
                                                                <TableHead className="font-bold">Principal</TableHead>
                                                                <TableHead className="font-bold">Interest</TableHead>
                                                                <TableHead className="font-bold text-right">Balance</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {(vaResult.amortizationSchedule || []).map((slot) => (
                                                                <TableRow key={`m-${slot.period}`}>
                                                                    <TableCell className="font-medium text-muted-foreground">{slot.period}</TableCell>
                                                                    <TableCell className="font-medium">${slot.payment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                                                    <TableCell>${slot.principal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                                                    <TableCell>${slot.interest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                                                    <TableCell className="text-right font-bold">${slot.remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </TabsContent>

                                            <TabsContent value="yearly" className="mt-4">
                                                <div className="rounded-xl border border-border/50 overflow-hidden">
                                                    <Table>
                                                        <TableHeader className="bg-muted/50">
                                                            <TableRow>
                                                                <TableHead className="font-bold">Year</TableHead>
                                                                <TableHead className="font-bold">Principal Paid</TableHead>
                                                                <TableHead className="font-bold">Interest Paid</TableHead>
                                                                <TableHead className="font-bold text-right">End Balance</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {yearlySchedule.map((slot: any) => (
                                                                <TableRow key={`y-${slot.period}`}>
                                                                    <TableCell className="font-bold">{slot.period}</TableCell>
                                                                    <TableCell>${slot.principal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                                                    <TableCell>${slot.interest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                                                    <TableCell className="text-right font-bold">${slot.remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </TabsContent>
                                        </Tabs>
                                    </DialogContent>
                                </Dialog>

                                <div className="grid grid-cols-2 gap-4 mt-2">
                                    <Button
                                        variant="outline"
                                        className="h-12 rounded-xl bg-card/30 border-border/50 hover:bg-blue-600/10 hover:border-blue-600/30 hover:text-blue-700 transition-all font-bold tracking-wide"
                                        onClick={() => handleSaveSnapshot(vaResult)}
                                        disabled={isSaving}
                                    >
                                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                        {saveSuccess || "Store Snapshot"}
                                    </Button>
                                    {contactId && (
                                        <Button
                                            onClick={() => handleSyncToCRM(vaResult.monthlyPayment)}
                                            disabled={isSyncing}
                                            className="h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20 transition-all font-bold tracking-wide"
                                        >
                                            {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                                            {syncSuccess || "Apply to Deal"}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )
                    }
                </AnimatePresence >
            </div >
        </div >
    );
}

