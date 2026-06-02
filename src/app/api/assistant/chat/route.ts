/**
 * AI assistant chat endpoint. Single-shot per call (not streaming) but
 * loops internally for tool use until Claude returns a final text response.
 *
 * Auth: cookie session (uses requireAuth). Workspace is scoped from session.
 * Body: { messages: [{ role, content }, ...] }
 * Response: { messages: [...input, ...newAssistantMessages] }
 *
 * The system prompt is cache_control:ephemeral so repeat questions in a
 * session reuse the cached prefix.
 */

import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { requireAuth } from "@/lib/auth-guard"
import { runTool, TOOL_DEFS } from "@/lib/assistant/tools"
import { SYSTEM_PROMPT } from "@/lib/assistant/system-prompt"
import { getAnthropicKey } from "@/lib/ai/get-anthropic-key"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const MAX_TOOL_LOOPS = 5
const MODEL = "claude-haiku-4-5"

interface ChatMessage {
    role: "user" | "assistant"
    content: string | Array<unknown>
}

export async function POST(req: NextRequest) {
    const session = await requireAuth()
    const workspaceId = (session.user as { workspaceId: string }).workspaceId

    const apiKey = await getAnthropicKey(workspaceId)
    if (!apiKey) {
        return NextResponse.json(
            { error: "Add your Anthropic API key in Settings → Integrations to enable the AI assistant." },
            { status: 400 },
        )
    }

    let body: { messages?: ChatMessage[] } = {}
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    const inputMessages = body.messages ?? []
    if (inputMessages.length === 0) {
        return NextResponse.json({ error: "messages required" }, { status: 400 })
    }

    const client = new Anthropic({ apiKey })
    // Working copy we append to as we loop
    const conversation: Array<{ role: "user" | "assistant"; content: unknown }> = [
        ...inputMessages.map((m) => ({ role: m.role, content: m.content })),
    ]

    const newMessages: Array<{ role: "assistant"; content: unknown }> = []
    let toolLoops = 0

    while (toolLoops < MAX_TOOL_LOOPS) {
        const msg = await client.messages.create({
            model: MODEL,
            max_tokens: 1024,
            system: [
                {
                    type: "text",
                    text: SYSTEM_PROMPT,
                    cache_control: { type: "ephemeral" },
                },
            ],
            tools: TOOL_DEFS,
            messages: conversation as Anthropic.Messages.MessageParam[],
        })

        // Push the assistant's response into the working copy
        conversation.push({ role: "assistant", content: msg.content })
        newMessages.push({ role: "assistant", content: msg.content })

        const toolUseBlocks = msg.content.filter(
            (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use",
        )
        if (toolUseBlocks.length === 0 || msg.stop_reason !== "tool_use") {
            break
        }

        // Run each requested tool, feed results back as a user message
        const toolResults: Anthropic.Messages.ToolResultBlockParam[] = []
        for (const block of toolUseBlocks) {
            const result = await runTool(
                block.name,
                (block.input as Record<string, unknown>) ?? {},
                {
                    workspaceId,
                    userId: (session.user as { id?: string }).id,
                    userName: session.user.name || undefined,
                },
            )
            toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: result,
            })
        }
        conversation.push({ role: "user", content: toolResults })
        toolLoops += 1
    }

    return NextResponse.json({ messages: newMessages })
}
