"use client"

import { useState } from "react"
import Link from "next/link"
import { Plus, Users, LayoutGrid, CheckSquare, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const actions = [
    { icon: LayoutGrid, label: "New Deal", href: "/pipeline?action=new-deal", color: "bg-emerald-500 hover:bg-emerald-600" },
    { icon: Users, label: "New Contact", href: "/contacts?action=new-contact", color: "bg-blue-500 hover:bg-blue-600" },
    { icon: CheckSquare, label: "New Task", href: "/tasks?action=new-task", color: "bg-amber-500 hover:bg-amber-600" },
]

export function QuickAddFAB() {
    const [isOpen, setIsOpen] = useState(false)

    return (
        <div className="fixed bottom-6 right-6 z-40 flex flex-col-reverse items-end gap-2 md:hidden">
            {/* Action buttons - using Link for prefetching */}
            {isOpen && actions.map((action, i) => (
                <Link
                    key={action.label}
                    href={action.href}
                    prefetch={true}
                    onClick={() => setIsOpen(false)}
                    className={cn(
                        "flex items-center gap-2 rounded-full px-4 py-2.5 text-white shadow-lg transition-all duration-200",
                        action.color,
                        "animate-in slide-in-from-bottom-2 fade-in"
                    )}
                    style={{ animationDelay: `${i * 50}ms`, animationFillMode: "backwards" }}
                >
                    <action.icon className="h-4 w-4" />
                    <span className="text-sm font-medium whitespace-nowrap">{action.label}</span>
                </Link>
            ))}

            {/* Main FAB */}
            <Button
                size="icon"
                className={cn(
                    "h-14 w-14 rounded-full shadow-xl transition-transform duration-200",
                    isOpen && "rotate-45"
                )}
                onClick={() => setIsOpen(!isOpen)}
            >
                {isOpen ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
            </Button>
        </div>
    )
}
