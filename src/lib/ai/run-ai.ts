import Anthropic from "@anthropic-ai/sdk"
import OpenAI from "openai"
import { GoogleGenAI } from "@google/genai"
import { tenantDb } from "@/lib/tenant-db"
import { adminDb } from "@/lib/firebase-admin"
import { getAnthropicKey } from "./get-anthropic-key"
import { getOpenAIKey } from "./get-openai-key"
import { getGeminiKey } from "./get-gemini-key"
import { AI_FEATURES, MODEL_OPTIONS, type AIFeature, type AIProvider, type AIRoutingMap } from "./types"

/**
 * Single entry point for every AI call in the CRM.
 *
 * Resolves at call time:
 *   1. Which provider is configured for this feature (workspace setting)
 *   2. Which model that provider should use
 *   3. Which API key (per-workspace > env-var fallback)
 *
 * Then dispatches to the right SDK and normalizes the response so callers
 * get a single shape regardless of provider.
 *
 * Usage tracking: every successful call writes a row to ai_usage_logs
 * with workspace, feature, provider, model, and rough token counts so
 * admins can see "we spent X on AI this month, mostly from feature Y."
 */

// ── Public API ──────────────────────────────────────────────────────────

export interface RunAIInput {
    workspaceId: string
    feature: AIFeature
    /** System prompt — instructions to the model. Defines tone/output format. */
    system?: string
    /** User-facing prompt — the actual content to act on. */
    prompt: string
    /** Conversation history if multi-turn. Optional; defaults to single-turn. */
    messages?: Array<{ role: "user" | "assistant"; content: string }>
    /** Cap on output tokens. Defaults to 1024. */
    maxTokens?: number
    /** Temperature. Defaults to 0.7 (match Anthropic's typical default). */
    temperature?: number
}

export interface RunAIResult {
    text: string
    provider: AIProvider
    model: string
    /** Token counts when the SDK reports them. May be 0 if usage data unavailable. */
    inputTokens: number
    outputTokens: number
}

export class AIKeyMissingError extends Error {
    constructor(public readonly provider: AIProvider) {
        super(`No API key configured for ${provider}. Add it in Settings → Integrations.`)
        this.name = "AIKeyMissingError"
    }
}

/**
 * Execute an AI call. Throws AIKeyMissingError if the routed provider
 * has no key (workspace OR env). Other errors propagate from the SDK.
 */
export async function runAI(input: RunAIInput): Promise<RunAIResult> {
    const { workspaceId, feature, system, prompt, messages, maxTokens = 1024, temperature = 0.7 } = input

    const route = await resolveRoute(workspaceId, feature)
    const startedAt = Date.now()

    let result: RunAIResult
    if (route.provider === "anthropic") {
        result = await runAnthropic(workspaceId, route.model, system, prompt, messages, maxTokens, temperature)
    } else if (route.provider === "openai") {
        result = await runOpenAI(workspaceId, route.model, system, prompt, messages, maxTokens, temperature)
    } else {
        result = await runGemini(workspaceId, route.model, system, prompt, messages, maxTokens, temperature)
    }

    // Log usage in the background — don't block the caller waiting on this
    void recordUsage({
        workspaceId,
        feature,
        provider: result.provider,
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        durationMs: Date.now() - startedAt,
    })

    return result
}

// ── Routing resolution ──────────────────────────────────────────────────

interface ResolvedRoute {
    provider: AIProvider
    model: string
}

async function resolveRoute(workspaceId: string, feature: AIFeature): Promise<ResolvedRoute> {
    let routing: AIRoutingMap = {}
    try {
        const db = tenantDb(workspaceId)
        const doc = await db.settingsDoc("integrations").get()
        const data = doc.exists ? doc.data() : null
        if (data?.ai_routing && typeof data.ai_routing === "object") {
            routing = data.ai_routing as AIRoutingMap
        }
    } catch {
        // Fall through to defaults
    }

    const meta = AI_FEATURES.find((f) => f.feature === feature)
    if (!meta) {
        // Should never happen at runtime if callers use the AIFeature type
        return { provider: "anthropic", model: "claude-haiku-4-5" }
    }

    const route = routing[feature]
    const provider: AIProvider = route?.provider || "anthropic"
    const model = route?.model && route.model.trim() ? route.model.trim() : meta.defaultModel[provider]
    return { provider, model }
}

// ── Provider adapters ───────────────────────────────────────────────────

