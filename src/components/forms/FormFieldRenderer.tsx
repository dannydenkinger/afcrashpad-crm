"use client"

import { useState } from "react"
import type { FormField, FormStyle } from "@/app/settings/lead-forms/types"
import { BORDER_RADIUS_MAP, FONT_SIZE_MAP, INPUT_HEIGHT_MAP } from "@/app/settings/lead-forms/types"
import { SignaturePad } from "./SignaturePad"
import { sanitizeHtml } from "@/lib/sanitize-html"

interface Props {
    field: FormField
    style: FormStyle
    value: any
    onChange: (value: any) => void
    error?: string
}

export function FormFieldRenderer({ field, style, value, onChange, error }: Props) {
    const radius = BORDER_RADIUS_MAP[style.borderRadius]
    const fs = field.fieldStyle
    const fontSize = fs?.fontSize ? FONT_SIZE_MAP[fs.fontSize] : "14px"
    const inputHeight = fs?.inputHeight ? INPUT_HEIGHT_MAP[fs.inputHeight] : "42px"
    const labelColor = fs?.labelColor || style.textColor
    const labelPos = fs?.labelPosition || "top"

    const inputStyle: React.CSSProperties = {
        width: "100%",
        padding: "10px 14px",
        border: `1px solid ${error ? "#ef4444" : "#d1d5db"}`,
        borderRadius: radius,
        fontSize,
        fontFamily: style.fontFamily,
        color: style.textColor,
        backgroundColor: style.backgroundColor === "#111827" || style.backgroundColor === "#1e293b" ? "rgba(255,255,255,0.05)" : "#ffffff",
        outline: "none",
        boxSizing: "border-box" as const,
        transition: "border-color 0.15s",
        height: inputHeight,
    }
    const labelStyle: React.CSSProperties = {
        display: labelPos === "hidden" ? "none" : "block",
        fontSize,
        fontWeight: 500,
        color: labelColor,
        marginBottom: labelPos === "top" ? "6px" : "0",
        fontFamily: style.fontFamily,
        ...(labelPos === "left" && { minWidth: "120px", marginRight: "12px" }),
    }
    const helpStyle: React.CSSProperties = {
        fontSize: "12px",
        color: "#9ca3af",
        marginTop: "4px",
        fontFamily: style.fontFamily,
    }
    const errorStyle: React.CSSProperties = {
        fontSize: "12px",
        color: "#ef4444",
        marginTop: "4px",
        fontFamily: style.fontFamily,
    }
    const wrapperStyle: React.CSSProperties = labelPos === "left" || labelPos === "inline"
        ? { display: "flex", alignItems: "flex-start" }
        : {}

    // Character count
    const charCount = field.showCharCount && typeof value === "string" ? value.length : null
    const maxLen = field.validation?.maxLength

    // ── Display-only fields ──────────────────────────────────────────

    if (field.type === "header") {
        return (
            <div style={{ padding: "8px 0" }}>
                <h2 style={{ fontSize: "20px", fontWeight: 700, color: style.textColor, fontFamily: style.fontFamily, margin: 0 }}>
                    {field.label}
                </h2>
                {field.helpText && <p style={{ ...helpStyle, fontSize: "14px", marginTop: "4px" }}>{field.helpText}</p>}
            </div>
        )
    }

    if (field.type === "hidden") {
        return <input type="hidden" name={field.label} value={field.defaultValue || ""} />
    }

    if (field.type === "divider") {
        return <hr style={{ border: "none", borderTop: `1px solid ${style.textColor}20`, margin: "8px 0" }} />
    }

    if (field.type === "image") {
        return field.imageUrl ? (
            <div style={{ textAlign: "center", padding: "8px 0" }}>
                <img src={field.imageUrl} alt={field.imageAlt || ""} style={{ maxWidth: "100%", borderRadius: radius, height: "auto" }} />
            </div>
        ) : (
            <div style={{ padding: "24px", textAlign: "center", border: `2px dashed ${style.textColor}20`, borderRadius: radius }}>
                <p style={{ color: "#9ca3af", fontSize: "13px" }}>Image: set URL in field properties</p>
            </div>
        )
    }

    if (field.type === "rich_text") {
        return (
            <div
                style={{ fontSize: "14px", lineHeight: "1.6", color: style.textColor, fontFamily: style.fontFamily, padding: "4px 0" }}
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(field.richTextContent || "<p>Text block — edit in properties</p>") }}
            />
        )
    }

    // ── Input fields ─────────────────────────────────────────────────

    const renderInput = () => {
        switch (field.type) {
            case "short_text":
            case "email":
            case "phone":
            case "number":
            case "date":
            case "time":
                return (
                    <input
                        type={field.type === "short_text" ? "text" : field.type === "phone" ? "tel" : field.type}
                        placeholder={field.placeholder}
                        value={value || ""}
                        onChange={e => onChange(e.target.value)}
                        style={inputStyle}
                        onFocus={e => { e.target.style.borderColor = style.accentColor }}
                        onBlur={e => { e.target.style.borderColor = error ? "#ef4444" : "#d1d5db" }}
                    />
                )

            case "long_text":
                return (
                    <textarea
                        placeholder={field.placeholder}
                        value={value || ""}
                        onChange={e => onChange(e.target.value)}
                        rows={4}
                        style={{ ...inputStyle, resize: "vertical" as const, minHeight: "100px", height: "auto" }}
                        onFocus={e => { e.target.style.borderColor = style.accentColor }}
                        onBlur={e => { e.target.style.borderColor = error ? "#ef4444" : "#d1d5db" }}
                    />
                )

            case "dropdown":
                return (
                    <select value={value || ""} onChange={e => onChange(e.target.value)} style={{ ...inputStyle, appearance: "auto" as const }}>
                        <option value="">{field.placeholder || "Select..."}</option>
                        {field.options?.map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
                    </select>
                )

            case "radio":
                return (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        {field.options?.map((opt, i) => (
                            <label key={i} style={{ display: "flex", alignItems: "center", gap: "10px", fontSize, color: style.textColor, fontFamily: style.fontFamily, cursor: "pointer" }}>
                                <input type="radio" name={field.id} value={opt} checked={value === opt} onChange={() => onChange(opt)}
                                    style={{ accentColor: style.accentColor, width: "18px", height: "18px" }} />
                                {opt}
                            </label>
                        ))}
                    </div>
                )

            case "checkbox":
                return (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        {field.options?.map((opt, i) => {
                            const checked = Array.isArray(value) && value.includes(opt)
                            return (
                                <label key={i} style={{ display: "flex", alignItems: "center", gap: "10px", fontSize, color: style.textColor, fontFamily: style.fontFamily, cursor: "pointer" }}>
                                    <input type="checkbox" checked={checked}
                                        onChange={() => {
                                            const arr = Array.isArray(value) ? [...value] : []
                                            onChange(checked ? arr.filter(v => v !== opt) : [...arr, opt])
                                        }}
                                        style={{ accentColor: style.accentColor, width: "18px", height: "18px" }} />
                                    {opt}
                                </label>
                            )
                        })}
                    </div>
                )

            case "rating":
                return <RatingField field={field} style={style} value={value} onChange={onChange} />

            case "scale":
                return <ScaleField field={field} style={style} value={value} onChange={onChange} />

            case "phone_intl":
                return <PhoneIntlField field={field} style={style} inputStyle={inputStyle} value={value} onChange={onChange} />

            case "full_name":
                return <FullNameField field={field} style={style} inputStyle={inputStyle} value={value} onChange={onChange} />

            case "address":
                return <AddressField field={field} style={style} inputStyle={inputStyle} value={value} onChange={onChange} />

            case "file_upload":
                return <FileUploadField field={field} style={style} inputStyle={inputStyle} value={value} onChange={onChange} />

            case "signature":
                return <SignatureField field={field} style={style} value={value} onChange={onChange} />

            default:
                return null
        }
    }

    return (
        <div style={wrapperStyle}>
            <label style={labelStyle} aria-label={labelPos === "hidden" ? field.label : undefined}>
                {field.label}
                {field.required && <span style={{ color: "#ef4444", marginLeft: "2px" }}>*</span>}
            </label>
            <div style={{ flex: 1 }}>
                {renderInput()}
                {charCount !== null && (
                    <p style={{ ...helpStyle, textAlign: "right" }}>
                        {charCount}{maxLen ? ` / ${maxLen}` : ""}
                    </p>
                )}
                {field.helpText && !error && <p style={helpStyle}>{field.helpText}</p>}
                {error && <p style={errorStyle}>{error}</p>}
            </div>
        </div>
    )
}

