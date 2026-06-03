'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search,
    MapPin,
    Calendar,
    Maximize2,
    ChevronLeft,
    ChevronRight,
    Info,
    Building2,
    UtensilsCrossed,
    Loader2,
    AlertCircle,
    RefreshCw,
    Moon,
    ShieldCheck,
    ChevronDown,
    ChevronUp
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
    fetchLodgingByZip,
    fetchLodgingByStateCity,
    fetchMieRates,
    GsaLodgingRate,
    GsaMieRate
} from "@/lib/calculators/off-base-lodging";

const STATES = [
    { value: "AL", label: "Alabama" }, { value: "AK", label: "Alaska" }, { value: "AZ", label: "Arizona" },
    { value: "AR", label: "Arkansas" }, { value: "CA", label: "California" }, { value: "CO", label: "Colorado" },
    { value: "CT", label: "Connecticut" }, { value: "DE", label: "Delaware" }, { value: "FL", label: "Florida" },
    { value: "GA", label: "Georgia" }, { value: "HI", label: "Hawaii" }, { value: "ID", label: "Idaho" },
    { value: "IL", label: "Illinois" }, { value: "IN", label: "Indiana" }, { value: "IA", label: "Iowa" },
    { value: "KS", label: "Kansas" }, { value: "KY", label: "Kentucky" }, { value: "LA", label: "Louisiana" },
    { value: "ME", label: "Maine" }, { value: "MD", label: "Maryland" }, { value: "MA", label: "Massachusetts" },
    { value: "MI", label: "Michigan" }, { value: "MN", label: "Minnesota" }, { value: "MS", label: "Mississippi" },
    { value: "MO", label: "Missouri" }, { value: "MT", label: "Montana" }, { value: "NE", label: "Nebraska" },
    { value: "NV", label: "Nevada" }, { value: "NH", label: "New Hampshire" }, { value: "NJ", label: "New Jersey" },
    { value: "NM", label: "New Mexico" }, { value: "NY", label: "New York" }, { value: "NC", label: "North Carolina" },
    { value: "ND", label: "North Dakota" }, { value: "OH", label: "Ohio" }, { value: "OK", label: "Oklahoma" },
    { value: "OR", label: "Oregon" }, { value: "PA", label: "Pennsylvania" }, { value: "RI", label: "Rhode Island" },
    { value: "SC", label: "South Carolina" }, { value: "SD", label: "South Dakota" }, { value: "TN", label: "Tennessee" },
    { value: "TX", label: "Texas" }, { value: "UT", label: "Utah" }, { value: "VT", label: "Vermont" },
    { value: "VA", label: "Virginia" }, { value: "WA", label: "Washington" }, { value: "WV", label: "West Virginia" },
    { value: "WI", label: "Wisconsin" }, { value: "WY", label: "Wyoming" }
];

const FISCAL_YEARS = ["2024", "2025", "2026", "2027"];

import { baseToZip } from '@/lib/calculators/on-base';

interface OffBaseLodgingCalculatorProps {
    contactId?: string;
    embedded?: boolean;
    initialBase?: string;
    initialStartDate?: string;
    initialEndDate?: string;
    onSyncValue?: (value: number, type: "OFF_BASE", metadata?: any) => void;
}

