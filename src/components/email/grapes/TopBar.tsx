"use client"

import { useEffect, useState } from "react"
import { DevicesProvider, useEditorMaybe } from "@grapesjs/react"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Undo2,
    Redo2,
    Monitor,
    Tablet,
    Smartphone,
    Code2,
    Eye,
    EyeOff,
    Maximize2,
    Minimize2,
    Save,
    PanelRightOpen,
    PanelRightClose,
} from "lucide-react"

const DEVICE_ICONS: Record<string, React.ReactNode> = {
    Desktop: <Monitor className="w-3.5 h-3.5" />,
    Tablet: <Tablet className="w-3.5 h-3.5" />,
    "Mobile portrait": <Smartphone className="w-3.5 h-3.5" />,
    "Mobile landscape": <Smartphone className="w-3.5 h-3.5" />,
    Mobile: <Smartphone className="w-3.5 h-3.5" />,
}

export interface TopBarProps {
    fullscreen: boolean
    onToggleFullscreen: () => void
    /** Optional save trigger; when present a Save button appears in fullscreen mode. */
    onSave?: () => void
    rightPanelOpen: boolean
    onToggleRightPanel: () => void
}

export function TopBar({
    fullscreen,
    onToggleFullscreen,
    onSave,
    rightPanelOpen,
    onToggleRightPanel,
}: TopBarProps) {
    const editor = useEditorMaybe()
    const [canUndo, setCanUndo] = useState(false)
    const [canRedo, setCanRedo] = useState(false)
    const [preview, setPreview] = useState(false)

    useEffect(() => {
        if (!editor) return
        const updateUndoState = () => {
            setCanUndo(editor.UndoManager.hasUndo())
            setCanRedo(editor.UndoManager.hasRedo())
        }
        updateUndoState()
        editor.on("update", updateUndoState)
        editor.on("component:add component:remove component:update", updateUndoState)
        return () => {
            editor.off("update", updateUndoState)
            editor.off("component:add component:remove component:update", updateUndoState)
        }
    }, [editor])

    const handleUndo = () => editor?.UndoManager.undo()
    const handleRedo = () => editor?.UndoManager.redo()
    const handleViewCode = () => {
        if (!editor) return
        try {
            editor.runCommand("export-template")
        } catch {
            // newsletter preset registers "gjs-export-template"; fall back
            editor.runCommand("gjs-export-template")
        }
    }
    const handleTogglePreview = () => {
        if (!editor) return
        const nextPreview = !preview
        setPreview(nextPreview)
        if (nextPreview) {
            editor.runCommand("preview")
        } else {
            editor.stopCommand("preview")
        }
    }

    return (
        <div className="flex items-center justify-between border-b bg-card px-3 py-2">
            <div className="flex items-center gap-1">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleUndo}
                    disabled={!canUndo}
                    title="Undo"
                    className="h-8 w-8"
                >
                    <Undo2 className="w-4 h-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleRedo}
                    disabled={!canRedo}
                    title="Redo"
                    className="h-8 w-8"
                >
                    <Redo2 className="w-4 h-4" />
                </Button>
            </div>

            <DevicesProvider>
                {({ devices, selected, select }) => {
                    const current = devices.find((d) => d.id === selected)
                    const currentName = current?.attributes?.name ?? current?.id ?? "Desktop"
                    return (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-8 gap-2">
                                    {DEVICE_ICONS[String(currentName)] ?? (
                                        <Monitor className="w-3.5 h-3.5" />
                                    )}
                                    {String(currentName)}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="center">
                                {devices.map((d) => {
                                    const name = (d.attributes?.name as string) ?? d.id
                                    return (
                                        <DropdownMenuItem
                                            key={d.id}
                                            onSelect={() => select(d.id as string)}
                                            className="gap-2"
                                        >
                                            {DEVICE_ICONS[String(name)] ?? (
                                                <Monitor className="w-3.5 h-3.5" />
                                            )}
                                            {String(name)}
                                        </DropdownMenuItem>
                                    )
                                })}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )
                }}
            </DevicesProvider>

            <div className="flex items-center gap-1">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleTogglePreview}
                    className="h-8 gap-1.5"
                    title="Toggle preview"
                >
                    {preview ? (
                        <>
                            <EyeOff className="w-3.5 h-3.5" /> Exit preview
                        </>
                    ) : (
                        <>
                            <Eye className="w-3.5 h-3.5" /> Preview
                        </>
                    )}
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleViewCode}
                    className="h-8 gap-1.5"
                    title="View HTML"
                >
                    <Code2 className="w-3.5 h-3.5" />
                    Code
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onToggleRightPanel}
                    className="h-8 w-8"
                    title={rightPanelOpen ? "Hide properties panel" : "Show properties panel"}
                >
                    {rightPanelOpen ? (
                        <PanelRightClose className="w-4 h-4" />
                    ) : (
                        <PanelRightOpen className="w-4 h-4" />
                    )}
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onToggleFullscreen}
                    className="h-8 w-8"
                    title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
                >
                    {fullscreen ? (
                        <Minimize2 className="w-4 h-4" />
                    ) : (
                        <Maximize2 className="w-4 h-4" />
                    )}
                </Button>
                {fullscreen && onSave && (
                    <Button
                        size="sm"
                        onClick={onSave}
                        className="h-8 ml-1 gap-1.5"
                        title="Save template"
                    >
                        <Save className="w-3.5 h-3.5" />
                        Save
                    </Button>
                )}
            </div>
        </div>
    )
}
