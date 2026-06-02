import type { FormField } from "@/app/settings/lead-forms/types"
import { randomUUID } from "crypto"

/**
 * Pre-filled form templates shown when creating a new lead form.
 * Each starter is a name + description + an array of FormField — the
 * style and notification config get filled in by createLeadForm() with
 * sensible defaults derived from workspace branding.
 *
 * Adding a starter:
 *   1. Append an entry to FORM_STARTERS below.
 *   2. Use field type IDs that exist in FIELD_TYPE_CONFIG (types.ts).
 *   3. Field IDs are stable strings — they're regenerated per-form when
 *      the starter is applied, so use simple slugs here.
 */

export interface FormStarter {
    id: string
    name: string
    description: string
    /** Lucide icon name shown in the picker tile. */
    icon: string
    /** Used to color the icon background tile. */
    accent: "primary" | "emerald" | "blue" | "violet" | "amber" | "rose" | "sky"
    /** What the form should be named when this starter is applied. */
    defaultName: string
    /** Header title shown above the form when published. */
    headerTitle: string
    /** Subtitle shown above the form when published. */
    headerDescription: string
    /** Submit button copy. */
    buttonText: string
    /** Success message shown after submit. */
    successMessage: string
    fields: Omit<FormField, "id">[]
}

const f = <T extends Omit<FormField, "id">>(field: T): T => field

