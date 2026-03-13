"use client"

import { useRef, useState, useCallback } from "react"
import { cn } from "@/lib/utils"
import { useHapticFeedback } from "@/hooks/useHapticFeedback"

interface SwipeAction {
    label: string
    icon?: React.ReactNode
    color: string // Tailwind bg color class
    onClick: () => void
}

interface SwipeableCardProps {
    children: React.ReactNode
    leftActions?: SwipeAction[]
    rightActions?: SwipeAction[]
    className?: string
    threshold?: number
}

const DEFAULT_THRESHOLD = 80

export function SwipeableCard({
    children,
    leftActions = [],
    rightActions = [],
    className,
    threshold = DEFAULT_THRESHOLD,
}: SwipeableCardProps) {
    const [offsetX, setOffsetX] = useState(0)
    const [swiping, setSwiping] = useState(false)
    const startX = useRef(0)
    const startY = useRef(0)
    const locked = useRef(false) // lock direction after initial move
    const isHorizontal = useRef(false)
    const hapticFired = useRef(false)
    const cardRef = useRef<HTMLDivElement>(null)
    const { trigger: haptic } = useHapticFeedback()

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        startX.current = e.touches[0].clientX
        startY.current = e.touches[0].clientY
        locked.current = false
        isHorizontal.current = false
        hapticFired.current = false
        setSwiping(true)
    }, [])

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        if (!swiping) return

        const dx = e.touches[0].clientX - startX.current
        const dy = e.touches[0].clientY - startY.current

        // Determine direction lock on first significant move
        if (!locked.current && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
            locked.current = true
            isHorizontal.current = Math.abs(dx) > Math.abs(dy)
        }

        if (!locked.current || !isHorizontal.current) return

        // Prevent vertical scroll while swiping horizontally
        e.preventDefault()

        // Constrain swipe direction based on available actions
        let clamped = dx
        if (rightActions.length === 0 && dx < 0) clamped = 0
        if (leftActions.length === 0 && dx > 0) clamped = 0

        // Haptic feedback when crossing threshold
        if (Math.abs(clamped) >= threshold && !hapticFired.current) {
            hapticFired.current = true
            haptic("medium")
        } else if (Math.abs(clamped) < threshold && hapticFired.current) {
            hapticFired.current = false
            haptic("light")
        }

        // Dampen after threshold
        const maxSwipe = threshold * 1.5
        if (Math.abs(clamped) > threshold) {
            const over = Math.abs(clamped) - threshold
            const dampened = threshold + over * 0.3
            clamped = clamped > 0 ? Math.min(dampened, maxSwipe) : Math.max(-dampened, -maxSwipe)
        }

        setOffsetX(clamped)
    }, [swiping, threshold, leftActions.length, rightActions.length])

    const handleTouchEnd = useCallback(() => {
        setSwiping(false)

        // Snap open if past threshold, otherwise snap back
        if (Math.abs(offsetX) >= threshold) {
            const actions = offsetX > 0 ? leftActions : rightActions
            if (actions.length === 1) {
                // Single action: auto-trigger
                actions[0].onClick()
                setOffsetX(0)
            } else {
                // Multiple actions: snap to reveal
                setOffsetX(offsetX > 0 ? threshold : -threshold)
            }
        } else {
            setOffsetX(0)
        }
    }, [offsetX, threshold, leftActions, rightActions])

    const handleClose = useCallback(() => {
        setOffsetX(0)
    }, [])

    const activeActions = offsetX > 0 ? leftActions : rightActions
    const revealSide = offsetX > 0 ? "left" : "right"

    return (
        <div className={cn("relative overflow-hidden rounded-xl", className)} style={{ touchAction: "pan-y" }}>
            {/* Action buttons revealed behind card */}
            {activeActions.length > 0 && offsetX !== 0 && (
                <div
                    className={cn(
                        "absolute inset-y-0 flex items-stretch",
                        revealSide === "right" ? "right-0" : "left-0"
                    )}
                    style={{ width: Math.abs(offsetX) }}
                >
                    {activeActions.map((action, i) => (
                        <button
                            key={i}
                            className={cn(
                                "flex flex-1 flex-col items-center justify-center gap-1 text-white text-xs font-medium transition-opacity",
                                action.color,
                                Math.abs(offsetX) > 20 ? "opacity-100" : "opacity-0"
                            )}
                            onClick={() => {
                                action.onClick()
                                handleClose()
                            }}
                        >
                            {action.icon}
                            <span>{action.label}</span>
                        </button>
                    ))}
                </div>
            )}

            {/* Card content */}
            <div
                ref={cardRef}
                className={cn(
                    "relative bg-card",
                    !swiping && "transition-transform duration-200 ease-out"
                )}
                style={{ transform: `translateX(${offsetX}px)` }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {children}
            </div>
        </div>
    )
}
