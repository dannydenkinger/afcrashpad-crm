"use client"

import { useState, useMemo, Suspense } from "react"
import { Button } from "@/components/ui/button"
import { Search, Plus, ListFilter, CheckCircle2, Settings, ChevronDown, LayoutGrid, List as ListIcon, ChevronRight, User, Building2, Upload, BarChart3, Download, Trash2, ArrowRightLeft, UserPlus, X, Phone, MessageSquare, MapPin } from "lucide-react"
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
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetTitle,
} from "@/components/ui/sheet"
import { getPipelines, bulkCreateOpportunities, deleteOpportunity, updateOpportunity, getBaseNames, getUsers, createNewDeal, markOpportunitySeen, autoAdvanceOpportunities, runStayReminders, bulkDeleteDeals, bulkMoveDeals, bulkAssignDeals, softDeleteOpportunity, restoreOpportunity, permanentlyDeleteOpportunity } from "./actions"
import { getAutomationSettings } from "@/app/settings/automations/actions"
import { getContactsList, getContactTimeline } from "@/app/contacts/actions"
import type { TimelineItem } from "@/app/contacts/types"
import { getSpecialAccommodations } from "@/app/settings/system-properties/actions"
import { getPipelinePrioritySettings } from "@/app/settings/pipeline/actions"
import { useEffect, useRef } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"

import { useSession } from "next-auth/react"
import { getCurrentUserRole } from "@/app/settings/users/actions"

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { ConversionMetrics } from "./analytics/ConversionMetrics"
import { DealDetailSheet } from "./DealDetailSheet"
import { Skeleton } from "@/components/ui/skeleton"
import { exportToCSV } from "@/lib/export"
import { getLengthOfStay } from "./utils"
import { KanbanView } from "./KanbanView"
import { ListView } from "./ListView"
import { SavedViews, type PipelineViewState } from "./SavedViews"
import type { DealStatus } from "@/types"
import { DEAL_STATUS_LABELS } from "@/types"
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh"
import { useRealtimeRefreshOnChange } from "@/hooks/useRealtimeCollection"
import { toast } from "sonner"
import { withRetry, withRetryAction } from "@/lib/retry"
import { useIsMobile } from "@/hooks/useIsMobile"
import { SwipeableCard } from "@/components/mobile/SwipeableCard"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import dynamic from "next/dynamic"

// Lazy-loaded heavy dialogs (only shown on user action)
const CSVImportDialog = dynamic(() => import("@/components/ui/CSVImportDialog").then(mod => mod.CSVImportDialog), {
    loading: () => null,
    ssr: false,
})
const PipelineManagerDialog = dynamic(() => import("@/components/ui/PipelineManagerDialog").then(mod => mod.PipelineManagerDialog), {
    loading: () => null,
    ssr: false,
})

export default function PipelinePage() {
    return (
        <Suspense fallback={<div className="p-8">Loading pipeline...</div>}>
            <PipelineContent />
        </Suspense>
    )
}

