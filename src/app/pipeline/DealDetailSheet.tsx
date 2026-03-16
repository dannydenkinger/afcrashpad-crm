"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
    DollarSign, MapPin, Phone, Mail, FileText, CheckCircle2, MoreVertical, MessageSquare, Calculator, User, Trash2, FileDown, Ban, Plus, X, CreditCard, Banknote, Wallet
} from "lucide-react"
import { exportToPDF } from "@/lib/export-pdf"
import { buildDealProfileHtml } from "@/components/PrintableProfile"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetTitle,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LeadSourceSelector } from "@/components/ui/LeadSourceSelector"
import { TagPicker } from "@/components/ui/TagPicker"
import { DocumentManager } from "@/app/contacts/documents/DocumentManager"
import { createNote, deleteNote } from "@/app/contacts/actions"
import type { TimelineItem } from "@/app/contacts/types"
import { NotesEditor } from "@/components/NotesEditor"
import { CustomFieldsSection } from "@/components/CustomFieldsSection"
import { updateRequiredDocs, moveToLeaseSigned, claimOpportunity, updateBlockers, addPayment, getPayments, updateDealExpenses, getDealExpenses, updateOpportunity } from "./actions"
import type { DealStatus } from "@/types"
import { DEAL_STATUS_LABELS, DEAL_STATUS_COLORS } from "@/types"
import { toast } from "sonner"
import dynamic from "next/dynamic"

const OffBaseLodgingCalculator = dynamic(() => import("@/components/calculators/OffBaseLodgingCalculator"), {
    ssr: false,
    loading: () => <div className="h-[300px] flex items-center justify-center">Loading Off-Base Calculator...</div>
})

const OnBaseLodgingCalculator = dynamic(() => import("@/components/calculators/OnBaseLodgingCalculator").then(mod => mod.OnBaseLodgingCalculator), {
    ssr: false,
    loading: () => <div className="h-[300px] flex items-center justify-center">Loading On-Base Calculator...</div>
})

