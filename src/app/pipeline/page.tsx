"use client"

import { useState, useMemo, Suspense } from "react"
import { Button } from "@/components/ui/button"
import { Search, Plus, ListFilter, Calendar as CalendarIcon, DollarSign, MapPin, Phone, Mail, FileText, CheckCircle2, MoreVertical, Settings, Send, ChevronDown, MessageSquare, Tag, CheckSquare, LayoutGrid, List as ListIcon, ArrowUpDown, Calculator, Info, Clock, ChevronRight, User, Building2, Layers, Upload, Edit2, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuCheckboxItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetTitle,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { getPipelines, bulkCreateOpportunities, deleteOpportunity, updateOpportunity, getBaseNames, getUsers, createNewDeal, markOpportunitySeen } from "./actions"
import { getSpecialAccommodations } from "@/app/settings/system-properties/actions"
import { CSVImportDialog } from "@/components/ui/CSVImportDialog"
import { PipelineManagerDialog } from "@/components/ui/PipelineManagerDialog"
import { useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { lodgingData } from "@/lib/calculators/on-base"
import { useSession } from "next-auth/react"
import { getCurrentUserRole } from "@/app/settings/users/actions"

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { LeadSourceSelector } from "@/components/ui/LeadSourceSelector"
import { TagPicker } from "@/components/ui/TagPicker"
import dynamic from "next/dynamic"

const OffBaseLodgingCalculator = dynamic(() => import("@/components/calculators/OffBaseLodgingCalculator"), {
    ssr: false,
    loading: () => <div className="h-[300px] flex items-center justify-center">Loading Off-Base Calculator...</div>
})


const OnBaseLodgingCalculator = dynamic(() => import("@/components/calculators/OnBaseLodgingCalculator").then(mod => mod.OnBaseLodgingCalculator), {
    ssr: false,
    loading: () => <div className="h-[300px] flex items-center justify-center">Loading On-Base Calculator...</div>
})

const initialPipelines = {
    traveler: {
        name: "Traveler Placement",
        stages: [
            "On Hold", "New Lead", "Contacted", "Finding Properties", "Selecting Property",
            "Travel Started", "Lease Sent", "Lease Signed", "Move-in Scheduled",
            "Current Tenant", "Move-out Scheduled", "Review/Referral", "Closed Won",
            "Closed Lost", "Archive"
        ],
        deals: [
            { id: 1, name: "Capt. John Doe", email: "john.doe@usaf.mil", phone: "(555) 123-4567", base: "Luke AFB", bin: "73521", stage: "New Lead", priority: "HIGH", startDate: "Oct 12, 2026", endDate: "Apr 12, 2027", value: 18000, margin: 4500, assignee: "JD", forms: { lease: false, tc: false, auth: false }, notes: "Needs a place close to base, bringing his golden retriever." },
            { id: 2, name: "Lt. Jane Smith", email: "jane.s@usaf.mil", phone: "(555) 987-6543", base: "Nellis AFB", bin: "89191", stage: "Contacted", priority: "MEDIUM", startDate: "Jan 05, 2027", endDate: "Jun 05, 2027", value: 15200, margin: 3800, assignee: "AW", forms: { lease: false, tc: true, auth: false }, notes: "Called her yesterday. She wants to confirm the per diem rates with her commander." },
            { id: 3, name: "Maj. Mike Johnson", email: "michael.j@usaf.mil", phone: "(555) 456-7890", base: "Randolph AFB", bin: "78148", stage: "Lease Sent", priority: "LOW", startDate: "Nov 20, 2026", endDate: "Mar 20, 2027", value: 12000, margin: 3000, assignee: "JD", forms: { lease: true, tc: true, auth: false }, notes: "Waiting on the payment auth form to arrive." },
            { id: 4, name: "Capt. Sarah Williams", email: "sarah.w@usaf.mil", phone: "(555) 234-5678", base: "Luke AFB", bin: "73521", stage: "Move-in Scheduled", priority: "MEDIUM", startDate: "Dec 01, 2026", endDate: "Feb 28, 2027", value: 8900, margin: 2200, assignee: "MK", forms: { lease: true, tc: true, auth: true }, notes: "All set. Move-in scheduled." },
        ]
    },
    marketing: {
        name: "Marketing Flow",
        stages: ["Idea", "Drafting", "Review", "Scheduled", "Published"],
        deals: [
            { id: 5, name: "Base Housing Guide Video", email: "marketing@usaf.mil", phone: "-", base: "All Bases", stage: "Drafting", priority: "HIGH", startDate: "Nov 01, 2026", endDate: "Nov 15, 2026", value: 0, margin: 0, assignee: "AW", forms: { lease: false, tc: false, auth: false }, notes: "Drafting the script for the TikTok/Reels video explaining the non-availability letter process." }
        ]
    },
    projects: {
        name: "Projects Flow",
        stages: ["Backlog", "To Do", "In Progress", "Review", "Done"],
        deals: [
            { id: 6, name: "Website Redesign", email: "dev@usaf.mil", phone: "-", base: "-", stage: "In Progress", priority: "MEDIUM", startDate: "Oct 15, 2026", endDate: "Dec 01, 2026", value: 0, margin: 0, assignee: "MK", forms: { lease: false, tc: false, auth: false }, notes: "Updating the landing page for higher conversion rates." }
        ]
    }
}

function getLengthOfStay(start: string, end: string) {
    const startDate = new Date(start)
    const endDate = new Date(end)
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return "-"
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return `${diffDays} days`
}

function formatDisplayDate(dateStr: string) {
    if (!dateStr) return "-";
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return `${parts[1]}/${parts[2]}/${parts[0]}`;
    }
    return dateStr;
}

export default function PipelinePage() {
    return (
        <Suspense fallback={<div className="p-8">Loading pipeline...</div>}>
            <PipelineContent />
        </Suspense>
    )
}

function PipelineContent() {
    const { data: session } = useSession()
    const [userRole, setUserRole] = useState("AGENT")

    const [pipelines, setPipelines] = useState<any>(initialPipelines)
    const [activePipelineKey, setActivePipelineKey] = useState<string>("traveler")
    const [selectedDeal, setSelectedDeal] = useState<any>(null)
    const [activeTab, setActiveTab] = useState("details")
    const [isCalculatorOpen, setIsCalculatorOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
    const [isPipelineManagerOpen, setIsPipelineManagerOpen] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')
    const [baseNames, setBaseNames] = useState<string[]>([])
    const [allUsers, setAllUsers] = useState<any[]>([])
    const [specialAccommodations, setSpecialAccommodations] = useState<{ id: string; name: string }[]>([])
    const [draggedDealId, setDraggedDealId] = useState<string | null>(null)
    const [dragOverStageId, setDragOverStageId] = useState<string | null>(null)

    const handleDragStart = (e: React.DragEvent, dealId: string) => {
        e.dataTransfer.setData("dealId", dealId)
        e.dataTransfer.effectAllowed = "move"
        setDraggedDealId(dealId)
    }

    const handleDragEnd = () => {
        setDraggedDealId(null)
        setDragOverStageId(null)
    }

    const handleDragOver = (e: React.DragEvent, stageId: string) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = "move"
        setDragOverStageId(stageId)
    }

    const handleDragLeave = () => {
        setDragOverStageId(null)
    }

    const handleDrop = async (e: React.DragEvent, stageId: string, stageName: string) => {
        e.preventDefault()
        setDragOverStageId(null)
        setDraggedDealId(null)
        const dealId = e.dataTransfer.getData("dealId")
        if (!dealId) return

        // Find the deal - skip if already in this stage
        const deal = currentPipeline.deals.find((d: any) => d.id === dealId)
        if (!deal || deal.stage === stageName) return

        // Optimistic UI update
        const updatedPipelines = { ...pipelines }
        const dealIdx = updatedPipelines[activePipelineKey].deals.findIndex((d: any) => d.id === dealId)
        if (dealIdx !== -1) {
            updatedPipelines[activePipelineKey].deals[dealIdx] = {
                ...updatedPipelines[activePipelineKey].deals[dealIdx],
                stage: stageName
            }
            setPipelines(updatedPipelines)
        }

        // Persist to DB
        await updateOpportunity(dealId, { pipelineStageId: stageId })
        fetchPipelines()
    }

    const fetchPipelines = async () => {
        setIsLoading(true);
        const res = await getPipelines();
        if (res.success && res.pipelines) {
            setPipelines(res.pipelines);
            // Auto-select first pipeline if current is invalid
            if (!activePipelineKey || !res.pipelines[activePipelineKey]) {
                const keys = Object.keys(res.pipelines);
                if (keys.length > 0) setActivePipelineKey(keys[0]);
            }
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchPipelines();
        getBaseNames().then(setBaseNames);
        getUsers().then(res => { if (res.success) setAllUsers(res.users || []); });
        getSpecialAccommodations().then(res => { if (res.success) setSpecialAccommodations(res.items || []); });
    }, []);

    // Auto-open deal from ?deal= query param (calendar navigation)
    const searchParams = useSearchParams();
    useEffect(() => {
        const dealId = searchParams.get('deal');
        if (dealId && !isLoading) {
            // Search across all pipelines for the deal
            for (const key of Object.keys(pipelines)) {
                const p = pipelines[key];
                const deal = p.deals?.find((d: any) => d.id === dealId);
                if (deal) {
                    setActivePipelineKey(key);
                    setActiveTab('details');
                    setSelectedDeal(deal);
                    // Best-effort: clear "new/unread" indicator when opened
                    markOpportunitySeen(dealId);
                    break;
                }
            }
        }
    }, [searchParams, pipelines, isLoading]);

    useEffect(() => {
        async function fetchRole() {
            if (session?.user?.id) {
                const role = await getCurrentUserRole();
                setUserRole(role);
            }
        }
        fetchRole();
    }, [session]);

    const openDeal = (deal: any) => {
        setActiveTab("details");
        setSelectedDeal(deal);

        if (deal?.id && deal?.unread) {
            markOpportunitySeen(String(deal.id));
            setPipelines((prev: any) => {
                const next = { ...prev };
                const p = next[activePipelineKey];
                if (!p?.deals) return prev;
                next[activePipelineKey] = {
                    ...p,
                    deals: p.deals.map((d: any) => d.id === deal.id ? { ...d, unread: false, lastSeenAt: new Date() } : d)
                };
                return next;
            });
        }
    };

    const handleSyncCalculatorValue = (val: number, type: "BAH" | "VA" | "ON_BASE" | "OFF_BASE") => {
        let updatedValue = val;
        if ((type === "ON_BASE") && val < 1000) {
            updatedValue = val * 30; // Estimate monthly if it looks like a daily rate
        }
        const updatedMargin = updatedValue * 0.25;

        const updatedPipelines = { ...pipelines };
        const deals = updatedPipelines[activePipelineKey].deals;
        const dealIdx = deals.findIndex((d: any) => d.id === selectedDeal.id);

        if (selectedDeal && dealIdx !== -1) {
            deals[dealIdx] = {
                ...deals[dealIdx],
                value: updatedValue,
                margin: updatedMargin
            };
            setPipelines(updatedPipelines);
            // We need to update the selectedDeal state too to reflect in the UI immediately
            setSelectedDeal({ ...deals[dealIdx] });
        }
        setIsCalculatorOpen(false);
    };

    const handleAddOpportunity = () => {
        setSelectedDeal({
            id: 'new',
            name: 'New Deal',
            email: '',
            phone: '',
            base: '',
            stage: currentPipeline.stages[0]?.name || 'New Lead',
            priority: 'MEDIUM',
            startDate: '',
            endDate: '',
            value: 0,
            margin: 0,
            notes: '',
            assigneeId: null,
            specialAccommodationId: null,
            assignee: session?.user?.name ? session.user.name.split(" ").map((w: string) => w[0]).join("").toUpperCase() : "—"
        });
        setActiveTab("details");
    };

    const handleDeleteOpportunity = async (id: string) => {
        if (!confirm("Are you sure you want to delete this opportunity?")) return;
        const res = await deleteOpportunity(id);
        if (res.success) {
            setSelectedDeal(null);
            fetchPipelines();
        }
    }

    const handleSaveOpportunity = async () => {
        if (!selectedDeal) return;
        setIsSaving(true);
        setSaveStatus('idle');
        try {
            if (selectedDeal.id === 'new') {
                const res = await createNewDeal({
                    name: selectedDeal.name,
                    email: selectedDeal.email,
                    phone: selectedDeal.phone,
                    base: selectedDeal.base,
                    stage: selectedDeal.stage,
                    priority: selectedDeal.priority,
                    startDate: selectedDeal.startDate,
                    endDate: selectedDeal.endDate,
                    value: selectedDeal.value,
                    margin: selectedDeal.margin,
                    notes: selectedDeal.notes,
                    assigneeId: selectedDeal.assigneeId,
                    specialAccommodationId: selectedDeal.specialAccommodationId || null
                }, activePipelineKey);

                if (res.success) {
                    setSaveStatus('success');
                    await fetchPipelines();
                    setSelectedDeal(null);
                } else {
                    setSaveStatus('error');
                    console.error('Save failed:', res);
                }
            } else {
                // Map stage name → stageId from the current pipeline
                const matchedStage = currentPipeline.stages.find((s: any) => {
                    const stageName = typeof s === 'string' ? s : s.name;
                    return stageName === selectedDeal.stage;
                });
                const pipelineStageId = typeof matchedStage === 'string' ? undefined : matchedStage?.id;

                const res = await updateOpportunity(String(selectedDeal.id), {
                    ...(pipelineStageId ? { pipelineStageId } : {}),
                    name: selectedDeal.name,
                    value: selectedDeal.value,
                    margin: selectedDeal.margin,
                    priority: selectedDeal.priority,
                    startDate: selectedDeal.startDate || "",
                    endDate: selectedDeal.endDate || "",
                    base: selectedDeal.base || undefined,
                    notes: selectedDeal.notes,
                    contactId: selectedDeal.contactId,
                    assigneeId: selectedDeal.assigneeId || null,
                    specialAccommodationId: selectedDeal.specialAccommodationId || null,
                });

                if (res.success) {
                    setSaveStatus('success');
                    await fetchPipelines();
                } else {
                    setSaveStatus('error');
                    console.error('Save failed:', res);
                }
            }
        } catch (err) {
            setSaveStatus('error');
            console.error("Failed to save opportunity:", err);
        } finally {
            setIsSaving(false);
            setTimeout(() => setSaveStatus('idle'), 3000);
        }
    }

    const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban")
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null)

    // View Options State
    const [showBase, setShowBase] = useState(true)
    const [showValue, setShowValue] = useState(true)
    const [showPriority, setShowPriority] = useState(true)
    const [showDates, setShowDates] = useState(true)
    const [showEndDate, setShowEndDate] = useState(false)
    const [showLengthOfStay, setShowLengthOfStay] = useState(false)
    const [showQuickActions, setShowQuickActions] = useState(true)

    const currentPipeline = pipelines[activePipelineKey] || { name: "Loading...", stages: [], deals: [] }

    const sortedDeals = useMemo(() => {
        const sortableDeals = [...currentPipeline.deals];
        if (sortConfig !== null) {
            sortableDeals.sort((a, b) => {
                let aValue: any = a[sortConfig.key as keyof typeof a];
                let bValue: any = b[sortConfig.key as keyof typeof b];

                if (sortConfig.key === 'lengthOfStay') {
                    aValue = parseInt(getLengthOfStay(a.startDate, a.endDate)) || 0;
                    bValue = parseInt(getLengthOfStay(b.startDate, b.endDate)) || 0;
                } else if (sortConfig.key === 'startDate' || sortConfig.key === 'endDate') {
                    aValue = new Date(aValue as string).getTime();
                    bValue = new Date(bValue as string).getTime();
                }

                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return sortableDeals;
    }, [currentPipeline.deals, sortConfig]);

    const requestSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    }

    return (
        <div className="flex flex-col h-full overflow-hidden p-8 pt-6">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <h2 className="text-3xl font-bold tracking-tight">Opportunities</h2>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-2 h-8 mt-1 border border-border/60 bg-muted/20 font-medium text-muted-foreground hover:text-foreground">
                                {currentPipeline.name}
                                <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-56">
                            <DropdownMenuLabel className="text-xs uppercase text-muted-foreground tracking-wider">Select Pipeline</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {Object.keys(pipelines).map((key) => (
                                <DropdownMenuItem
                                    key={key}
                                    onClick={() => { setActivePipelineKey(key); setSelectedDeal(null); }}
                                    className="cursor-pointer font-medium"
                                >
                                    {pipelines[key].name}
                                    {activePipelineKey === key && <CheckCircle2 className="ml-auto h-4 w-4 text-primary" />}
                                </DropdownMenuItem>
                            ))}
                            <DropdownMenuSeparator />
                            {userRole !== "AGENT" && (
                                <DropdownMenuItem onClick={() => setIsPipelineManagerOpen(true)} className="cursor-pointer">
                                    <Settings className="mr-2 h-4 w-4" />
                                    <span>Manage Pipelines</span>
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
                <div className="flex items-center space-x-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                                <ListFilter className="mr-2 h-4 w-4" />
                                View Options
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel className="text-xs uppercase text-muted-foreground tracking-wider">Card Fields</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuCheckboxItem checked={showBase} onCheckedChange={setShowBase} className="cursor-pointer">
                                Show Base Location
                            </DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem checked={showValue} onCheckedChange={setShowValue} className="cursor-pointer">
                                Show Deal Value
                            </DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem checked={showPriority} onCheckedChange={setShowPriority} className="cursor-pointer">
                                Show Priority Badge
                            </DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem checked={showDates} onCheckedChange={setShowDates} className="cursor-pointer">
                                Show Check-in Date
                            </DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem checked={showEndDate} onCheckedChange={setShowEndDate} className="cursor-pointer">
                                Show Check-out Date
                            </DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem checked={showLengthOfStay} onCheckedChange={setShowLengthOfStay} className="cursor-pointer">
                                Show Duration
                            </DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem checked={showQuickActions} onCheckedChange={setShowQuickActions} className="cursor-pointer">
                                Show Quick Actions
                            </DropdownMenuCheckboxItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <div className="flex bg-muted/60 p-1 rounded-md items-center">
                        <Button variant={viewMode === "kanban" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("kanban")} className="h-7 px-2.5 shadow-none">
                            <LayoutGrid className="h-4 w-4" />
                        </Button>
                        <Button variant={viewMode === "list" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("list")} className="h-7 px-2.5 shadow-none">
                            <ListIcon className="h-4 w-4" />
                        </Button>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => setIsImportDialogOpen(true)}>
                            <Upload className="mr-2 h-4 w-4" />
                            Import CSV
                        </Button>
                        <Button size="sm" onClick={handleAddOpportunity}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Opportunity
                        </Button>
                    </div>
                </div>
            </div>

            <CSVImportDialog
                isOpen={isImportDialogOpen}
                onClose={() => setIsImportDialogOpen(false)}
                onImport={async (data) => {
                    const res = await bulkCreateOpportunities(data, activePipelineKey);
                    if (res.success) fetchPipelines();
                    return res;
                }}
                title="Import Opportunities"
                description="Upload a CSV file to bulk add deals and contacts to your pipeline."
                templateFields={['name', 'email', 'phone', 'base', 'dealName', 'value', 'margin', 'stage', 'priority']}
            />

            <PipelineManagerDialog
                isOpen={isPipelineManagerOpen}
                onClose={() => setIsPipelineManagerOpen(false)}
                pipelines={pipelines}
                onPipelinesChange={fetchPipelines}
            />

            <div className="flex items-center mb-6">
                <div className="relative w-72">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search deals..." className="h-9 pl-8" />
                </div>
            </div>

            <div className={`flex-1 overflow-x-auto ${viewMode === "kanban" ? "overflow-y-hidden" : ""}`}>
                {viewMode === "kanban" ? (
                    <div className="flex h-[calc(100vh-220px)] gap-4 pb-4 w-max">
                        {currentPipeline.stages.map((stage: any, index: number) => {
                            const isString = typeof stage === 'string';
                            const stageName = isString ? stage : stage.name;
                            const stageId = isString ? `stage-${index}` : (stage.id || stage.name);

                            const stageDeals = currentPipeline.deals.filter((d: any) => d.stage === stageName)
                            return (
                                <div
                                    key={stageId}
                                    className={`flex flex-col w-[340px] shrink-0 bg-muted/40 rounded-xl pb-2 border h-full overflow-hidden transition-colors ${dragOverStageId === stageId ? "border-primary/60 bg-primary/5 ring-2 ring-primary/20" : ""
                                        }`}
                                    onDragOver={(e) => handleDragOver(e, stageId)}
                                    onDragLeave={handleDragLeave}
                                    onDrop={(e) => handleDrop(e, stageId, stageName)}
                                >
                                    <div className="p-4 font-semibold flex items-center justify-between border-b bg-muted/60">
                                        <span className="text-sm uppercase tracking-wider">{stageName}</span>
                                        <Badge variant="secondary" className="px-2 py-0.5 rounded-full font-bold">
                                            {stageDeals.length}
                                        </Badge>
                                    </div>

                                    <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                                        {stageDeals.map((deal: any) => {
                                            const isNewInquiry = deal.unread === true;
                                                // Priority color mapping based on days from now until start date
                                                let priorityColorClass = "bg-blue-500"; // default to blue (>45 days)
                                                if (deal.startDate && deal.startDate !== "-") {
                                                    const start = new Date(deal.startDate);
                                                    const now = new Date();
                                                    const diffTime = start.getTime() - now.getTime();
                                                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                                    
                                                    if (diffDays <= 14) {
                                                        priorityColorClass = "bg-red-500";
                                                    } else if (diffDays <= 30) {
                                                        priorityColorClass = "bg-yellow-500";
                                                    } else {
                                                        priorityColorClass = "bg-blue-500";
                                                    }
                                                }

                                            return (
                                            <div
                                                key={deal.id}
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, deal.id)}
                                                onDragEnd={handleDragEnd}
                                                onClick={() => openDeal(deal)}
                                                className={`bg-card cursor-grab border hover:border-primary/40 transition-all rounded-xl p-4 shadow-sm group relative overflow-hidden flex flex-col gap-3 ${draggedDealId === deal.id ? "opacity-40 scale-95" : ""} ${isNewInquiry ? "border-primary/80 ring-2 ring-primary bg-primary/10 shadow-[0_0_20px_rgba(59,130,246,0.6)] animate-pulse" : "border-border/60 hover:shadow-lg"}`}
                                            >
                                                {/* Colored accent bar on the left based on priority */}
                                                <div className={`absolute left-0 top-0 bottom-0 w-1 ${deal.startDate && deal.startDate !== "-" ? priorityColorClass : (deal.priority === "HIGH" ? "bg-red-500" : deal.priority === "MEDIUM" ? "bg-amber-500" : "bg-blue-500")}`}></div>

                                                <div className="flex items-start justify-between pl-1">
                                                    <div className="flex items-center gap-3">
                                                        <Avatar className="h-9 w-9 border-2 border-background shadow-sm shrink-0">
                                                            <AvatarFallback className="bg-gradient-to-br from-slate-700 to-slate-900 text-white text-xs font-medium">{deal.name.charAt(6)}</AvatarFallback>
                                                        </Avatar>
                                                        <div className="flex flex-col gap-0.5">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className="font-semibold text-sm group-hover:text-primary transition-colors tracking-tight">{deal.name}</span>
                                                                {isNewInquiry && (
                                                                    <Badge className="shrink-0 text-[10px] font-bold tracking-wider bg-primary text-primary-foreground border-0 px-1.5 py-0">New</Badge>
                                                                )}
                                                            </div>
                                                            {showBase && (
                                                                <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                                                    <MapPin className="h-3 w-3" />
                                                                    {deal.base}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <Avatar title={`Assignee: ${deal.assignee}`} className="h-6 w-6 border border-background shadow-sm shrink-0 mt-1">
                                                        <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-bold">{deal.assignee}</AvatarFallback>
                                                    </Avatar>
                                                </div>

                                                {(showValue || showPriority) && (
                                                    <div className="grid grid-cols-2 gap-2 text-xs pl-1">
                                                        {showValue && (
                                                            <div className="flex flex-col gap-1">
                                                                <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Value</span>
                                                                <div className="flex items-center gap-1">
                                                                    <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                                                                    <span className="font-mono font-semibold text-sm">${deal.value.toLocaleString()}</span>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {showPriority && (
                                                            <div className="flex flex-col items-end gap-1">
                                                                <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Priority</span>
                                                                <Badge
                                                                    variant="outline"
                                                                    className={`text-[10px] font-bold tracking-wider rounded-sm
                                                                        ${(deal.startDate && deal.startDate !== "-" && priorityColorClass === "bg-red-500") || (!deal.startDate && deal.priority === "HIGH") ? "bg-red-500/10 text-red-600 border-red-500/20" : ""}
                                                                        ${(deal.startDate && deal.startDate !== "-" && priorityColorClass === "bg-yellow-500") || (!deal.startDate && deal.priority === "MEDIUM") ? "bg-amber-500/10 text-amber-600 border-amber-500/20" : ""}
                                                                        ${(deal.startDate && deal.startDate !== "-" && priorityColorClass === "bg-blue-500") || (!deal.startDate && deal.priority === "LOW") ? "bg-blue-500/10 text-blue-600 border-blue-500/20" : ""}
                                                                    `}
                                                                >
                                                                    {deal.startDate && deal.startDate !== "-" ? 
                                                                        (priorityColorClass === "bg-red-500" ? "URGENT" : priorityColorClass === "bg-yellow-500" ? "SOON" : "PLANNED")
                                                                    : deal.priority}
                                                                </Badge>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {(showDates || showEndDate || showLengthOfStay) && (
                                                    <div className="flex items-stretch justify-between pt-3 border-t border-border/50 pl-1 gap-2">
                                                        {(showDates || showEndDate) && (
                                                            <div className="flex flex-col gap-1.5 flex-1 bg-muted/20 border border-border/40 p-2 rounded-md justify-center">
                                                                {showDates && (
                                                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                                                                        <CalendarIcon className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                                                                        <span className="truncate"><span className="opacity-70 font-normal mr-1">Start:</span>{formatDisplayDate(deal.startDate)}</span>
                                                                    </div>
                                                                )}
                                                                {showEndDate && (
                                                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                                                                        <CalendarIcon className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                                                                        <span className="truncate"><span className="opacity-70 font-normal mr-1">End:</span>{formatDisplayDate(deal.endDate)}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                        {showLengthOfStay && (
                                                            <div className="flex flex-col items-center justify-center bg-muted/20 border border-border/40 p-2 rounded-md shrink-0 min-w-[70px]">
                                                                <span className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground mb-0.5">Duration</span>
                                                                <span className="text-xs font-bold text-primary/80">{getLengthOfStay(deal.startDate, deal.endDate)}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {showQuickActions && (
                                                    <div className="flex items-center gap-1.5 pt-3 border-t border-border/50 pl-1">
                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:bg-muted/50 hover:text-primary shrink-0 transition-colors">
                                                            <Phone className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:bg-muted/50 hover:text-primary shrink-0 transition-colors relative">
                                                            <MessageSquare className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:bg-muted/50 hover:text-primary shrink-0 transition-colors">
                                                            <Tag className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7 text-muted-foreground hover:bg-muted/50 hover:text-primary shrink-0 transition-colors relative"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setActiveTab("notes");
                                                                setSelectedDeal(deal);
                                                            }}
                                                        >
                                                            <FileText className="h-3.5 w-3.5" />
                                                            {deal.notes && <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-blue-500 text-[8px] text-white font-bold ring-2 ring-card border-none">1</span>}
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:bg-muted/50 hover:text-primary shrink-0 transition-colors">
                                                            <CheckSquare className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                        })}
                                        {stageDeals.length === 0 && (
                                            <div className="flex flex-col items-center justify-center h-24 border-2 border-dashed border-muted-foreground/20 rounded-xl text-muted-foreground bg-muted/10">
                                                <span className="text-xs font-medium">No deals in this stage</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    <div className="rounded-md border bg-card/50">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead>Contact</TableHead>
                                    <TableHead>Stage</TableHead>
                                    {showBase && <TableHead>Location</TableHead>}
                                    {showPriority && <TableHead>Priority</TableHead>}
                                    {showValue && <TableHead className="cursor-pointer hover:bg-muted/80 transition-colors" onClick={() => requestSort('value')}>Value <ArrowUpDown className="ml-1 h-3 w-3 inline-block text-muted-foreground" /></TableHead>}
                                    {showDates && <TableHead className="cursor-pointer hover:bg-muted/80 transition-colors" onClick={() => requestSort('startDate')}>Check-in <ArrowUpDown className="ml-1 h-3 w-3 inline-block text-muted-foreground" /></TableHead>}
                                    {showEndDate && <TableHead className="cursor-pointer hover:bg-muted/80 transition-colors" onClick={() => requestSort('endDate')}>Check-out <ArrowUpDown className="ml-1 h-3 w-3 inline-block text-muted-foreground" /></TableHead>}
                                    {showLengthOfStay && <TableHead className="cursor-pointer hover:bg-muted/80 transition-colors" onClick={() => requestSort('lengthOfStay')}>Duration <ArrowUpDown className="ml-1 h-3 w-3 inline-block text-muted-foreground" /></TableHead>}
                                    <TableHead>Assignee</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedDeals.map((deal) => (
                                    <TableRow key={deal.id} className={`cursor-pointer hover:bg-muted/30 ${deal.unread === true ? "bg-primary/[0.04]" : ""}`} onClick={() => openDeal(deal)}>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold">{deal.name}</span>
                                                {deal.unread === true && (
                                                    <Badge className="text-[10px] font-bold tracking-wider bg-primary text-primary-foreground border-0 px-1.5 py-0">New</Badge>
                                                )}
                                            </div>
                                            <div className="text-xs text-muted-foreground hidden sm:block">{deal.email} • {deal.phone}</div>
                                        </TableCell>
                                        <TableCell><Badge variant="secondary" className="font-medium bg-muted text-muted-foreground border-border">{deal.stage}</Badge></TableCell>
                                        {showBase && <TableCell className="text-muted-foreground">{deal.base}</TableCell>}
                                        {showPriority && <TableCell>
                                            <Badge variant="outline" className={`text-[10px] font-bold tracking-wider rounded-sm
                                                ${(() => {
                                                    let color = "";
                                                    if (deal.startDate && deal.startDate !== "-") {
                                                        const diffDays = Math.ceil((new Date(deal.startDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                                                        if (diffDays <= 14) color = "bg-red-500/10 text-red-600 border-red-500/20";
                                                        else if (diffDays <= 30) color = "bg-amber-500/10 text-amber-600 border-amber-500/20";
                                                        else color = "bg-blue-500/10 text-blue-600 border-blue-500/20";
                                                    } else {
                                                        if (deal.priority === "HIGH") color = "bg-red-500/10 text-red-600 border-red-500/20";
                                                        else if (deal.priority === "MEDIUM") color = "bg-amber-500/10 text-amber-600 border-amber-500/20";
                                                        else color = "bg-blue-500/10 text-blue-600 border-blue-500/20";
                                                    }
                                                    return color;
                                                })()}
                                            `}>
                                                {(() => {
                                                    if (deal.startDate && deal.startDate !== "-") {
                                                        const diffDays = Math.ceil((new Date(deal.startDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                                                        if (diffDays <= 14) return "URGENT";
                                                        if (diffDays <= 30) return "SOON";
                                                        return "PLANNED";
                                                    }
                                                    return deal.priority;
                                                })()}
                                            </Badge>
                                        </TableCell>}
                                        {showValue && <TableCell className="font-mono font-medium">${deal.value.toLocaleString()}</TableCell>}
                                        {showDates && <TableCell className="text-muted-foreground">{formatDisplayDate(deal.startDate)}</TableCell>}
                                        {showEndDate && <TableCell className="text-muted-foreground">{formatDisplayDate(deal.endDate)}</TableCell>}
                                        {showLengthOfStay && <TableCell className="font-medium text-primary/80">{getLengthOfStay(deal.startDate, deal.endDate)}</TableCell>}
                                        <TableCell>
                                            <Avatar className="h-6 w-6">
                                                <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{deal.assignee}</AvatarFallback>
                                            </Avatar>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {sortedDeals.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                                            No deals found in this pipeline.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </div>

            {/* Slide-over Deal Detail Pane */}
            <Sheet open={!!selectedDeal} onOpenChange={() => setSelectedDeal(null)}>
                <SheetContent className="sm:max-w-xl w-full p-0 flex flex-col gap-0 border-l border-border/50 shadow-2xl">
                    {selectedDeal && (
                        <>
                            <div className="p-6 bg-muted/30 border-b">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-4">
                                        <Avatar className="h-16 w-16 border-2 border-background shadow-sm">
                                            <AvatarFallback className="text-xl bg-primary/10 text-primary">{selectedDeal.name.charAt(6)}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <SheetTitle className="text-2xl">{selectedDeal.name}</SheetTitle>
                                            <SheetDescription className="flex items-center gap-2 mt-1">
                                                <Badge variant="outline" className="font-normal">{selectedDeal.stage}</Badge>
                                                <span className="text-xs text-muted-foreground">in Pipeline</span>
                                            </SheetDescription>
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                                        <MoreVertical className="h-4 w-4" />
                                    </Button>
                                </div>

                                <div className="flex items-center gap-6 mt-6">
                                    <Button size="sm" className="w-full">
                                        <Phone className="mr-2 h-4 w-4" />
                                        Call
                                    </Button>
                                    <Button size="sm" variant="outline" className="w-full">
                                        <Mail className="mr-2 h-4 w-4" />
                                        Email
                                    </Button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto">
                                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full flex flex-col">
                                    <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-6 h-12">
                                        <TabsTrigger value="details" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 h-full">Details</TabsTrigger>
                                        <TabsTrigger value="notes" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 h-full">Notes</TabsTrigger>
                                        <TabsTrigger value="forms" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 h-full">Forms</TabsTrigger>
                                    </TabsList>

                                    <TabsContent value="details" className="flex-1 p-6 m-0 outline-none space-y-8 overflow-y-auto">
                                        {/* Contact Info */}
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Contact Information</h3>
                                                <Button variant="outline" size="sm">Edit</Button>
                                            </div>
                                            <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-sm">
                                                <div className="space-y-1 col-span-2">
                                                    <span className="text-muted-foreground text-xs">Full Name</span>
                                                    <Input 
                                                        value={selectedDeal.name || ""} 
                                                        onChange={(e) => setSelectedDeal((prev: any) => prev ? { ...prev, name: e.target.value } : null)}
                                                        className="h-8 text-sm font-medium" 
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <span className="text-muted-foreground text-xs">Email Address</span>
                                                    <Input 
                                                        value={selectedDeal.email || ""} 
                                                        onChange={(e) => setSelectedDeal((prev: any) => prev ? { ...prev, email: e.target.value } : null)}
                                                        className="h-8 text-sm" 
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <span className="text-muted-foreground text-xs">Phone Number</span>
                                                    <Input 
                                                        value={selectedDeal.phone || ""} 
                                                        onChange={(e) => setSelectedDeal((prev: any) => prev ? { ...prev, phone: e.target.value } : null)}
                                                        className="h-8 text-sm" 
                                                    />
                                                </div>
                                                <div className="space-y-1 col-span-2">
                                                    <span className="text-muted-foreground text-xs">Military Base</span>
                                                    <div className="relative">
                                                        <MapPin className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                                                        <Input
                                                            list="bases-list"
                                                            value={selectedDeal.base || ""}
                                                            onChange={(e) => setSelectedDeal((prev: any) => prev ? { ...prev, base: e.target.value } : null)}
                                                            className="h-8 pl-8 text-sm"
                                                            placeholder="Type to search bases..."
                                                        />
                                                        <datalist id="bases-list">
                                                            {baseNames.map(base => (
                                                                <option key={base} value={base} />
                                                            ))}
                                                        </datalist>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <Separator />

                                        {/* Stay Info */}
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Stay Details</h3>
                                            </div>
                                            <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-sm">
                                                <div className="space-y-1">
                                                    <span className="text-muted-foreground text-xs">Check-in Date</span>
                                                    <div className="relative">
                                                        <Input type="date" value={selectedDeal.startDate || ""} onChange={(e) => setSelectedDeal((prev: any) => prev ? { ...prev, startDate: e.target.value } : null)} className="h-8 text-sm" />
                                                    </div>
                                                </div>
                                                <div className="space-y-1">
                                                    <span className="text-muted-foreground text-xs">Check-out Date</span>
                                                    <div className="relative">
                                                        <Input type="date" value={selectedDeal.endDate || ""} onChange={(e) => setSelectedDeal((prev: any) => prev ? { ...prev, endDate: e.target.value } : null)} className="h-8 text-sm" />
                                                    </div>
                                                </div>
                                                <div className="space-y-1 col-span-2">
                                                    <span className="text-muted-foreground text-xs">Pipeline Stage</span>
                                                    <select
                                                        className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                                        value={selectedDeal.stage}
                                                        onChange={(e) => {
                                                            const newStage = e.target.value;
                                                            setSelectedDeal((prev: any) => prev ? { ...prev, stage: newStage } : null);
                                                        }}
                                                    >
                                                        {currentPipeline.stages.map((s: any, index: number) => {
                                                            const isString = typeof s === 'string';
                                                            const stageName = isString ? s : s.name;
                                                            const stageId = isString ? `stage-${index}` : (s.id || s.name);
                                                            return (
                                                                <option key={stageId} value={stageName}>{stageName}</option>
                                                            )
                                                        })}
                                                    </select>
                                                </div>
                                            </div>
                                        </div>



                                        {/* Assigned To */}
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Assigned To</h3>
                                            </div>
                                            <select
                                                className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                                value={selectedDeal.assigneeId || ""}
                                                onChange={(e) => {
                                                    const userId = e.target.value || null;
                                                    const user = allUsers.find((u: any) => u.id === userId);
                                                    setSelectedDeal((prev: any) => prev ? {
                                                        ...prev,
                                                        assigneeId: userId,
                                                        assigneeName: user?.name || "Unassigned",
                                                        assignee: user?.name ? user.name.split(" ").map((w: string) => w[0]).join("").toUpperCase() : "\u2014"
                                                    } : null);
                                                }}
                                            >
                                                <option value="">Unassigned</option>
                                                {allUsers.map((user: any) => (
                                                    <option key={user.id} value={user.id}>
                                                        {user.name} ({user.role})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Lead Source */}
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Lead Source</h3>
                                            </div>
                                            <div className="space-y-3">
                                                <LeadSourceSelector
                                                    value={selectedDeal.leadSourceId}
                                                    onChange={(val) => setSelectedDeal((prev: any) => prev ? { ...prev, leadSourceId: val === "0" ? null : val } : null)}
                                                />
                                            </div>
                                        </div>

                                        {/* Special Accommodations */}
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Special Accommodations</h3>
                                            </div>
                                            <div className="space-y-2">
                                                {specialAccommodations.length === 0 ? (
                                                    <p className="text-xs text-muted-foreground">Add options in Settings → Workspace Options → Special Accommodations</p>
                                                ) : (
                                                    <div className="flex flex-col gap-2">
                                                        {specialAccommodations.map((acc) => (
                                                            <label
                                                                key={acc.id}
                                                                className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/30 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                                                            >
                                                                <input
                                                                    type="radio"
                                                                    name="specialAccommodation"
                                                                    value={acc.id}
                                                                    checked={(selectedDeal.specialAccommodationId || "") === acc.id}
                                                                    onChange={() => setSelectedDeal((prev: any) => prev ? { ...prev, specialAccommodationId: acc.id } : null)}
                                                                    className="h-4 w-4 text-primary border-input"
                                                                />
                                                                <span className="text-sm font-medium">{acc.name}</span>
                                                            </label>
                                                        ))}
                                                        <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/30 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                                                            <input
                                                                type="radio"
                                                                name="specialAccommodation"
                                                                value=""
                                                                checked={!selectedDeal.specialAccommodationId}
                                                                onChange={() => setSelectedDeal((prev: any) => prev ? { ...prev, specialAccommodationId: null } : null)}
                                                                className="h-4 w-4 text-primary border-input"
                                                            />
                                                            <span className="text-sm text-muted-foreground">None</span>
                                                        </label>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <Separator />

                                        {/* Tags */}
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Tags</h3>
                                            </div>
                                            <TagPicker
                                                selectedTagIds={selectedDeal.tags?.map((t: any) => t.tagId) || []}
                                                onAdd={(tagId) => setSelectedDeal((prev: any) => ({
                                                    ...prev,
                                                    tags: [...(prev.tags || []), { tagId }]
                                                }))}
                                                onRemove={(tagId) => setSelectedDeal((prev: any) => ({
                                                    ...prev,
                                                    tags: (prev.tags || []).filter((t: any) => t.tagId !== tagId)
                                                }))}
                                            />
                                        </div>


                                        <Separator />

                                        {/* Financials */}
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Financial Calculation</h3>
                                                <Dialog open={isCalculatorOpen} onOpenChange={setIsCalculatorOpen}>
                                                    <DialogTrigger asChild>
                                                        <Button variant="outline" size="sm" className="gap-2 border-primary/20 hover:border-primary/50 text-primary">
                                                            <Calculator className="h-4 w-4" />
                                                            Calculate Opportunity Cost
                                                        </Button>
                                                    </DialogTrigger>
                                                    <DialogContent className="max-w-2xl bg-card border-white/5 backdrop-blur-xl max-h-[90vh] overflow-y-auto">
                                                        <DialogHeader>
                                                            <DialogTitle>Housing Allowance Calculator</DialogTitle>
                                                        </DialogHeader>
                                                        <Tabs defaultValue="on-base" className="w-full">
                                                            <TabsList className="grid w-full grid-cols-2 mb-4">
                                                                <TabsTrigger value="on-base">On-Base</TabsTrigger>
                                                                <TabsTrigger value="off-base">Off-Base</TabsTrigger>
                                                            </TabsList>
                                                            <TabsContent value="on-base">
                                                                <OnBaseLodgingCalculator
                                                                    embedded
                                                                    initialBase={selectedDeal.base}
                                                                    initialStartDate={selectedDeal.startDate}
                                                                    initialEndDate={selectedDeal.endDate}
                                                                    onSyncValue={(val) => {
                                                                        handleSyncCalculatorValue(val, "ON_BASE");
                                                                    }}
                                                                />
                                                            </TabsContent>

                                                            <TabsContent value="off-base">
                                                                <OffBaseLodgingCalculator
                                                                    embedded
                                                                    initialBase={selectedDeal.base}
                                                                    initialStartDate={selectedDeal.startDate}
                                                                    initialEndDate={selectedDeal.endDate}
                                                                    onSyncValue={(val) => {
                                                                        handleSyncCalculatorValue(val, "OFF_BASE");
                                                                    }}
                                                                />
                                                            </TabsContent>
                                                        </Tabs>
                                                    </DialogContent>
                                                </Dialog>
                                            </div>
                                            <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 space-y-3">
                                                <div className="flex items-center justify-between text-sm">
                                                    <span className="text-muted-foreground">Opportunity Value</span>
                                                    <span className="font-mono font-medium">${selectedDeal.value.toLocaleString()}</span>
                                                </div>
                                                <div className="flex items-center justify-between text-sm">
                                                    <div className="flex flex-col">
                                                        <span className="text-muted-foreground">Expected Profit Margin</span>
                                                        <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-tighter">(25% DEFAULT)</span>
                                                    </div>
                                                    <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400 font-bold">${selectedDeal.margin.toLocaleString()}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="pt-4 flex items-center justify-between">
                                            <div>
                                                {userRole !== "AGENT" && (
                                                    <Button variant="outline" className="text-rose-500 hover:text-rose-600 hover:bg-rose-500/10" onClick={() => handleDeleteOpportunity(selectedDeal.id)}>
                                                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                                                    </Button>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3">
                                                {saveStatus === 'success' && (
                                                    <span className="text-xs text-emerald-500 font-semibold">✓ Saved</span>
                                                )}
                                                {saveStatus === 'error' && (
                                                    <span className="text-xs text-red-500 font-semibold">✗ Failed</span>
                                                )}
                                                <Button onClick={handleSaveOpportunity} disabled={isSaving}>
                                                    {isSaving ? "Saving..." : "Save Changes"}
                                                </Button>
                                            </div>
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="notes" className="flex-1 p-6 m-0 outline-none flex flex-col h-full">
                                        <div className="space-y-4 flex-1">
                                            <div className="flex items-start gap-3 p-4 rounded-lg border bg-muted/20">
                                                <Avatar className="h-8 w-8">
                                                    <AvatarFallback className="text-[10px]">{selectedDeal.assignee}</AvatarFallback>
                                                </Avatar>
                                                <div className="space-y-1">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-sm font-semibold">You</span>
                                                        <span className="text-xs text-muted-foreground">Added yesterday</span>
                                                    </div>
                                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                                        {selectedDeal.notes}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-8 relative hidden sm:block">
                                            <Input placeholder="Type a new note..." className="pr-10" />
                                            <Button size="icon" variant="ghost" className="absolute right-0 top-0 h-9 w-9 text-muted-foreground hover:text-primary">
                                                <Send className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="forms" className="flex-1 p-6 m-0 outline-none space-y-6">
                                        <div className="space-y-4">
                                            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Required Documentation</h3>

                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`flex items-center justify-center h-8 w-8 rounded-full ${selectedDeal.forms?.lease ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground"}`}>
                                                            {selectedDeal.forms?.lease ? <CheckCircle2 className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-medium">Homeowner Lease</p>
                                                            <p className="text-xs text-muted-foreground">{selectedDeal.forms?.lease ? "Signed" : "Awaiting signature"}</p>
                                                        </div>
                                                    </div>
                                                    <Button size="sm" variant={selectedDeal.forms?.lease ? "outline" : "default"}>
                                                        {selectedDeal.forms?.lease ? "View" : "Send"}
                                                    </Button>
                                                </div>

                                                <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`flex items-center justify-center h-8 w-8 rounded-full ${selectedDeal.forms?.tc ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground"}`}>
                                                            {selectedDeal.forms?.tc ? <CheckCircle2 className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-medium">Terms & Conditions</p>
                                                            <p className="text-xs text-muted-foreground">{selectedDeal.forms?.tc ? "Signed" : "Awaiting signature"}</p>
                                                        </div>
                                                    </div>
                                                    <Button size="sm" variant={selectedDeal.forms?.tc ? "outline" : "default"}>
                                                        {selectedDeal.forms?.tc ? "View" : "Send"}
                                                    </Button>
                                                </div>

                                                <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`flex items-center justify-center h-8 w-8 rounded-full ${selectedDeal.forms?.payment ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground"}`}>
                                                            {selectedDeal.forms?.payment ? <CheckCircle2 className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-medium">Payment Authorization</p>
                                                            <p className="text-xs text-muted-foreground">{selectedDeal.forms?.payment ? "Signed" : "Awaiting signature"}</p>
                                                        </div>
                                                    </div>
                                                    <Button size="sm" variant={selectedDeal.forms?.payment ? "outline" : "default"}>
                                                        {selectedDeal.forms?.payment ? "View" : "Send"}
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </TabsContent>
                                </Tabs>
                            </div>
                        </>
                    )}
                </SheetContent>
            </Sheet>
        </div>
    )
}
