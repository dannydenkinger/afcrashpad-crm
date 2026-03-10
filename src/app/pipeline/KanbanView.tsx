import React, { useMemo } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { MapPin, DollarSign, CalendarIcon, Phone, MessageSquare, FileText, CheckSquare, ChevronRight, User, Ban } from "lucide-react"
import { getLengthOfStay, formatDisplayDate } from "./utils"

// Use the Calendar icon under an alias to match the original import name
const Calendar = CalendarIcon

/** Compute days a deal has been in its current stage and return color info */
function getAgingInfo(deal: any): { days: number; color: string; bgClass: string; label: string } {
    const enteredAt = deal.stageEnteredAt ? new Date(deal.stageEnteredAt) : null
    if (!enteredAt) return { days: 0, color: "bg-emerald-500", bgClass: "border-l-emerald-500", label: "Just entered" }
    const now = new Date()
    const days = Math.max(0, Math.floor((now.getTime() - enteredAt.getTime()) / (1000 * 60 * 60 * 24)))
    if (days <= 7) return { days, color: "bg-emerald-500", bgClass: "border-l-emerald-500", label: `In this stage for ${days} day${days !== 1 ? "s" : ""}` }
    if (days <= 14) return { days, color: "bg-amber-400", bgClass: "border-l-amber-400", label: `In this stage for ${days} days` }
    if (days <= 30) return { days, color: "bg-orange-500", bgClass: "border-l-orange-500", label: `In this stage for ${days} days` }
    return { days, color: "bg-red-500", bgClass: "border-l-red-500", label: `In this stage for ${days} days` }
}

interface DealCardProps {
    deal: any
    showBase: boolean
    showValue: boolean
    showPriority: boolean
    showDates: boolean
    showEndDate: boolean
    showLengthOfStay: boolean
    showQuickActions: boolean
    priorityRanges: { urgentDays: number; soonDays: number }
    isDragged: boolean
    onDragStart: (e: React.DragEvent, dealId: string) => void
    onDragEnd: () => void
    onOpenDeal: (deal: any) => void
    onOpenNotes: (deal: any) => void
    onCallContact: (deal: any) => void
    onMessageContact: (deal: any) => void
    onOpenTasks: (deal: any) => void
}

