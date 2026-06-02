// ── Field Types ──────────────────────────────────────────────────────────────

export type FieldType =
    | "short_text" | "long_text" | "email" | "phone" | "number"
    | "dropdown" | "radio" | "checkbox" | "date" | "header" | "hidden"
    | "file_upload" | "signature" | "rating" | "scale" | "address"
    | "full_name" | "time" | "divider" | "image" | "rich_text" | "phone_intl"

// ── Validation ───────────────────────────────────────────────────────────────

export interface FieldValidation {
    minLength?: number
    maxLength?: number
    min?: number
    max?: number
    pattern?: string
    customMessage?: string
    allowedFileTypes?: string[]
    maxFileSize?: number
    maxFiles?: number
}

// ── Per-Field Styling ────────────────────────────────────────────────────────

export interface FieldStyle {
    labelColor?: string
    fontSize?: "sm" | "md" | "lg"
    inputHeight?: "sm" | "md" | "lg"
    customCss?: string
    labelPosition?: "top" | "left" | "inline" | "hidden"
}

// ── Conditional Logic ────────────────────────────────────────────────────────

export interface FieldCondition {
    fieldId: string
    operator: "equals" | "not_equals" | "contains" | "not_contains" | "greater_than" | "less_than" | "is_empty" | "is_not_empty"
    value: string
}

export interface ConditionalLogic {
    action: "show" | "hide"
    logicType: "all" | "any"
    conditions: FieldCondition[]
}

// ── Form Field ───────────────────────────────────────────────────────────────

export interface FormField {
    id: string
    type: FieldType
    label: string
    placeholder?: string
    helpText?: string
    required: boolean
    defaultValue?: string
    options?: string[]
    width: "full" | "half"
    // Validation & styling
    validation?: FieldValidation
    fieldStyle?: FieldStyle
    conditionalLogic?: ConditionalLogic
    showCharCount?: boolean
    inputMask?: string
    // Rating
    ratingMax?: number
    // Scale / slider
    scaleMin?: number
    scaleMax?: number
    scaleMinLabel?: string
    scaleMaxLabel?: string
    // Image display
    imageUrl?: string
    imageAlt?: string
    // Rich text display
    richTextContent?: string
    // Address
    addressFields?: ("street" | "city" | "state" | "zip" | "country")[]
    // Full name
    nameFields?: ("prefix" | "first" | "middle" | "last" | "suffix")[]
    // International phone
    phoneCountryDefault?: string
}

// ── Form Page (multi-step) ───────────────────────────────────────────────────

export interface FormPage {
    id: string
    title?: string
    description?: string
    fields: FormField[]
}

// ── Form Style ───────────────────────────────────────────────────────────────

export interface FormStyle {
    // Header
    logoUrl?: string | null
    headerImageUrl?: string | null
    title: string
    description?: string
    // Colors
    backgroundColor: string
    accentColor: string
    textColor: string
    fontFamily: string
    // Background
    backgroundImageUrl?: string
    backgroundOverlayOpacity?: number
    backgroundGradient?: {
        direction: "to-bottom" | "to-right" | "to-bottom-right"
        color1: string
        color2: string
    }
    // Container
    containerWidth?: number
    containerWidthUnit?: "px" | "%"
    formPadding?: number
    fieldSpacing?: number
    // Button
    buttonText: string
    buttonColor: string
    buttonTextColor: string
    buttonHoverColor?: string
    buttonAlignment?: "left" | "center" | "right" | "full"
    buttonWidth?: "auto" | "full"
    // Shape
    borderRadius: "none" | "sm" | "md" | "lg" | "full"
    // After submission
    successMessage: string
    redirectUrl?: string | null
    // Layout
    layout: "single" | "two-column"
    // Custom CSS
    customCss?: string
    // Theme
    theme?: string
    // Progress bar (multi-step)
    progressBarColor?: string
    progressBarStyle?: "bar" | "dots" | "steps"
}

// ── Lead Form (complete document) ────────────────────────────────────────────