export default function OffBaseLodgingCalculator({
    contactId,
    embedded = false,
    initialBase,
    initialStartDate,
    initialEndDate,
    onSyncValue
}: OffBaseLodgingCalculatorProps = {}) {
    const getFiscalYearFromDate = (dateStr?: string) => {
        if (!dateStr) return new Date().getFullYear().toString();
        const dateObj = new Date(dateStr);
        // GSA FY starts in Oct of previous year
        return (dateObj.getMonth() >= 9 ? dateObj.getFullYear() + 1 : dateObj.getFullYear()).toString();
    };

    const [searchType, setSearchType] = useState<'stateCity' | 'zip'>(initialBase && baseToZip[initialBase] ? 'zip' : 'stateCity');
    const [year, setYear] = useState<string>(getFiscalYearFromDate(initialStartDate));
    const [state, setState] = useState<string>("");
    const [city, setCity] = useState<string>("");
    const [zip, setZip] = useState<string>(initialBase && baseToZip[initialBase] ? baseToZip[initialBase] : "");

    const [startDate, setStartDate] = useState(initialStartDate || "");
    const [endDate, setEndDate] = useState(initialEndDate || "");
    const [calculationResult, setCalculationResult] = useState<{ totalCost: number, totalNights: number, breakdown?: any[] } | null>(null);
    const [expandedBreakdown, setExpandedBreakdown] = useState(false);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [lodgingResults, setLodgingResults] = useState<GsaLodgingRate[]>([]);
    const [mieResults, setMieResults] = useState<GsaMieRate[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 8;

    useEffect(() => {
        if (!startDate || !endDate || lodgingResults.length === 0) {
            setCalculationResult(null);
            return;
        }

        const rate = lodgingResults[0];
        if (!rate) return;

        const [sy, sm, sd] = startDate.split('-').map(Number);
        const [ey, em, ed] = endDate.split('-').map(Number);
        const start = new Date(sy, sm - 1, sd, 12, 0, 0);
        const end = new Date(ey, em - 1, ed, 12, 0, 0);

        if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
            setCalculationResult(null);
            return;
        }

        let totalCost = 0;
        let totalNights = 0;
        const current = new Date(start);
        const breakdownMap = new Map<string, { monthStr: string, rate: number, nights: number }>();

        const getRateForMonth = (monthNum: number) => {
            if (rate.months?.month) {
                const m = rate.months.month.find((m: any) => Number(m.number) === monthNum);
                if (m?.value) return Number(m.value);
            } else {
                const mNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
                const monthKey = mNames[monthNum - 1] as keyof typeof rate;
                // @ts-ignore
                if (rate[monthKey]) return Number(rate[monthKey]);
            }
            return 0;
        };

        const displayMonthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

        while (current < end) {
            const currentMonth = current.getMonth() + 1;
            const currentYear = current.getFullYear();
            const rateForMonth = getRateForMonth(currentMonth);

            totalCost += rateForMonth;
            totalNights++;

            const monthKey = `${currentYear}-${currentMonth}`;
            if (!breakdownMap.has(monthKey)) {
                breakdownMap.set(monthKey, {
                    monthStr: `${displayMonthNames[currentMonth - 1]} ${currentYear}`,
                    rate: rateForMonth,
                    nights: 0
                });
            }
            breakdownMap.get(monthKey)!.nights++;

            current.setDate(current.getDate() + 1);
            current.setHours(12, 0, 0, 0);
        }

        const breakdown = Array.from(breakdownMap.values());
        setCalculationResult({ totalCost, totalNights, breakdown });

    }, [startDate, endDate, lodgingResults]);

    // Automatically keep the FY dropdown synced with the current check-in date
    useEffect(() => {
        if (startDate && !lodgingResults.length) {
            setYear(getFiscalYearFromDate(startDate));
        }
    }, [startDate]);

    const handlePageChange = (newPage: number) => {
        if (newPage > 0 && newPage <= totalPages) {
            setCurrentPage(newPage);
        }
    };

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setLodgingResults([]);
        setMieResults([]);
        setCurrentPage(1);

        try {
            const fiscalYear = parseInt(year);
            let lodging: GsaLodgingRate[] = [];

            if (searchType === 'zip') {
                if (!zip) throw new Error("Please enter a ZIP code.");
                const zipResult = await fetchLodgingByZip(zip, fiscalYear);
                lodging = [zipResult];
            } else {
                if (!state) throw new Error("Please select a state.");
                lodging = await fetchLodgingByStateCity(state, fiscalYear, city);
            }

            // Fetch all M&IE rates for the year for context mapping
            const allMie = await fetchMieRates(fiscalYear);

            // Map M&IE data to lodging entries if available
            const mappedLodging = lodging.map(item => {
                const mealRate = item.meals || 0;
                const matchingMie = allMie.find(m => Number(m.total) === Number(mealRate)) || allMie[0];
                return {
                    ...item,
                    mealData: {
                        ...matchingMie,
                        location: ((item as any).City || item.city || "").trim() || "Standard Rate"
                    }
                };
            });

            setLodgingResults(mappedLodging);

            // If ZIP or specific City search, we show a clean M&IE breakdown
            if (searchType === 'zip' || city) {
                const mealRate = mappedLodging[0].meals || 0;
                const mainMie = allMie.find(m => Number(m.total) === Number(mealRate)) || allMie[0];
                setMieResults([{ ...mainMie, location: mappedLodging[0].city || "Standard Rate" }]);
            } else {
                // Multi-result search shows the M&IE for each result in the table or secondary list
                setMieResults(mappedLodging.map(l => (l as any).mealData));
            }

        } catch (err: any) {
            setError(err.message || "An error occurred while fetching data.");
        } finally {
            setLoading(false);
        }
    };

    const totalPages = Math.ceil(lodgingResults.length / itemsPerPage);
    const paginatedLodging = lodgingResults.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const getHeaderOrder = () => {
        const fy = parseInt(year);
        // GSA FY runs Oct (prev year) through Sep (current year)
        return [
            { number: 10, label: `Oct ${fy - 1}` },
            { number: 11, label: `Nov ${fy - 1}` },
            { number: 12, label: `Dec ${fy - 1}` },
            { number: 1, label: `Jan ${fy}` },
            { number: 2, label: `Feb ${fy}` },
            { number: 3, label: `Mar ${fy}` },
            { number: 4, label: `Apr ${fy}` },
            { number: 5, label: `May ${fy}` },
            { number: 6, label: `Jun ${fy}` },
            { number: 7, label: `Jul ${fy}` },
            { number: 8, label: `Aug ${fy}` },
            { number: 9, label: `Sep ${fy}` }
        ];
    };

    return (
        <div className={cn("mx-auto space-y-6 transition-all duration-500 w-full", embedded ? "" : "max-w-5xl p-4 sm:p-6 lg:p-8")}>
            <div className="grid gap-6 items-start grid-cols-1">

                {/* Top Section: Inputs */}
                <div className="space-y-6">
                    <Card className="border-none bg-card/40 backdrop-blur-xl shadow-2xl shadow-blue-500/5 overflow-hidden group">
                        <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 opacity-20 group-hover:opacity-100 transition-opacity pointer-events-none" />
                        <CardHeader className="pb-4 relative">
                            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-blue-500" />
                                Calculation Input
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6 relative">
                            <form onSubmit={handleSearch} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                                    <div className="space-y-3">
                                        <Label className="text-[11px] font-bold uppercase opacity-70">Search By</Label>
                                        <div className="flex gap-2 p-1 bg-background/50 rounded-xl border border-border/50 overflow-hidden">
                                            <button
                                                type="button"
                                                onClick={() => setSearchType('stateCity')}
                                                className={cn(
                                                    "flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all",
                                                    searchType === 'stateCity' ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" : "text-muted-foreground hover:bg-muted/50"
                                                )}
                                            >
                                                State / City
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setSearchType('zip')}
                                                className={cn(
                                                    "flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all",
                                                    searchType === 'zip' ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" : "text-muted-foreground hover:bg-muted/50"
                                                )}
                                            >
                                                ZIP Code
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <Label className="text-[11px] font-bold uppercase opacity-70 block">Fiscal Year <span className="text-red-500">*</span></Label>
                                        <Select value={year} onValueChange={setYear}>
                                            <SelectTrigger className="bg-background/50 border-border/50 h-[42px] font-medium transition-all w-full leading-relaxed">
                                                <SelectValue placeholder="Select Fiscal Year" />
                                            </SelectTrigger>
                                            <SelectContent className="backdrop-blur-3xl">
                                                {FISCAL_YEARS.map(y => (
                                                    <SelectItem key={y} value={y}>{y}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                                    {searchType === 'stateCity' ? (
                                        <>
                                            <div className="space-y-2">
                                                <Label className="text-[11px] font-bold uppercase opacity-70">State <span className="text-red-500">*</span></Label>
                                                <Select value={state} onValueChange={setState}>
                                                    <SelectTrigger className="bg-background/50 border-border/50 h-11 font-medium">
                                                        <SelectValue placeholder="Select State" />
                                                    </SelectTrigger>
                                                    <SelectContent className="backdrop-blur-3xl max-h-[300px]">
                                                        {STATES.map(s => (
                                                            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[11px] font-bold uppercase opacity-70">City (Optional)</Label>
                                                <Input
                                                    placeholder="e.g., Tucson"
                                                    value={city}
                                                    onChange={(e) => setCity(e.target.value)}
                                                    className="bg-background/50 border-border/50 h-11"
                                                />
                                            </div>
                                        </>
                                    ) : (
                                        <div className="space-y-2 md:col-span-2 max-w-md">
                                            <Label className="text-[11px] font-bold uppercase opacity-70">ZIP Code <span className="text-red-500">*</span></Label>
                                            <Input
                                                placeholder="e.g., 89084"
                                                value={zip}
                                                onChange={(e) => setZip(e.target.value)}
                                                className="bg-background/50 border-border/50 h-11"
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                                    <div className="space-y-2">
                                        <Label className="text-[11px] font-bold uppercase opacity-70 flex items-center gap-1">
                                            <Calendar size={12} /> Check-In
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
                                            <Calendar size={12} /> Check-Out
                                        </Label>
                                        <Input
                                            type="date"
                                            value={endDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                            className="bg-background/50 border-border/50 h-11"
                                        />
                                    </div>
                                </div>

                                <Button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full h-12 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
                                >
                                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                                    {loading ? 'Finding Rates...' : 'Find Rates'}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </div>

                {/* Bottom Section: Results */}
                <div className="space-y-8 w-full">
                    <AnimatePresence mode="wait">
                        {/* Removed Empty State Placeholder to keep initial view perfectly clean and centered */}

                        {loading && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="h-full flex flex-col items-center justify-center p-12 space-y-6"
                            >
                                <div className="relative">
                                    <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                                    <Loader2 className="w-8 h-8 text-blue-400 absolute inset-0 m-auto animate-pulse" />
                                </div>
                                <div className="space-y-2 text-center">
                                    <h3 className="text-lg font-bold text-foreground uppercase tracking-widest animate-pulse">Fetching GSA Data</h3>
                                    <p className="text-muted-foreground text-sm">Validating results for FY {year}...</p>
                                </div>
                            </motion.div>
                        )}

                        {error && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="p-6 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-start gap-4"
                            >
                                <AlertCircle className="w-6 h-6 text-red-500 shrink-0 mt-1" />
                                <div className="space-y-1">
                                    <h3 className="text-lg font-bold text-red-500">Lookup Error</h3>
                                    <p className="text-red-200/70 text-sm leading-relaxed">{error}</p>
                                    <Button
                                        variant="link"
                                        className="text-red-400 p-0 h-auto font-bold text-xs uppercase"
                                        onClick={() => setError(null)}
                                    >
                                        Clear Error
                                    </Button>
                                </div>
                            </motion.div>
                        )}

                        {lodgingResults.length > 0 && !loading && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="space-y-6"
                            >
                                {/* Highlight Card mapping identically to OnBase layout */}
                                {lodgingResults.length === 1 ? (
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
                                            {calculationResult ? (
                                                <div>
                                                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-100/60 mb-1">Total Stay Cost</p>
                                                    <div className="flex items-baseline gap-1">
                                                        <span className="text-2xl font-bold opacity-60">$</span>
                                                        <h3 className="text-5xl font-black tracking-tighter">
                                                            {Math.round(calculationResult.totalCost).toLocaleString()}
                                                        </h3>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div>
                                                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-100/60 mb-1">Current Lodging Rate (Missing Dates)</p>
                                                    <div className="flex items-baseline gap-1">
                                                        <span className="text-2xl font-bold opacity-60">$</span>
                                                        <h3 className="text-5xl font-black tracking-tighter">
                                                            {(() => {
                                                                const currentMonth = new Date().getMonth() + 1; // 1-12
                                                                const rate = lodgingResults[0];
                                                                let activeRate = "N/A";

                                                                if (rate.months?.month) {
                                                                    const m = rate.months.month.find((m: any) => Number(m.number) === currentMonth);
                                                                    if (m?.value) activeRate = Math.round(Number(m.value)).toString();
                                                                } else {
                                                                    const mNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
                                                                    const monthKey = mNames[currentMonth - 1] as keyof typeof rate;
                                                                    const val = rate[monthKey];
                                                                    if (val) activeRate = Math.round(Number(val)).toString();
                                                                }
                                                                return activeRate;
                                                            })()}
                                                        </h3>
                                                        <span className="text-sm font-bold opacity-60 ml-1">/ night</span>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="grid grid-cols-2 gap-6 py-4 border-y border-white/10">
                                                <div>
                                                    <p className="text-[9px] font-bold uppercase tracking-wider text-white/50 mb-0.5">Duration</p>
                                                    <p className="text-sm font-black flex items-center gap-1.5 italic">
                                                        <Moon size={14} className="text-indigo-300" />
                                                        {calculationResult ? `${calculationResult.totalNights} Nights` : 'N/A'}
                                                    </p>
                                                </div>
                                                <div className="border-l border-white/10 pl-6">
                                                    <p className="text-[9px] font-bold uppercase tracking-wider text-white/50 mb-0.5">Location</p>
                                                    <p className="text-sm font-black truncate">{lodgingResults[0].city || "Standard Rate"}</p>
                                                </div>
                                            </div>

                                            {calculationResult && startDate && endDate && (
                                                <div className="flex items-center gap-3 pt-1">
                                                    <Badge className="bg-white/20 hover:bg-white/30 text-white border-0 text-[10px] font-bold py-1 px-3">
                                                        {(() => {
                                                            const [sy, sm, sd] = startDate.split('-').map(Number);
                                                            const sDate = new Date(sy, sm - 1, sd, 12, 0, 0);
                                                            const [ey, em, ed] = endDate.split('-').map(Number);
                                                            const eDate = new Date(ey, em - 1, ed, 12, 0, 0);
                                                            return `${format(sDate, "MMM d")} - ${format(eDate, "MMM d, yyyy")}`;
                                                        })()}
                                                    </Badge>
                                                </div>
                                            )}

                                            {calculationResult?.breakdown && calculationResult.breakdown.length > 0 && (
                                                <div className="rounded-2xl bg-black/20 border border-white/10 backdrop-blur-md overflow-hidden mt-4">
                                                    <button
                                                        type="button"
                                                        className="w-full flex items-center justify-between p-4 text-xs font-bold hover:bg-white/10 transition-colors"
                                                        onClick={() => setExpandedBreakdown(!expandedBreakdown)}
                                                    >
                                                        <span className="flex items-center gap-2 text-indigo-100"><ShieldCheck size={14} className="text-indigo-300" /> Monthly Rate Breakdown</span>
                                                        {expandedBreakdown ? <ChevronUp size={14} className="text-indigo-100" /> : <ChevronDown size={14} className="text-indigo-100" />}
                                                    </button>
                                                    <AnimatePresence>
                                                        {expandedBreakdown && (
                                                            <motion.div
                                                                initial={{ height: 0, opacity: 0 }}
                                                                animate={{ height: "auto", opacity: 1 }}
                                                                exit={{ height: 0, opacity: 0 }}
                                                                className="border-t border-white/10 bg-black/10"
                                                            >
                                                                <div className="p-4 max-h-[160px] overflow-y-auto space-y-1 custom-scrollbar">
                                                                    {calculationResult.breakdown.map((item, i) => (
                                                                        <div key={i} className="flex justify-between items-center py-1.5 text-xs border-b border-white/5 last:border-0 hover:bg-white/5 rounded-md px-2 transition-colors">
                                                                            <span className="text-indigo-100/70 font-medium">{item.monthStr} <span className="opacity-50 ml-1">({item.nights} nights)</span></span>
                                                                            <span className="font-bold text-white">${item.rate}/night</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
                                                </div>
                                            )}

                                            {calculationResult && onSyncValue && searchType === 'zip' && (
                                                <div className="pt-2">
                                                    <Button
                                                        className="w-full bg-white hover:bg-gray-100 text-indigo-900 h-12 rounded-xl transition-all shadow-lg font-black text-sm gap-2"
                                                        onClick={() => onSyncValue(calculationResult.totalCost, "OFF_BASE")}
                                                    >
                                                        <RefreshCw className="mr-1 h-4 w-4" />
                                                        Apply to Deal
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    calculationResult && (
                                        <div className="p-6 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-center relative overflow-hidden group">
                                            <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 opacity-20 group-hover:opacity-100 transition-opacity" />
                                            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-500/80 mb-2">Estimated Date Range Lodging Rate</h3>
                                            <div className="flex justify-center items-end gap-2">
                                                <span className="text-4xl font-black">${calculationResult.totalCost.toLocaleString()}</span>
                                                <span className="text-muted-foreground mb-1 text-xs uppercase font-bold tracking-wider opacity-60">/ {calculationResult.totalNights} nights</span>
                                            </div>
                                            {calculationResult?.breakdown && calculationResult.breakdown.length > 0 && (
                                                <div className="rounded-2xl bg-card/40 border border-border/50 backdrop-blur-md overflow-hidden text-left mt-4 mb-4">
                                                    <button
                                                        type="button"
                                                        className="w-full flex items-center justify-between p-4 text-xs font-bold hover:bg-muted/50 transition-colors"
                                                        onClick={() => setExpandedBreakdown(!expandedBreakdown)}
                                                    >
                                                        <span className="flex items-center gap-2 text-muted-foreground"><ShieldCheck size={14} className="text-indigo-500" /> Monthly Rate Breakdown</span>
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
                                                                    {calculationResult.breakdown.map((item, i) => (
                                                                        <div key={i} className="flex justify-between items-center py-1.5 text-xs border-b border-border/40 last:border-0 hover:bg-muted/50 rounded-md px-2 transition-colors">
                                                                            <span className="text-muted-foreground font-medium">{item.monthStr} <span className="opacity-50 ml-1">({item.nights} nights)</span></span>
                                                                            <span className="font-bold text-foreground">${item.rate}/night</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
                                                </div>
                                            )}

                                            {onSyncValue && searchType === 'zip' && (
                                                <Button
                                                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-12 rounded-xl transition-all shadow-lg shadow-indigo-500/20 font-bold gap-2 mt-4"
                                                    onClick={() => onSyncValue(calculationResult.totalCost, "OFF_BASE")}
                                                >
                                                    <RefreshCw className="mr-1 h-4 w-4" />
                                                    Apply to Deal
                                                </Button>
                                            )}
                                        </div>
                                    )
                                )}

                                {!embedded && (
                                    <>
                                        {/* Lodging Rates Table */}
                                        <Card className="border-none bg-card/40 backdrop-blur-md shadow-xl overflow-hidden rounded-3xl">
                                            <CardHeader className="flex flex-row items-center justify-between pb-2 bg-card/60">
                                                <div className="space-y-1">
                                                    <CardTitle className="text-lg font-black text-foreground flex items-center gap-2">
                                                        <Building2 className="w-5 h-5 text-blue-500" />
                                                        Daily Lodging Rates | {startDate && endDate ? `${startDate} to ${endDate}` : `Oct ${parseInt(year) - 1} - Sep ${year}`}
                                                    </CardTitle>
                                                </div>
                                                {/* Fullscreen Trigger */}
                                                <Dialog>
                                                    <DialogTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground hover:bg-background/50">
                                                            <Maximize2 className="w-4 h-4" />
                                                        </Button>
                                                    </DialogTrigger>
                                                    <DialogContent className="max-w-[100vw] w-screen h-screen m-0 rounded-none bg-card border-none text-foreground p-0 overflow-hidden shadow-3xl flex flex-col">
                                                        <DialogHeader className="p-6 bg-card/60 border-b border-border/50 shrink-0">
                                                            <DialogTitle className="text-2xl font-black flex items-center gap-2"><Building2 className="w-6 h-6 text-blue-500" /> All Lodging Rates</DialogTitle>
                                                        </DialogHeader>
                                                        <div className="flex-1 overflow-auto p-0 custom-scrollbar">
                                                            <ResultsTable data={lodgingResults} headerOrder={getHeaderOrder()} />
                                                        </div>
                                                    </DialogContent>
                                                </Dialog>
                                            </CardHeader>
                                            <CardContent className="p-0">
                                                <div className="overflow-x-auto overflow-y-hidden custom-scrollbar">
                                                    <ResultsTable data={paginatedLodging} headerOrder={getHeaderOrder()} />
                                                </div>

                                                {/* Pagination Controls */}
                                                {totalPages > 1 && (
                                                    <div className="flex items-center justify-center gap-2 p-6 border-t border-border/10 bg-card/30">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                                            disabled={currentPage === 1}
                                                            className="text-muted-foreground disabled:opacity-20 hover:bg-background/50"
                                                        >
                                                            <ChevronLeft className="w-4 h-4" />
                                                        </Button>
                                                        <div className="flex gap-1">
                                                            {Array.from({ length: totalPages }).map((_, i) => (
                                                                <Button
                                                                    key={i}
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => setCurrentPage(i + 1)}
                                                                    className={cn(
                                                                        "w-8 h-8 rounded-lg font-bold text-xs",
                                                                        currentPage === i + 1
                                                                            ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                                                                            : "text-muted-foreground hover:bg-background/50"
                                                                    )}
                                                                >
                                                                    {i + 1}
                                                                </Button>
                                                            ))}
                                                        </div>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                                            disabled={currentPage === totalPages}
                                                            className="text-muted-foreground disabled:opacity-20 hover:bg-background/50"
                                                        >
                                                            <ChevronRight className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>

                                        {/* M&IE Breakdown Card */}
                                        <Card className="border-none bg-card/40 backdrop-blur-md shadow-xl overflow-hidden rounded-3xl mt-8">
                                            <CardHeader className="flex flex-row items-center justify-between pb-2 bg-card/60">
                                                <div className="space-y-1">
                                                    <CardTitle className="text-lg font-black text-foreground flex items-center gap-2">
                                                        <UtensilsCrossed className="w-5 h-5 text-emerald-500" />
                                                        Meals and Incidental Expenses (M&IE) Rates
                                                    </CardTitle>
                                                </div>
                                                {/* Fullscreen Trigger */}
                                                <Dialog>
                                                    <DialogTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground hover:bg-background/50">
                                                            <Maximize2 className="w-4 h-4" />
                                                        </Button>
                                                    </DialogTrigger>
                                                    <DialogContent className="max-w-[100vw] w-screen h-screen m-0 rounded-none bg-card border-none text-foreground p-0 overflow-hidden shadow-3xl flex flex-col">
                                                        <DialogHeader className="p-6 bg-card/60 border-b border-border/50 shrink-0">
                                                            <DialogTitle className="text-2xl font-black flex items-center gap-2"><UtensilsCrossed className="w-6 h-6 text-emerald-500" /> All M&IE Rates</DialogTitle>
                                                        </DialogHeader>
                                                        <div className="flex-1 overflow-auto p-0 custom-scrollbar">
                                                            <MieTable data={mieResults} />
                                                        </div>
                                                    </DialogContent>
                                                </Dialog>
                                            </CardHeader>
                                            <CardContent className="p-0 overflow-x-auto custom-scrollbar">
                                                <MieTable data={mieResults.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)} />
                                            </CardContent>
                                        </Card>
                                    </>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>


        </div>
    );
}

function ResultsTable({ data, headerOrder }: { data: GsaLodgingRate[], headerOrder: any[] }) {
    return (
        <table className="w-full text-left border-collapse min-w-[1400px]">
            <thead className="bg-card/30 border-b border-border/10">
                <tr>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 w-[280px]">Primary Destination</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 w-[150px]">County</th>
                    {headerOrder.map(col => (
                        <th key={col.label} className="px-4 py-4 text-center">
                            <div className="flex justify-center items-baseline gap-1">
                                <span className="text-[11px] font-black uppercase text-foreground/80">{col.label.split(' ')[0]}</span>
                                <span className="text-[10px] font-bold text-muted-foreground">{col.label.split(' ')[1]}</span>
                            </div>
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody className="divide-y divide-border/10">
                {data.map((item, idx) => (
                    <tr key={idx} className="hover:bg-muted/30 transition-colors group">
                        <td className="px-6 py-4">
                            <span className="text-sm font-black text-foreground group-hover:text-blue-500 transition-colors uppercase tracking-tight line-clamp-2 md:line-clamp-1">
                                {(item as any).City || item.city || "Standard Rate"}
                            </span>
                        </td>
                        <td className="px-6 py-4">
                            <span className="text-xs font-bold text-muted-foreground/70">{item.county || "N/A"}</span>
                        </td>
                        {headerOrder.map(col => {
                            let value: string | undefined;
                            if (item.months?.month) {
                                // ZIP Code search format
                                const monthObj = item.months.month.find((m: any) => Number(m.number) === col.number);
                                value = monthObj?.value;
                            } else {
                                // State/City search format (months are flat keys on the object)
                                const monthAbbrev = col.label.split(" ")[0];
                                const key1 = monthAbbrev as keyof typeof item;
                                const key2 = monthAbbrev.toLowerCase() as keyof typeof item;
                                value = (item[key1] || item[key2]) as string | undefined;
                            }

                            return (
                                <td key={col.label} className="px-4 py-4 text-center">
                                    <span className={cn(
                                        "text-xs font-black",
                                        value ? "text-foreground" : "text-muted-foreground/30"
                                    )}>
                                        {value ? `$${Math.round(Number(value))}` : "N/A"}
                                    </span>
                                </td>
                            );
                        })}
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

function MieTable({ data }: { data: any[] }) {
    return (
        <table className="w-full text-left border-collapse min-w-[1200px]">
            <thead className="bg-card/30 border-b border-border/10">
                <tr>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-emerald-500/50 w-[280px]">Primary Destination</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-emerald-500/50 text-center w-[150px]">M&IE Total</th>
                    <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-emerald-500/50 text-center">Breakfast</th>
                    <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-emerald-500/50 text-center">Lunch</th>
                    <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-emerald-500/50 text-center">Dinner</th>
                    <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-emerald-500/50 text-center">Incidental</th>
                    <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-emerald-500/50 text-center">First/Last Day</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-border/10">
                {data.map((item, idx) => (
                    <tr key={idx} className="hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-4 text-sm font-black text-foreground uppercase tracking-tight line-clamp-2 md:line-clamp-1">
                            {item.location || item.state || "N/A"}
                        </td>
                        <td className="px-6 py-4 text-center">
                            <span className="text-sm font-black text-emerald-500">
                                ${Math.round(Number(item.total))}
                            </span>
                        </td>
                        {[item.breakfast, item.lunch, item.dinner, item.incidental, item.FirstLastDay].map((val, i) => (
                            <td key={i} className="px-4 py-4 text-center">
                                <span className="text-xs font-bold text-muted-foreground/70">${Math.round(Number(val))}</span>
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