function BaseCombobox({ value, bases, onChange }: { value: string; bases: string[]; onChange: (val: string) => void }) {
    const [open, setOpen] = useState(false)
    const [search, setSearch] = useState(value)
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => { setSearch(value) }, [value])

    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
        }
        document.addEventListener("mousedown", handleClick)
        return () => document.removeEventListener("mousedown", handleClick)
    }, [])

    const filtered = search
        ? bases.filter(b => b.toLowerCase().includes(search.toLowerCase()))
        : []

    return (
        <div className="relative" ref={containerRef}>
            <MapPin className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground z-10" />
            <Input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setOpen(true); onChange(e.target.value) }}
                onFocus={() => { if (search) setOpen(true) }}
                className="h-8 pl-8 text-sm"
                placeholder="Type to search bases..."
            />
            {open && filtered.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-md border border-border bg-popover text-popover-foreground shadow-md">
                    {filtered.map(base => (
                        <div
                            key={base}
                            className={`px-3 py-1.5 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors ${base === value ? "bg-accent/50 font-medium" : ""}`}
                            onMouseDown={(e) => { e.preventDefault(); setSearch(base); onChange(base); setOpen(false) }}
                        >
                            {base}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

interface DealDetailSheetProps {
    selectedDeal: any
    setSelectedDeal: (val: any) => void
    activeTab: string
    setActiveTab: (val: string) => void
    currentPipeline: any
    activePipelineKey: string
    baseNames: string[]
    allUsers: any[]
    specialAccommodations: { id: string; name: string }[]
    userRole: string
    session: any
    isSaving: boolean
    saveStatus: 'idle' | 'success' | 'error'
    onSave: () => void
    onDelete: (id: string) => void
    onSyncCalculatorValue: (val: number, type: "BAH" | "VA" | "ON_BASE" | "OFF_BASE") => void
    contactTimeline: TimelineItem[] | null
    timelineLoading: boolean
    onRefetchTimeline: () => void
    searchParams: ReturnType<typeof import("next/navigation").useSearchParams>
    router: ReturnType<typeof import("next/navigation").useRouter>
    pathname: string
    openedDealIdFromUrl: React.MutableRefObject<string | null>
    fetchPipelines: () => void
    onLinkContact?: () => void
}

export function DealDetailSheet({
    selectedDeal,
    setSelectedDeal,
    activeTab,
    setActiveTab,
    currentPipeline,
    activePipelineKey,
    baseNames,
    allUsers,
    specialAccommodations,
    userRole,
    session,
    isSaving,
    saveStatus,
    onSave,
    onDelete,
    onSyncCalculatorValue,
    contactTimeline,
    timelineLoading,
    onRefetchTimeline,
    searchParams,
    router,
    pathname,
    openedDealIdFromUrl,
    fetchPipelines,
    onLinkContact,
}: DealDetailSheetProps) {
    // Internal state for the sheet
    const [isCalculatorOpen, setIsCalculatorOpen] = useState(false)
    const [noteToDelete, setNoteToDelete] = useState<{ contactId: string; noteId: string } | null>(null)
    const [isDeletingNote, setIsDeletingNote] = useState(false)
    const [formErrors, setFormErrors] = useState<Record<string, string>>({})
    const [blockerInput, setBlockerInput] = useState("")
    const [isSavingBlockers, setIsSavingBlockers] = useState(false)

    const handleAddBlocker = async () => {
        const text = blockerInput.trim()
        if (!text || !selectedDeal?.id || selectedDeal.id === "new") return
        const newBlockers = [...(selectedDeal.blockers || []), text]
        setIsSavingBlockers(true)
        const res = await updateBlockers(selectedDeal.id, newBlockers)
        if (res.success) {
            setSelectedDeal((prev: any) => prev ? { ...prev, blockers: newBlockers } : null)
            setBlockerInput("")
            fetchPipelines()
        }
        setIsSavingBlockers(false)
    }

    const handleRemoveBlocker = async (index: number) => {
        if (!selectedDeal?.id || selectedDeal.id === "new") return
        const newBlockers = (selectedDeal.blockers || []).filter((_: string, i: number) => i !== index)
        setIsSavingBlockers(true)
        const res = await updateBlockers(selectedDeal.id, newBlockers)
        if (res.success) {
            setSelectedDeal((prev: any) => prev ? { ...prev, blockers: newBlockers } : null)
            fetchPipelines()
        }
        setIsSavingBlockers(false)
    }

    // Payment tracking state
    const [payments, setPayments] = useState<{ id: string; amount: number; date: string; method: string; notes: string; recordedBy: string; createdAt: string }[]>([])
    const [paymentsLoading, setPaymentsLoading] = useState(false)
    const [showPaymentForm, setShowPaymentForm] = useState(false)
    const [paymentFormData, setPaymentFormData] = useState({ amount: "", date: new Date().toISOString().split("T")[0], method: "ach", notes: "" })
    const [addingPayment, setAddingPayment] = useState(false)

    // Expenses state
    const [expensesData, setExpensesData] = useState({ monthlyRent: 0, cleaningFee: 0, petFee: 0, nonrefundableDeposit: 0 })
    const [expensesLoading, setExpensesLoading] = useState(false)
    const [savingExpenses, setSavingExpenses] = useState(false)
    const [showRentBreakdown, setShowRentBreakdown] = useState(false)

    const loadPayments = useCallback(async (dealId: string) => {
        if (!dealId || dealId === "new") return
        setPaymentsLoading(true)
        const res = await getPayments(dealId)
        if (res.success && res.payments) setPayments(res.payments)
        setPaymentsLoading(false)
    }, [])

    const loadExpenses = useCallback(async (dealId: string) => {
        if (!dealId || dealId === "new") return
        setExpensesLoading(true)
        const res = await getDealExpenses(dealId)
        if (res.success && res.expenses) setExpensesData(res.expenses)
        setExpensesLoading(false)
    }, [])

    useEffect(() => {
        if (selectedDeal?.id && activeTab === "finance") {
            loadPayments(selectedDeal.id)
            loadExpenses(selectedDeal.id)
        }
    }, [selectedDeal?.id, activeTab, loadPayments, loadExpenses])

    // Proration calculation
    function calculateProratedRent(monthlyRent: number, startDate: string, endDate: string) {
        if (!startDate || !endDate || monthlyRent <= 0) return { months: [], totalRent: 0 }
        const start = new Date(startDate + "T12:00:00")
        const end = new Date(endDate + "T12:00:00")
        if (end <= start) return { months: [], totalRent: 0 }

        const months: { label: string; days: number; totalDays: number; amount: number }[] = []
        const cursor = new Date(start)

        while (cursor < end) {
            const year = cursor.getFullYear()
            const month = cursor.getMonth()
            const totalDaysInMonth = new Date(year, month + 1, 0).getDate()
            const monthStart = cursor.getDate()
            const monthEnd = (year === end.getFullYear() && month === end.getMonth())
                ? end.getDate()
                : totalDaysInMonth
            const days = monthEnd - monthStart + (cursor.getTime() === start.getTime() ? 0 : 0)
            const actualDays = Math.min(monthEnd - monthStart + 1, totalDaysInMonth)
            const amount = (actualDays / totalDaysInMonth) * monthlyRent

            months.push({
                label: new Date(year, month).toLocaleDateString("en-US", { month: "short", year: "numeric" }),
                days: actualDays,
                totalDays: totalDaysInMonth,
                amount: Math.round(amount * 100) / 100,
            })

            cursor.setMonth(cursor.getMonth() + 1)
            cursor.setDate(1)
        }

        return { months, totalRent: months.reduce((sum, m) => sum + m.amount, 0) }
    }

    const proratedRent = selectedDeal ? calculateProratedRent(
        expensesData.monthlyRent,
        selectedDeal.startDate || "",
        selectedDeal.endDate || ""
    ) : { months: [], totalRent: 0 }

    const totalExpenses = proratedRent.totalRent + expensesData.cleaningFee + expensesData.petFee + expensesData.nonrefundableDeposit

    const handleSaveExpenses = async () => {
        if (!selectedDeal?.id || selectedDeal.id === "new") return
        setSavingExpenses(true)
        const res = await updateDealExpenses(selectedDeal.id, expensesData)
        if (res.success) {
            toast.success("Expenses saved")
            setSelectedDeal((prev: any) => prev ? { ...prev, expenses: expensesData } : null)
        } else {
            toast.error(res.error || "Failed to save expenses")
        }
        setSavingExpenses(false)
    }

    const handleAddPayment = async () => {
        if (!selectedDeal?.id || selectedDeal.id === "new") return
        const amount = parseFloat(paymentFormData.amount)
        if (isNaN(amount) || amount <= 0) {
            toast.error("Please enter a valid payment amount")
            return
        }
        setAddingPayment(true)
        const res = await addPayment(selectedDeal.id, amount, paymentFormData.date, paymentFormData.method, paymentFormData.notes)
        if (res.success) {
            toast.success(`Payment of $${amount.toFixed(2)} recorded`)
            setPaymentFormData({ amount: "", date: new Date().toISOString().split("T")[0], method: "ach", notes: "" })
            setShowPaymentForm(false)
            loadPayments(selectedDeal.id)
            if (res.paymentStatus) {
                setSelectedDeal((prev: any) => prev ? {
                    ...prev,
                    paymentStatus: res.paymentStatus,
                    revenueStatus: res.revenueStatus,
                    collectedAmount: res.totalPaid,
                } : null)
            }
            fetchPipelines()
        } else {
            toast.error(res.error || "Failed to record payment")
        }
        setAddingPayment(false)
    }

    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)
    const dealValue = selectedDeal?.value || 0
    const paymentProgress = dealValue > 0 ? Math.min((totalPaid / dealValue) * 100, 100) : 0

    const paymentMethodLabels: Record<string, string> = {
        check: "Check", ach: "ACH", credit_card: "Credit Card", wire: "Wire Transfer", cash: "Cash", other: "Other"
    }

    const validateDealForm = (): Record<string, string> => {
        const errors: Record<string, string> = {}
        if (!selectedDeal?.name?.trim()) {
            errors.name = "Name is required"
        }
        if (selectedDeal?.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(selectedDeal.email)) {
            errors.email = "Invalid email format"
        }
        if (selectedDeal?.startDate && selectedDeal?.endDate && selectedDeal.startDate > selectedDeal.endDate) {
            errors.endDate = "End date must be after start date"
        }
        return errors
    }

    const handleValidatedSave = () => {
        const errors = validateDealForm()
        setFormErrors(errors)
        if (Object.keys(errors).length > 0) return
        onSave()
    }

    const handleDeleteOpportunityNote = async () => {
        if (!noteToDelete) return;
        setIsDeletingNote(true);
        const res = await deleteNote(noteToDelete.contactId, noteToDelete.noteId);
        if (res.success) onRefetchTimeline();
        setNoteToDelete(null);
        setIsDeletingNote(false);
    };

    return (
        <>
            {/* Slide-over Deal Detail Pane */}
            <Sheet
                open={!!selectedDeal}
                onOpenChange={(open) => {
                    if (!open) {
                        setSelectedDeal(null);
                        // Clear ?deal= from URL so effect won't re-open the sheet
                        const dealId = searchParams.get('deal');
                        if (dealId) {
                            openedDealIdFromUrl.current = null;
                            const params = new URLSearchParams(searchParams.toString());
                            params.delete('deal');
                            const q = params.toString();
                            router.replace(q ? `${pathname}?${q}` : pathname);
                        }
                    }
                }}
            >
                <SheetContent className="lg:max-w-xl p-0 flex flex-col gap-0 border-l border-border/50 shadow-2xl safe-bottom">
                    {selectedDeal && (
                        <>
                            <div className="bg-muted/30 safe-top shrink-0" />
                            <div className="p-4 sm:p-6 bg-muted/30 border-b">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3 sm:gap-4">
                                        <Avatar className="h-12 w-12 sm:h-16 sm:w-16 border-2 border-background shadow-sm">
                                            <AvatarFallback className="text-lg sm:text-xl bg-primary/10 text-primary">{(selectedDeal.name || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <SheetTitle className="text-xl sm:text-2xl">{selectedDeal.name || "New opportunity"}</SheetTitle>
                                            <SheetDescription className="flex items-center gap-2 mt-1 flex-wrap">
                                                <Badge variant="outline" className="font-normal">{selectedDeal.stage}</Badge>
                                                {selectedDeal.id !== "new" && (
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Badge variant="outline" className={`cursor-pointer font-normal ${DEAL_STATUS_COLORS[(selectedDeal.status || "open") as DealStatus]}`}>
                                                                {DEAL_STATUS_LABELS[(selectedDeal.status || "open") as DealStatus]}
                                                            </Badge>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="start">
                                                            {(["open", "closed_won", "closed_lost", "archive"] as DealStatus[]).map(s => (
                                                                <DropdownMenuItem
                                                                    key={s}
                                                                    disabled={s === (selectedDeal.status || "open")}
                                                                    onClick={async () => {
                                                                        const res = await updateOpportunity(selectedDeal.id, { status: s })
                                                                        if (res.success) {
                                                                            setSelectedDeal((prev: any) => prev ? { ...prev, status: s } : null)
                                                                            fetchPipelines()
                                                                            toast.success(`Deal marked as ${DEAL_STATUS_LABELS[s]}`)
                                                                        }
                                                                    }}
                                                                >
                                                                    <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
                                                                        s === "open" ? "bg-emerald-500" :
                                                                        s === "closed_won" ? "bg-blue-500" :
                                                                        s === "closed_lost" ? "bg-red-500" :
                                                                        "bg-gray-400"
                                                                    }`} />
                                                                    {DEAL_STATUS_LABELS[s]}
                                                                </DropdownMenuItem>
                                                            ))}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                )}
                                            </SheetDescription>
                                        </div>
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                                                <MoreVertical className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem
                                                onClick={() => {
                                                    const html = buildDealProfileHtml(selectedDeal)
                                                    const safeName = (selectedDeal.name || "deal").replace(/[^a-zA-Z0-9]/g, "_")
                                                    exportToPDF(html, `${safeName}_deal_profile`)
                                                }}
                                            >
                                                <FileDown className="mr-2 h-4 w-4" />
                                                Export PDF
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>

                                <div className="flex items-center gap-3 sm:gap-6 mt-4 sm:mt-6">
                                    <Button size="sm" className="w-full">
                                        <Phone className="mr-2 h-4 w-4" />
                                        Call
                                    </Button>
                                    <Button size="sm" variant="outline" className="w-full">
                                        <Mail className="mr-2 h-4 w-4" />
                                        Email
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant={selectedDeal.claimedBy === session?.user?.id ? "default" : "outline"}
                                        className="w-full"
                                        onClick={async () => {
                                            const res = await claimOpportunity(selectedDeal.id);
                                            if (res.success) {
                                                if (res.action === "claimed") {
                                                    setSelectedDeal((prev: any) => prev ? {
                                                        ...prev,
                                                        claimedBy: session?.user?.id,
                                                        claimedByName: session?.user?.name || session?.user?.email || "You",
                                                        claimedAt: new Date().toISOString(),
                                                    } : null);
                                                } else {
                                                    setSelectedDeal((prev: any) => prev ? {
                                                        ...prev,
                                                        claimedBy: null,
                                                        claimedByName: null,
                                                        claimedAt: null,
                                                    } : null);
                                                }
                                                fetchPipelines();
                                            }
                                        }}
                                    >
                                        <User className="mr-2 h-4 w-4" />
                                        {selectedDeal.claimedBy === session?.user?.id
                                            ? "Unclaim"
                                            : selectedDeal.claimedBy
                                                ? `Claimed by ${selectedDeal.claimedByName}`
                                                : "Claim"
                                        }
                                    </Button>
                                </div>
                                {selectedDeal.claimedByName && selectedDeal.claimedBy !== session?.user?.id && (
                                    <p className="text-xs text-muted-foreground mt-2">Currently being worked by {selectedDeal.claimedByName}</p>
                                )}
                            </div>

                            <div className="flex-1 overflow-y-auto">
                                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full flex flex-col">
                                    <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-3 sm:px-6 h-12">
                                        <TabsTrigger value="details" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2.5 sm:px-4 h-full text-xs sm:text-sm min-h-[44px] sm:min-h-0 touch-manipulation">Details</TabsTrigger>
                                        <TabsTrigger value="notes" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2.5 sm:px-4 h-full text-xs sm:text-sm min-h-[44px] sm:min-h-0 touch-manipulation">Notes</TabsTrigger>
                                        <TabsTrigger value="timeline" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2.5 sm:px-4 h-full text-xs sm:text-sm min-h-[44px] sm:min-h-0 touch-manipulation">Timeline</TabsTrigger>
                                        <TabsTrigger value="documents" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2.5 sm:px-4 h-full text-xs sm:text-sm min-h-[44px] sm:min-h-0 touch-manipulation">Docs</TabsTrigger>
                                        <TabsTrigger value="finance" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2.5 sm:px-4 h-full text-xs sm:text-sm min-h-[44px] sm:min-h-0 touch-manipulation">Finance</TabsTrigger>
                                    </TabsList>

                                    <TabsContent value="details" className="flex-1 p-4 sm:p-6 m-0 outline-none space-y-8 overflow-y-auto">
                                        {/* Contact Info */}
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Contact Information</h3>
                                                <Button variant="outline" size="sm">Edit</Button>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-4 sm:gap-x-8 text-sm">
                                                <div className="space-y-1 col-span-2">
                                                    <span className="text-muted-foreground text-xs">Full Name</span>
                                                    <Input
                                                        value={selectedDeal.name || ""}
                                                        onChange={(e) => {
                                                            setSelectedDeal((prev: any) => prev ? { ...prev, name: e.target.value } : null)
                                                            if (formErrors.name) setFormErrors(prev => { const next = {...prev}; delete next.name; return next })
                                                        }}
                                                        className={`h-8 text-sm font-medium ${formErrors.name ? "border-destructive" : ""}`}
                                                    />
                                                    {formErrors.name && <p className="text-xs text-destructive mt-1">{formErrors.name}</p>}
                                                </div>
                                                <div className="space-y-1">
                                                    <span className="text-muted-foreground text-xs">Email Address</span>
                                                    <Input
                                                        value={selectedDeal.email || ""}
                                                        onChange={(e) => {
                                                            setSelectedDeal((prev: any) => prev ? { ...prev, email: e.target.value } : null)
                                                            if (formErrors.email) setFormErrors(prev => { const next = {...prev}; delete next.email; return next })
                                                        }}
                                                        className={`h-8 text-sm ${formErrors.email ? "border-destructive" : ""}`}
                                                    />
                                                    {formErrors.email && <p className="text-xs text-destructive mt-1">{formErrors.email}</p>}
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
                                                    <BaseCombobox
                                                        value={selectedDeal.base || ""}
                                                        bases={baseNames}
                                                        onChange={(val) => setSelectedDeal((prev: any) => prev ? { ...prev, base: val } : null)}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {selectedDeal?.id !== 'new' && !selectedDeal?.contactId && onLinkContact && (
                                            <div className="flex items-center gap-2 p-3 rounded-lg border border-dashed border-primary/30 bg-primary/5">
                                                <User className="h-4 w-4 text-primary" />
                                                <span className="text-sm text-muted-foreground flex-1">No contact linked</span>
                                                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onLinkContact}>
                                                    Link Contact
                                                </Button>
                                            </div>
                                        )}

                                        <Separator />

                                        {/* Stay Info */}
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Stay Details</h3>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-4 sm:gap-x-8 text-sm">
                                                <div className="space-y-1">
                                                    <span className="text-muted-foreground text-xs">Check-in Date</span>
                                                    <div className="relative">
                                                        <Input type="date" value={selectedDeal.startDate || ""} onChange={(e) => {
                                                            setSelectedDeal((prev: any) => prev ? { ...prev, startDate: e.target.value } : null)
                                                            if (formErrors.endDate) setFormErrors(prev => { const next = {...prev}; delete next.endDate; return next })
                                                        }} className="h-8 text-sm" />
                                                    </div>
                                                </div>
                                                <div className="space-y-1">
                                                    <span className="text-muted-foreground text-xs">Check-out Date</span>
                                                    <div className="relative">
                                                        <Input type="date" value={selectedDeal.endDate || ""} onChange={(e) => {
                                                            setSelectedDeal((prev: any) => prev ? { ...prev, endDate: e.target.value } : null)
                                                            if (formErrors.endDate) setFormErrors(prev => { const next = {...prev}; delete next.endDate; return next })
                                                        }} className={`h-8 text-sm ${formErrors.endDate ? "border-destructive" : ""}`} />
                                                    </div>
                                                    {formErrors.endDate && <p className="text-xs text-destructive mt-1">{formErrors.endDate}</p>}
                                                </div>
                                                <div className="space-y-1 col-span-2">
                                                    <span className="text-muted-foreground text-xs">Pipeline Stage</span>
                                                    <select
                                                        className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                                        value={selectedDeal.stage}
                                                        disabled={(selectedDeal.status || "open") !== "open"}
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
                                            {userRole === "OWNER" || userRole === "ADMIN" ? (
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
                                            ) : (
                                                <p className="text-sm text-muted-foreground">
                                                    {selectedDeal.assigneeName || "Unassigned"}
                                                </p>
                                            )}
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
                                                    <p className="text-xs text-muted-foreground">Add options in Settings &rarr; Workspace Options &rarr; Special Accommodations</p>
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

                                        {/* Blockers */}
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                                    <Ban className="h-4 w-4 text-red-500" />
                                                    Blockers
                                                </h3>
                                                {(selectedDeal.blockers?.length || 0) > 0 && (
                                                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                                                        {selectedDeal.blockers.length}
                                                    </Badge>
                                                )}
                                            </div>
                                            {selectedDeal.id !== "new" && (
                                                <div className="space-y-2">
                                                    {(selectedDeal.blockers || []).map((blocker: string, idx: number) => (
                                                        <div key={idx} className="flex items-start gap-2 p-2.5 rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20">
                                                            <Ban className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                                                            <span className="text-sm flex-1">{blocker}</span>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-6 w-6 shrink-0 text-red-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30"
                                                                onClick={() => handleRemoveBlocker(idx)}
                                                                disabled={isSavingBlockers}
                                                            >
                                                                <X className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                    ))}
                                                    <div className="flex gap-2">
                                                        <Input
                                                            value={blockerInput}
                                                            onChange={(e) => setBlockerInput(e.target.value)}
                                                            placeholder="Add a blocker note..."
                                                            className="h-8 text-sm"
                                                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddBlocker() } }}
                                                        />
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="shrink-0 h-8"
                                                            onClick={handleAddBlocker}
                                                            disabled={!blockerInput.trim() || isSavingBlockers}
                                                        >
                                                            <Plus className="h-3.5 w-3.5 mr-1" />
                                                            Add
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}
                                            {selectedDeal.id === "new" && (
                                                <p className="text-xs text-muted-foreground">Save the deal first to add blockers.</p>
                                            )}
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

                                        {/* Custom Fields */}
                                        <Separator />
                                        <CustomFieldsSection
                                            entityType="deal"
                                            values={selectedDeal?.customFields || {}}
                                            onChange={(fieldId, value) => {
                                                setSelectedDeal((prev: any) => prev ? {
                                                    ...prev,
                                                    customFields: { ...(prev.customFields || {}), [fieldId]: value },
                                                } : null)
                                            }}
                                        />

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
                                                                        onSyncCalculatorValue(val, "ON_BASE");
                                                                        setIsCalculatorOpen(false);
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
                                                                        onSyncCalculatorValue(val, "OFF_BASE");
                                                                        setIsCalculatorOpen(false);
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
                                                    <span className="font-mono font-medium">${(Number(selectedDeal.value) || 0).toLocaleString()}</span>
                                                </div>
                                                <div className="flex items-center justify-between text-sm">
                                                    <div className="flex flex-col">
                                                        <span className="text-muted-foreground">Expected Profit Margin</span>
                                                        <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-tighter">(25% DEFAULT)</span>
                                                    </div>
                                                    <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400 font-bold">${(Number(selectedDeal.margin) || 0).toLocaleString()}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="pt-4 flex items-center justify-between">
                                            <div>
                                                {userRole !== "AGENT" && (
                                                    <Button variant="outline" className="text-rose-500 hover:text-rose-600 hover:bg-rose-500/10" onClick={() => onDelete(selectedDeal.id)}>
                                                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                                                    </Button>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3">
                                                {saveStatus === 'success' && (
                                                    <span className="text-xs text-emerald-500 font-semibold">&#10003; Saved</span>
                                                )}
                                                {saveStatus === 'error' && (
                                                    <span className="text-xs text-red-500 font-semibold">&#10007; Failed</span>
                                                )}
                                                <Button onClick={handleValidatedSave} disabled={isSaving}>
                                                    {isSaving ? "Saving..." : "Save Changes"}
                                                </Button>
                                            </div>
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="notes" className="flex-1 p-4 sm:p-6 m-0 outline-none flex flex-col h-full">
                                        {!selectedDeal.contactId ? (
                                            <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
                                                <FileText className="h-10 w-10 opacity-50" />
                                                <p className="text-sm font-medium">Link a contact to view and add notes</p>
                                                <p className="text-xs">Notes added here appear on the contact (same as GoHighLevel).</p>
                                            </div>
                                        ) : (
                                            <NotesEditor
                                                notes={(() => {
                                                    const noteItems = (contactTimeline ?? []).filter((item) => item.kind === "note");
                                                    return noteItems.map((item) => ({
                                                        id: item.id,
                                                        content: item.content,
                                                        authorName: item.kind === "note" ? item.authorName ?? null : null,
                                                        authorId: item.kind === "note" ? item.authorId ?? null : null,
                                                        mentions: item.kind === "note" ? item.mentions ?? [] : [],
                                                        createdAt: item.createdAt,
                                                    }));
                                                })()}
                                                onAddNote={async (content, mentions) => {
                                                    const cid = selectedDeal.contactId;
                                                    if (!cid) return;
                                                    const res = await createNote(cid, content, {
                                                        opportunityId: selectedDeal.id,
                                                        source: "deal",
                                                        mentions,
                                                    });
                                                    if (res.success) onRefetchTimeline();
                                                }}
                                                onDeleteNote={(noteId) => setNoteToDelete({ contactId: selectedDeal.contactId, noteId })}
                                                users={allUsers}
                                                isLoading={timelineLoading}
                                                placeholder="Type a note (saved to contact)... Use @ to mention a team member"
                                            />
                                        )}
                                    </TabsContent>

                                    <TabsContent value="timeline" className="flex-1 p-4 sm:p-6 m-0 outline-none overflow-y-auto">
                                        <div className="relative space-y-6 before:absolute before:inset-0 before:ml-5 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-border before:via-border before:to-transparent">
                                            {!selectedDeal.contactId ? (
                                                <div className="ml-14 py-8 text-sm text-muted-foreground">Link a contact to this opportunity to see the timeline.</div>
                                            ) : timelineLoading ? (
                                                <div className="ml-14 py-8 text-sm text-muted-foreground">Loading timeline...</div>
                                            ) : !contactTimeline?.length ? (
                                                <div className="ml-14 py-8 text-sm text-muted-foreground">No timeline activity yet.</div>
                                            ) : (
                                                contactTimeline.map((item) => {
                                                    if (item.kind === "message") {
                                                        return (
                                                            <div key={item.id} className="relative flex items-center gap-4">
                                                                <div className="absolute left-0 mt-1 flex h-10 w-10 items-center justify-center rounded-full border bg-background shadow-sm z-10">
                                                                    {item.type === "EMAIL" && <Mail className="h-4 w-4 text-blue-500" />}
                                                                    {item.type === "SMS" && <MessageSquare className="h-4 w-4 text-emerald-500" />}
                                                                    {item.type === "CALL" && <Phone className="h-4 w-4 text-amber-500" />}
                                                                </div>
                                                                <div className="ml-14 flex-1 space-y-1">
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-sm font-bold">
                                                                            {item.direction === "INBOUND" ? "Received " : "Sent "}
                                                                            {(item.type || "").toLowerCase()}
                                                                        </span>
                                                                        <span className="text-[10px] text-muted-foreground tabular-nums">
                                                                            {new Date(item.createdAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                                                                        </span>
                                                                    </div>
                                                                    <div className="p-3 rounded-xl border bg-muted/30 text-sm text-muted-foreground leading-relaxed">
                                                                        {item.content}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    }
                                                    if (item.kind === "note") {
                                                        return (
                                                            <div key={item.id} className="relative flex items-center gap-4">
                                                                <div className="absolute left-0 mt-1 flex h-10 w-10 items-center justify-center rounded-full border bg-background shadow-sm z-10">
                                                                    <FileText className="h-4 w-4 text-primary" />
                                                                </div>
                                                                <div className="ml-14 flex-1 space-y-1">
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-sm font-bold">Internal note</span>
                                                                        <span className="text-[10px] text-muted-foreground tabular-nums">
                                                                            {new Date(item.createdAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                                                                        </span>
                                                                    </div>
                                                                    <div className="p-3 rounded-xl border bg-muted/30 text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                                                                        {item.content}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    }
                                                    return (
                                                        <div key={item.id} className="relative flex items-center gap-4">
                                                            <div className="absolute left-0 mt-1 flex h-10 w-10 items-center justify-center rounded-full border bg-background shadow-sm z-10">
                                                                <Trash2 className="h-4 w-4 text-muted-foreground" />
                                                            </div>
                                                            <div className="ml-14 flex-1 space-y-1">
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-sm font-bold text-muted-foreground">
                                                                        Note deleted{item.deletedBy ? ` by ${item.deletedBy}` : ""}
                                                                    </span>
                                                                    <span className="text-[10px] text-muted-foreground tabular-nums">
                                                                        {new Date(item.createdAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                                                                    </span>
                                                                </div>
                                                                <div className="p-3 rounded-xl border border-dashed bg-muted/20 text-sm text-muted-foreground italic">
                                                                    {item.contentPreview ? `"${item.contentPreview}"` : "A note was removed."}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="documents" className="flex-1 p-4 sm:p-6 m-0 outline-none overflow-y-auto space-y-6">
                                        <div className="space-y-4">
                                            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Required Documentation</h3>
                                            <p className="text-xs text-muted-foreground">Check off each document once it has been uploaded and verified.</p>
                                            <div className="space-y-3">
                                                {[
                                                    { key: "lease" as const, label: "Homeowner Lease" },
                                                    { key: "tc" as const, label: "Terms & Conditions" },
                                                    { key: "payment" as const, label: "Payment Authorization" },
                                                ].map((doc) => {
                                                    const isChecked = selectedDeal.requiredDocs?.[doc.key] ?? false;
                                                    return (
                                                        <label key={doc.key} className="flex items-center gap-3 p-4 rounded-lg border bg-card cursor-pointer hover:bg-muted/30 transition-colors">
                                                            <input
                                                                type="checkbox"
                                                                checked={isChecked}
                                                                onChange={async (e) => {
                                                                    const val = e.target.checked;
                                                                    setSelectedDeal((prev: any) => prev ? {
                                                                        ...prev,
                                                                        requiredDocs: { ...prev.requiredDocs, [doc.key]: val }
                                                                    } : null);
                                                                    if (selectedDeal.id !== "new") {
                                                                        await updateRequiredDocs(selectedDeal.id, doc.key, val);
                                                                    }
                                                                }}
                                                                className="h-5 w-5 rounded border-2 border-muted-foreground/30 text-primary accent-primary cursor-pointer"
                                                            />
                                                            <div className="flex items-center gap-3 flex-1">
                                                                <div className={`flex items-center justify-center h-8 w-8 rounded-full ${isChecked ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground"}`}>
                                                                    {isChecked ? <CheckCircle2 className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                                                                </div>
                                                                <div>
                                                                    <p className={`text-sm font-medium ${isChecked ? "line-through text-muted-foreground" : ""}`}>{doc.label}</p>
                                                                    <p className="text-xs text-muted-foreground">{isChecked ? "Uploaded" : "Awaiting upload"}</p>
                                                                </div>
                                                            </div>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                            {selectedDeal.requiredDocs?.lease && selectedDeal.requiredDocs?.tc && selectedDeal.requiredDocs?.payment && selectedDeal.id !== "new" && (
                                                <Button
                                                    className="w-full mt-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                                                    onClick={async () => {
                                                        const res = await moveToLeaseSigned(selectedDeal.id);
                                                        if (res.success) {
                                                            setSelectedDeal((prev: any) => prev ? { ...prev, stage: "Lease Signed" } : null);
                                                            fetchPipelines();
                                                        }
                                                    }}
                                                >
                                                    <CheckCircle2 className="h-4 w-4 mr-2" />
                                                    Move to Lease Signed
                                                </Button>
                                            )}
                                        </div>
                                        <Separator />
                                        {selectedDeal.contactId ? (
                                            <DocumentManager contactId={selectedDeal.contactId} />
                                        ) : (
                                            <div className="py-8 text-sm text-muted-foreground">Link a contact to this opportunity to upload or view documents.</div>
                                        )}
                                    </TabsContent>

                                    {/* Finance Tab */}
                                    <TabsContent value="finance" className="flex-1 p-4 sm:p-6 m-0 outline-none overflow-y-auto space-y-6">
                                        {/* Expenses Section */}
                                        <div className="space-y-4">
                                            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Host Expenses</h3>
                                            {expensesLoading ? (
                                                <div className="flex items-center justify-center py-6">
                                                    <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
                                                </div>
                                            ) : (
                                                <div className="rounded-lg border bg-card p-4 space-y-3">
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="space-y-1">
                                                            <label className="text-xs text-muted-foreground">Monthly Host Rent ($)</label>
                                                            <Input
                                                                type="number"
                                                                step="0.01"
                                                                min="0"
                                                                placeholder="0.00"
                                                                value={expensesData.monthlyRent || ""}
                                                                onChange={(e) => setExpensesData(prev => ({ ...prev, monthlyRent: parseFloat(e.target.value) || 0 }))}
                                                                className="h-8 text-sm"
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-xs text-muted-foreground">Cleaning Fee ($)</label>
                                                            <Input
                                                                type="number"
                                                                step="0.01"
                                                                min="0"
                                                                placeholder="0.00"
                                                                value={expensesData.cleaningFee || ""}
                                                                onChange={(e) => setExpensesData(prev => ({ ...prev, cleaningFee: parseFloat(e.target.value) || 0 }))}
                                                                className="h-8 text-sm"
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-xs text-muted-foreground">Pet Fee ($)</label>
                                                            <Input
                                                                type="number"
                                                                step="0.01"
                                                                min="0"
                                                                placeholder="0.00"
                                                                value={expensesData.petFee || ""}
                                                                onChange={(e) => setExpensesData(prev => ({ ...prev, petFee: parseFloat(e.target.value) || 0 }))}
                                                                className="h-8 text-sm"
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-xs text-muted-foreground">Non-refundable Deposit ($)</label>
                                                            <Input
                                                                type="number"
                                                                step="0.01"
                                                                min="0"
                                                                placeholder="0.00"
                                                                value={expensesData.nonrefundableDeposit || ""}
                                                                onChange={(e) => setExpensesData(prev => ({ ...prev, nonrefundableDeposit: parseFloat(e.target.value) || 0 }))}
                                                                className="h-8 text-sm"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="flex justify-end">
                                                        <Button size="sm" onClick={handleSaveExpenses} disabled={savingExpenses || selectedDeal?.id === "new"}>
                                                            {savingExpenses ? "Saving..." : "Save Expenses"}
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Profit Summary */}
                                        <div className="space-y-4">
                                            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Profit Summary</h3>
                                            <div className="rounded-lg border bg-card p-4 space-y-3">
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-muted-foreground">Deal Value</span>
                                                    <span className="font-semibold">${dealValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                </div>
                                                {expensesData.monthlyRent > 0 && (
                                                    <div>
                                                        <button
                                                            className="flex justify-between text-sm w-full hover:bg-muted/20 rounded px-1 -mx-1 py-0.5 transition-colors"
                                                            onClick={() => setShowRentBreakdown(!showRentBreakdown)}
                                                        >
                                                            <span className="text-muted-foreground flex items-center gap-1">
                                                                Prorated Rent
                                                                <span className="text-[10px]">({proratedRent.months.length} {proratedRent.months.length === 1 ? "month" : "months"})</span>
                                                            </span>
                                                            <span className="font-semibold text-rose-500">-${proratedRent.totalRent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                        </button>
                                                        {showRentBreakdown && proratedRent.months.length > 0 && (
                                                            <div className="ml-4 mt-1 space-y-1 border-l-2 border-muted pl-3">
                                                                {proratedRent.months.map((m, i) => (
                                                                    <div key={i} className="flex justify-between text-[11px] text-muted-foreground">
                                                                        <span>{m.label} ({m.days}/{m.totalDays} days)</span>
                                                                        <span>${m.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                {expensesData.cleaningFee > 0 && (
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-muted-foreground">Cleaning Fee</span>
                                                        <span className="font-semibold text-rose-500">-${expensesData.cleaningFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                    </div>
                                                )}
                                                {expensesData.petFee > 0 && (
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-muted-foreground">Pet Fee</span>
                                                        <span className="font-semibold text-rose-500">-${expensesData.petFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                    </div>
                                                )}
                                                {expensesData.nonrefundableDeposit > 0 && (
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-muted-foreground">Non-refundable Deposit</span>
                                                        <span className="font-semibold text-rose-500">-${expensesData.nonrefundableDeposit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                    </div>
                                                )}
                                                <Separator />
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-muted-foreground">Total Expenses</span>
                                                    <span className="font-semibold text-rose-500">-${totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                </div>
                                                <div className="flex justify-between text-sm font-bold">
                                                    <span>Profit</span>
                                                    <span className={dealValue - totalExpenses >= 0 ? "text-emerald-600" : "text-rose-600"}>
                                                        ${(dealValue - totalExpenses).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between text-xs text-muted-foreground">
                                                    <span>Expected Profit (25%)</span>
                                                    <span>${(dealValue * 0.25).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <Separator />

                                        {/* Payment Status Overview */}
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Payment Status</h3>
                                                <Badge variant={
                                                    selectedDeal.paymentStatus === "paid" ? "default" :
                                                    selectedDeal.paymentStatus === "partial" ? "secondary" : "outline"
                                                } className={
                                                    selectedDeal.paymentStatus === "paid" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" :
                                                    selectedDeal.paymentStatus === "partial" ? "bg-amber-500/10 text-amber-600 border-amber-500/20" :
                                                    "text-muted-foreground"
                                                }>
                                                    {selectedDeal.paymentStatus === "paid" ? "Paid" :
                                                     selectedDeal.paymentStatus === "partial" ? "Partial" : "Unpaid"}
                                                </Badge>
                                            </div>

                                            {/* Deal Value vs Paid Progress */}
                                            <div className="rounded-lg border bg-card p-4 space-y-3">
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-muted-foreground">Deal Value</span>
                                                    <span className="font-semibold">${dealValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                </div>
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-muted-foreground">Total Paid</span>
                                                    <span className="font-semibold text-emerald-600">${totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                </div>
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-muted-foreground">Remaining</span>
                                                    <span className="font-semibold text-amber-600">${Math.max(dealValue - totalPaid, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                </div>
                                                {/* Progress Bar */}
                                                <div className="space-y-1">
                                                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full transition-all duration-500 ${paymentProgress >= 100 ? "bg-emerald-500" : paymentProgress > 0 ? "bg-amber-500" : "bg-muted-foreground/20"}`}
                                                            style={{ width: `${paymentProgress}%` }}
                                                        />
                                                    </div>
                                                    <p className="text-xs text-muted-foreground text-right">{paymentProgress.toFixed(0)}% collected</p>
                                                </div>
                                            </div>
                                        </div>

                                        <Separator />

                                        {/* Add Payment */}
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Payment History</h3>
                                                {selectedDeal.id !== "new" && (
                                                    <Button size="sm" variant="outline" onClick={() => setShowPaymentForm(!showPaymentForm)}>
                                                        <Plus className="h-3.5 w-3.5 mr-1.5" />
                                                        Add Payment
                                                    </Button>
                                                )}
                                            </div>

                                            {showPaymentForm && (
                                                <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="space-y-1">
                                                            <label className="text-xs text-muted-foreground">Amount ($)</label>
                                                            <Input
                                                                type="number"
                                                                step="0.01"
                                                                min="0"
                                                                placeholder="0.00"
                                                                value={paymentFormData.amount}
                                                                onChange={(e) => setPaymentFormData(prev => ({ ...prev, amount: e.target.value }))}
                                                                className="h-8 text-sm"
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-xs text-muted-foreground">Date</label>
                                                            <Input
                                                                type="date"
                                                                value={paymentFormData.date}
                                                                onChange={(e) => setPaymentFormData(prev => ({ ...prev, date: e.target.value }))}
                                                                className="h-8 text-sm"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-xs text-muted-foreground">Payment Method</label>
                                                        <select
                                                            className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                                            value={paymentFormData.method}
                                                            onChange={(e) => setPaymentFormData(prev => ({ ...prev, method: e.target.value }))}
                                                        >
                                                            <option value="ach">ACH</option>
                                                            <option value="check">Check</option>
                                                            <option value="credit_card">Credit Card</option>
                                                            <option value="wire">Wire Transfer</option>
                                                            <option value="cash">Cash</option>
                                                            <option value="other">Other</option>
                                                        </select>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-xs text-muted-foreground">Notes (optional)</label>
                                                        <Input
                                                            placeholder="Payment notes..."
                                                            value={paymentFormData.notes}
                                                            onChange={(e) => setPaymentFormData(prev => ({ ...prev, notes: e.target.value }))}
                                                            className="h-8 text-sm"
                                                        />
                                                    </div>
                                                    <div className="flex gap-2 justify-end">
                                                        <Button size="sm" variant="ghost" onClick={() => setShowPaymentForm(false)}>Cancel</Button>
                                                        <Button size="sm" onClick={handleAddPayment} disabled={addingPayment}>
                                                            {addingPayment ? "Recording..." : "Record Payment"}
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Payment List */}
                                            {paymentsLoading ? (
                                                <div className="flex items-center justify-center py-8">
                                                    <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
                                                </div>
                                            ) : payments.length === 0 ? (
                                                <div className="text-center py-8">
                                                    <Wallet className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                                                    <p className="text-sm text-muted-foreground">No payments recorded yet</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-2">
                                                    {payments.map((payment) => (
                                                        <div key={payment.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                                                            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-emerald-500/10 text-emerald-500 shrink-0 mt-0.5">
                                                                <CreditCard className="h-4 w-4" />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center justify-between">
                                                                    <p className="text-sm font-semibold">${payment.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                                                    <span className="text-xs text-muted-foreground">{payment.date}</span>
                                                                </div>
                                                                <p className="text-xs text-muted-foreground">
                                                                    {paymentMethodLabels[payment.method] || payment.method}
                                                                    {payment.recordedBy ? ` - by ${payment.recordedBy}` : ""}
                                                                </p>
                                                                {payment.notes && (
                                                                    <p className="text-xs text-muted-foreground mt-1 italic">{payment.notes}</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </TabsContent>
                                </Tabs>
                            </div>
                        </>
                    )}
                </SheetContent>
            </Sheet>

            <AlertDialog open={!!noteToDelete} onOpenChange={(open) => !open && setNoteToDelete(null)}>
                <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete this note?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This note will be removed. The deletion will be recorded in the contact timeline.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={(e) => { e.preventDefault(); handleDeleteOpportunityNote(); }}
                        >
                            {isDeletingNote ? "Deleting..." : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
