"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Download, Database, Loader2 } from "lucide-react"
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
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    Data Management
                </CardTitle>
                <CardDescription>
                    Export your CRM data for backup or migration. Downloads are in JSON format.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Full Export */}
                <div className="p-4 border rounded-lg space-y-3">
                    <div>
                        <h4 className="font-medium text-sm">Full Data Export</h4>
                        <p className="text-xs text-muted-foreground mt-1">
                            Export all contacts, deals, notes, tasks, templates, pipelines, and settings in a single file.
                        </p>
                    </div>
                    <Button onClick={handleExportAll} disabled={isExporting} className="w-full sm:w-auto">
                        {isExportingAll ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                {progress || "Exporting..."}
                            </>
                        ) : (
                            <>
                                <Download className="mr-2 h-4 w-4" />
                                Export All Data
                            </>
                        )}
                    </Button>
                </div>

                {/* Selective Export */}
                <div className="p-4 border rounded-lg space-y-4">
                    <div>
                        <h4 className="font-medium text-sm">Selective Export</h4>
                        <p className="text-xs text-muted-foreground mt-1">
                            Choose specific data types to export.
                        </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                        className="w-full sm:w-auto"
                    >
                        {isExportingSelective ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                {progress || "Exporting..."}
                            </>
                        ) : (
                            <>
                                <Download className="mr-2 h-4 w-4" />
                                Export Selected ({selectedCollections.size})
                            </>
                        )}
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
