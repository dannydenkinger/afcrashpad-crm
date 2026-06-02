"use client"

import { TaskCard } from "@/components/TaskCard"

export default function TaskCardPlaygroundPage() {
    return (
        <div className="min-h-[100dvh] flex items-center justify-center bg-muted/30 p-6">
            <div className="w-full max-w-md space-y-6">
                <div className="text-center space-y-1">
                    <h1 className="text-lg font-semibold tracking-tight">Task card</h1>
                    <p className="text-xs text-muted-foreground">
                        Click the card to expand. Hover the progress bar to see the shine.
                    </p>
                </div>

                <TaskCard
                    title="Design System"
                    priority="Urgent"
                    status="In Progress"
                    checklist={[
                        { id: "tokens", label: "Design Tokens", done: true },
                        { id: "color", label: "Color System", done: true },
                        { id: "type", label: "Type System", done: true },
                        { id: "docs", label: "Documentation", done: false },
                    ]}
                    members={[
                        { id: "chloe", name: "Chloe", accent: "sky" },
                        { id: "anna", name: "Anna", accent: "violet" },
                        { id: "ramesh", name: "Ramesh", accent: "rose" },
                    ]}
                />
            </div>
        </div>
    )
}