function PipelineContent() {
    const { data: session } = useSession()
    const isMobile = useIsMobile()
    const [userRole, setUserRole] = useState("AGENT")

    const [pipelines, setPipelines] = useState<Record<string, { name: string; stages: any[]; deals: any[] }>>({})
    const [activePipelineKey, setActivePipelineKey] = useState<string>("")
    const [selectedDeal, setSelectedDeal] = useState<any>(null)
    const [activeTab, setActiveTab] = useState("details")
    const [isLoading, setIsLoading] = useState(true)
    const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
    const [isPipelineManagerOpen, setIsPipelineManagerOpen] = useState(false)
    const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')
    const [baseNames, setBaseNames] = useState<string[]>([])
    const [allUsers, setAllUsers] = useState<any[]>([])
    const [specialAccommodations, setSpecialAccommodations] = useState<{ id: string; name: string }[]>([])
    const [priorityRanges, setPriorityRanges] = useState({ urgentDays: 14, soonDays: 30 })
    const [draggedDealId, setDraggedDealId] = useState<string | null>(null)
    const [dragOverStageId, setDragOverStageId] = useState<string | null>(null)
    const [isContactPickerOpen, setIsContactPickerOpen] = useState(false)
    const [linkingDealId, setLinkingDealId] = useState<string | null>(null)
    const [contactList, setContactList] = useState<{ id: string; name: string; email: string; phone: string; militaryBase: string }[]>([])
    const [contactSearch, setContactSearch] = useState("")
    const [pipelineSearch, setPipelineSearch] = useState("")
    const [contactTimeline, setContactTimeline] = useState<TimelineItem[] | null>(null)
    const [timelineLoading, setTimelineLoading] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
    const [selectedDealIds, setSelectedDealIds] = useState<Set<string>>(new Set())
    const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false)
    const [bulkActionLoading, setBulkActionLoading] = useState(false)
    const [statusFilter, setStatusFilter] = useState<DealStatus>("open")

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

        // Snapshot for rollback on failure
        const previousPipelines = pipelines

        // Optimistic UI update - move deal card instantly
        const updatedPipelines = { ...pipelines }
        const pipelineData = { ...updatedPipelines[activePipelineKey] }
        pipelineData.deals = pipelineData.deals.map((d: any) =>
            d.id === dealId ? { ...d, stage: stageName } : d
        )
        updatedPipelines[activePipelineKey] = pipelineData
        setPipelines(updatedPipelines)

        // Persist to DB with retry
        try {
            await withRetry(
                () => updateOpportunity(dealId, { pipelineStageId: stageId }),
                { onRetry: (attempt) => toast.info(`Retrying stage update... (attempt ${attempt + 1}/4)`, { id: "retry-toast", duration: 2000 }) }
            )
            toast.success("Stage updated")
        } catch {
            // Rollback optimistic update
            setPipelines(previousPipelines)
            toast.error("Failed to update stage")
        }
    }

    const fetchPipelines = async (): Promise<Record<string, any> | null> => {
        setIsLoading(true);
        const res = await getPipelines();
        if (res.success && res.pipelines) {
            setPipelines(res.pipelines);
            if (!activePipelineKey || !res.pipelines[activePipelineKey]) {
                const keys = Object.keys(res.pipelines);
                if (keys.length > 0) setActivePipelineKey(keys[0]);
            }
            setIsLoading(false);
            return res.pipelines;
        }
        setIsLoading(false);
        return null;
    };

    // Auto-refresh when push notification arrives or tab regains focus
    useRealtimeRefresh(fetchPipelines);

    // Real-time: refetch when opportunities collection changes in Firestore
    useRealtimeRefreshOnChange("opportunities", () => {
        fetchPipelines();
    });

    useEffect(() => {
        fetchPipelines();
        getBaseNames().then(setBaseNames);
        getUsers().then(res => { if (res.success) setAllUsers(res.users || []); });
        getSpecialAccommodations().then(res => { if (res.success) setSpecialAccommodations(res.items || []); });
        getPipelinePrioritySettings().then(res => { if (res.success && res.settings) setPriorityRanges(res.settings); });

        // Auto-advance opportunities if enabled
        getAutomationSettings().then(async (res) => {
            if (res.success && res.settings?.autoAdvanceEnabled) {
                const advRes = await autoAdvanceOpportunities();
                if (advRes.success && advRes.advancedCount && advRes.advancedCount > 0) {
                    fetchPipelines(); // Refresh to show moved deals
                }
            }
        });

        // Check-in/check-out reminders
        runStayReminders();
    }, []);

    // Auto-open deal from ?deal= query param (notification/calendar link) — only once per dealId, then clear URL
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const openedDealIdFromUrl = useRef<string | null>(null);

    useEffect(() => {
        const dealId = searchParams.get('deal');
        if (!dealId || isLoading) return;
        // Only auto-open once per dealId so we don't re-open when pipelines updates (which would trap the user)
        if (openedDealIdFromUrl.current === dealId) return;

        for (const key of Object.keys(pipelines)) {
            const p = pipelines[key];
            const deal = p.deals?.find((d: any) => d.id === dealId);
            if (deal) {
                openedDealIdFromUrl.current = dealId;
                setActivePipelineKey(key);
                setActiveTab('details');
                setSelectedDeal(deal);
                markOpportunitySeen(dealId);
                // Clear ?deal= from URL so closing the sheet isn't overridden when effect re-runs (e.g. pipelines update)
                const params = new URLSearchParams(searchParams.toString());
                params.delete('deal');
                const q = params.toString();
                router.replace(q ? `${pathname}?${q}` : pathname);
                break;
            }
        }
    }, [searchParams, pipelines, isLoading, pathname, router]);

    useEffect(() => {
        async function fetchRole() {
            if (session?.user?.id) {
                const role = await getCurrentUserRole();
                setUserRole(role);
            }
        }
        fetchRole();
    }, [session]);

    // Load contact timeline when opportunity has a linked contact (Notes + Timeline tabs, GHL-style)
    const refetchContactTimeline = () => {
        const cid = selectedDeal?.contactId;
        if (!cid) return;
        getContactTimeline(cid).then((res) => {
            setContactTimeline(res.success ? (res.timeline ?? null) : null);
        });
    };

    useEffect(() => {
        const cid = selectedDeal?.contactId;
        if (!cid) {
            setContactTimeline(null);
            return;
        }
        setTimelineLoading(true);
        getContactTimeline(cid).then((res) => {
            setContactTimeline(res.success ? (res.timeline ?? null) : null);
            setTimelineLoading(false);
        }).catch(() => setTimelineLoading(false));
    }, [selectedDeal?.contactId]);

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
                    deals: p.deals.map((d: any) => d.id === deal.id ? { ...d, unread: false, lastSeenAt: new Date().toISOString() } : d)
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
    };

    const newDealTemplate = () => ({
        id: 'new',
        name: '',
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
        contactId: null as string | null,
        assignee: session?.user?.name ? session.user.name.split(" ").map((w: string) => w[0]).join("").toUpperCase() : "—"
    });

    const handleAddNewContactOpportunity = () => {
        setSelectedDeal({ ...newDealTemplate(), name: 'New Lead' });
        setActiveTab("details");
    };

    const handleOpenContactPicker = () => {
        setContactSearch("");
        getContactsList().then(res => {
            if (res.success) setContactList(res.contacts || []);
            else setContactList([]);
        });
        setIsContactPickerOpen(true);
    };

    const handleSelectContactForOpportunity = (c: { id: string; name: string; email: string; phone: string; militaryBase: string }) => {
        if (linkingDealId && selectedDeal && selectedDeal.id === linkingDealId) {
            // Link contact to existing deal
            setSelectedDeal((prev: any) => prev ? {
                ...prev,
                contactId: c.id,
                name: c.name || prev.name,
                email: c.email || prev.email,
                phone: c.phone || prev.phone,
                base: c.militaryBase || prev.base,
            } : null);
            setLinkingDealId(null);
        } else {
            // Create new deal from contact
            setSelectedDeal({
                ...newDealTemplate(),
                contactId: c.id,
                name: c.name || "New Lead",
                email: c.email || "",
                phone: c.phone || "",
                base: c.militaryBase || ""
            });
        }
        setIsContactPickerOpen(false);
        setActiveTab("details");
    };

    const handleLinkContactToExistingDeal = () => {
        if (!selectedDeal || selectedDeal.id === 'new') return;
        setLinkingDealId(selectedDeal.id);
        handleOpenContactPicker();
    };

    const handleDeleteOpportunity = async (id: string) => {
        // Optimistic UI - remove deal from list instantly
        const updatedPipelines = { ...pipelines }
        const pipelineData = { ...updatedPipelines[activePipelineKey] }
        pipelineData.deals = pipelineData.deals.filter((d: any) => d.id !== id)
        updatedPipelines[activePipelineKey] = pipelineData
        setPipelines(updatedPipelines)
        setDeleteTarget(null)
        setSelectedDeal(null)

        const res = await softDeleteOpportunity(id);
        if (!res.success) {
            toast.error(res.error || "Failed to delete opportunity");
            fetchPipelines();
            return;
        }

        toast("Opportunity deleted", {
            duration: 5000,
            action: {
                label: "Undo",
                onClick: async () => {
                    const undoRes = await restoreOpportunity(id);
                    if (undoRes.success) {
                        toast.success("Opportunity restored");
                        fetchPipelines();
                    } else {
                        toast.error("Failed to restore opportunity");
                    }
                },
            },
            onDismiss: () => { permanentlyDeleteOpportunity(id).catch(() => {}); },
            onAutoClose: () => { permanentlyDeleteOpportunity(id).catch(() => {}); },
        });
    }

    // ── Bulk action handlers ─────────────────────────────────────────────────

    const handleToggleSelect = (dealId: string) => {
        setSelectedDealIds(prev => {
            const next = new Set(prev)
            if (next.has(dealId)) next.delete(dealId)
            else next.add(dealId)
            return next
        })
    }

    const handleToggleSelectAll = () => {
        if (selectedDealIds.size === sortedDeals.length && sortedDeals.length > 0) {
            setSelectedDealIds(new Set())
        } else {
            setSelectedDealIds(new Set(sortedDeals.map((d: any) => d.id)))
        }
    }

    const handleBulkDelete = async () => {
        const ids = Array.from(selectedDealIds)
        const count = ids.length
        setBulkDeleteConfirm(false)

        // Snapshot for potential undo
        const previousPipelines = JSON.parse(JSON.stringify(pipelines))

        // Optimistic UI: remove deals from view immediately
        const updatedPipelines = { ...pipelines }
        const pipelineData = { ...updatedPipelines[activePipelineKey] }
        const idsSet = new Set(ids)
        pipelineData.deals = pipelineData.deals.filter((d: any) => !idsSet.has(d.id))
        updatedPipelines[activePipelineKey] = pipelineData
        setPipelines(updatedPipelines)
        setSelectedDealIds(new Set())

        const res = await bulkDeleteDeals(ids)
        if (!res.success) {
            toast.error(res.error || "Failed to delete deals")
            setPipelines(previousPipelines)
            return
        }

        toast(`${count} deal${count !== 1 ? "s" : ""} deleted`, {
            duration: 10000,
            action: {
                label: "Undo",
                onClick: () => {
                    setPipelines(previousPipelines)
                    fetchPipelines()
                    toast.success("Deals restored")
                },
            },
        })
    }

    const handleBulkMove = async (stageId: string) => {
        const ids = Array.from(selectedDealIds)
        const count = ids.length

        // Snapshot for undo
        const previousPipelines = JSON.parse(JSON.stringify(pipelines))

        // Optimistic UI: move deals to new stage visually
        const updatedPipelines = { ...pipelines }
        const pipelineData = { ...updatedPipelines[activePipelineKey] }
        const targetStage = pipelineData.stages.find((s: any) => {
            const sid = typeof s === "string" ? s : s.id || s.name
            return sid === stageId
        })
        const targetStageName = typeof targetStage === "string" ? targetStage : targetStage?.name || stageId
        const idsSet = new Set(ids)
        pipelineData.deals = pipelineData.deals.map((d: any) =>
            idsSet.has(d.id) ? { ...d, stage: targetStageName, pipelineStageId: stageId } : d
        )
        updatedPipelines[activePipelineKey] = pipelineData
        setPipelines(updatedPipelines)
        setSelectedDealIds(new Set())

        try {
            const res = await bulkMoveDeals(ids, stageId)
            if (!res.success) {
                toast.error(res.error || "Failed to move deals")
                setPipelines(previousPipelines)
                return
            }
            toast(`${count} deal${count !== 1 ? "s" : ""} moved to ${targetStageName}`, {
                duration: 10000,
                action: {
                    label: "Undo",
                    onClick: () => {
                        setPipelines(previousPipelines)
                        const prevDeals = previousPipelines[activePipelineKey]?.deals || []
                        for (const id of ids) {
                            const prevDeal = prevDeals.find((d: any) => d.id === id)
                            if (prevDeal?.pipelineStageId) {
                                bulkMoveDeals([id], prevDeal.pipelineStageId).catch(() => {})
                            }
                        }
                        toast.success("Move undone")
                    },
                },
            })
        } catch {
            toast.error("Failed to move deals")
            setPipelines(previousPipelines)
        }
    }

    const handleBulkAssign = async (userId: string) => {
        const ids = Array.from(selectedDealIds)
        const count = ids.length

        // Snapshot for undo
        const previousPipelines = JSON.parse(JSON.stringify(pipelines))

        // Optimistic UI: update assignee visually
        const assigneeName = allUsers.find((u: any) => u.id === userId)?.name || "User"
        const updatedPipelines = { ...pipelines }
        const pipelineData = { ...updatedPipelines[activePipelineKey] }
        const idsSet = new Set(ids)
        pipelineData.deals = pipelineData.deals.map((d: any) =>
            idsSet.has(d.id) ? { ...d, assigneeId: userId, assignee: assigneeName } : d
        )
        updatedPipelines[activePipelineKey] = pipelineData
        setPipelines(updatedPipelines)
        setSelectedDealIds(new Set())

        try {
            const res = await bulkAssignDeals(ids, userId)
            if (!res.success) {
                toast.error(res.error || "Failed to assign deals")
                setPipelines(previousPipelines)
                return
            }
            toast(`${count} deal${count !== 1 ? "s" : ""} assigned to ${assigneeName}`, {
                duration: 10000,
                action: {
                    label: "Undo",
                    onClick: () => {
                        setPipelines(previousPipelines)
                        const prevDeals = previousPipelines[activePipelineKey]?.deals || []
                        for (const id of ids) {
                            const prevDeal = prevDeals.find((d: any) => d.id === id)
                            if (prevDeal?.assigneeId) {
                                bulkAssignDeals([id], prevDeal.assigneeId).catch(() => {})
                            }
                        }
                        toast.success("Assignment undone")
                    },
                },
            })
        } catch {
            toast.error("Failed to assign deals")
            setPipelines(previousPipelines)
        }
    }

    const handleSaveOpportunity = async () => {
        if (!selectedDeal) return;
        setIsSaving(true);
        setSaveStatus('idle');
        try {
            if (selectedDeal.id === 'new') {
                const res = await withRetryAction(
                    () => createNewDeal({
                        contactId: selectedDeal.contactId || undefined,
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
                    }, activePipelineKey),
                    { onRetry: (attempt) => toast.info(`Retrying... (attempt ${attempt + 1}/4)`, { id: "retry-toast", duration: 2000 }) }
                );

                setSaveStatus('success');
                toast.success("Deal created")
                await fetchPipelines();
                setSelectedDeal(null);
            } else {
                const matchedStage = currentPipeline.stages.find((s: any) => {
                    const stageName = typeof s === 'string' ? s : s.name;
                    return stageName === selectedDeal.stage;
                });
                const pipelineStageId = typeof matchedStage === 'string' ? undefined : matchedStage?.id;

                // Build a plain serializable payload to avoid "Failed to fetch" from server action
                const payload: any = {
                    name: selectedDeal.name != null ? String(selectedDeal.name) : "",
                    email: selectedDeal.email != null ? String(selectedDeal.email) : "",
                    phone: selectedDeal.phone != null ? String(selectedDeal.phone) : "",
                    value: Number(selectedDeal.value) || 0,
                    margin: Number(selectedDeal.margin) || 0,
                    priority: selectedDeal.priority != null ? String(selectedDeal.priority) : "MEDIUM",
                    startDate: selectedDeal.startDate ? String(selectedDeal.startDate) : "",
                    endDate: selectedDeal.endDate ? String(selectedDeal.endDate) : "",
                    assigneeId: selectedDeal.assigneeId ?? null,
                    specialAccommodationId: selectedDeal.specialAccommodationId ?? null,
                };
                if (pipelineStageId) payload.pipelineStageId = String(pipelineStageId);
                if (selectedDeal.base != null && selectedDeal.base !== "") payload.base = String(selectedDeal.base);
                if (selectedDeal.notes != null) payload.notes = String(selectedDeal.notes);
                if (selectedDeal.contactId != null) payload.contactId = String(selectedDeal.contactId);
                if (Array.isArray(selectedDeal.tags)) payload.tagIds = selectedDeal.tags.map((t: any) => String(t.tagId || t.id));
                if (Array.isArray(selectedDeal.blockers)) payload.blockers = selectedDeal.blockers;

                await withRetryAction(
                    () => updateOpportunity(String(selectedDeal.id), payload),
                    { onRetry: (attempt) => toast.info(`Retrying save... (attempt ${attempt + 1}/4)`, { id: "retry-toast", duration: 2000 }) }
                );

                setSaveStatus('success');
                toast.success("Opportunity saved")
                const savedId = String(selectedDeal.id);
                const nextPipelines = await fetchPipelines();
                if (nextPipelines) {
                    for (const key of Object.keys(nextPipelines)) {
                        const deal = nextPipelines[key].deals?.find((d: any) => String(d.id) === savedId);
                        if (deal) {
                            setSelectedDeal(deal);
                            break;
                        }
                    }
                }
            }
        } catch (err) {
            setSaveStatus('error');
            toast.error("Failed to save opportunity")
            console.error("Failed to save opportunity:", err);
        } finally {
            setIsSaving(false);
            setTimeout(() => setSaveStatus('idle'), 3000);
        }
    }

    const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban")
    const [mobileSelectedStage, setMobileSelectedStage] = useState<string>("")
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null)

    // View Options State
    const [showBase, setShowBase] = useState(true)
    const [showValue, setShowValue] = useState(true)
    const [showPriority, setShowPriority] = useState(true)
    const [showDates, setShowDates] = useState(true)
    const [showEndDate, setShowEndDate] = useState(false)
    const [showLengthOfStay, setShowLengthOfStay] = useState(false)
    const [showQuickActions, setShowQuickActions] = useState(true)

    const currentPipeline = pipelines[activePipelineKey] || { name: "", stages: [], deals: [] }
    const pipelineKeys = Object.keys(pipelines)

    // Default mobile stage to first stage when pipeline loads
    useEffect(() => {
        if (currentPipeline.stages.length > 0 && !mobileSelectedStage) {
            const first = currentPipeline.stages[0];
            setMobileSelectedStage(typeof first === 'string' ? first : first.name);
        }
    }, [currentPipeline.stages, mobileSelectedStage]);

    const sortedDeals = useMemo(() => {
        let filteredDeals = [...currentPipeline.deals];

        // Filter by deal status
        filteredDeals = filteredDeals.filter((d: any) => (d.status || "open") === statusFilter);

        // Filter by search term
        if (pipelineSearch.trim()) {
            const term = pipelineSearch.trim().toLowerCase();
            filteredDeals = filteredDeals.filter((deal: any) => {
                const name = (deal.name || deal.contactName || '').toLowerCase();
                const email = (deal.email || deal.contactEmail || '').toLowerCase();
                const phone = (deal.phone || deal.contactPhone || '').toLowerCase();
                const base = (deal.base || deal.militaryBase || '').toLowerCase();
                return name.includes(term) || email.includes(term) || phone.includes(term) || base.includes(term);
            });
        }

        if (sortConfig !== null) {
            filteredDeals.sort((a, b) => {
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
        return filteredDeals;
    }, [currentPipeline.deals, sortConfig, pipelineSearch, statusFilter]);

    // Pipeline with deals filtered by search (for KanbanView)
    const filteredPipeline = useMemo(() => ({
        ...currentPipeline,
        deals: sortedDeals,
    }), [currentPipeline, sortedDeals]);

    const requestSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    }

    const currentViewState: PipelineViewState = {
        activePipelineKey,
        viewMode,
        statusFilter,
        showBase,
        showValue,
        showPriority,
        showDates,
        showEndDate,
        showLengthOfStay,
        showQuickActions,
        sortConfig,
    }

    const applyView = (state: PipelineViewState) => {
        if (state.activePipelineKey && pipelines[state.activePipelineKey]) {
            setActivePipelineKey(state.activePipelineKey)
        }
        setViewMode(state.viewMode)
        if (state.statusFilter) setStatusFilter(state.statusFilter)
        setShowBase(state.showBase)
        setShowValue(state.showValue)
        setShowPriority(state.showPriority)
        setShowDates(state.showDates)
        setShowEndDate(state.showEndDate)
        setShowLengthOfStay(state.showLengthOfStay)
        setShowQuickActions(state.showQuickActions)
        setSortConfig(state.sortConfig)
    }

    // ─── Mobile Pipeline ────────────────────────────────────────────
    if (isMobile) {
        const mobileStages = currentPipeline.stages || []
        const mobileStageName = mobileSelectedStage || (mobileStages[0] && (typeof mobileStages[0] === 'string' ? mobileStages[0] : mobileStages[0].name)) || ""
        const mobileStageDeals = sortedDeals.filter((d: any) => d.stage === mobileStageName)

        return (
            <div className="flex flex-col h-full min-h-0 bg-zinc-950 overflow-x-hidden">
                {/* Search */}
                <div className="px-4 pt-3 pb-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                        <input
                            placeholder="Search deals..."
                            className="w-full h-9 pl-9 pr-3 rounded-xl bg-zinc-900 border border-white/5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-primary/50"
                            value={pipelineSearch}
                            onChange={(e) => setPipelineSearch(e.target.value)}
                        />
                    </div>
                </div>

                {/* Stage pills */}
                <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 py-2 shrink-0">
                    {mobileStages.map((stage: any, idx: number) => {
                        const name = typeof stage === 'string' ? stage : stage.name
                        const count = sortedDeals.filter((d: any) => d.stage === name).length
                        const isActive = mobileStageName === name
                        return (
                            <button
                                key={name}
                                onClick={() => setMobileSelectedStage(name)}
                                className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold touch-manipulation transition-colors ${
                                    isActive ? "bg-primary text-primary-foreground" : "bg-zinc-900 text-zinc-400 border border-white/5"
                                }`}
                            >
                                {name}
                                <span className="ml-1 opacity-60">{count}</span>
                            </button>
                        )
                    })}
                </div>

                {/* Deal cards */}
                <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-2">
                    {isLoading ? (
                        <div className="space-y-3 pt-4">
                            {[1,2,3,4].map(i => (
                                <div key={i} className="mobile-card p-4 space-y-3 animate-pulse">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-zinc-800" />
                                        <div className="space-y-2 flex-1">
                                            <div className="h-4 w-32 bg-zinc-800 rounded" />
                                            <div className="h-3 w-24 bg-zinc-800 rounded" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : mobileStageDeals.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-zinc-500 text-sm">
                            No deals in this stage
                        </div>
                    ) : (
                        mobileStageDeals.map((deal: any) => (
                            <SwipeableCard
                                key={deal.id}
                                rightActions={[
                                    {
                                        label: "Call",
                                        icon: <Phone className="h-4 w-4" />,
                                        color: "bg-emerald-600",
                                        onClick: () => {
                                            const phone = deal.phone || deal.contactPhone
                                            if (phone) window.open(`tel:${phone}`, '_self')
                                            else toast("No phone number on file")
                                        },
                                    },
                                    {
                                        label: "Message",
                                        icon: <MessageSquare className="h-4 w-4" />,
                                        color: "bg-blue-600",
                                        onClick: () => router.push('/communications'),
                                    },
                                ]}
                            >
                                <button
                                    className="w-full mobile-card p-3.5 flex items-center gap-3 touch-manipulation text-left"
                                    onClick={() => openDeal(deal)}
                                >
                                    <Avatar className="h-10 w-10 border-2 border-zinc-800 shrink-0">
                                        <AvatarFallback className="bg-gradient-to-br from-zinc-700 to-zinc-900 text-white text-xs font-medium">
                                            {(deal.name || "?").slice(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-semibold text-white truncate">{deal.name}</span>
                                            {deal.unread && (
                                                <span className="shrink-0 text-[9px] font-bold bg-primary text-primary-foreground px-1.5 py-0 rounded">New</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-zinc-500">
                                            {deal.base && (
                                                <span className="flex items-center gap-0.5 truncate">
                                                    <MapPin className="h-2.5 w-2.5" />
                                                    {deal.base}
                                                </span>
                                            )}
                                            {deal.value > 0 && (
                                                <span className="font-mono font-semibold text-zinc-400">${deal.value.toLocaleString()}</span>
                                            )}
                                        </div>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-zinc-600 shrink-0" />
                                </button>
                            </SwipeableCard>
                        ))
                    )}
                </div>

                {/* Deal detail sheet (reused) */}
                <DealDetailSheet
                    selectedDeal={selectedDeal}
                    setSelectedDeal={setSelectedDeal}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    currentPipeline={currentPipeline}
                    activePipelineKey={activePipelineKey}
                    baseNames={baseNames}
                    allUsers={allUsers}
                    specialAccommodations={specialAccommodations}
                    userRole={userRole}
                    session={session}
                    isSaving={isSaving}
                    saveStatus={saveStatus}
                    onSave={handleSaveOpportunity}
                    onDelete={(id: string) => setDeleteTarget(id)}
                    onSyncCalculatorValue={handleSyncCalculatorValue}
                    contactTimeline={contactTimeline}
                    timelineLoading={timelineLoading}
                    onRefetchTimeline={refetchContactTimeline}
                    searchParams={searchParams}
                    router={router}
                    pathname={pathname}
                    openedDealIdFromUrl={openedDealIdFromUrl}
                    fetchPipelines={fetchPipelines}
                    onLinkContact={handleLinkContactToExistingDeal}
                />

                {/* Delete confirm */}
                <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete Opportunity</AlertDialogTitle>
                            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteTarget && handleDeleteOpportunity(deleteTarget)}>
                                Delete
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        )
    }

    // ─── Desktop Pipeline ───────────────────────────────────────────
    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="space-y-4 sm:space-y-6 p-4 sm:p-6 lg:p-8 pt-4 sm:pt-6 pb-4 sm:pb-6 flex flex-col min-h-0">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shrink-0">
                    <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight truncate">Opportunities</h2>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-2 h-8 min-h-[44px] sm:min-h-0 mt-1 border border-border/60 bg-muted/20 font-medium text-muted-foreground hover:text-foreground" disabled={isLoading}>
                                {isLoading ? (
                                    <Skeleton className="h-4 w-24" />
                                ) : (
                                    <span>{currentPipeline.name || (pipelineKeys.length ? "Select pipeline" : "No pipeline")}</span>
                                )}
                                <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-56">
                            <DropdownMenuLabel className="text-xs uppercase text-muted-foreground tracking-wider">Select Pipeline</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {pipelineKeys.map((key) => (
                                <DropdownMenuItem
                                    key={key}
                                    onClick={() => { setActivePipelineKey(key); setSelectedDeal(null); setSelectedDealIds(new Set()); }}
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
                <div className="flex flex-wrap items-center gap-2 overflow-x-auto no-scrollbar">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="touch-manipulation min-h-[44px] sm:min-h-0 shrink-0">
                                <ListFilter className="mr-2 h-4 w-4" />
                                <span className="hidden sm:inline">View Options</span>
                                <span className="sm:hidden">View</span>
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

                    <SavedViews currentState={currentViewState} onApplyView={applyView} />

                    <div className="flex bg-muted/60 p-0.5 sm:p-1 rounded-md items-center shrink-0 h-[44px] sm:h-auto">
                        <Button variant={viewMode === "kanban" ? "secondary" : "ghost"} size="sm" onClick={() => { setViewMode("kanban"); setSelectedDealIds(new Set()); }} className="h-full sm:h-7 px-3 sm:px-2.5 shadow-none" disabled={statusFilter !== "open"}>
                            <LayoutGrid className="h-4 w-4" />
                        </Button>
                        <Button variant={(viewMode === "list" || statusFilter !== "open") ? "secondary" : "ghost"} size="sm" onClick={() => { setViewMode("list"); setSelectedDealIds(new Set()); }} className="h-full sm:h-7 px-3 sm:px-2.5 shadow-none">
                            <ListIcon className="h-4 w-4" />
                        </Button>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <Button variant="outline" size="sm" onClick={() => setIsAnalyticsOpen(true)} className="hidden sm:flex">
                            <BarChart3 className="mr-2 h-4 w-4" />
                            Analytics
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="hidden sm:flex"
                            onClick={() => {
                                const pipeline = pipelines[activePipelineKey]
                                if (!pipeline) return
                                const rows = pipeline.deals.map((d: any) => ({
                                    Name: d.name || "",
                                    Stage: pipeline.stages.find((s: any) => s.id === d.pipelineStageId)?.name || "",
                                    Value: d.opportunityValue || 0,
                                    "Military Base": d.militaryBase || "",
                                    "Stay Start": d.stayStartDate ? new Date(d.stayStartDate).toLocaleDateString() : "",
                                    "Stay End": d.stayEndDate ? new Date(d.stayEndDate).toLocaleDateString() : "",
                                    Priority: d.priority || "",
                                    Source: d.utmSource || d.source || "",
                                    Created: d.createdAt ? new Date(d.createdAt).toLocaleDateString() : "",
                                }))
                                exportToCSV(rows, `${pipeline.name}-deals`)
                            }}
                        >
                            <Download className="mr-2 h-4 w-4" />
                            Export
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setIsImportDialogOpen(true)} className="hidden sm:flex">
                            <Upload className="mr-2 h-4 w-4" />
                            Import CSV
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button size="sm" className="min-h-[44px] sm:min-h-0">
                                    <Plus className="mr-2 h-4 w-4" />
                                    <span className="hidden sm:inline">Add Opportunity</span>
                                    <span className="sm:hidden">Add</span>
                                    <ChevronDown className="ml-2 h-3.5 w-3.5 opacity-70" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuLabel className="text-xs uppercase text-muted-foreground tracking-wider">Add opportunity</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={handleAddNewContactOpportunity} className="cursor-pointer gap-2">
                                    <User className="h-4 w-4" />
                                    New contact + opportunity
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={handleOpenContactPicker} className="cursor-pointer gap-2">
                                    <Building2 className="h-4 w-4" />
                                    Select existing contact
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </div>

            <CSVImportDialog
                isOpen={isImportDialogOpen}
                onClose={() => setIsImportDialogOpen(false)}
                onImport={async (data) => {
                    const res = await bulkCreateOpportunities(data, activePipelineKey);
                    if (res.success) {
                        toast.success("Import complete")
                        fetchPipelines();
                    } else {
                        toast.error("Import failed")
                    }
                    return res;
                }}
                title="Import Opportunities"
                description="Upload a CSV file to bulk add deals and contacts to your pipeline."
                templateFields={['name', 'email', 'phone', 'base', 'dealName', 'value', 'margin', 'stage', 'priority']}
            />

            {/* Analytics Sheet */}
            <Sheet open={isAnalyticsOpen} onOpenChange={setIsAnalyticsOpen}>
                <SheetContent className="w-full max-w-[100vw] sm:max-w-lg overflow-y-auto">
                    <SheetTitle className="text-lg font-semibold mb-1">Pipeline Analytics</SheetTitle>
                    <SheetDescription className="text-sm text-muted-foreground mb-4">
                        Conversion funnel, win rate, and deal cycle metrics.
                    </SheetDescription>
                    {isAnalyticsOpen && activePipelineKey && (
                        <ConversionMetrics pipelineId={activePipelineKey} />
                    )}
                </SheetContent>
            </Sheet>

            <PipelineManagerDialog
                isOpen={isPipelineManagerOpen}
                onClose={() => setIsPipelineManagerOpen(false)}
                pipelines={Object.fromEntries(
                    Object.entries(pipelines).map(([id, data]) => [id, { id, name: data.name, stages: data.stages }])
                )}
                onPipelinesChange={fetchPipelines}
            />

            <Dialog open={isContactPickerOpen} onOpenChange={(open) => { setIsContactPickerOpen(open); if (!open) setLinkingDealId(null); }}>
                <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col p-0 gap-0">
                    <DialogHeader className="p-4 pb-2">
                        <DialogTitle>Select contact</DialogTitle>
                        <p className="text-sm text-muted-foreground">Choose a contact to create an opportunity for.</p>
                    </DialogHeader>
                    <div className="px-4 pb-2">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by name, email, or phone..."
                                value={contactSearch}
                                onChange={(e) => setContactSearch(e.target.value)}
                                className="pl-8 h-9"
                            />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto border-t min-h-[200px] max-h-[360px]">
                        {contactList.length === 0 && !contactSearch && (
                            <div className="p-6 text-center text-sm text-muted-foreground">Loading contacts…</div>
                        )}
                        {contactList.length === 0 && contactSearch && (
                            <div className="p-6 text-center text-sm text-muted-foreground">No contacts found.</div>
                        )}
                        {contactList
                            .filter(c => {
                                const q = contactSearch.toLowerCase().trim();
                                if (!q) return true;
                                return (c.name || "").toLowerCase().includes(q) ||
                                    (c.email || "").toLowerCase().includes(q) ||
                                    (c.phone || "").replace(/\D/g, "").includes(q.replace(/\D/g, ""));
                            })
                            .map(c => (
                                <div
                                    key={c.id}
                                    onClick={() => handleSelectContactForOpportunity(c)}
                                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/60 cursor-pointer border-b border-border/30 last:border-0"
                                >
                                    <Avatar className="h-9 w-9 shrink-0">
                                        <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                                            {(c.name || "?").slice(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium truncate">{c.name || "Unnamed"}</div>
                                        <div className="text-xs text-muted-foreground truncate">{c.email || c.phone || "—"}</div>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                                </div>
                            ))}
                    </div>
                </DialogContent>
            </Dialog>

                <div className="flex items-center gap-3">
                    <div className="relative w-full sm:w-72 flex-1 sm:flex-initial">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search deals..."
                            className="h-9 pl-8 min-h-[44px] sm:min-h-0"
                            value={pipelineSearch}
                            onChange={(e) => setPipelineSearch(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                    {(["open", "closed_won", "closed_lost", "archive"] as DealStatus[]).map(s => {
                        const count = currentPipeline.deals.filter((d: any) => (d.status || "open") === s).length
                        return (
                            <Button
                                key={s}
                                variant={statusFilter === s ? "secondary" : "ghost"}
                                size="sm"
                                onClick={() => { setStatusFilter(s); setSelectedDealIds(new Set()); }}
                                className="h-8 px-3 text-xs gap-1.5"
                            >
                                {DEAL_STATUS_LABELS[s]}
                                <Badge variant="outline" className="ml-0.5 text-[10px] px-1.5 py-0 h-4 font-normal">{count}</Badge>
                            </Button>
                        )
                    })}
                </div>

                {!isLoading && currentPipeline.deals.length > 0 && (
                    <div className="text-xs text-muted-foreground px-1 py-1">
                        Showing {sortedDeals.length} of {currentPipeline.deals.filter((d: any) => (d.status || "open") === statusFilter).length} deals
                    </div>
                )}

                <div className={`flex-1 min-h-0 overflow-x-auto overflow-y-auto ${(statusFilter === "open" && viewMode === "kanban") ? "sm:overflow-y-hidden" : ""}`}>
                {isLoading ? (
                    (statusFilter === "open" && viewMode === "kanban") ? (
                        <div className="flex min-h-[400px] sm:min-h-[calc(100vh-220px)] h-[400px] sm:h-[calc(100vh-220px)] gap-3 sm:gap-4 pb-4 w-max">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="flex flex-col w-[340px] shrink-0 bg-muted/40 rounded-xl border h-full overflow-hidden">
                                    <div className="p-4 border-b bg-muted/60 flex items-center justify-between">
                                        <Skeleton className="h-4 w-24" />
                                        <Skeleton className="h-5 w-8 rounded-full" />
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-3 space-y-3">
                                        {[1, 2, 3].map((j) => (
                                            <div key={j} className="rounded-xl border bg-card p-4 space-y-3">
                                                <div className="flex items-start justify-between pl-1">
                                                    <div className="flex items-center gap-3">
                                                        <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                                                        <div className="space-y-2">
                                                            <Skeleton className="h-4 w-32" />
                                                            <Skeleton className="h-3 w-24" />
                                                        </div>
                                                    </div>
                                                    <Skeleton className="h-6 w-6 rounded-full shrink-0" />
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 pl-1">
                                                    <Skeleton className="h-10 w-full" />
                                                    <Skeleton className="h-10 w-full" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="rounded-md border bg-card/50">
                            <Table>
                                <TableHeader className="bg-muted/50">
                                    <TableRow>
                                        <TableHead>Contact</TableHead>
                                        <TableHead>Stage</TableHead>
                                        <TableHead>Location</TableHead>
                                        <TableHead>Priority</TableHead>
                                        <TableHead>Value</TableHead>
                                        <TableHead>Assignee</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                                        <TableRow key={i}>
                                            <TableCell><div className="flex items-center gap-2"><Skeleton className="h-4 w-28" /><Skeleton className="h-3 w-40" /></div></TableCell>
                                            <TableCell><Skeleton className="h-5 w-16 rounded-sm" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                            <TableCell><Skeleton className="h-5 w-14 rounded-sm" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                                            <TableCell><Skeleton className="h-6 w-6 rounded-full" /></TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )
                ) : currentPipeline.deals.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <LayoutGrid className="h-12 w-12 text-muted-foreground/20 mb-4" />
                        <p className="text-lg font-medium text-foreground mb-1">No deals yet</p>
                        <p className="text-sm text-muted-foreground mb-4 max-w-sm">Create your first deal to start tracking opportunities</p>
                        <Button onClick={handleAddNewContactOpportunity}>
                            <Plus className="mr-2 h-4 w-4" />
                            New Deal
                        </Button>
                    </div>
                ) : (statusFilter === "open" && viewMode === "kanban") ? (
                    <KanbanView
                        currentPipeline={filteredPipeline}
                        mobileSelectedStage={mobileSelectedStage}
                        setMobileSelectedStage={setMobileSelectedStage}
                        showBase={showBase}
                        showValue={showValue}
                        showPriority={showPriority}
                        showDates={showDates}
                        showEndDate={showEndDate}
                        showLengthOfStay={showLengthOfStay}
                        showQuickActions={showQuickActions}
                        priorityRanges={priorityRanges}
                        draggedDealId={draggedDealId}
                        dragOverStageId={dragOverStageId}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onOpenDeal={openDeal}
                        onOpenNotes={(deal) => {
                            setActiveTab("notes");
                            setSelectedDeal(deal);
                        }}
                        onCallContact={(deal) => {
                            const phone = deal.phone || deal.contactPhone;
                            if (phone) {
                                window.open(`tel:${phone}`, '_self');
                            } else {
                                toast("No phone number on file for this contact");
                            }
                        }}
                        onMessageContact={() => {
                            router.push('/communications');
                        }}
                        onOpenTasks={() => {
                            router.push('/tasks');
                        }}
                    />
                ) : (
                    <>
                        {/* Bulk action bar */}
                        {selectedDealIds.size > 0 && (
                            <div className="flex items-center gap-2 px-4 py-2.5 mb-3 bg-primary/10 border border-primary/20 rounded-lg animate-in fade-in slide-in-from-top-2 duration-200">
                                <span className="text-sm font-semibold text-primary mr-1">
                                    {selectedDealIds.size} selected
                                </span>
                                <div className="h-4 w-px bg-primary/20 mx-1" />

                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" disabled={bulkActionLoading}>
                                            <ArrowRightLeft className="h-3.5 w-3.5" />
                                            Move to Stage
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start" className="w-48">
                                        <DropdownMenuLabel className="text-xs uppercase text-muted-foreground tracking-wider">Select Stage</DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        {currentPipeline.stages.map((stage: any) => {
                                            const isString = typeof stage === 'string';
                                            const stageName = isString ? stage : stage.name;
                                            const stageId = isString ? stageName : (stage.id || stage.name);
                                            return (
                                                <DropdownMenuItem
                                                    key={stageId}
                                                    onClick={() => handleBulkMove(stageId)}
                                                    className="cursor-pointer"
                                                >
                                                    {stageName}
                                                </DropdownMenuItem>
                                            );
                                        })}
                                    </DropdownMenuContent>
                                </DropdownMenu>

                                {userRole !== "AGENT" && (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" disabled={bulkActionLoading}>
                                                <UserPlus className="h-3.5 w-3.5" />
                                                Assign
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="start" className="w-48">
                                            <DropdownMenuLabel className="text-xs uppercase text-muted-foreground tracking-wider">Select User</DropdownMenuLabel>
                                            <DropdownMenuSeparator />
                                            {allUsers.map((user: any) => (
                                                <DropdownMenuItem
                                                    key={user.id}
                                                    onClick={() => handleBulkAssign(user.id)}
                                                    className="cursor-pointer"
                                                >
                                                    <User className="mr-2 h-3.5 w-3.5" />
                                                    {user.name || user.email}
                                                </DropdownMenuItem>
                                            ))}
                                            {allUsers.length === 0 && (
                                                <DropdownMenuItem disabled>No users available</DropdownMenuItem>
                                            )}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                )}

                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 gap-1.5 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                                    disabled={bulkActionLoading}
                                    onClick={() => setBulkDeleteConfirm(true)}
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Delete
                                </Button>

                                <div className="flex-1" />
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-2 text-muted-foreground"
                                    onClick={() => setSelectedDealIds(new Set())}
                                >
                                    <X className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        )}

                        <ListView
                            sortedDeals={sortedDeals}
                            showBase={showBase}
                            showValue={showValue}
                            showPriority={showPriority}
                            showDates={showDates}
                            showEndDate={showEndDate}
                            showLengthOfStay={showLengthOfStay}
                            priorityRanges={priorityRanges}
                            onOpenDeal={openDeal}
                            requestSort={requestSort}
                            selectedDealIds={selectedDealIds}
                            onToggleSelect={handleToggleSelect}
                            onToggleSelectAll={handleToggleSelectAll}
                            statusFilter={statusFilter}
                        />
                    </>
                )}
            </div>

            <DealDetailSheet
                selectedDeal={selectedDeal}
                setSelectedDeal={setSelectedDeal}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                currentPipeline={currentPipeline}
                activePipelineKey={activePipelineKey}
                baseNames={baseNames}
                allUsers={allUsers}
                specialAccommodations={specialAccommodations}
                userRole={userRole}
                session={session}
                isSaving={isSaving}
                saveStatus={saveStatus}
                onSave={handleSaveOpportunity}
                onDelete={(id: string) => setDeleteTarget(id)}
                onSyncCalculatorValue={handleSyncCalculatorValue}
                contactTimeline={contactTimeline}
                timelineLoading={timelineLoading}
                onRefetchTimeline={refetchContactTimeline}
                searchParams={searchParams}
                router={router}
                pathname={pathname}
                openedDealIdFromUrl={openedDealIdFromUrl}
                fetchPipelines={fetchPipelines}
                onLinkContact={handleLinkContactToExistingDeal}
            />

            <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Opportunity</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this opportunity? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteTarget && handleDeleteOpportunity(deleteTarget)}>
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={bulkDeleteConfirm} onOpenChange={(open) => { if (!open) setBulkDeleteConfirm(false) }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete {selectedDealIds.size} Opportunities</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete {selectedDealIds.size} selected opportunities? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={bulkActionLoading}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            disabled={bulkActionLoading}
                            onClick={handleBulkDelete}
                        >
                            {bulkActionLoading ? "Deleting..." : `Delete ${selectedDealIds.size} Deals`}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            </div>
        </div>
    )
}
