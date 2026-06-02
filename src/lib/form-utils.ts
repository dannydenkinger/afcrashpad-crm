import { randomUUID } from "crypto"
import type { FormField, FormStyle, FormPage, LeadForm } from "@/app/settings/lead-forms/types"

export function generateFormId(): string {
    return randomUUID().replace(/-/g, "").slice(0, 12)
}

export function generateSlug(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 60)
}

export function generateFieldId(): string {
    return randomUUID().replace(/-/g, "").slice(0, 8)
}

/**
 * Get all fields from a form, whether single-page or multi-step.
 */
export function getFormFields(form: LeadForm): FormField[] {
    if (form.isMultiStep && form.pages?.length) {
        return form.pages.flatMap(p => p.fields)
    }
    return form.fields
}

/**
 * Get pages from a form. Single-page forms return one page.
 */
export function getFormPages(form: LeadForm): FormPage[] {
    if (form.isMultiStep && form.pages?.length) {
        return form.pages
    }
    return [{ id: "default", fields: form.fields }]
}

export function getDefaultFields(): FormField[] {
    return []
}

export function getDefaultStyle(branding?: {
    companyName?: string
    primaryColor?: string
    logoUrl?: string
}): FormStyle {
    const accent = branding?.primaryColor || "#2563eb"
    return {
        logoUrl: branding?.logoUrl || null,
        title: branding?.companyName ? `Contact ${branding.companyName}` : "Contact Us",
        description: "Fill out the form below and we'll get back to you shortly.",
        backgroundColor: "#ffffff",
        accentColor: accent,
        textColor: "#1f2937",
        fontFamily: "Inter, system-ui, sans-serif",
        buttonText: "Submit",
        buttonColor: accent,
        buttonTextColor: "#ffffff",
        borderRadius: "md",
        successMessage: "Thank you! We've received your submission and will be in touch soon.",
        redirectUrl: null,
        layout: "single",
        fieldSpacing: 20,
        formPadding: 40,
        containerWidth: 560,
        containerWidthUnit: "px",
        buttonAlignment: "full",
        buttonWidth: "full",
        progressBarStyle: "bar",
    }
}

const GOOGLE_FONT_MAP: Record<string, string> = {
    "'Playfair Display', serif": "Playfair+Display:wght@400;600;700",
    "'DM Sans', sans-serif": "DM+Sans:wght@400;500;600;700",
    "'Space Grotesk', sans-serif": "Space+Grotesk:wght@400;500;600;700",
    "'JetBrains Mono', monospace": "JetBrains+Mono:wght@400;500;600",
    "'Lora', serif": "Lora:wght@400;500;600;700",
    "'Poppins', sans-serif": "Poppins:wght@400;500;600;700",
}

export function getGoogleFontUrl(fontFamily: string): string | null {
    const family = GOOGLE_FONT_MAP[fontFamily]
    if (!family) return null
    return `https://fonts.googleapis.com/css2?family=${family}&display=swap`
}
