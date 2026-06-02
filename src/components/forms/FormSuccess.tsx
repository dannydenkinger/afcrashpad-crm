"use client"

import type { FormStyle } from "@/app/settings/lead-forms/types"

function hexToRgba(hex: string, alpha: number): string {
    const h = hex.replace("#", "")
    const r = parseInt(h.substring(0, 2), 16)
    const g = parseInt(h.substring(2, 4), 16)
    const b = parseInt(h.substring(4, 6), 16)
    if (isNaN(r) || isNaN(g) || isNaN(b)) return `rgba(100,100,100,${alpha})`
    return `rgba(${r},${g},${b},${alpha})`
}

export function FormSuccess({ style }: { style: FormStyle }) {
    return (
        <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "48px 24px",
            textAlign: "center",
            fontFamily: style.fontFamily,
        }}>
            <div style={{
                width: "72px",
                height: "72px",
                borderRadius: "50%",
                backgroundColor: hexToRgba(style.accentColor, 0.1),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "24px",
            }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={style.accentColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
            </div>
            <h2 style={{
                fontSize: "24px",
                fontWeight: 700,
                color: style.textColor,
                margin: "0 0 12px 0",
                fontFamily: style.fontFamily,
            }}>
                Thank you!
            </h2>
            <p style={{
                fontSize: "15px",
                color: `${style.textColor}99`,
                maxWidth: "420px",
                lineHeight: "1.6",
                margin: 0,
                fontFamily: style.fontFamily,
            }}>
                {style.successMessage}
            </p>
        </div>
    )
}