// ── Rating ───────────────────────────────────────────────────────────────────

function RatingField({ field, style, value, onChange }: { field: FormField; style: FormStyle; value: any; onChange: (v: any) => void }) {
    const [hover, setHover] = useState(0)
    const max = field.ratingMax || 5
    const current = Number(value) || 0

    return (
        <div style={{ display: "flex", gap: "4px" }}>
            {Array.from({ length: max }, (_, i) => i + 1).map(star => (
                <button
                    key={star}
                    type="button"
                    onClick={() => onChange(star)}
                    onMouseEnter={() => setHover(star)}
                    onMouseLeave={() => setHover(0)}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: "2px" }}
                >
                    <svg width="28" height="28" viewBox="0 0 24 24" fill={(hover || current) >= star ? style.accentColor : "none"}
                        stroke={(hover || current) >= star ? style.accentColor : "#d1d5db"} strokeWidth="1.5">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                </button>
            ))}
        </div>
    )
}

// ── Scale / Slider ───────────────────────────────────────────────────────────

function ScaleField({ field, style, value, onChange }: { field: FormField; style: FormStyle; value: any; onChange: (v: any) => void }) {
    const min = field.scaleMin ?? 1
    const max = field.scaleMax ?? 10
    const current = Number(value) || min

    return (
        <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#9ca3af", marginBottom: "8px", fontFamily: style.fontFamily }}>
                <span>{field.scaleMinLabel || min}</span>
                <span style={{ fontWeight: 600, color: style.accentColor, fontSize: "18px" }}>{current}</span>
                <span>{field.scaleMaxLabel || max}</span>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                value={current}
                onChange={e => onChange(Number(e.target.value))}
                style={{ width: "100%", accentColor: style.accentColor }}
            />
        </div>
    )
}

