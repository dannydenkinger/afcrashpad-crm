/**
 * AI provider routing types.
 *
 * Each "feature" in the CRM that calls an LLM gets a stable id. The
 * workspace's settings/integrations.ai_routing doc maps feature → provider
 * → model so different features can use different providers without
 * call-site branching.
 *
 * GoHighLevel ties everything to OpenAI behind a credit system. Vesta
 * lets the customer pick per-feature: e.g., "use cheap GPT-4o-mini for
 * blog drafts but Claude Sonnet 4.6 for the assistant."
 */

export type AIProvider = "anthropic" | "openai" | "gemini"

/** Stable identifiers for every place in the CRM that calls an LLM. */
export type AIFeature =
    | "assistant"               // In-app AI chat assistant
    | "blog_generation"         // Blog post writer
    | "automation_email"        // AI Send Email automation step
    | "automation_classify"     // AI Classify automation node
    | "automation_score"        // AI Lead Score automation node
    | "automation_summarize"    // AI Summarize automation node
    | "haro_reply"              // HARO journalist-pitch reply drafter
    | "inline_email_writer"     // "✨ Write with AI" in email composer
    | "inline_sms_writer"       // "✨ Write with AI" in SMS composer
    | "subject_line"            // Email subject line generator
    | "deal_summary"            // One-click deal history summary
    | "next_step_suggestion"    // Suggest next action on a stale deal

export interface AIFeatureMeta {
    feature: AIFeature
    label: string
    description: string
    /** Reasonable default per provider — used when the workspace hasn't
     *  customized this feature's model yet. */
    defaultModel: Record<AIProvider, string>
}

/**
 * Curated list of every AI feature, with display copy + sensible defaults
 * per provider. The settings UI iterates this to render the routing table.
 *
 * Adding a feature: append to this list, set defaultModel for both providers,
 * and call runAI({ feature: ... }) from the call site.
 */
export const AI_FEATURES: AIFeatureMeta[] = [
    {
        feature: "assistant",
        label: "AI Assistant",
        description: "The chat assistant in the bottom-right corner. Tool-using; Anthropic only today (OpenAI tools coming).",
        defaultModel: { anthropic: "claude-haiku-4-5", openai: "gpt-4o-mini", gemini: "gemini-2.5-flash" },
    },
    {
        feature: "blog_generation",
        label: "Blog content generation",
        description: "Long-form blog drafts. Quality matters more than speed here.",
        defaultModel: { anthropic: "claude-sonnet-4-6", openai: "gpt-4o", gemini: "gemini-2.5-pro" },
    },
    {
        feature: "automation_email",
        label: "Automation: AI Send Email",
        description: "The AI-generated email body in workflows.",
        defaultModel: { anthropic: "claude-haiku-4-5", openai: "gpt-4o-mini", gemini: "gemini-2.5-flash" },
    },
    {
        feature: "automation_classify",
        label: "Automation: AI Classify",
        description: "Tag a contact based on their data (e.g., \"hot lead\" / \"stale\").",
        defaultModel: { anthropic: "claude-haiku-4-5", openai: "gpt-4o-mini", gemini: "gemini-2.5-flash" },
    },
    {
        feature: "automation_score",
        label: "Automation: AI Lead Score",
        description: "Produce a 0-100 lead score from contact + activity data.",
        defaultModel: { anthropic: "claude-haiku-4-5", openai: "gpt-4o-mini", gemini: "gemini-2.5-flash" },
    },
    {
        feature: "automation_summarize",
        label: "Automation: AI Summarize",
        description: "Collapse long text fields into a short summary.",
        defaultModel: { anthropic: "claude-haiku-4-5", openai: "gpt-4o-mini", gemini: "gemini-2.5-flash" },
    },
    {
        feature: "haro_reply",
        label: "HARO reply drafts",
        description: "Drafts journalist pitches when a HARO query matches your expertise.",
        defaultModel: { anthropic: "claude-sonnet-4-6", openai: "gpt-4o", gemini: "gemini-2.5-pro" },
    },
    {
        feature: "inline_email_writer",
        label: "Email composer (✨ Write with AI)",
        description: "Inline AI button in the email composer.",
        defaultModel: { anthropic: "claude-haiku-4-5", openai: "gpt-4o-mini", gemini: "gemini-2.5-flash" },
    },
    {
        feature: "inline_sms_writer",
        label: "SMS composer (✨ Write with AI)",
        description: "Inline AI button in the SMS composer. Constrained to under 160 chars.",
        defaultModel: { anthropic: "claude-haiku-4-5", openai: "gpt-4o-mini", gemini: "gemini-2.5-flash" },
    },
    {
        feature: "subject_line",
        label: "Email subject line generator",
        description: "Generates 3 A/B subject-line variants for marketing emails.",
        defaultModel: { anthropic: "claude-haiku-4-5", openai: "gpt-4o-mini", gemini: "gemini-2.5-flash" },
    },
    {
        feature: "deal_summary",
        label: "Deal summary",
        description: "One-click summary of a deal's history (notes + emails + tasks).",
        defaultModel: { anthropic: "claude-haiku-4-5", openai: "gpt-4o-mini", gemini: "gemini-2.5-flash" },
    },
    {
        feature: "next_step_suggestion",
        label: "Next-step suggestions",
        description: "Suggest a follow-up email / call when a deal goes stale.",
        defaultModel: { anthropic: "claude-haiku-4-5", openai: "gpt-4o-mini", gemini: "gemini-2.5-flash" },
    },
]

/** Curated model list per provider. Friendly labels for the dropdown.
 *  Customers needing a model not on this list use the "Custom" option. */
export const MODEL_OPTIONS: Record<AIProvider, { id: string; label: string; tier: "fast" | "balanced" | "premium" }[]> = {
    anthropic: [
        { id: "claude-haiku-4-5", label: "Claude Haiku 4.5 — fastest, cheapest", tier: "fast" },
        { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6 — balanced", tier: "balanced" },
        { id: "claude-opus-4-7", label: "Claude Opus 4.7 — premium quality", tier: "premium" },
    ],
    openai: [
        { id: "gpt-4o-mini", label: "GPT-4o mini — fastest, cheapest", tier: "fast" },
        { id: "gpt-4o", label: "GPT-4o — balanced", tier: "balanced" },
        { id: "gpt-5", label: "GPT-5 — premium quality", tier: "premium" },
    ],
    gemini: [
        { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash — fastest, cheapest", tier: "fast" },
        { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro — balanced", tier: "balanced" },
        { id: "gemini-2.0-pro", label: "Gemini 2.0 Pro — long-context", tier: "premium" },
    ],
}

/** Per-feature routing record stored on settings/integrations.ai_routing. */
export interface AIFeatureRoute {
    provider: AIProvider
    /** Empty string means "use the default for the chosen provider". */
    model: string
}

export type AIRoutingMap = Partial<Record<AIFeature, AIFeatureRoute>>
