"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Key, Plus, Copy, Trash2, Eye, EyeOff, AlertTriangle } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { generateApiKey, getApiKeys, revokeApiKey } from "./actions"
import type { ApiKeyInfo } from "./types"

export function ApiKeyManager() {
    const [keys, setKeys] = useState<ApiKeyInfo[]>([])
    const [loading, setLoading] = useState(true)
    const [createDialogOpen, setCreateDialogOpen] = useState(false)
    const [newKeyName, setNewKeyName] = useState("")
    const [generatedKey, setGeneratedKey] = useState<string | null>(null)
    const [generating, setGenerating] = useState(false)
    const [revokeTarget, setRevokeTarget] = useState<ApiKeyInfo | null>(null)

    useEffect(() => {
        loadKeys()
    }, [])

    async function loadKeys() {
        setLoading(true)
        try {
            const data = await getApiKeys()
            setKeys(data)
        } catch {
            toast.error("Failed to load API keys")
        } finally {
            setLoading(false)
        }
    }

    async function handleGenerate() {
        if (!newKeyName.trim()) {
            toast.error("Please enter a name for the API key")
            return
        }
        setGenerating(true)
        try {
            const result = await generateApiKey(newKeyName.trim())
            setGeneratedKey(result.key)
            loadKeys()
        } catch (err: any) {
            toast.error(err.message || "Failed to generate API key")
        } finally {
            setGenerating(false)
        }
    }

    async function handleRevoke() {
        if (!revokeTarget) return
        try {
            await revokeApiKey(revokeTarget.id)
            toast.success("API key revoked")
            setRevokeTarget(null)
            loadKeys()
        } catch (err: any) {
            toast.error(err.message || "Failed to revoke API key")
        }
    }

    function copyToClipboard(text: string) {
        navigator.clipboard.writeText(text)
        toast.success("Copied to clipboard")
    }

    function closeCreateDialog() {
        setCreateDialogOpen(false)
        setNewKeyName("")
        setGeneratedKey(null)
    }

    const activeKeys = keys.filter((k) => k.active)
    const revokedKeys = keys.filter((k) => !k.active)

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Key className="h-4 w-4" />
                        API Keys
                    </CardTitle>
                    <CardDescription>
                        Generate and manage API keys for external integrations and webhooks.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex justify-end">
                        <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
                            <Plus className="mr-1.5 h-3.5 w-3.5" />
                            Generate New Key
                        </Button>
                    </div>

                    {loading ? (
                        <div className="text-center py-8 text-sm text-muted-foreground">Loading API keys...</div>
                    ) : keys.length === 0 ? (
                        <div className="text-center py-8 border rounded-lg border-dashed">
                            <Key className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                            <p className="text-sm text-muted-foreground">No API keys generated yet.</p>
                            <p className="text-xs text-muted-foreground mt-1">API keys allow external services to authenticate with your CRM.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {activeKeys.map((key) => (
                                <div key={key.id} className="flex items-center gap-3 p-3 border rounded-lg group">
                                    <Key className="h-4 w-4 text-muted-foreground shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium">{key.name}</span>
                                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 border-green-200 dark:border-green-800">
                                                Active
                                            </Badge>
                                        </div>
                                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                            <code className="bg-muted px-1.5 py-0.5 rounded">{key.keyPrefix}</code>
                                            <span>Created {key.createdAt ? new Date(key.createdAt).toLocaleDateString() : "N/A"}</span>
                                            {key.lastUsedAt && (
                                                <span>Last used {new Date(key.lastUsedAt).toLocaleDateString()}</span>
                                            )}
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={() => setRevokeTarget(key)}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            ))}
                            {revokedKeys.length > 0 && (
                                <div className="pt-2">
                                    <p className="text-xs text-muted-foreground mb-2">Revoked Keys</p>
                                    {revokedKeys.map((key) => (
                                        <div key={key.id} className="flex items-center gap-3 p-3 border rounded-lg opacity-50">
                                            <Key className="h-4 w-4 text-muted-foreground shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-medium line-through">{key.name}</span>
                                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">Revoked</Badge>
                                                </div>
                                                <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{key.keyPrefix}</code>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Generate Key Dialog */}
            <Dialog open={createDialogOpen} onOpenChange={(open) => !open && closeCreateDialog()}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Generate API Key</DialogTitle>
                        <DialogDescription>
                            {generatedKey
                                ? "Your API key has been generated. Copy it now -- you will not be able to see it again."
                                : "Create a new API key for external integrations."}
                        </DialogDescription>
                    </DialogHeader>

                    {!generatedKey ? (
                        <div className="space-y-4 py-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="key-name">Key Name</Label>
                                <Input
                                    id="key-name"
                                    value={newKeyName}
                                    onChange={(e) => setNewKeyName(e.target.value)}
                                    placeholder="e.g. WordPress Integration"
                                    onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
                                />
                                <p className="text-xs text-muted-foreground">A descriptive name to identify this key.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4 py-2">
                            <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-2">
                                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                                <p className="text-xs text-amber-700 dark:text-amber-400">
                                    This key will only be shown once. Make sure to copy it before closing this dialog.
                                </p>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Your API Key</Label>
                                <div className="flex gap-2">
                                    <code className="flex-1 p-2 bg-muted rounded text-xs font-mono break-all border">
                                        {generatedKey}
                                    </code>
                                    <Button variant="outline" size="icon" onClick={() => copyToClipboard(generatedKey)} className="shrink-0">
                                        <Copy className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        {!generatedKey ? (
                            <>
                                <Button variant="outline" onClick={closeCreateDialog}>Cancel</Button>
                                <Button onClick={handleGenerate} disabled={generating}>
                                    {generating ? "Generating..." : "Generate Key"}
                                </Button>
                            </>
                        ) : (
                            <Button onClick={closeCreateDialog}>Done</Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Revoke Confirmation */}
            <AlertDialog open={!!revokeTarget} onOpenChange={(open) => !open && setRevokeTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Revoke API Key</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to revoke &quot;{revokeTarget?.name}&quot;? Any integrations using this key will stop working immediately.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRevoke} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Revoke Key
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
