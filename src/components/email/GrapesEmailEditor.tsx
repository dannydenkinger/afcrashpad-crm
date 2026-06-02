"use client"

import { useEffect, useRef, useState } from "react"
import GjsEditor, { Canvas } from "@grapesjs/react"
import grapesjs from "grapesjs"
import type { Component, Editor, Plugin, ProjectData } from "grapesjs"
import newsletterPreset from "grapesjs-preset-newsletter"
import { ArrowLeft } from "lucide-react"
import "grapesjs/dist/css/grapes.min.css"
import "./grapes/grapes-theme.css"
import { vestaBlocksPlugin } from "./grapes/blocks"

import { TopBar } from "./grapes/TopBar"
import { BlocksPanel } from "./grapes/BlocksPanel"
import { RightPanel } from "./grapes/RightPanel"

export interface GrapesEmailEditorProps {
    /** Initial project JSON from a previously saved design (takes priority over initialHtml). */
    initialProject?: ProjectData | null
    /** Seed HTML when creating a new template (used only if initialProject is absent). */
    initialHtml?: string
    /**
     * Fired after every edit. Receives the rendered HTML and the project JSON.
     * The JSON is what you save to re-open for editing later.
     */
    onChange?: (html: string, projectJson: ProjectData) => void
    /** Fired once when the editor is mounted and ready. */
    onReady?: (editor: Editor) => void
    /** Optional: triggered when the user clicks the Save button in the editor TopBar. */
    onSave?: () => void
}

/**
 * GrapesJS-based drag-and-drop email editor with a shadcn-themed skin.
 * Heavy bundle (~300 KB) — parent should lazy-import via next/dynamic.
 */
export function GrapesEmailEditor({
    initialProject,
    initialHtml,
    onChange,
    onReady,
    onSave,
}: GrapesEmailEditorProps) {
    const editorRef = useRef<Editor | null>(null)
    const [fullscreen, setFullscreen] = useState(false)
    // Properties panel collapses by default; opens automatically when the
    // user selects something in the canvas, closes on deselect. User can
    // also toggle manually via the TopBar button.
    const [rightPanelOpen, setRightPanelOpen] = useState(false)
    // Track whether the canvas has any components — drives the empty-state hint
    const [isEmpty, setIsEmpty] = useState(!initialHtml && !initialProject)
    // Element count for the status bar
    const [componentCount, setComponentCount] = useState(0)

    // Lock body scroll while fullscreen so background scrolling can't drift
    // the iframe and throw off GrapesJS's drop-position math.
    useEffect(() => {
        if (!fullscreen) return
        const prev = document.body.style.overflow
        document.body.style.overflow = "hidden"
        return () => {
            document.body.style.overflow = prev
        }
    }, [fullscreen])

    // Esc: exit fullscreen, otherwise deselect any element. Useful when the
    // properties panel feels intrusive — one tap returns to the empty canvas.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return
            // Don't fight inputs / textareas
            const tag = (e.target as HTMLElement | null)?.tagName
            if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return
            if (fullscreen) {
                setFullscreen(false)
                return
            }
            try {
                const ed = editorRef.current
                const selected = ed?.getSelected()
                if (ed && selected) ed.selectRemove(selected)
            } catch {
                // ignore
            }
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [fullscreen])

    const handleEditor = (editor: Editor) => {
        editorRef.current = editor

        if (initialProject) {
            try {
                editor.loadProjectData(initialProject)
            } catch (err) {
                console.error("[GrapesEmailEditor] failed to load project:", err)
                if (initialHtml) editor.setComponents(initialHtml)
            }
        } else if (initialHtml) {
            editor.setComponents(initialHtml)
        }

        // Auto-open the properties panel when the user selects something,
        // close it on deselect. Gives users full canvas width when not
        // styling, and surfaces controls automatically when needed.
        editor.on("component:selected", () => setRightPanelOpen(true))
        editor.on("component:deselected", () => setRightPanelOpen(false))

        // Track empty state and component count for the status bar / hint
        const refreshCounts = () => {
            try {
                const wrapper = editor.getWrapper()
                const count = wrapper ? countDescendants(wrapper) : 0
                setComponentCount(count)
                setIsEmpty(count === 0)
            } catch {
                // ignore
            }
        }
        refreshCounts()
        editor.on("component:add component:remove component:update", refreshCounts)

        onReady?.(editor)
    }

    const handleUpdate = (projectData: ProjectData, editor: Editor) => {
        if (!onChange) return
        try {
            const html = editor.getHtml() + "<style>" + editor.getCss() + "</style>"
            onChange(html, projectData)
        } catch (err) {
            console.error("[GrapesEmailEditor] render failed:", err)
        }
    }

    // Inline mode fills its parent (TemplateEditor pins it in a fixed-height
    // flex region — the iframe never moves on page scroll, which keeps
    // GrapesJS's drop-position math accurate).
    // Fullscreen mode covers the whole viewport.
    const wrapperClass = fullscreen
        ? "grapes-editor-root fixed inset-0 z-50 bg-background flex flex-col"
        : "grapes-editor-root bg-background flex flex-col h-full w-full"

    return (
        <div className={wrapperClass}>
            <GjsEditor
                grapesjs={grapesjs}
                plugins={[newsletterPreset as Plugin, vestaBlocksPlugin]}
                options={{
                    height: "100%",
                    storageManager: false,
                    panels: { defaults: [] },
                    // Tell GrapesJS we're rendering each manager's UI ourselves
                    // (via the React providers in our left/right panels).
                    // Without this it ALSO renders its own native panels,
                    // causing the duplicate "two right sidebars" effect.
                    blockManager: { custom: true },
                    styleManager: { custom: true },
                    selectorManager: { custom: true },
                    traitManager: { custom: true },
                    layerManager: { custom: true },
                }}
                onEditor={handleEditor}
                onUpdate={handleUpdate}
                waitReady={
                    <div className="py-12 text-sm text-muted-foreground text-center">
                        Loading editor…
                    </div>
                }
            >
                <div className="flex flex-col h-full">
                    <TopBar
                        fullscreen={fullscreen}
                        onToggleFullscreen={() => setFullscreen((v) => !v)}
                        onSave={onSave}
                        rightPanelOpen={rightPanelOpen}
                        onToggleRightPanel={() => setRightPanelOpen((v) => !v)}
                    />
                    <div className="flex flex-1 min-h-0">
                        <div className="w-56 shrink-0 border-r bg-card">
                            <BlocksPanel />
                        </div>
                        <div className="flex-1 min-w-0 relative">
                            <Canvas className="h-full" />
                            {isEmpty && <EmptyCanvasHint />}
                        </div>
                        <div
                            className={`shrink-0 border-l bg-card overflow-hidden transition-[width] duration-200 ease-out ${
                                rightPanelOpen ? "w-72" : "w-0 border-l-0"
                            }`}
                            aria-hidden={!rightPanelOpen}
                        >
                            <div className="w-72 h-full">
                                <RightPanel />
                            </div>
                        </div>
                    </div>
                    <StatusBar
                        componentCount={componentCount}
                        fullscreen={fullscreen}
                    />
                </div>
            </GjsEditor>
        </div>
    )
}