export const FORM_STARTERS: FormStarter[] = [
    {
        id: "blank",
        name: "Blank",
        description: "Start from scratch — drag fields in from the palette.",
        icon: "FileText",
        accent: "primary",
        defaultName: "Untitled form",
        headerTitle: "Contact us",
        headerDescription: "Fill out the form below and we'll get back to you shortly.",
        buttonText: "Submit",
        successMessage: "Thank you! We've received your submission and will be in touch soon.",
        fields: [],
    },
    {
        id: "contact",
        name: "Contact us",
        description: "Name, email, message — the classic.",
        icon: "Mail",
        accent: "blue",
        defaultName: "Contact form",
        headerTitle: "Get in touch",
        headerDescription: "Send us a message and we'll respond within one business day.",
        buttonText: "Send message",
        successMessage: "Thanks for reaching out — we'll be in touch shortly.",
        fields: [
            f({ type: "full_name", label: "Your name", required: true, width: "full", nameFields: ["first", "last"] as any }),
            f({ type: "email", label: "Email", required: true, width: "full" }),
            f({ type: "long_text", label: "How can we help?", required: true, width: "full", placeholder: "Tell us what you're looking for…" }),
        ],
    },
    {
        id: "lead-capture",
        name: "Lead capture",
        description: "Higher-intent: name, work email, phone, company, message.",
        icon: "Sparkles",
        accent: "violet",
        defaultName: "Lead capture form",
        headerTitle: "Let's talk",
        headerDescription: "Tell us a bit about you — we'll loop in the right person on our team.",
        buttonText: "Request a call",
        successMessage: "Got it. Someone from our team will reach out within one business day.",
        fields: [
            f({ type: "full_name", label: "Name", required: true, width: "full", nameFields: ["first", "last"] as any }),
            f({ type: "email", label: "Work email", required: true, width: "half" }),
            f({ type: "phone", label: "Phone", required: false, width: "half" }),
            f({ type: "short_text", label: "Company", required: true, width: "full" }),
            f({ type: "long_text", label: "What are you looking to solve?", required: false, width: "full", placeholder: "Optional — anything that helps us prepare." }),
        ],
    },
    {
        id: "newsletter",
        name: "Newsletter signup",
        description: "Email-first, name optional. Quick to fill.",
        icon: "AtSign",
        accent: "emerald",
        defaultName: "Newsletter signup",
        headerTitle: "Subscribe",
        headerDescription: "Get product updates, tips, and the occasional case study — about once a month.",
        buttonText: "Subscribe",
        successMessage: "You're in. Check your inbox for a confirmation email.",
        fields: [
            f({ type: "email", label: "Email", required: true, width: "full" }),
            f({ type: "short_text", label: "First name", required: false, width: "full", placeholder: "Optional" }),
        ],
    },
    {
        id: "event-rsvp",
        name: "Event RSVP",
        description: "Attendance, dietary preferences, plus-one.",
        icon: "Calendar",
        accent: "amber",
        defaultName: "Event RSVP",
        headerTitle: "RSVP",
        headerDescription: "Let us know if you can make it.",
        buttonText: "Send RSVP",
        successMessage: "Thanks for the RSVP — we'll see you there!",
        fields: [
            f({ type: "full_name", label: "Your name", required: true, width: "full", nameFields: ["first", "last"] as any }),
            f({ type: "email", label: "Email", required: true, width: "full" }),
            f({ type: "radio", label: "Will you be attending?", required: true, width: "full", options: ["Yes, I'll be there", "Sorry, can't make it"] }),
            f({ type: "checkbox", label: "Dietary preferences", required: false, width: "full", options: ["Vegetarian", "Vegan", "Gluten-free", "No restrictions"] }),
            f({ type: "short_text", label: "Bringing a plus-one?", required: false, width: "full", placeholder: "Their name (optional)" }),
        ],
    },
    {
        id: "quote-request",
        name: "Quote request",
        description: "Project scope, budget, timeline — qualifies leads.",
        icon: "DollarSign",
        accent: "sky",
        defaultName: "Quote request",
        headerTitle: "Request a quote",
        headerDescription: "A few quick details so we can put together accurate pricing.",
        buttonText: "Request quote",
        successMessage: "Thanks! We'll review and get back to you with a quote within two business days.",
        fields: [
            f({ type: "full_name", label: "Name", required: true, width: "full", nameFields: ["first", "last"] as any }),
            f({ type: "email", label: "Email", required: true, width: "half" }),
            f({ type: "phone", label: "Phone", required: false, width: "half" }),
            f({ type: "short_text", label: "Company", required: false, width: "full" }),
            f({ type: "long_text", label: "Describe the project", required: true, width: "full", placeholder: "What needs to get built or done?" }),
            f({ type: "dropdown", label: "Approximate budget", required: false, width: "half", options: ["Under $1,000", "$1,000 – $5,000", "$5,000 – $25,000", "$25,000 – $100,000", "$100,000+", "Not sure yet"] }),
            f({ type: "dropdown", label: "Ideal timeline", required: false, width: "half", options: ["ASAP", "Within 1 month", "1 – 3 months", "3 – 6 months", "Flexible / no rush"] }),
        ],
    },
    {
        id: "job-application",
        name: "Job application",
        description: "Name, role, resume upload, cover letter, links.",
        icon: "Briefcase",
        accent: "rose",
        defaultName: "Job application",
        headerTitle: "Apply",
        headerDescription: "Tell us about you. We review every application personally.",
        buttonText: "Submit application",
        successMessage: "Application received. We'll be in touch within a week.",
        fields: [
            f({ type: "full_name", label: "Full name", required: true, width: "full", nameFields: ["first", "last"] as any }),
            f({ type: "email", label: "Email", required: true, width: "half" }),
            f({ type: "phone", label: "Phone", required: false, width: "half" }),
            f({ type: "short_text", label: "Which role are you applying for?", required: true, width: "full" }),
            f({ type: "file_upload", label: "Resume / CV", required: true, width: "full", validation: { maxFiles: 1, maxFileSize: 10 * 1024 * 1024, allowedFileTypes: [".pdf", ".doc", ".docx"] } }),
            f({ type: "long_text", label: "Cover letter", required: false, width: "full", placeholder: "Why this role? Why now?" }),
            f({ type: "short_text", label: "LinkedIn", required: false, width: "half", placeholder: "https://linkedin.com/in/…" }),
            f({ type: "short_text", label: "Portfolio / Website", required: false, width: "half", placeholder: "https://…" }),
        ],
    },
]

/** Apply a starter template to a fresh form — assigns stable field IDs. */
export function getStarterFields(starterId: string): FormField[] {
    const starter = FORM_STARTERS.find((s) => s.id === starterId)
    if (!starter || !starter.fields.length) return []
    return starter.fields.map((field) => ({
        ...field,
        id: randomUUID().replace(/-/g, "").slice(0, 8),
    }))
}

export function getStarter(starterId: string): FormStarter | undefined {
    return FORM_STARTERS.find((s) => s.id === starterId)
}