export interface LeadForm {
    id: string
    workspaceId: string
    name: string
    slug: string
    status: "active" | "inactive"
    apiKeyHash: string
    apiKeyPrefix: string
    // Fields (single page) or Pages (multi-step)
    fields: FormField[]
    pages?: FormPage[]
    isMultiStep?: boolean
    showReviewPage?: boolean
    // Styling
    style: FormStyle
    // Stats
    submissionCount: number
    viewCount?: number
    // Spam
    spamProtection?: {
        honeypot: boolean
        recaptchaEnabled: boolean
        recaptchaSiteKey?: string
        submissionCooldownMinutes?: number
    }
    // Notifications
    notifications?: {
        adminEmailEnabled: boolean
        adminEmailAddresses?: string[]
        autoresponderEnabled: boolean
        autoresponderSubject?: string
        autoresponderBody?: string
    }
    // Page skip logic (multi-step)
    pageSkipLogic?: {
        fromPageId: string
        toPageId: string
        logicType: "all" | "any"
        conditions: FieldCondition[]
    }[]
    // Metadata
    createdAt: string
    updatedAt: string
}

// ── Field Type Config ────────────────────────────────────────────────────────

export const FIELD_TYPE_CONFIG: Record<FieldType, { label: string; icon: string; defaultLabel: string; category: string }> = {
    // Input
    short_text:  { label: "Short Text",       icon: "Type",         defaultLabel: "Text Field",         category: "Input" },
    long_text:   { label: "Long Text",        icon: "AlignLeft",    defaultLabel: "Message",            category: "Input" },
    email:       { label: "Email",            icon: "Mail",         defaultLabel: "Email Address",      category: "Input" },
    phone:       { label: "Phone",            icon: "Phone",        defaultLabel: "Phone Number",       category: "Input" },
    phone_intl:  { label: "Phone (Intl)",     icon: "Globe",        defaultLabel: "Phone Number",       category: "Input" },
    number:      { label: "Number",           icon: "Hash",         defaultLabel: "Number",             category: "Input" },
    date:        { label: "Date",             icon: "Calendar",     defaultLabel: "Date",               category: "Input" },
    time:        { label: "Time",             icon: "Clock",        defaultLabel: "Time",               category: "Input" },
    full_name:   { label: "Full Name",        icon: "User",         defaultLabel: "Name",               category: "Input" },
    address:     { label: "Address",          icon: "MapPin",       defaultLabel: "Address",            category: "Input" },
    // Choice
    dropdown:    { label: "Dropdown",         icon: "ChevronDown",  defaultLabel: "Select an option",   category: "Choice" },
    radio:       { label: "Multiple Choice",  icon: "Circle",       defaultLabel: "Choose one",         category: "Choice" },
    checkbox:    { label: "Checkboxes",       icon: "CheckSquare",  defaultLabel: "Select all that apply", category: "Choice" },
    rating:      { label: "Rating",           icon: "Star",         defaultLabel: "Rating",             category: "Choice" },
    scale:       { label: "Scale",            icon: "SlidersHorizontal", defaultLabel: "How likely?",   category: "Choice" },
    // Layout
    header:      { label: "Section Header",   icon: "Heading",      defaultLabel: "Section Title",      category: "Layout" },
    divider:     { label: "Divider",          icon: "Minus",        defaultLabel: "",                   category: "Layout" },
    image:       { label: "Image",            icon: "Image",        defaultLabel: "",                   category: "Layout" },
    rich_text:   { label: "Text Block",       icon: "FileText",     defaultLabel: "",                   category: "Layout" },
    // Advanced
    file_upload: { label: "File Upload",      icon: "Upload",       defaultLabel: "Upload File",        category: "Advanced" },
    signature:   { label: "Signature",        icon: "PenTool",      defaultLabel: "Signature",          category: "Advanced" },
    hidden:      { label: "Hidden Field",     icon: "EyeOff",       defaultLabel: "hidden_field",       category: "Advanced" },
}

// ── Font Options ─────────────────────────────────────────────────────────────