function EmptyCanvasHint() {
    return (
        <div className="pointer-events-none absolute inset-0 flex items-start pt-24 justify-center">
            <div className="bg-popover/95 backdrop-blur border border-dashed rounded-lg px-5 py-4 max-w-xs shadow-sm flex items-center gap-3">
                <ArrowLeft className="w-5 h-5 text-primary shrink-0 animate-pulse" />
                <div>
                    <div className="text-sm font-medium">Drag a block to start</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                        Pick from the panel on the left and drop it on the canvas.
                    </div>
                </div>
            </div>
        </div>
    )
}

function StatusBar({
    componentCount,
    fullscreen,
}: {
    componentCount: number
    fullscreen: boolean
}) {
    return (
        <div className="h-7 border-t shrink-0 px-3 flex items-center justify-between text-[11px] text-muted-foreground bg-card">
            <div className="flex items-center gap-3">
                <span className="tabular-nums">
                    {componentCount} element{componentCount === 1 ? "" : "s"}
                </span>
                <span className="opacity-50">·</span>
                <span>
                    <kbd className="px-1 py-0.5 rounded border bg-background text-[10px]">⌘S</kbd> save
                </span>
                <span className="opacity-50">·</span>
                <span>
                    <kbd className="px-1 py-0.5 rounded border bg-background text-[10px]">Esc</kbd>{" "}
                    {fullscreen ? "exit fullscreen" : "deselect"}
                </span>
            </div>
            <div className="text-muted-foreground/70">
                CSS auto-inlined on send
            </div>
        </div>
    )
}

function countDescendants(component: Component): number {
    const children = component.components()
    let total = children.length
    children.each((child: Component) => {
        total += countDescendants(child)
    })
    return total
}
