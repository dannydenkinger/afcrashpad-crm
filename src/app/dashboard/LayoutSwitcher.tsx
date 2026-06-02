"use client"

import { useState } from "react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    LayoutGrid, Check, ChevronDown, Plus, Pencil, Copy, Trash2, Star,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { DashboardLayout } from "./layout-actions"

interface Props {
    layouts: DashboardLayout[]
    activeLayoutId: string
    defaultLayoutId: string | null
    onSwitch: (id: string) => void
    onCreate: (name: string) => void
    onRename: (id: string, name: string) => void
    onDuplicate: (id: string) => void
    onDelete: (id: string) => void
    onSetDefault: (id: string) => void
}

export function LayoutSwitcher({
    layouts,
    activeLayoutId,
    defaultLayoutId,
    onSwitch,
    onCreate,
    onRename,
    onDuplicate,
    onDelete,
    onSetDefault,
}: Props) {
    const [showCreate, setShowCreate] = useState(false)
    const [showRename, setShowRename] = useState<DashboardLayout | null>(null)
    const [newName, setNewName] = useState("")

    const active = layouts.find((l) => l.id === activeLayoutId)

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 max-w-[180px]">
                        <LayoutGrid className="h-3.5 w-3.5 text-primary" />
                        <span className="truncate font-semibold">
                            {active?.name || "Untitled"}
                        </span>
                        <ChevronDown className="h-3 w-3 opacity-50 shrink-0" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                    <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
                        My layouts
                    </DropdownMenuLabel>
                    {layouts.length === 0 && (
                        <div className="px-2 py-3 text-xs text-muted-foreground">
                            No saved layouts yet.
                        </div>
                    )}
                    {layouts.map((l) => {
                        const isActive = l.id === activeLayoutId
                        const isDefault = l.id === defaultLayoutId
                        return (
                            <DropdownMenuItem
                                key={l.id}
                                onClick={() => onSwitch(l.id)}
                                className={cn(
                                    "flex items-center justify-between gap-2",
                                    isActive && "bg-primary/10",
                                )}
                            >
                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                    {isActive ? (
                                        <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                                    ) : (
                                        <span className="w-3.5 shrink-0" />
                                    )}
                                    <span className="truncate text-xs font-medium">{l.name}</span>
                                </div>
                                {isDefault && (
                                    <Star className="h-3 w-3 text-amber-500 fill-amber-500 shrink-0" />
                                )}
                            </DropdownMenuItem>
                        )
                    })}

                    <DropdownMenuSeparator />

                    <DropdownMenuItem
                        onClick={() => {
                            setNewName("")
                            setShowCreate(true)
                        }}
                    >
                        <Plus className="h-3.5 w-3.5 mr-2" />
                        New layout
                    </DropdownMenuItem>

                    {active && (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
                                Manage &ldquo;{active.name}&rdquo;
                            </DropdownMenuLabel>

                            <DropdownMenuItem
                                onClick={() => {
                                    setNewName(active.name)
                                    setShowRename(active)
                                }}
                            >
                                <Pencil className="h-3.5 w-3.5 mr-2" />
                                Rename
                            </DropdownMenuItem>

                            <DropdownMenuItem onClick={() => onDuplicate(active.id)}>
                                <Copy className="h-3.5 w-3.5 mr-2" />
                                Duplicate
                            </DropdownMenuItem>

                            {defaultLayoutId !== active.id && (
                                <DropdownMenuItem onClick={() => onSetDefault(active.id)}>
                                    <Star className="h-3.5 w-3.5 mr-2" />
                                    Set as default
                                </DropdownMenuItem>
                            )}

                            {layouts.length > 1 && (
                                <DropdownMenuItem
                                    onClick={() => {
                                        if (confirm(`Delete "${active.name}"? This can't be undone.`)) {
                                            onDelete(active.id)
                                        }
                                    }}
                                    className="text-destructive focus:text-destructive"
                                >
                                    <Trash2 className="h-3.5 w-3.5 mr-2" />
                                    Delete
                                </DropdownMenuItem>
                            )}
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Create dialog */}
            <Dialog open={showCreate} onOpenChange={setShowCreate}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>New dashboard layout</DialogTitle>
                        <DialogDescription>
                            Start with a blank canvas — you can add widgets and resize from edit mode.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-1.5 py-2">
                        <Label className="text-xs">Name</Label>
                        <Input
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder="e.g. Daily standup, Weekly review"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && newName.trim()) {
                                    onCreate(newName.trim())
                                    setShowCreate(false)
                                }
                            }}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                        <Button
                            onClick={() => {
                                onCreate(newName.trim())
                                setShowCreate(false)
                            }}
                            disabled={!newName.trim()}
                        >
                            Create layout
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Rename dialog */}
            <Dialog open={!!showRename} onOpenChange={(v) => !v && setShowRename(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Rename layout</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-1.5 py-2">
                        <Label className="text-xs">Name</Label>
                        <Input
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && newName.trim() && showRename) {
                                    onRename(showRename.id, newName.trim())
                                    setShowRename(null)
                                }
                            }}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowRename(null)}>Cancel</Button>
                        <Button
                            onClick={() => {
                                if (showRename) onRename(showRename.id, newName.trim())
                                setShowRename(null)
                            }}
                            disabled={!newName.trim()}
                        >
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
