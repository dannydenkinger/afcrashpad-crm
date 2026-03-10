import React from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { ChevronRight, ArrowUpDown } from "lucide-react"
import { getLengthOfStay, formatDisplayDate } from "./utils"
import type { DealStatus } from "@/types"
import { DEAL_STATUS_LABELS, DEAL_STATUS_COLORS } from "@/types"

interface ListViewProps {
    sortedDeals: any[]
    showBase: boolean
    showValue: boolean
    showPriority: boolean
    showDates: boolean
    showEndDate: boolean
    showLengthOfStay: boolean
    priorityRanges: { urgentDays: number; soonDays: number }
    onOpenDeal: (deal: any) => void
    requestSort: (key: string) => void
    selectedDealIds: Set<string>
    onToggleSelect: (dealId: string) => void
    onToggleSelectAll: () => void
    statusFilter?: DealStatus
}

export function ListView({
    sortedDeals,
    showBase,
    showValue,
    showPriority,
    showDates,
    showEndDate,
    showLengthOfStay: showLengthOfStayProp,
    priorityRanges,
    onOpenDeal,
    requestSort,
    selectedDealIds,
    onToggleSelect,
    onToggleSelectAll,
    statusFilter = "open",
}: ListViewProps) {
    const allSelected = sortedDeals.length > 0 && sortedDeals.every(d => selectedDealIds.has(d.id))
    const someSelected = sortedDeals.some(d => selectedDealIds.has(d.id)) && !allSelected

    return (
        <>
        {/* Mobile list: card view */}
        <div className="md:hidden space-y-2">
            {sortedDeals.map((deal: any) => {
                const isNewInquiry = deal.unread === true;
                const isSelected = selectedDealIds.has(deal.id);
                return (
                    <div
                        key={deal.id}
                        className={`flex items-center gap-3 p-4 rounded-xl border bg-card min-h-[56px] touch-manipulation transition-colors ${isNewInquiry ? "border-primary/60 bg-primary/5" : "border-border/60"} ${isSelected ? "ring-2 ring-primary bg-primary/5" : ""}`}
                    >
                        <div
                            className="shrink-0 flex items-center justify-center min-h-[44px] min-w-[44px]"
                            onClick={(e) => { e.stopPropagation(); onToggleSelect(deal.id); }}
                        >
                            <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => onToggleSelect(deal.id)}
                            />
                        </div>
                        <div
                            role="button"
                            tabIndex={0}
                            onClick={() => onOpenDeal(deal)}
                            className="flex items-center gap-3 flex-1 min-w-0"
                        >
                            <Avatar className="h-10 w-10 shrink-0">
                                <AvatarFallback className="text-sm bg-primary/10 text-primary font-bold">
                                    {(deal.name || "?").slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="font-medium truncate">{deal.name}</span>
                                    {isNewInquiry && <Badge className="shrink-0 text-[10px] bg-primary text-primary-foreground border-0 px-1.5 py-0">New</Badge>}
                                </div>
                                <p className="text-xs text-muted-foreground truncate">
                                    {deal.base || "No base"} &bull; ${deal.value.toLocaleString()}
                                </p>
                            </div>
                            <Badge variant="secondary" className="shrink-0 text-[10px]">{deal.stage}</Badge>
                            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        </div>
                    </div>
                );
            })}
            {sortedDeals.length === 0 && (
                <div className="flex items-center justify-center h-24 border-2 border-dashed rounded-xl text-muted-foreground text-xs font-medium">
                    No deals found in this pipeline.
                </div>
            )}
        </div>

        {/* Desktop list: table view */}
        <div className="hidden md:block rounded-md border bg-card/50">
            <Table>
                <TableHeader className="bg-muted/50">
                    <TableRow>
                        <TableHead className="w-[40px]">
                            <Checkbox
                                checked={allSelected ? true : someSelected ? "indeterminate" : false}
                                onCheckedChange={onToggleSelectAll}
                            />
                        </TableHead>
                        <TableHead>Contact</TableHead>
                        {statusFilter !== "open" && <TableHead>Status</TableHead>}
                        <TableHead>{statusFilter !== "open" ? "Last Stage" : "Stage"}</TableHead>
                        {showBase && <TableHead>Location</TableHead>}
                        {showPriority && <TableHead>Priority</TableHead>}
                        {showValue && <TableHead className="cursor-pointer hover:bg-muted/80 transition-colors" onClick={() => requestSort('value')}>Value <ArrowUpDown className="ml-1 h-3 w-3 inline-block text-muted-foreground" /></TableHead>}
                        {showDates && <TableHead className="cursor-pointer hover:bg-muted/80 transition-colors" onClick={() => requestSort('startDate')}>Check-in <ArrowUpDown className="ml-1 h-3 w-3 inline-block text-muted-foreground" /></TableHead>}
                        {showEndDate && <TableHead className="cursor-pointer hover:bg-muted/80 transition-colors" onClick={() => requestSort('endDate')}>Check-out <ArrowUpDown className="ml-1 h-3 w-3 inline-block text-muted-foreground" /></TableHead>}
                        {showLengthOfStayProp && <TableHead className="cursor-pointer hover:bg-muted/80 transition-colors" onClick={() => requestSort('lengthOfStay')}>Duration <ArrowUpDown className="ml-1 h-3 w-3 inline-block text-muted-foreground" /></TableHead>}
                        <TableHead>Assignee</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sortedDeals.map((deal) => {
                        const isSelected = selectedDealIds.has(deal.id);
                        return (
                            <TableRow
                                key={deal.id}
                                className={`cursor-pointer hover:bg-muted/30 ${deal.unread === true ? "bg-primary/[0.04]" : ""} ${isSelected ? "bg-primary/10 hover:bg-primary/15" : ""}`}
                                onClick={() => onOpenDeal(deal)}
                            >
                                <TableCell className="w-[40px]" onClick={(e) => e.stopPropagation()}>
                                    <Checkbox
                                        checked={isSelected}
                                        onCheckedChange={() => onToggleSelect(deal.id)}
                                    />
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold">{deal.name}</span>
                                        {deal.unread === true && (
                                            <Badge className="text-[10px] font-bold tracking-wider bg-primary text-primary-foreground border-0 px-1.5 py-0">New</Badge>
                                        )}
                                    </div>
                                    <div className="text-xs text-muted-foreground hidden sm:block">{deal.email} • {deal.phone}</div>
                                </TableCell>
                                {statusFilter !== "open" && (
                                    <TableCell>
                                        <Badge variant="outline" className={`font-normal text-[10px] ${DEAL_STATUS_COLORS[(deal.status || "open") as DealStatus]}`}>
                                            {DEAL_STATUS_LABELS[(deal.status || "open") as DealStatus]}
                                        </Badge>
                                    </TableCell>
                                )}
                                <TableCell><Badge variant="secondary" className="font-medium bg-muted text-muted-foreground border-border">{deal.stage}</Badge></TableCell>
                                {showBase && <TableCell className="text-muted-foreground">{deal.base}</TableCell>}
                                {showPriority && <TableCell>
                                    <Badge variant="outline" className={`text-[10px] font-bold tracking-wider rounded-sm
                                        ${(() => {
                                            const { urgentDays, soonDays } = priorityRanges;
                                            let color = "";
                                            if (deal.startDate && deal.startDate !== "-") {
                                                const start = new Date(deal.startDate);
                                                const end = deal.endDate && deal.endDate !== "-" ? new Date(deal.endDate) : null;
                                                const now = new Date();
                                                const diffDays = Math.ceil((start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                                                if (end && now > end) color = "bg-gray-500/10 text-gray-500 border-gray-500/20";
                                                else if (now >= start && (!end || now <= end)) color = "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
                                                else if (diffDays <= urgentDays) color = "bg-red-500/10 text-red-600 border-red-500/20";
                                                else if (diffDays <= soonDays) color = "bg-amber-500/10 text-amber-600 border-amber-500/20";
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
                                                const start = new Date(deal.startDate);
                                                const end = deal.endDate && deal.endDate !== "-" ? new Date(deal.endDate) : null;
                                                const now = new Date();
                                                const diffDays = Math.ceil((start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                                                const { urgentDays, soonDays } = priorityRanges;
                                                if (end && now > end) return "EXPIRED";
                                                if (now >= start && (!end || now <= end)) return "ACTIVE";
                                                if (diffDays <= urgentDays) return "URGENT";
                                                if (diffDays <= soonDays) return "SOON";
                                                return "PLANNED";
                                            }
                                            return deal.priority;
                                        })()}
                                    </Badge>
                                </TableCell>}
                                {showValue && <TableCell className="font-mono font-medium">${deal.value.toLocaleString()}</TableCell>}
                                {showDates && <TableCell className="text-muted-foreground">{formatDisplayDate(deal.startDate)}</TableCell>}
                                {showEndDate && <TableCell className="text-muted-foreground">{formatDisplayDate(deal.endDate)}</TableCell>}
                                {showLengthOfStayProp && <TableCell className="font-medium text-primary/80">{getLengthOfStay(deal.startDate, deal.endDate)}</TableCell>}
                                <TableCell>
                                    <Avatar className="h-6 w-6">
                                        <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{deal.assignee}</AvatarFallback>
                                    </Avatar>
                                </TableCell>
                            </TableRow>
                        );
                    })}
                    {sortedDeals.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                                No deals found in this pipeline.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
        </>
    )
}