async function runAnthropic(
    workspaceId: string,
    model: string,
    system: string | undefined,
    prompt: string,
    messages: Array<{ role: "user" | "assistant"; content: string }> | undefined,
    maxTokens: number,
    temperature: number,
): Promise<RunAIResult> {
    const apiKey = await getAnthropicKey(workspaceId)
    if (!apiKey) throw new AIKeyMissingError("anthropic")

    const client = new Anthropic({ apiKey })
    const finalMessages: Anthropic.Messages.MessageParam[] = messages
        ? messages.map((m) => ({ role: m.role, content: m.content }))
        : [{ role: "user", content: prompt }]

    const res = await client.messages.create({
        model,
        max_tokens: maxTokens,
        temperature,
        ...(system ? { system } : {}),
        messages: finalMessages,
    })

    const text = res.content
        .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("")

    return {
        text,
        provider: "anthropic",
        model,
        inputTokens: res.usage?.input_tokens ?? 0,
        outputTokens: res.usage?.output_tokens ?? 0,
    }
}

async function runOpenAI(
    workspaceId: string,
    model: string,
    system: string | undefined,
    prompt: string,
    messages: Array<{ role: "user" | "assistant"; content: string }> | undefined,
    maxTokens: number,
    temperature: number,
): Promise<RunAIResult> {
    const apiKey = await getOpenAIKey(workspaceId)
    if (!apiKey) throw new AIKeyMissingError("openai")

    const client = new OpenAI({ apiKey })
    const finalMessages: OpenAI.Chat.ChatCompletionMessageParam[] = []
    if (system) finalMessages.push({ role: "system", content: system })
    if (messages) {
        for (const m of messages) finalMessages.push({ role: m.role, content: m.content })
    } else {
        finalMessages.push({ role: "user", content: prompt })
    }

    const res = await client.chat.completions.create({
        model,
        messages: finalMessages,
        max_completion_tokens: maxTokens,
        temperature,
    })

    const text = res.choices[0]?.message?.content ?? ""

    return {
        text,
        provider: "openai",
        model,
        inputTokens: res.usage?.prompt_tokens ?? 0,
        outputTokens: res.usage?.completion_tokens ?? 0,
    }
}

async function runGemini(
    workspaceId: string,
    model: string,
    system: string | undefined,
    prompt: string,
    messages: Array<{ role: "user" | "assistant"; content: string }> | undefined,
    maxTokens: number,
    temperature: number,
): Promise<RunAIResult> {
    const apiKey = await getGeminiKey(workspaceId)
    if (!apiKey) throw new AIKeyMissingError("gemini")

    const client = new GoogleGenAI({ apiKey })
    // Gemini's contents shape uses parts inside each turn; assistant turns
    // are represented with role "model". Map our normalized messages to
    // that shape, falling back to a single-turn user message.
    const contents = messages
        ? messages.map((m) => ({
              role: m.role === "assistant" ? "model" : "user",
              parts: [{ text: m.content }],
          }))
        : [{ role: "user", parts: [{ text: prompt }] }]

    const res = await client.models.generateContent({
        model,
        contents,
        config: {
            ...(system ? { systemInstruction: system } : {}),
            maxOutputTokens: maxTokens,
            temperature,
        },
    })

    // The SDK exposes the assembled text via `.text` on the response.
    // Fall back to walking candidates if that ever returns undefined.
    const text =
        (res.text as string | undefined) ||
        (res.candidates?.[0]?.content?.parts || [])
            .map((p: any) => (typeof p.text === "string" ? p.text : ""))
            .join("") ||
        ""

    return {
        text,
        provider: "gemini",
        model,
        inputTokens: res.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: res.usageMetadata?.candidatesTokenCount ?? 0,
    }
}

// ── Usage logging ───────────────────────────────────────────────────────

interface UsageRecord {
    workspaceId: string
    feature: AIFeature
    provider: AIProvider
    model: string
    inputTokens: number
    outputTokens: number
    durationMs: number
}

async function recordUsage(rec: UsageRecord): Promise<void> {
    try {
        // Per-workspace subcollection so the data is naturally tenant-scoped
        // and a workspace delete cleans up its own logs.
        await adminDb
            .collection("workspaces")
            .doc(rec.workspaceId)
            .collection("ai_usage_logs")
            .add({
                ...rec,
                createdAt: new Date(),
            })
    } catch (err) {
        console.error("[ai] Failed to record usage:", err)
    }
}

// Re-export the curated model list so settings UI can render it without
// importing types directly.
export { AI_FEATURES, MODEL_OPTIONS }
