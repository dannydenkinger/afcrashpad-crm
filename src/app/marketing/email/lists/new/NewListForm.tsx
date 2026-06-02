"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Loader2, ListPlus, Sparkles, Users } from "lucide-react"
import { saveListAction } from "../actions"

type ListKind = "static" | "smart"

export function NewListForm() {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [name, setName] = useState("")
    const [description, setDescription] = useState("")
    const [kind, setKind] = useState<ListKind>("static")

    const handleSave = () => {
        if (!name.trim()) {
            toast.error("Name is required")
            return
        }
        startTransition(async () => {
            const result = await saveListAction({
                name: name.trim(),
                description: description.trim() || undefined,
                type: kind,
                rules: kind === "smart" ? [] : undefined,
                combinator: kind === "smart" ? "and" : undefined,
            })
            if (!result.success || !result.list) {
                toast.error(result.error || "Failed to create list")
                return
            }
            toast.success(kind === "smart" ? "Smart segment created" : "List created")
            router.push(`/marketing/email/lists/${result.list.id}`)
        })
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>List details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label>Type</Label>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={() => setKind("static")}
                            disabled={isPending}
                            className={`text-left p-3 border rounded-md transition-colors ${
                                kind === "static"
                                    ? "border-primary bg-primary/5"
                                    : "hover:bg-muted/40"
                            }`}
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <Users className="w-4 h-4 text-primary" />
                                <span className="text-sm font-medium">Static list</span>
                            </div>
                            <div className="text-xs text-muted-foreground leading-snug">
                                Add contacts manually or via CSV. Membership only changes
                                when you change it.
                            </div>
                        </button>
                        <button
                            type="button"
                            onClick={() => setKind("smart")}
                            disabled={isPending}
                            className={`text-left p-3 border rounded-md transition-colors ${
                                kind === "smart"
                                    ? "border-primary bg-primary/5"
                                    : "hover:bg-muted/40"
                            }`}
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <Sparkles className="w-4 h-4 text-primary" />
                                <span className="text-sm font-medium">Smart segment</span>
                            </div>
                            <div className="text-xs text-muted-foreground leading-snug">
                                Membership defined by rules (tag, status, recent
                                opens). Re-evaluated live every read.
                            </div>
                        </button>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={kind === "smart" ? "Active VIPs" : "Monthly newsletter subscribers"}
                        disabled={isPending}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="description">Description (optional)</Label>
                    <Input
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder={
                            kind === "smart"
                                ? "Auto-updated based on tag + recent activity"
                                : "People who opted in via the website"
                        }
                        disabled={isPending}
                    />
                </div>
                <div className="flex justify-end">
                    <Button onClick={handleSave} disabled={isPending || !name.trim()}>
                        {isPending ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <ListPlus className="w-4 h-4 mr-2" />
                        )}
                        {kind === "smart" ? "Create segment" : "Create list"}
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