const DealCard = React.memo(function DealCard({
    deal,
    showBase,
    showValue,
    showPriority,
    showDates,
    showEndDate,
    showLengthOfStay: showLengthOfStayProp,
    showQuickActions,
    priorityRanges,
    isDragged,
    onDragStart,
    onDragEnd,
    onOpenDeal,
    onOpenNotes,
    onCallContact,
    onMessageContact,
    onOpenTasks,
}: DealCardProps) {
    const isNewInquiry = deal.unread === true;
    const aging = getAgingInfo(deal);
    const hasBlockers = Array.isArray(deal.blockers) && deal.blockers.length > 0;
    let priorityColorClass = "bg-blue-500";
    let priorityLabel = "";
    if (deal.startDate && deal.startDate !== "-") {
        const start = new Date(deal.startDate);
        const end = deal.endDate && deal.endDate !== "-" ? new Date(deal.endDate) : null;
        const now = new Date();
        const diffTime = start.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const { urgentDays, soonDays } = priorityRanges;
        if (end && now > end) { priorityColorClass = "bg-gray-500"; priorityLabel = "EXPIRED"; }
        else if (now >= start && (!end || now <= end)) { priorityColorClass = "bg-emerald-500"; priorityLabel = "ACTIVE"; }
        else if (diffDays <= urgentDays) { priorityColorClass = "bg-red-500"; priorityLabel = "URGENT"; }
        else if (diffDays <= soonDays) { priorityColorClass = "bg-yellow-500"; priorityLabel = "SOON"; }
        else { priorityColorClass = "bg-blue-500"; priorityLabel = "PLANNED"; }
    }

    return (
        <TooltipProvider delayDuration={300}>
        <div
            draggable
            onDragStart={(e) => onDragStart(e, deal.id)}
            onDragEnd={onDragEnd}
            onClick={() => onOpenDeal(deal)}
            className={`bg-card cursor-grab border hover:border-primary/40 active:scale-[0.98] transition-all rounded-xl p-4 shadow-sm group relative overflow-hidden flex flex-col gap-3 touch-manipulation min-h-[44px] ${isDragged ? "opacity-50 scale-95" : ""} ${isNewInquiry ? "border-primary/80 ring-2 ring-primary bg-primary/10 shadow-[0_0_20px_rgba(59,130,246,0.6)] animate-pulse" : "border-border/60 hover:shadow-lg"}`}
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
                <div className="flex items-center gap-1.5 shrink-0 mt-1">
                    {hasBlockers && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span className="cursor-help">
                                    <Ban className="h-4 w-4 text-red-500" />
                                </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[220px]">
                                <p className="font-semibold text-xs mb-1">Blockers ({deal.blockers.length})</p>
                                <ul className="text-xs space-y-0.5">
                                    {deal.blockers.map((b: string, i: number) => (
                                        <li key={i} className="truncate">- {b}</li>
                                    ))}
                                </ul>
                            </TooltipContent>
                        </Tooltip>
                    )}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span className={`inline-block h-2.5 w-2.5 rounded-full ${aging.color} shrink-0 cursor-help`} />
                        </TooltipTrigger>
                        <TooltipContent side="top">
                            <p className="text-xs">{aging.label}</p>
                        </TooltipContent>
                    </Tooltip>
                    <Avatar title={`Assignee: ${deal.assignee}`} className="h-6 w-6 border border-background shadow-sm shrink-0">
                        <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-bold">{deal.assignee}</AvatarFallback>
                    </Avatar>
                </div>
            </div>

            {deal.claimedByName && (
                <div className="flex items-center gap-1.5 pl-1">
                    <Badge variant="outline" className="text-[9px] font-bold bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                        <User className="h-2.5 w-2.5 mr-1" />
                        {deal.claimedByName}
                    </Badge>
                </div>
            )}

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
                                    ${priorityColorClass === "bg-emerald-500" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : ""}
                                    ${priorityColorClass === "bg-gray-500" ? "bg-gray-500/10 text-gray-500 border-gray-500/20" : ""}
                                `}
                            >
                                {deal.startDate && deal.startDate !== "-" ? priorityLabel : deal.priority}
                            </Badge>
                        </div>
                    )}
                </div>
            )}

            {(showDates || showEndDate || showLengthOfStayProp) && (
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
                    {showLengthOfStayProp && (
                        <div className="flex flex-col items-center justify-center bg-muted/20 border border-border/40 p-2 rounded-md shrink-0 min-w-[70px]">
                            <span className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground mb-0.5">Duration</span>
                            <span className="text-xs font-bold text-primary/80">{getLengthOfStay(deal.startDate, deal.endDate)}</span>
                        </div>
                    )}
                </div>
            )}

            {showQuickActions && (
                <div className="flex items-center gap-1.5 pt-3 border-t border-border/50 pl-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:bg-muted/50 hover:text-primary shrink-0 transition-colors" onClick={(e) => { e.stopPropagation(); onCallContact(deal); }}>
                        <Phone className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:bg-muted/50 hover:text-primary shrink-0 transition-colors relative" onClick={(e) => { e.stopPropagation(); onMessageContact(deal); }}>
                        <MessageSquare className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:bg-muted/50 hover:text-primary shrink-0 transition-colors relative"
                        onClick={(e) => {
                            e.stopPropagation();
                            onOpenNotes(deal);
                        }}
                    >
                        <FileText className="h-3.5 w-3.5" />
                        {deal.notes && <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-blue-500 text-[8px] text-white font-bold ring-2 ring-card border-none">1</span>}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:bg-muted/50 hover:text-primary shrink-0 transition-colors" onClick={(e) => { e.stopPropagation(); onOpenTasks(deal); }}>
                        <CheckSquare className="h-3.5 w-3.5" />
                    </Button>
                </div>
            )}
        </div>
        </TooltipProvider>
    );
})

interface MobileDealCardProps {
    deal: any
    showBase: boolean
    showValue: boolean
    showDates: boolean
    showEndDate: boolean
    onOpenDeal: (deal: any) => void
}

const MobileDealCard = React.memo(function MobileDealCard({
    deal,
    showBase,
    showValue,
    showDates,
    showEndDate,
    onOpenDeal,
}: MobileDealCardProps) {
    const isNewInquiry = deal.unread === true;
    const aging = getAgingInfo(deal);
    const hasBlockers = Array.isArray(deal.blockers) && deal.blockers.length > 0;
    return (
        <div
            onClick={() => onOpenDeal(deal)}
            className={`bg-card border rounded-xl p-4 shadow-sm flex flex-col gap-3 touch-manipulation active:scale-[0.98] transition-all ${isNewInquiry ? "border-primary/80 ring-2 ring-primary bg-primary/10" : "border-border/60"}`}
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-10 w-10 border-2 border-background shadow-sm shrink-0">
                        <AvatarFallback className="bg-gradient-to-br from-slate-700 to-slate-900 text-white text-xs font-medium">{(deal.name || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm truncate">{deal.name}</span>
                            {isNewInquiry && <Badge className="shrink-0 text-[10px] font-bold bg-primary text-primary-foreground border-0 px-1.5 py-0">New</Badge>}
                            <span className={`inline-block h-2 w-2 rounded-full ${aging.color} shrink-0`} title={aging.label} />
                            {hasBlockers && <Ban className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                        </div>
                        {showBase && <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><MapPin className="h-3 w-3" />{deal.base}</span>}
                    </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </div>
            {(showValue || showDates) && (
                <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border/50 pt-2">
                    {showValue && <span className="font-mono font-semibold text-foreground">${deal.value.toLocaleString()}</span>}
                    {showDates && <span>{formatDisplayDate(deal.startDate)}{showEndDate ? ` — ${formatDisplayDate(deal.endDate)}` : ""}</span>}
                </div>
            )}
        </div>
    );
})

interface KanbanViewProps {
    currentPipeline: any
    mobileSelectedStage: string
    setMobileSelectedStage: (stage: string) => void
    showBase: boolean
    showValue: boolean
    showPriority: boolean
    showDates: boolean
    showEndDate: boolean
    showLengthOfStay: boolean
    showQuickActions: boolean
    priorityRanges: { urgentDays: number; soonDays: number }
    draggedDealId: string | null
    dragOverStageId: string | null
    onDragStart: (e: React.DragEvent, dealId: string) => void
    onDragEnd: () => void
    onDragOver: (e: React.DragEvent, stageId: string) => void
    onDragLeave: () => void
    onDrop: (e: React.DragEvent, stageId: string, stageName: string) => void
    onOpenDeal: (deal: any) => void
    onOpenNotes: (deal: any) => void
    onCallContact: (deal: any) => void
    onMessageContact: (deal: any) => void
    onOpenTasks: (deal: any) => void
}

export const KanbanView = React.memo(function KanbanView({
    currentPipeline,
    mobileSelectedStage,
    setMobileSelectedStage,
    showBase,
    showValue,
    showPriority,
    showDates,
    showEndDate,
    showLengthOfStay: showLengthOfStayProp,
    showQuickActions,
    priorityRanges,
    draggedDealId,
    dragOverStageId,
    onDragStart,
    onDragEnd,
    onDragOver,
    onDragLeave,
    onDrop,
    onOpenDeal,
    onOpenNotes,
    onCallContact,
    onMessageContact,
    onOpenTasks,
}: KanbanViewProps) {
    // Memoize deals grouped by stage to avoid re-filtering on every render
    const dealsByStage = useMemo(() => {
        const map: Record<string, any[]> = {};
        for (const stage of currentPipeline.stages) {
            const stageName = typeof stage === 'string' ? stage : stage.name;
            map[stageName] = currentPipeline.deals.filter((d: any) => d.stage === stageName);
        }
        return map;
    }, [currentPipeline.stages, currentPipeline.deals]);

    // Memoize stage value totals
    const stageValues = useMemo(() => {
        const map: Record<string, number> = {};
        for (const [stageName, deals] of Object.entries(dealsByStage)) {
            map[stageName] = deals.reduce((sum: number, d: any) => sum + (d.value || 0), 0);
        }
        return map;
    }, [dealsByStage]);

    const mobileDeals = useMemo(() =>
        dealsByStage[mobileSelectedStage] || [],
        [dealsByStage, mobileSelectedStage]
    );

    return (
        <>
        {/* Mobile kanban: stage pill selector + card list */}
        <div className="md:hidden flex flex-col h-full min-h-0">
            <div className="flex gap-2 overflow-x-auto no-scrollbar scroll-fade-x px-1 py-2 shrink-0">
                {currentPipeline.stages.map((stage: any) => {
                    const stageName = typeof stage === 'string' ? stage : stage.name;
                    const stageDeals = dealsByStage[stageName] || [];
                    return (
                        <button
                            key={stageName}
                            onClick={() => setMobileSelectedStage(stageName)}
                            className={`shrink-0 px-4 py-2 rounded-full text-xs font-semibold min-h-[44px] touch-manipulation transition-colors ${mobileSelectedStage === stageName
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted/60 text-muted-foreground hover:bg-muted"}`}
                        >
                            {stageName}
                            <span className="ml-1.5 text-[10px] opacity-70">({stageDeals.length})</span>
                        </button>
                    );
                })}
            </div>
            <div className="flex-1 overflow-y-auto px-1 space-y-3 pb-4">
                {mobileDeals.map((deal: any) => (
                    <MobileDealCard
                        key={deal.id}
                        deal={deal}
                        showBase={showBase}
                        showValue={showValue}
                        showDates={showDates}
                        showEndDate={showEndDate}
                        onOpenDeal={onOpenDeal}
                    />
                ))}
                {mobileDeals.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-muted-foreground/20 rounded-xl text-muted-foreground bg-muted/10">
                        <span className="text-xs font-medium">No deals in this stage</span>
                    </div>
                )}
            </div>
        </div>

        {/* Desktop kanban */}
        <div className="hidden md:flex min-h-[calc(100vh-220px)] h-[calc(100vh-220px)] gap-4 pb-4 w-max">
            {currentPipeline.stages.map((stage: any, index: number) => {
                const isString = typeof stage === 'string';
                const stageName = isString ? stage : stage.name;
                const stageId = isString ? `stage-${index}` : (stage.id || stage.name);
                const stageDeals = dealsByStage[stageName] || [];

                return (
                    <div
                        key={stageId}
                        className={`flex flex-col w-[340px] shrink-0 bg-muted/40 rounded-xl pb-2 border h-full overflow-hidden transition-all duration-200 ${dragOverStageId === stageId ? "border-dashed border-primary/60 bg-primary/5 ring-2 ring-primary/30 shadow-lg" : ""
                            }`}
                        onDragOver={(e) => onDragOver(e, stageId)}
                        onDragLeave={onDragLeave}
                        onDrop={(e) => onDrop(e, stageId, stageName)}
                    >
                        <div className="p-4 font-semibold flex flex-col gap-1 border-b bg-muted/60">
                            <div className="flex items-center justify-between">
                                <span className="text-sm uppercase tracking-wider">{stageName} ({stageDeals.length})</span>
                                <Badge variant="secondary" className="px-2 py-0.5 rounded-full font-bold">
                                    {stageDeals.length}
                                </Badge>
                            </div>
                            <span className="text-xs text-muted-foreground font-mono">
                                ${(stageValues[stageName] || 0).toLocaleString()}
                            </span>
                        </div>

                        <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                            {dragOverStageId === stageId && (
                                <div className="h-1 bg-primary rounded-full mx-2 mb-2 animate-pulse" />
                            )}
                            {stageDeals.map((deal: any) => (
                                <DealCard
                                    key={deal.id}
                                    deal={deal}
                                    showBase={showBase}
                                    showValue={showValue}
                                    showPriority={showPriority}
                                    showDates={showDates}
                                    showEndDate={showEndDate}
                                    showLengthOfStay={showLengthOfStayProp}
                                    showQuickActions={showQuickActions}
                                    priorityRanges={priorityRanges}
                                    isDragged={draggedDealId === deal.id}
                                    onDragStart={onDragStart}
                                    onDragEnd={onDragEnd}
                                    onOpenDeal={onOpenDeal}
                                    onOpenNotes={onOpenNotes}
                                    onCallContact={onCallContact}
                                    onMessageContact={onMessageContact}
                                    onOpenTasks={onOpenTasks}
                                />
                            ))}
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
        </>
    )
})
