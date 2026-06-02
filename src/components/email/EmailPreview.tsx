"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Monitor, Smartphone, ExternalLink, Maximize2 } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Pixel-accurate email preview with a Desktop / Mobile width toggle.
 *
 * Email HTML is intended for ~600px-wide desktop clients (or ~375px on
 * mobile). Embedding it at less than that width without scaling produces
 * a horizontally-scrolling iframe that hides the email layout, which is
 * exactly what we don't want when reviewing a campaign.
 *
 * This component renders the iframe at its natural width and uses CSS
 * transform-scale to fit it inside the available container width, so the
 * preview always shows the *whole* email layout shrunk to fit.
 *
 *   <EmailPreview html={renderedHtml} height={420} />
 *
 * - `height` controls the visible viewport height (the iframe itself can
 *   be taller than that and scroll inside the scaled wrapper).
 * - "Open full size" pops the email in a new tab via blob URL.
 */

const DESKTOP_WIDTH = 600
const MOBILE_WIDTH = 375

interface EmailPreviewProps {
    html: string
    /** Height of the visible preview area in CSS pixels. */
    height?: number
    /** Default device. Defaults to "desktop". */
    defaultDevice?: "desktop" | "mobile"
    /** Hide the toolbar (used inside small thumbnail cards). */
    showToolbar?: boolean
    className?: string
}

const EMPTY_HTML = `<html><body style="margin:0;padding:48px 24px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#94a3b8;text-align:center;font-size:14px;">No content yet</body></html>`

export function EmailPreview({
    html,
    height = 480,
    defaultDevice = "desktop",
    showToolbar = true,
    className,
}: EmailPreviewProps) {
    const [device, setDevice] = useState<"desktop" | "mobile">(defaultDevice)
    const containerRef = useRef<HTMLDivElement | null>(null)
    const [containerWidth, setContainerWidth] = useState(0)

    useEffect(() => {
        const el = containerRef.current
        if (!el) return
        const ro = new ResizeObserver(() => setContainerWidth(el.clientWidth))
        ro.observe(el)
        setContainerWidth(el.clientWidth)
        return () => ro.disconnect()
    }, [])

    const naturalWidth = device === "desktop" ? DESKTOP_WIDTH : MOBILE_WIDTH
    // Scale down so the natural-width iframe fits the container, but never
    // upscale past 1.0 — small emails on wide cards stay readable.
    const scale = containerWidth > 0 ? Math.min(1, containerWidth / naturalWidth) : 1
    const scaledHeight = height / scale

    const openFullSize = () => {
        const blob = new Blob([html || EMPTY_HTML], { type: "text/html;charset=utf-8" })
        const url = URL.createObjectURL(blob)
        window.open(url, "_blank", "noopener,noreferrer")
        // Revoke later so the new tab has a chance to load.
        setTimeout(() => URL.revokeObjectURL(url), 60_000)
    }

    return (
        <div className={cn("flex flex-col gap-2", className)}>
            {showToolbar && (
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 rounded-md border bg-muted/40 p-0.5">
                        <DeviceButton
                            active={device === "desktop"}
                            onClick={() => setDevice("desktop")}
                            label="Desktop"
                            Icon={Monitor}
                        />
                        <DeviceButton
                            active={device === "mobile"}
                            onClick={() => setDevice("mobile")}
                            label="Mobile"
                            Icon={Smartphone}
                        />
                    </div>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={openFullSize}
                        className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Open full size
                    </Button>
                </div>
            )}

            <div
                ref={containerRef}
                className="relative overflow-hidden rounded-md border bg-[radial-gradient(circle_at_1px_1px,_rgba(148,163,184,0.18)_1px,_transparent_0)] [background-size:14px_14px] flex justify-center"
                style={{ height }}
            >
                <div
                    style={{
                        width: naturalWidth,
                        height: scaledHeight,
                        transform: `scale(${scale})`,
                        transformOrigin: "top center",
                        // When scaled down the wrapper appears smaller than its
                        // natural box, so explicitly center it horizontally.
                    }}
                >
                    <iframe
                        title="Email preview"
                        srcDoc={html || EMPTY_HTML}
                        sandbox=""
                        loading="lazy"
                        style={{
                            width: naturalWidth,
                            height: "100%",
                            border: 0,
                            display: "block",
                            background: "#ffffff",
                        }}
                    />
                </div>
                {!showToolbar && (
                    <button
                        type="button"
                        onClick={openFullSize}
                        className="absolute top-1.5 right-1.5 rounded-md bg-background/90 backdrop-blur p-1 text-muted-foreground opacity-0 hover:opacity-100 hover:text-foreground transition-opacity"
                        aria-label="Open full size"
                    >
                        <Maximize2 className="h-3.5 w-3.5" />
                    </button>
                )}
            </div>
        </div>
    )
}

function DeviceButton({
    active,
    onClick,
    label,
    Icon,
}: {
    active: boolean
    onClick: () => void
    label: string
    Icon: React.ComponentType<{ className?: string }>
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-colors",
                active
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
            )}
            aria-pressed={active}
        >
            <Icon className="h-3.5 w-3.5" />
            {label}
        </button>
    )
}