// ── International Phone ──────────────────────────────────────────────────────

const COUNTRY_CODES = [
    { code: "+1", country: "US", flag: "🇺🇸" },
    { code: "+1", country: "CA", flag: "🇨🇦" },
    { code: "+44", country: "GB", flag: "🇬🇧" },
    { code: "+61", country: "AU", flag: "🇦🇺" },
    { code: "+49", country: "DE", flag: "🇩🇪" },
    { code: "+33", country: "FR", flag: "🇫🇷" },
    { code: "+81", country: "JP", flag: "🇯🇵" },
    { code: "+86", country: "CN", flag: "🇨🇳" },
    { code: "+91", country: "IN", flag: "🇮🇳" },
    { code: "+55", country: "BR", flag: "🇧🇷" },
    { code: "+52", country: "MX", flag: "🇲🇽" },
    { code: "+82", country: "KR", flag: "🇰🇷" },
    { code: "+39", country: "IT", flag: "🇮🇹" },
    { code: "+34", country: "ES", flag: "🇪🇸" },
    { code: "+31", country: "NL", flag: "🇳🇱" },
]

function PhoneIntlField({ field, style, inputStyle, value, onChange }: { field: FormField; style: FormStyle; inputStyle: React.CSSProperties; value: any; onChange: (v: any) => void }) {
    const parsed = typeof value === "object" && value ? value : { countryCode: "+1", number: "" }
    return (
        <div style={{ display: "flex", gap: "8px" }}>
            <select
                value={parsed.countryCode || "+1"}
                onChange={e => onChange({ ...parsed, countryCode: e.target.value })}
                style={{ ...inputStyle, width: "100px", flex: "none" }}
            >
                {COUNTRY_CODES.map((c, i) => (
                    <option key={i} value={c.code}>{c.flag} {c.code}</option>
                ))}
            </select>
            <input
                type="tel"
                placeholder={field.placeholder || "Phone number"}
                value={parsed.number || ""}
                onChange={e => onChange({ ...parsed, number: e.target.value })}
                style={{ ...inputStyle, flex: 1 }}
                onFocus={e => { e.target.style.borderColor = style.accentColor }}
                onBlur={e => { e.target.style.borderColor = "#d1d5db" }}
            />
        </div>
    )
}

