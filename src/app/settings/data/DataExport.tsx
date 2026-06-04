"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Download, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { exportAllData, exportSelectiveData } from "./actions"

const EXPORT_OPTIONS = [
    { key: "contacts" as const, label: "Contacts", description: "All contact records and their details" },
    { key: "opportunities" as const, label: "Deals / Opportunities", description: "Pipeline deals and opportunity data" },
    { key: "notes" as const, label: "Notes", description: "All notes attached to contacts and deals" },
    { key: "tasks" as const, label: "Tasks", description: "Task assignments and completion data" },
    { key: "email_templates" as const, label: "Email Templates", description: "Saved email templates and sequences" },
    { key: "settings" as const, label: "Settings", description: "System configuration and preferences" },
]

type ExportCollection = "contacts" | "opportunities" | "notes" | "tasks" | "email_templates" | "settings"

function downloadJson(data: any, filename: string) {
    const json = JSON.stringify(data, null, 2)
    const blob = new Blob([json], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
}

export function DataExport() {
    const [isExportingAll, setIsExportingAll] = useState(false)
    const [isExportingSelective, setIsExportingSelective] = useState(false)
    const [selectedCollections, setSelectedCollections] = useState<Set<ExportCollection>>(new Set())
    const [progress, setProgress] = useState("")

    const handleExportAll = async () => {
        setIsExportingAll(true)
        setProgress("Fetching all data...")
        try {
            const result = await exportAllData()
            const totalRecords = Object.values(result.data).reduce((sum, arr) => sum + arr.length, 0)
            setProgress("Preparing download...")
            const timestamp = new Date().toISOString().split("T")[0]
            downloadJson(result, `afcrashpad-backup-${timestamp}.json`)
            toast.success(`Export complete: ${totalRecords} records exported`)
        } catch (err: any) {
            toast.error(err.message || "Export failed")
        } finally {
            setIsExportingAll(false)
            setProgress("")
        }
    }

    const handleExportSelective = async () => {
        if (selectedCollections.size === 0) {
            toast.error("Select at least one data type to export")
            return
        }
        setIsExportingSelective(true)
        setProgress("Fetching selected data...")
        try {
            const result = await exportSelectiveData(Array.from(selectedCollections))
            const totalRecords = Object.values(result.data).reduce((sum, arr) => sum + arr.length, 0)
            setProgress("Preparing download...")
            const timestamp = new Date().toISOString().split("T")[0]
            const suffix = Array.from(selectedCollections).join("-")
            downloadJson(result, `afcrashpad-${suffix}-${timestamp}.json`)
            toast.success(`Export complete: ${totalRecords} records exported`)
        } catch (err: any) {
            toast.error(err.message || "Export failed")
        } finally {
            setIsExportingSelective(false)
            setProgress("")
        }
    }

    const toggleCollection = (key: ExportCollection) => {
        setSelectedCollections((prev) => {
            const next = new Set(prev)
            if (next.has(key)) {
                next.delete(key)
            } else {
                next.add(key)
            }
            return next
        })
    }

    const isExporting = isExportingAll || isExportingSelective

    return (
        <div className="space-y-6">
            <div className="p-4 border rounded-lg space-y-3">
                <div>
                    <h3 className="font-medium text-sm">Full backup</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                        Export all contacts, deals, notes, tasks, templates, pipelines, and settings in a single file.
                    </p>
                </div>
                <Button onClick={handleExportAll} disabled={isExporting} size="sm">
                    {isExportingAll ? (
                        <>
                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                            {progress || "Exporting…"}
                        </>
                    ) : (
                        <>
                            <Download className="mr-2 h-3.5 w-3.5" />
                            Export everything
                        </>
                    )}
                </Button>
            </div>

            <div className="p-4 border rounded-lg space-y-4">
                <div>
                    <h3 className="font-medium text-sm">Selective export</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                        Choose specific data types to export.
                    </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {EXPORT_OPTIONS.map((option) => (
                        <label
                            key={option.key}
                            className="flex items-start gap-3 p-3 border rounded-md cursor-pointer hover:bg-muted/30 transition-colors"
                        >
                            <Checkbox
                                checked={selectedCollections.has(option.key)}
                                onCheckedChange={() => toggleCollection(option.key)}
                                disabled={isExporting}
                                className="mt-0.5"
                            />
                            <div>
                                <Label className="text-sm font-medium cursor-pointer">{option.label}</Label>
                                <p className="text-xs text-muted-foreground mt-0.5">{option.description}</p>
                            </div>
                        </label>
                    ))}
                </div>
                <Button
                    onClick={handleExportSelective}
                    disabled={isExporting || selectedCollections.size === 0}
                    variant="outline"
                    size="sm"
                >
                    {isExportingSelective ? (
                        <>
                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                            {progress || "Exporting…"}
                        </>
                    ) : (
                        <>
                            <Download className="mr-2 h-3.5 w-3.5" />
                            Export selected ({selectedCollections.size})
                        </>
                    )}
                </Button>
            </div>
        </div>
    )
}
