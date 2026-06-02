"use client"

import * as React from "react"
import { type VariantProps } from "class-variance-authority"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * Icon-only button with a custom tooltip — replaces the native browser
 * `title=""` attribute that produces a slow, ugly system tooltip and
 * doubles as the accessible name.
 *
 *   <IconButton label="Edit" onClick={onEdit}>
 *       <Pencil className="h-3.5 w-3.5" />
 *   </IconButton>
 *
 * The label prop is required and is wired up as both the visible
 * tooltip text and the aria-label, so screen readers get the same
 * affordance.
 */
export interface IconButtonProps
    extends Omit<React.ComponentProps<"button">, "title" | "aria-label">,
        VariantProps<typeof buttonVariants> {
    label: string
    children: React.ReactNode
    side?: "top" | "right" | "bottom" | "left"
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
    ({ label, children, side = "top", className, variant = "ghost", size = "icon", ...rest }, ref) => {
        return (
            <TooltipProvider delayDuration={250}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            ref={ref}
                            variant={variant}
                            size={size}
                            aria-label={label}
                            className={cn(className)}
                            {...rest}
                        >
                            {children}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side={side}>{label}</TooltipContent>
                </Tooltip>
            </TooltipProvider>
        )
    }
)
IconButton.displayName = "IconButton"
