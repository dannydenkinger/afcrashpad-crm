"use client"

/**
 * Floating AI assistant. Bottom-right button opens a side panel with a
 * chat interface backed by Claude with read-only CRM tools.
 *
 * Hidden on standalone routes (login, signing pages, etc.) — only mounts
 * when there's a logged-in session.
 */

import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { Loader2, Send, Sparkles, X } from "lucide-react"

interface UiMessage {
    role: "user" | "assistant"
    /** Plain text for user messages; for assistant, just the surfaced text portion. */
    text: string
    /** Tool names the assistant called for this turn (badge display). */
    toolsUsed?: string[]
}

const HIDE_ON_PREFIXES = ["/login", "/register", "/", "/setup", "/sign/", "/invite/", "/form/", "/forms/", "/book/", "/booking/", "/payout/", "/unsub/"]

const SUGGESTIONS = [
    "Show me opportunities that haven't moved in 14 days",
    "Which campaigns had the best open rate last month?",
    "Anything booked for me this week?",
    "Find the contact 'jane'",
]

export function AssistantWidget() {
    const pathname = usePathname()
    const { data: session, status } = useSession()
    const [open, setOpen] = useState(false)
    const [messages, setMessages] = useState<UiMessage[]>([])
    const [input, setInput] = useState("")
    const [isPending, setIsPending] = useState(false)
    const scrollRef = useRef<HTMLDivElement | null>(null)

    // Hide on auth/standalone routes
    const hidden =
        status !== "authenticated" ||
        HIDE_ON_PREFIXES.some((p) => pathname === p || (p !== "/" && pathname.startsWith(p)))

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [messages, isPending])

    if (hidden) return null

    const send = async (text: string) => {
        const trimmed = text.trim()
        if (!trimmed) return
        const next: UiMessage[] = [...messages, { role: "user", text: trimmed }]
        setMessages(next)
        setInput("")
        setIsPending(true)
        try {
            const res = await fetch("/api/assistant/chat", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    messages: next.map((m) => ({ role: m.role, content: m.text })),
                }),
            })
            const data = await res.json()
            if (!res.ok) {
                setMessages((prev) => [
                    ...prev,
                    { role: "assistant", text: `Error: ${data?.error ?? "request failed"}` },
                ])
                return
            }
            // Combine the assistant's reply blocks. The API returns an array of
            // assistant messages, each with a `content` array of blocks. We extract
            // the final text + which tools fired this turn.
            const blocks: Array<{ type: string; text?: string; name?: string }> = []
            for (const m of data.messages ?? []) {
                if (Array.isArray(m.content)) {
                    for (const b of m.content) blocks.push(b)
                }
            }
            const finalText = blocks
                .filter((b) => b.type === "text")
                .map((b) => b.text ?? "")
                .join("\n\n")
                .trim()
            const toolsUsed = blocks
                .filter((b) => b.type === "tool_use")
                .map((b) => b.name as string)

            setMessages((prev) => [
                ...prev,
                {
                    role: "assistant",
                    text: finalText || "(no response)",
                    toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined,
                },
            ])
        } catch (err) {
            setMessages((prev) => [
                ...prev,
                {
                    role: "assistant",
                    text: `Error: ${err instanceof Error ? err.message : "request failed"}`,
                },
            ])
        } finally {
            setIsPending(false)
        }
    }

    return (
        <>
            {/* Floating launcher */}
            {!open && (
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className="fixed bottom-5 right-5 z-50 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center"
                    aria-label="Open AI assistant"
                    title="AI assistant"
                >
                    <Sparkles className="w-5 h-5" />
                </button>
            )}

            {/* Drawer */}
            {open && (
                <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[440px] bg-card border-l shadow-2xl flex flex-col">
                    <div className="h-12 border-b shrink-0 flex items-center justify-between px-4">
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                                <Sparkles className="w-3.5 h-3.5" />
                            </div>
                            <div>
                                <div className="text-sm font-semibold">Assistant</div>
                                <div className="text-[10px] text-muted-foreground">
                                    {session?.user?.name ? `for ${session.user.name}` : "Vesta CRM"}
                                </div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                        {messages.length === 0 && (
                            <div className="space-y-3">
                                <p className="text-sm text-muted-foreground">
                                    Ask anything about your CRM data — pipeline, contacts,
                                    campaigns, automations, bookings.
                                </p>
                                <div className="space-y-1.5">
                                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">
                                        Try asking
                                    </div>
                                    {SUGGESTIONS.map((s) => (
                                        <button
                                            key={s}
                                            type="button"
                                            onClick={() => send(s)}
                                            className="w-full text-left text-sm py-2 px-3 rounded-md border hover:bg-muted/50 hover:border-primary/30 transition-colors"
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {messages.map((m, i) => (
                            <div
                                key={i}
                                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                            >
                                <div
                                    className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                                        m.role === "user"
                                            ? "bg-primary text-primary-foreground"
                                            : "bg-muted/40 border"
                                    }`}
                                >
                                    {m.toolsUsed && m.toolsUsed.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mb-1.5">
                                            {m.toolsUsed.map((t, j) => (
                                                <span
                                                    key={j}
                                                    className="text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary"
                                                >
                                                    {t.replace(/_/g, " ")}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    <div className="whitespace-pre-wrap leading-relaxed">
                                        {m.text}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {isPending && (
                            <div className="flex justify-start">
                                <div className="rounded-2xl px-3 py-2 text-sm bg-muted/40 border flex items-center gap-2 text-muted-foreground">
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    Thinking…
                                </div>
                            </div>
                        )}
                    </div>

                    <form
                        onSubmit={(e) => {
                            e.preventDefault()
                            send(input)
                        }}
                        className="border-t shrink-0 p-3 flex items-center gap-2"
                    >
                        <input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ask about your CRM…"
                            disabled={isPending}
                            className="flex-1 px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary/20"
                        />
                        <button
                            type="submit"
                            disabled={isPending || !input.trim()}
                            className="w-9 h-9 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center"
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    </form>
                </div>
            )}
        </>
    )
}