// ── Full Name ────────────────────────────────────────────────────────────────

const NAME_PREFIXES = ["Mr.", "Mrs.", "Ms.", "Dr.", "Prof."]

function FullNameField({ field, style, inputStyle, value, onChange }: { field: FormField; style: FormStyle; inputStyle: React.CSSProperties; value: any; onChange: (v: any) => void }) {
    const parts = typeof value === "object" && value ? value : {}
    const fields = field.nameFields || ["first", "last"]
    const update = (key: string, val: string) => onChange({ ...parts, [key]: val })

    return (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {fields.includes("prefix") && (
                <select value={parts.prefix || ""} onChange={e => update("prefix", e.target.value)} style={{ ...inputStyle, width: "90px", flex: "none" }}>
                    <option value="">Prefix</option>
                    {NAME_PREFIXES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
            )}
            {fields.includes("first") && (
                <input placeholder="First Name" value={parts.first || ""} onChange={e => update("first", e.target.value)}
                    style={{ ...inputStyle, flex: 1, minWidth: "120px" }}
                    onFocus={e => { e.target.style.borderColor = style.accentColor }}
                    onBlur={e => { e.target.style.borderColor = "#d1d5db" }} />
            )}
            {fields.includes("middle") && (
                <input placeholder="Middle" value={parts.middle || ""} onChange={e => update("middle", e.target.value)}
                    style={{ ...inputStyle, flex: 1, minWidth: "100px" }}
                    onFocus={e => { e.target.style.borderColor = style.accentColor }}
                    onBlur={e => { e.target.style.borderColor = "#d1d5db" }} />
            )}
            {fields.includes("last") && (
                <input placeholder="Last Name" value={parts.last || ""} onChange={e => update("last", e.target.value)}
                    style={{ ...inputStyle, flex: 1, minWidth: "120px" }}
                    onFocus={e => { e.target.style.borderColor = style.accentColor }}
                    onBlur={e => { e.target.style.borderColor = "#d1d5db" }} />
            )}
            {fields.includes("suffix") && (
                <input placeholder="Suffix" value={parts.suffix || ""} onChange={e => update("suffix", e.target.value)}
                    style={{ ...inputStyle, width: "80px", flex: "none" }}
                    onFocus={e => { e.target.style.borderColor = style.accentColor }}
                    onBlur={e => { e.target.style.borderColor = "#d1d5db" }} />
            )}
        </div>
    )
}

// ── Address ──────────────────────────────────────────────────────────────────

function AddressField({ field, style, inputStyle, value, onChange }: { field: FormField; style: FormStyle; inputStyle: React.CSSProperties; value: any; onChange: (v: any) => void }) {
    const parts = typeof value === "object" && value ? value : {}
    const fields = field.addressFields || ["street", "city", "state", "zip", "country"]
    const update = (key: string, val: string) => onChange({ ...parts, [key]: val })

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {fields.includes("street") && (
                <input placeholder="Street Address" value={parts.street || ""} onChange={e => update("street", e.target.value)}
                    style={inputStyle}
                    onFocus={e => { e.target.style.borderColor = style.accentColor }}
                    onBlur={e => { e.target.style.borderColor = "#d1d5db" }} />
            )}
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {fields.includes("city") && (
                    <input placeholder="City" value={parts.city || ""} onChange={e => update("city", e.target.value)}
                        style={{ ...inputStyle, flex: 2, minWidth: "120px" }}
                        onFocus={e => { e.target.style.borderColor = style.accentColor }}
                        onBlur={e => { e.target.style.borderColor = "#d1d5db" }} />
                )}
                {fields.includes("state") && (
                    <input placeholder="State" value={parts.state || ""} onChange={e => update("state", e.target.value)}
                        style={{ ...inputStyle, flex: 1, minWidth: "80px" }}
                        onFocus={e => { e.target.style.borderColor = style.accentColor }}
                        onBlur={e => { e.target.style.borderColor = "#d1d5db" }} />
                )}
                {fields.includes("zip") && (
                    <input placeholder="ZIP" value={parts.zip || ""} onChange={e => update("zip", e.target.value)}
                        style={{ ...inputStyle, width: "100px", flex: "none" }}
                        onFocus={e => { e.target.style.borderColor = style.accentColor }}
                        onBlur={e => { e.target.style.borderColor = "#d1d5db" }} />
                )}
            </div>
            {fields.includes("country") && (
                <input placeholder="Country" value={parts.country || ""} onChange={e => update("country", e.target.value)}
                    style={inputStyle}
                    onFocus={e => { e.target.style.borderColor = style.accentColor }}
                    onBlur={e => { e.target.style.borderColor = "#d1d5db" }} />
            )}
        </div>
    )
}

