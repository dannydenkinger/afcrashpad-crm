"use client"

import * as React from "react"
import { Card } from "@/components/ui/card"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreHorizontal, EyeOff, Maximize2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface DashboardWidgetProps {
    /** Stable widget id (e.g. "kpi-pipeline-value"). */
    id: string
    /** Widget title — used in the kebab menu label. */
    title: string
    /** Whether the dashboard is in edit mode. */
    editMode: boolean
    /** Hide widget callback. */
    onHide: () => void
    /** Optional shortcut to maximize / make fullscreen this widget. */
    onMaximize?: () => void
    /**
     * Drop the wrapping <Card> chrome — used by widgets that already
     * render their own card. The wrapper still applies the edit-mode
     * overlay so editing still works.
     */
    chromeless?: boolean
    children: React.ReactNode
}

/**
 * Wraps every dashboard widget. In edit mode, the entire card is
 * draggable (configured at the GridDashboard level via draggableCancel
 * = "button, a, input, select, textarea, .no-drag, [data-no-drag]").
 * The only UI we add in edit mode is a single kebab in the top-right
 * for hide / maximize.
 */
export const DashboardWidget = React.forwardRef<
    HTMLDivElement,
    DashboardWidgetProps & React.HTMLAttributes<HTMLDivElement>
>(function DashboardWidget(
    { id, title, editMode, onHide, onMaximize, chromeless = false, children, className, ...rest },
    ref,
) {
    const editControls = editMode ? (
        <div
            className="absolute top-2 right-2 z-20"
            data-no-drag
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
        >
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button
                        type="button"
                        className="h-7 w-7 flex items-center justify-center rounded-md bg-background/90 backdrop-blur border shadow-sm hover:bg-muted transition-colors cursor-pointer"
                        title="Widget options"
                        aria-label="Widget options"
                    >
                        <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" data-no-drag>
                    <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
                        {title}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {onMaximize && (
                        <DropdownMenuItem onClick={onMaximize}>
                            <Maximize2 className="h-3.5 w-3.5 mr-2" />
                            Make full width
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                        onClick={onHide}
                        className="text-destructive focus:text-destructive"
                    >
                        <EyeOff className="h-3.5 w-3.5 mr-2" />
                        Remove from dashboard
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    ) : null

    if (chromeless) {
        return (
            <div
                ref={ref}
                className={cn(
                    "relative h-full w-full overflow-hidden",
                    editMode && "cursor-grab active:cursor-grabbing",
                    className,
                )}
                data-widget-id={id}
                {...rest}
            >
                {editControls}
                {/* Chromeless widgets render their own outer Card — they need
                    h-full to fill the grid item. We force it via a wrapper +
                    a child selector that targets the immediate child. */}
                <div className={cn(
                    "h-full w-full [&>*]:h-full [&>*]:w-full",
                    editMode && "pointer-events-none select-none",
                )}>
                    {children}
                </div>
            </div>
        )
    }

    return (
        <div
            ref={ref}
            className={cn("h-full w-full", className)}
            data-widget-id={id}
            {...rest}
        >
            <Card
                className={cn(
                    "relative h-full w-full border-none shadow-md bg-card/40 backdrop-blur-md overflow-hidden flex flex-col",
                    editMode && "cursor-grab active:cursor-grabbing",
                )}
            >
                {editControls}
                <div className={cn(
                    "flex-1 min-h-0 w-full overflow-auto",
                    editMode && "pointer-events-none select-none",
                )}>
                    {children}
                </div>
            </Card>
        </div>
    )
})
