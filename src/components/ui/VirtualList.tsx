"use client"

import React from "react"
import { cn } from "@/lib/utils"

interface VirtualListProps<T> {
    items: T[]
    estimateSize: number
    renderItem: (item: T, index: number) => React.ReactNode
    className?: string
    overscan?: number
}

export function VirtualList<T>({
    items,
    renderItem,
    className,
}: VirtualListProps<T>) {
    return (
        <div className={cn("overflow-auto", className)}>
            {items.map((item, index) => (
                <React.Fragment key={index}>
                    {renderItem(item, index)}
                </React.Fragment>
            ))}
        </div>
    )
}