// ── File Upload (placeholder for Phase 3 backend) ────────────────────────────

function FileUploadField({ field, style, inputStyle, value, onChange }: { field: FormField; style: FormStyle; inputStyle: React.CSSProperties; value: any; onChange: (v: any) => void }) {
    return (
        <div style={{
            border: `2px dashed ${style.accentColor}30`,
            borderRadius: BORDER_RADIUS_MAP[style.borderRadius],
            padding: "24px",
            textAlign: "center",
            cursor: "pointer",
        }}>
            <input
                type="file"
                onChange={e => {
                    const files = e.target.files
                    if (files?.length) onChange(Array.from(files).map(f => f.name))
                }}
                multiple={field.validation?.maxFiles !== 1}
                accept={field.validation?.allowedFileTypes?.join(",")}
                style={{ display: "none" }}
                id={`file-${field.id}`}
            />
            <label htmlFor={`file-${field.id}`} style={{ cursor: "pointer" }}>
                <p style={{ color: style.accentColor, fontWeight: 600, fontSize: "14px", fontFamily: style.fontFamily }}>
                    Click to upload
                </p>
                <p style={{ color: "#9ca3af", fontSize: "12px", marginTop: "4px", fontFamily: style.fontFamily }}>
                    {field.validation?.allowedFileTypes?.join(", ") || "Any file"} · Max {field.validation?.maxFileSize ? `${Math.round(field.validation.maxFileSize / 1048576)}MB` : "25MB"}
                </p>
            </label>
            {Array.isArray(value) && value.length > 0 && (
                <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "4px" }}>
                    {value.map((name: string, i: number) => (
                        <span key={i} style={{ fontSize: "12px", color: style.textColor }}>{name}</span>
                    ))}
                </div>
            )}
        </div>
    )
}

// ── Signature (canvas placeholder — full implementation in Phase 3) ──────────

function SignatureField({ field, style, value, onChange }: { field: FormField; style: FormStyle; value: any; onChange: (v: any) => void }) {
    return (
        <SignaturePad
            value={value}
            onChange={onChange}
            accentColor={style.accentColor}
            borderRadius={BORDER_RADIUS_MAP[style.borderRadius]}
        />
    )
}
