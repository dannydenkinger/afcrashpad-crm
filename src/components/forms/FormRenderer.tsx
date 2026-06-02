"use client"

import { useState, useEffect } from "react"
import type { LeadForm, FormField, FormPage } from "@/app/settings/lead-forms/types"
import { BORDER_RADIUS_MAP } from "@/app/settings/lead-forms/types"
import { FormFieldRenderer } from "./FormFieldRenderer"
import { FormSuccess } from "./FormSuccess"
import { getVisibleFields, getNextPageIndex } from "@/lib/form-conditions"

interface Props {
    form: LeadForm
    mode: "preview" | "live"
    selectedFieldId?: string | null
    onFieldSelect?: (fieldId: string) => void
    submitUrl?: string
}

export function FormRenderer({ form, mode, selectedFieldId, onFieldSelect, submitUrl }: Props) {
    const { style } = form
    const radius = BORDER_RADIUS_MAP[style.borderRadius]

    const [values, setValues] = useState<Record<string, any>>({})
    const [errors, setErrors] = useState<Record<string, string>>({})
    const [submitting, setSubmitting] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const [submitError, setSubmitError] = useState<string | null>(null)
    const [currentPage, setCurrentPage] = useState(0)

    // Get pages
    const pages: FormPage[] = form.isMultiStep && form.pages?.length
        ? form.pages
        : [{ id: "default", fields: form.fields }]
    const totalPages = pages.length
    const isMultiStep = form.isMultiStep && totalPages > 1
    const isLastPage = currentPage >= totalPages - 1
    const rawFields = pages[currentPage]?.fields || []
    const currentFields = mode === "preview" ? rawFields : getVisibleFields(rawFields, values)

    // View tracking
    useEffect(() => {
        if (mode !== "live") return
        fetch(`/api/forms/${form.id}/track`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ event: "view" }),
        }).catch(() => {})
    }, [form.id, mode])

    // URL prefill
    useEffect(() => {
        if (mode !== "live" || typeof window === "undefined") return
        const params = new URLSearchParams(window.location.search)
        const allFields = pages.flatMap(p => p.fields)
        const prefilled: Record<string, string> = {}
        params.forEach((val, key) => {
            const field = allFields.find(f =>
                f.id === key ||
                f.label.toLowerCase().replace(/[^a-z0-9]+/g, "_") === key.toLowerCase()
            )
            if (field) prefilled[field.id] = val
        })
        if (Object.keys(prefilled).length) setValues(prev => ({ ...prefilled, ...prev }))
    }, [mode])

    const setValue = (fieldId: string, value: any) => {
        setValues(prev => ({ ...prev, [fieldId]: value }))
        if (errors[fieldId]) setErrors(prev => { const n = { ...prev }; delete n[fieldId]; return n })
    }

    const validatePage = (fields: FormField[]): boolean => {
        const newErrors: Record<string, string> = {}
        for (const field of fields) {
            if (field.type === "header" || field.type === "hidden" || field.type === "divider" || field.type === "image" || field.type === "rich_text") continue
            const val = values[field.id]
            if (field.required && (!val || (typeof val === "string" && !val.trim()) || (Array.isArray(val) && val.length === 0))) {
                newErrors[field.id] = field.validation?.customMessage || `${field.label} is required`
            }
            if (field.type === "email" && val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
                newErrors[field.id] = "Please enter a valid email address"
            }
            if (field.validation?.minLength && typeof val === "string" && val.length < field.validation.minLength) {
                newErrors[field.id] = field.validation.customMessage || `Minimum ${field.validation.minLength} characters`
            }
            if (field.validation?.maxLength && typeof val === "string" && val.length > field.validation.maxLength) {
                newErrors[field.id] = field.validation.customMessage || `Maximum ${field.validation.maxLength} characters`
            }
            if (field.validation?.min !== undefined && typeof val === "string" && Number(val) < field.validation.min) {
                newErrors[field.id] = field.validation.customMessage || `Minimum value is ${field.validation.min}`
            }
            if (field.validation?.max !== undefined && typeof val === "string" && Number(val) > field.validation.max) {
                newErrors[field.id] = field.validation.customMessage || `Maximum value is ${field.validation.max}`
            }
            if (field.validation?.pattern && typeof val === "string" && val) {
                try {
                    if (!new RegExp(field.validation.pattern).test(val)) {
                        newErrors[field.id] = field.validation.customMessage || "Invalid format"
                    }
                } catch {}
            }
        }
        setErrors(prev => ({ ...prev, ...newErrors }))
        return Object.keys(newErrors).length === 0
    }

    const handleNext = () => {
        if (mode === "preview") { setCurrentPage(p => Math.min(p + 1, totalPages - 1)); return }
        if (validatePage(currentFields)) {
            const nextIdx = getNextPageIndex(form, currentPage, values)
            setCurrentPage(nextIdx)
        }
    }

    const handlePrev = () => setCurrentPage(p => Math.max(p - 1, 0))

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (mode === "preview") return
        if (!validatePage(currentFields)) return

        setSubmitting(true)
        try {
            const allFields = pages.flatMap(p => p.fields)
            const payload: Record<string, any> = {}
            for (const field of allFields) {
                if (field.type === "header" || field.type === "divider" || field.type === "image" || field.type === "rich_text") continue
                const val = values[field.id]
                if (val !== undefined && val !== "" && val !== null) {
                    if (field.type === "email") payload.email = val
                    else if (field.type === "phone" || field.type === "phone_intl") {
                        payload.phone = typeof val === "object" ? `${val.countryCode || ""} ${val.number || ""}`.trim() : val
                    }
                    else if (field.label.toLowerCase().includes("name") && !payload.name) {
                        if (typeof val === "object") {
                            payload.name = [val.prefix, val.first, val.middle, val.last, val.suffix].filter(Boolean).join(" ")
                        } else {
                            payload.name = val
                        }
                    }
                    else if (field.type === "hidden") payload[field.label] = field.defaultValue
                    else if (field.type === "address" && typeof val === "object") {
                        payload[field.label.toLowerCase().replace(/[^a-z0-9]+/g, "_")] =
                            [val.street, val.city, val.state, val.zip, val.country].filter(Boolean).join(", ")
                    }
                    else {
                        const key = field.label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")
                        payload[key] = Array.isArray(val) ? val.join(", ") : val
                    }
                }
            }

            const url = submitUrl || `/api/forms/${form.id}/submit`
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })

            if (res.ok) {
                setSubmitError(null)
                if (style.redirectUrl) window.location.href = style.redirectUrl
                else setSubmitted(true)
            } else {
                const data = await res.json().catch(() => ({}))
                setSubmitError(data.error || "Something went wrong. Please try again.")
            }
        } catch {
            setSubmitError("Something went wrong. Please try again.")
        }
        setSubmitting(false)
    }

    // ── Background styling ───────────────────────────────────────────

    const containerWidth = style.containerWidth || 560
    const containerUnit = style.containerWidthUnit || "px"
    const padding = style.formPadding ?? 40
    const spacing = style.fieldSpacing ?? 20

    let bgStyle: React.CSSProperties = { backgroundColor: style.backgroundColor }
    if (style.backgroundGradient) {
        const dir = style.backgroundGradient.direction === "to-bottom" ? "to bottom"
            : style.backgroundGradient.direction === "to-right" ? "to right" : "to bottom right"
        bgStyle = { background: `linear-gradient(${dir}, ${style.backgroundGradient.color1}, ${style.backgroundGradient.color2})` }
    }

    if (submitted) {
        return (
            <div style={{ minHeight: "100%", ...bgStyle, fontFamily: style.fontFamily }}>
                <div style={{ maxWidth: `${containerWidth}${containerUnit}`, margin: "0 auto", padding: `${padding}px 24px` }}>
                    <FormSuccess style={style} />
                </div>
            </div>
        )
    }

    // Group fields for two-column layout
    const fieldRows: (FormField | [FormField, FormField])[] = []
    if (style.layout === "two-column") {
        let i = 0
        while (i < currentFields.length) {
            const field = currentFields[i]
            if (field.width === "half" && i + 1 < currentFields.length && currentFields[i + 1].width === "half") {
                fieldRows.push([field, currentFields[i + 1]])
                i += 2
            } else {
                fieldRows.push(field)
                i++
            }
        }
    } else {
        currentFields.forEach(f => fieldRows.push(f))
    }

    const renderField = (field: FormField) => (
        <div
            key={field.id}
            style={{
                cursor: mode === "preview" ? "pointer" : undefined,
                outline: selectedFieldId === field.id ? `2px solid ${style.accentColor}` : undefined,
                outlineOffset: "4px",
                borderRadius: "4px",
            }}
            onClick={mode === "preview" ? (e) => { e.preventDefault(); onFieldSelect?.(field.id) } : undefined}
        >
            <FormFieldRenderer field={field} style={style} value={values[field.id]} onChange={v => setValue(field.id, v)} error={errors[field.id]} />
        </div>
    )

    return (
        <div style={{ minHeight: "100%", ...bgStyle, fontFamily: style.fontFamily, position: "relative" }}>
            {/* Background image overlay */}
            {style.backgroundImageUrl && (
                <div style={{
                    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                    backgroundImage: `url(${style.backgroundImageUrl})`,
                    backgroundSize: "cover", backgroundPosition: "center",
                    opacity: (style.backgroundOverlayOpacity ?? 100) / 100,
                    zIndex: 0,
                }} />
            )}

            {/* Custom CSS */}
            {style.customCss && (
                <style dangerouslySetInnerHTML={{ __html: `.vesta-form-${form.id} { ${style.customCss} }` }} />
            )}

            <div className={`vesta-form-${form.id}`} style={{ maxWidth: `${containerWidth}${containerUnit}`, margin: "0 auto", padding: `${padding}px 24px`, position: "relative", zIndex: 1 }}>
                {/* Logo */}
                {style.logoUrl && (
                    <div style={{ textAlign: "center", marginBottom: "24px" }}>
                        <img src={style.logoUrl} alt="" style={{ maxHeight: "48px", maxWidth: "200px", objectFit: "contain" }} />
                    </div>
                )}

                {/* Header image */}
                {style.headerImageUrl && (
                    <div style={{ marginBottom: "24px", borderRadius: radius, overflow: "hidden" }}>
                        <img src={style.headerImageUrl} alt="" style={{ width: "100%", height: "auto" }} />
                    </div>
                )}

                {/* Title & Description */}
                {style.title && (
                    <h1 style={{ fontSize: "28px", fontWeight: 700, color: style.textColor, textAlign: "center", margin: "0 0 8px 0", fontFamily: style.fontFamily }}>
                        {style.title}
                    </h1>
                )}
                {style.description && (
                    <p style={{ fontSize: "15px", color: `${style.textColor}99`, textAlign: "center", margin: "0 0 32px 0", lineHeight: "1.5", fontFamily: style.fontFamily }}>
                        {style.description}
                    </p>
                )}

                {/* Progress bar (multi-step) */}
                {isMultiStep && (
                    <ProgressBar current={currentPage} total={totalPages} pages={pages} style={style} />
                )}

                {/* Page title (multi-step) */}
                {isMultiStep && pages[currentPage]?.title && (
                    <h2 style={{ fontSize: "20px", fontWeight: 600, color: style.textColor, margin: "0 0 8px 0", fontFamily: style.fontFamily }}>
                        {pages[currentPage].title}
                    </h2>
                )}
                {isMultiStep && pages[currentPage]?.description && (
                    <p style={{ fontSize: "14px", color: `${style.textColor}80`, margin: "0 0 20px 0", fontFamily: style.fontFamily }}>
                        {pages[currentPage].description}
                    </p>
                )}

                {/* Fields */}
                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: `${spacing}px` }}>
                    {/* Honeypot field for spam protection */}
                    {mode === "live" && (
                        <input name="website" tabIndex={-1} autoComplete="off"
                            style={{ position: "absolute", left: "-9999px", opacity: 0, height: 0, width: 0 }}
                            onChange={e => setValue("__honeypot", e.target.value)} />
                    )}
                    {fieldRows.map((row, rowIdx) => {
                        if (Array.isArray(row)) {
                            return (
                                <div key={rowIdx} style={{ display: "flex", gap: "16px" }}>
                                    {row.map(field => (
                                        <div key={field.id} style={{ flex: 1 }}>{renderField(field)}</div>
                                    ))}
                                </div>
                            )
                        }
                        return renderField(row as FormField)
                    })}

                    {/* Submit error message */}
                    {submitError && (
                        <div style={{
                            padding: "12px 16px",
                            backgroundColor: "#fef2f2",
                            border: "1px solid #fecaca",
                            borderRadius: radius,
                            color: "#dc2626",
                            fontSize: "13px",
                            fontFamily: style.fontFamily,
                        }}>
                            {submitError}
                        </div>
                    )}

                    {/* Navigation buttons */}
                    <div style={{
                        display: "flex",
                        gap: "12px",
                        marginTop: "8px",
                        justifyContent: style.buttonAlignment === "center" ? "center" : style.buttonAlignment === "right" ? "flex-end" : "stretch",
                    }}>
                        {isMultiStep && currentPage > 0 && (
                            <button type="button" onClick={handlePrev} style={{
                                padding: "12px 24px",
                                backgroundColor: "transparent",
                                color: style.textColor,
                                border: `1px solid ${style.textColor}30`,
                                borderRadius: radius,
                                fontSize: "15px",
                                fontWeight: 500,
                                fontFamily: style.fontFamily,
                                cursor: "pointer",
                                flex: style.buttonWidth === "full" ? 1 : undefined,
                            }}>
                                Previous
                            </button>
                        )}

                        {isMultiStep && !isLastPage ? (
                            <button type="button" onClick={handleNext} style={{
                                padding: "12px 24px",
                                backgroundColor: style.buttonColor,
                                color: style.buttonTextColor,
                                border: "none",
                                borderRadius: radius,
                                fontSize: "15px",
                                fontWeight: 600,
                                fontFamily: style.fontFamily,
                                cursor: "pointer",
                                flex: style.buttonWidth === "full" ? 1 : undefined,
                                width: style.buttonWidth === "full" && !isMultiStep ? "100%" : undefined,
                            }}>
                                Next
                            </button>
                        ) : (
                            <button type="submit" disabled={submitting} style={{
                                padding: "14px 24px",
                                backgroundColor: submitting ? `${style.buttonColor}99` : style.buttonColor,
                                color: style.buttonTextColor,
                                border: "none",
                                borderRadius: radius,
                                fontSize: "15px",
                                fontWeight: 600,
                                fontFamily: style.fontFamily,
                                cursor: submitting ? "not-allowed" : "pointer",
                                transition: "background-color 0.15s",
                                flex: style.buttonWidth === "full" ? 1 : undefined,
                                width: style.buttonWidth === "full" && !(isMultiStep && currentPage > 0) ? "100%" : undefined,
                            }}>
                                {submitting ? "Submitting..." : style.buttonText}
                            </button>
                        )}
                    </div>
                </form>

                {/* Powered by */}
                <p style={{ textAlign: "center", fontSize: "11px", color: "#9ca3af", marginTop: "32px" }}>
                    Powered by Vesta CRM
                </p>
            </div>
        </div>
    )
}

// ── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({ current, total, pages, style: formStyle }: {
    current: number; total: number; pages: FormPage[]; style: import("@/app/settings/lead-forms/types").FormStyle
}) {
    const color = formStyle.progressBarColor || formStyle.accentColor
    const barStyle = formStyle.progressBarStyle || "bar"

    if (barStyle === "dots") {
        return (
            <div style={{ display: "flex", justifyContent: "center", gap: "12px", marginBottom: "28px" }}>
                {Array.from({ length: total }, (_, i) => (
                    <div key={i} style={{
                        width: "12px", height: "12px", borderRadius: "50%",
                        backgroundColor: i <= current ? color : `${formStyle.textColor}20`,
                        transition: "background-color 0.2s",
                    }} />
                ))}
            </div>
        )
    }

    if (barStyle === "steps") {
        return (
            <div style={{ display: "flex", alignItems: "center", marginBottom: "28px", gap: "4px" }}>
                {Array.from({ length: total }, (_, i) => (
                    <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                        <div style={{
                            width: "28px", height: "28px", borderRadius: "50%",
                            backgroundColor: i <= current ? color : "transparent",
                            border: `2px solid ${i <= current ? color : `${formStyle.textColor}30`}`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "12px", fontWeight: 600,
                            color: i <= current ? formStyle.buttonTextColor || "#fff" : `${formStyle.textColor}60`,
                        }}>
                            {i + 1}
                        </div>
                        <span style={{ fontSize: "10px", color: `${formStyle.textColor}60`, textAlign: "center" }}>
                            {pages[i]?.title || `Step ${i + 1}`}
                        </span>
                    </div>
                ))}
            </div>
        )
    }

    // Default: bar
    const pct = ((current + 1) / total) * 100
    return (
        <div style={{ marginBottom: "28px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                <span style={{ fontSize: "12px", color: `${formStyle.textColor}80`, fontFamily: formStyle.fontFamily }}>
                    Step {current + 1} of {total}
                </span>
                <span style={{ fontSize: "12px", color: `${formStyle.textColor}80`, fontFamily: formStyle.fontFamily }}>
                    {Math.round(pct)}%
                </span>
            </div>
            <div style={{ height: "6px", backgroundColor: `${formStyle.textColor}15`, borderRadius: "3px", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, backgroundColor: color, borderRadius: "3px", transition: "width 0.3s ease" }} />
            </div>
        </div>
    )
}
