"use client"

import { useRef, useState, useEffect, useCallback } from "react"

interface Props {
    onChange: (dataUrl: string | null) => void
    value?: string | null
    accentColor: string
    borderRadius: string
}

export function SignaturePad({ onChange, value, accentColor, borderRadius }: Props) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [isDrawing, setIsDrawing] = useState(false)
    const [hasContent, setHasContent] = useState(!!value)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext("2d")
        if (!ctx) return

        // Set canvas resolution
        const rect = canvas.getBoundingClientRect()
        canvas.width = rect.width * 2
        canvas.height = rect.height * 2
        ctx.scale(2, 2)
        ctx.strokeStyle = "#1f2937"
        ctx.lineWidth = 2
        ctx.lineCap = "round"
        ctx.lineJoin = "round"

        // Restore existing signature
        if (value) {
            const img = new Image()
            img.onload = () => {
                ctx.drawImage(img, 0, 0, rect.width, rect.height)
            }
            img.src = value
        }
    }, [])

    const getPos = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current
        if (!canvas) return { x: 0, y: 0 }
        const rect = canvas.getBoundingClientRect()
        if ("touches" in e) {
            return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top }
        }
        return { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }

    const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault()
        const ctx = canvasRef.current?.getContext("2d")
        if (!ctx) return
        setIsDrawing(true)
        const pos = getPos(e)
        ctx.beginPath()
        ctx.moveTo(pos.x, pos.y)
    }

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing) return
        e.preventDefault()
        const ctx = canvasRef.current?.getContext("2d")
        if (!ctx) return
        const pos = getPos(e)
        ctx.lineTo(pos.x, pos.y)
        ctx.stroke()
        setHasContent(true)
    }

    const endDraw = () => {
        if (!isDrawing) return
        setIsDrawing(false)
        const canvas = canvasRef.current
        if (canvas && hasContent) {
            onChange(canvas.toDataURL("image/png"))
        }
    }

    const clear = () => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext("2d")
        if (!ctx) return
        const rect = canvas.getBoundingClientRect()
        ctx.clearRect(0, 0, rect.width, rect.height)
        setHasContent(false)
        onChange(null)
    }

    return (
        <div>
            <div style={{
                border: "1px solid #d1d5db",
                borderRadius,
                overflow: "hidden",
                position: "relative",
                backgroundColor: "#fafafa",
            }}>
                <canvas
                    ref={canvasRef}
                    style={{ width: "100%", height: "120px", cursor: "crosshair", touchAction: "none" }}
                    onMouseDown={startDraw}
                    onMouseMove={draw}
                    onMouseUp={endDraw}
                    onMouseLeave={endDraw}
                    onTouchStart={startDraw}
                    onTouchMove={draw}
                    onTouchEnd={endDraw}
                />
                {!hasContent && (
                    <div style={{
                        position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
                        color: "#9ca3af", fontSize: "13px", pointerEvents: "none",
                    }}>
                        Sign here
                    </div>
                )}
            </div>
            {hasContent && (
                <button
                    type="button"
                    onClick={clear}
                    style={{
                        marginTop: "6px", fontSize: "12px", color: accentColor,
                        background: "none", border: "none", cursor: "pointer", padding: 0,
                    }}
                >
                    Clear signature
                </button>
            )}
        </div>
    )
}