export const FONT_OPTIONS = [
    { value: "Inter, system-ui, sans-serif", label: "Inter" },
    { value: "system-ui, -apple-system, sans-serif", label: "System Default" },
    { value: "'Georgia', serif", label: "Georgia" },
    { value: "'Helvetica Neue', Helvetica, Arial, sans-serif", label: "Helvetica" },
    { value: "'Playfair Display', serif", label: "Playfair Display" },
    { value: "'DM Sans', sans-serif", label: "DM Sans" },
    { value: "'Space Grotesk', sans-serif", label: "Space Grotesk" },
    { value: "'JetBrains Mono', monospace", label: "JetBrains Mono" },
    { value: "'Lora', serif", label: "Lora" },
    { value: "'Poppins', sans-serif", label: "Poppins" },
]

// ── Border Radius Map ────────────────────────────────────────────────────────

export const BORDER_RADIUS_MAP: Record<FormStyle["borderRadius"], string> = {
    none: "0px",
    sm: "4px",
    md: "8px",
    lg: "12px",
    full: "9999px",
}

// ── Font Size Map ────────────────────────────────────────────────────────────

export const FONT_SIZE_MAP: Record<NonNullable<FieldStyle["fontSize"]>, string> = {
    sm: "12px",
    md: "14px",
    lg: "16px",
}

export const INPUT_HEIGHT_MAP: Record<NonNullable<FieldStyle["inputHeight"]>, string> = {
    sm: "36px",
    md: "42px",
    lg: "50px",
}

// ── Preset Themes ────────────────────────────────────────────────────────────

export const FORM_THEMES: { id: string; name: string; preview: string; style: Partial<FormStyle> }[] = [
    {
        id: "clean", name: "Clean White", preview: "#ffffff",
        style: { backgroundColor: "#ffffff", textColor: "#1f2937", accentColor: "#2563eb", buttonColor: "#2563eb", buttonTextColor: "#ffffff", borderRadius: "md" },
    },
    {
        id: "dark", name: "Dark Mode", preview: "#111827",
        style: { backgroundColor: "#111827", textColor: "#f9fafb", accentColor: "#818cf8", buttonColor: "#6366f1", buttonTextColor: "#ffffff", borderRadius: "lg" },
    },
    {
        id: "warm", name: "Warm Sand", preview: "#fef7ed",
        style: { backgroundColor: "#fef7ed", textColor: "#451a03", accentColor: "#ea580c", buttonColor: "#ea580c", buttonTextColor: "#ffffff", borderRadius: "md" },
    },
    {
        id: "ocean", name: "Ocean Blue", preview: "#eff6ff",
        style: { backgroundColor: "#eff6ff", textColor: "#1e3a5f", accentColor: "#0284c7", buttonColor: "#0284c7", buttonTextColor: "#ffffff", borderRadius: "lg" },
    },
    {
        id: "forest", name: "Forest", preview: "#f0fdf4",
        style: { backgroundColor: "#f0fdf4", textColor: "#14532d", accentColor: "#16a34a", buttonColor: "#16a34a", buttonTextColor: "#ffffff", borderRadius: "md" },
    },
    {
        id: "minimal", name: "Minimal Gray", preview: "#f9fafb",
        style: { backgroundColor: "#f9fafb", textColor: "#374151", accentColor: "#374151", buttonColor: "#111827", buttonTextColor: "#ffffff", borderRadius: "sm" },
    },
    {
        id: "sunset", name: "Sunset", preview: "#fdf2f8",
        style: { backgroundColor: "#fdf2f8", textColor: "#831843", accentColor: "#db2777", buttonColor: "#db2777", buttonTextColor: "#ffffff", borderRadius: "full" },
    },
    {
        id: "slate", name: "Slate Pro", preview: "#1e293b",
        style: { backgroundColor: "#1e293b", textColor: "#e2e8f0", accentColor: "#38bdf8", buttonColor: "#0ea5e9", buttonTextColor: "#ffffff", borderRadius: "md" },
    },
]
