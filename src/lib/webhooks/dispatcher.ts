import crypto from "crypto"
import { adminDb } from "@/lib/firebase-admin"
import type { WebhookEvent, WebhookSubscription } from "./types"

/**
 * Render an event payload as Slack-incoming-webhook JSON.
 * Slack expects { text, blocks? }; we keep it readable so the message
 * looks good in any channel without further configuration.
 */
function formatSlackPayload(event: string, data: Record<string, unknown>): string {
    const titleByEvent: Record<string, string> = {
        "contact.created": "🆕 New contact",
        "contact.updated": "✏️ Contact updated",
        "deal.created": "💼 New deal",
        "deal.stage_changed": "➡️ Deal moved stages",
        "deal.closed_won": "✅ Deal won",
        "deal.closed_lost": "❌ Deal lost",
        "task.completed": "✔️ Task completed",
        "webhook.test": "🧪 Test webhook",
    }
    const title = titleByEvent[event] || `🔔 ${event}`

    // Fields shown in the Slack attachment / context block. Pick the
    // most-useful 4-5 keys per event so the message reads cleanly.
    const fields: { label: string; value: string }[] = []
    const push = (label: string, val: unknown) => {
        if (val === null || val === undefined || val === "") return
        fields.push({ label, value: String(val) })
    }

    if ("name" in data) push("Name", data.name)
    if ("email" in data) push("Email", data.email)
    if ("phone" in data) push("Phone", data.phone)
    if ("status" in data) push("Status", data.status)
    if ("value" in data) push("Value", `$${Number(data.value).toLocaleString()}`)
    if ("stageName" in data) push("Stage", data.stageName)
    if ("toStageId" in data) push("Moved to stage", data.toStageId)
    if ("title" in data) push("Title", data.title)

    const text = `*${title}*${fields.length > 0 ? "\n" + fields.map((f) => `• ${f.label}: ${f.value}`).join("\n") : ""}`

    return JSON.stringify({
        text,
        // Slack rendering: text is the fallback; blocks gives us markdown.
        blocks: [
            {
                type: "section",
                text: { type: "mrkdwn", text },
            },
        ],
    })
}

/**
 * Outbound webhook dispatcher.
 *
 * Call dispatchWebhook(workspaceId, event, payload) from any server-side
 * code path that mutates a resource (creating a contact, moving a deal
 * stage, etc). It looks up enabled subscriptions in the workspace that
 * are listening for that event and POSTs the payload to each receiver's
 * URL with an HMAC-SHA256 signature header.
 *
 * Design notes:
 *
 * - Fire-and-forget. Callers don't await the network round-trip — we
 *   spawn the deliveries in the background and return immediately so
 *   the originating mutation isn't held up by a slow webhook receiver.
 *
 * - Retries: 3 attempts total, exponential backoff (1s/4s/16s). After
 *   3 failures the subscription's failureCount is bumped and lastError
 *   is recorded; the subscription is NOT auto-disabled — that's a
 *   policy decision the operator can make from the UI.
 *
 * - Signing: receivers verify by computing
 *   `HMAC-SHA256(secret, raw_request_body)` and comparing it against
 *   the X-Vesta-Signature header. Timing-safe comparison on the
 *   receiver side is the receiver's responsibility, but we provide a
 *   timestamp in X-Vesta-Timestamp so they can also reject replays.
 *
 * - Workspace-scoped. Subscriptions live under
 *   `workspace_webhooks` keyed by workspaceId. There's no cross-tenant
 *   leak path here as long as callers pass the right workspaceId.
 */

const REQUEST_TIMEOUT_MS = 10_000
const MAX_ATTEMPTS = 3
const RETRY_BACKOFF_MS = [1000, 4000, 16_000]

interface DispatchResult {
    subscriptionId: string
    success: boolean
    statusCode?: number
    error?: string
    attempts: number
}

/**
 * Sign + send a single webhook payload to a single receiver, with retries.
 * Returns the final outcome — caller decides what to do with the audit
 * record (we update the subscription doc in updateDeliveryRecord).
 */
async function deliverOnce(
    sub: WebhookSubscription,
    bodyJson: string,
    eventName: WebhookEvent,
    deliveryId: string,
): Promise<DispatchResult> {
    const signature = crypto.createHmac("sha256", sub.secret).update(bodyJson).digest("hex")
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-Vesta-Event": eventName,
        "X-Vesta-Delivery-Id": deliveryId,
        "X-Vesta-Signature": `sha256=${signature}`,
        "X-Vesta-Timestamp": new Date().toISOString(),
        "User-Agent": "Vesta-Webhooks/1.0",
    }

    let lastError: string | undefined
    let lastStatus: number | undefined

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
            const controller = new AbortController()
            const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
            const res = await fetch(sub.url, {
                method: "POST",
                headers,
                body: bodyJson,
                signal: controller.signal,
            })
            clearTimeout(timeout)
            lastStatus = res.status
            // 2xx = success. 3xx and 4xx are caller errors that won't fix on
            // retry; we bail. 5xx = retry.
            if (res.status >= 200 && res.status < 300) {
                return { subscriptionId: sub.id, success: true, statusCode: res.status, attempts: attempt }
            }
            if (res.status >= 400 && res.status < 500) {
                return { subscriptionId: sub.id, success: false, statusCode: res.status, error: `Receiver returned ${res.status}`, attempts: attempt }
            }
            lastError = `Receiver returned ${res.status}`
        } catch (err) {
            lastError = err instanceof Error ? err.message : String(err)
        }
        // Backoff before next attempt (skip after final attempt)
        if (attempt < MAX_ATTEMPTS) {
            await new Promise(r => setTimeout(r, RETRY_BACKOFF_MS[attempt - 1]))
        }
    }

    return {
        subscriptionId: sub.id,
        success: false,
        statusCode: lastStatus,
        error: lastError || "Delivery failed",
        attempts: MAX_ATTEMPTS,
    }
}

/**
 * Update the subscription doc with delivery outcome. Bumps counters,
 * stores the most recent success/failure timestamps and last error.
 * Best-effort — failures here shouldn't block the originating mutation.
 */
async function updateDeliveryRecord(workspaceId: string, result: DispatchResult): Promise<void> {
    try {
        const ref = adminDb
            .collection("workspaces")
            .doc(workspaceId)
            .collection("webhooks")
            .doc(result.subscriptionId)
        const now = new Date().toISOString()
        if (result.success) {
            await ref.update({
                lastDeliveredAt: now,
                lastError: null,
                deliveryCount: (await import("firebase-admin/firestore")).FieldValue.increment(1),
            })
        } else {
            await ref.update({
                lastError: result.error || `HTTP ${result.statusCode || "?"}`,
                failureCount: (await import("firebase-admin/firestore")).FieldValue.increment(1),
            })
        }
    } catch (err) {
        console.error("[webhooks] Failed to update delivery record:", err)
    }
}

/**
 * Send a test payload directly to ONE subscription, bypassing the
 * event-filter. Used by the "Send test" button in the settings UI so
 * operators can verify their receiver works without waiting for a real
 * CRM event. The event name in the body is `webhook.test`.
 */
export function dispatchTestWebhook(
    workspaceId: string,
    subscriptionId: string,
    triggeredByEmail: string,
): void {
    void (async () => {
        try {
            const subDoc = await adminDb
                .collection("workspaces")
                .doc(workspaceId)
                .collection("webhooks")
                .doc(subscriptionId)
                .get()
            if (!subDoc.exists) return
            const sub = { id: subDoc.id, ...subDoc.data() } as WebhookSubscription

            const deliveryId = crypto.randomUUID()
            const envelope = {
                id: deliveryId,
                event: "webhook.test",
                workspaceId,
                createdAt: new Date().toISOString(),
                data: {
                    message: "Test delivery from Vesta. If you can read this, your receiver is wired up correctly.",
                    triggeredBy: triggeredByEmail,
                    subscriptionId,
                },
            }
            const bodyJson = sub.format === "slack"
                ? formatSlackPayload("webhook.test", envelope.data)
                : JSON.stringify(envelope)
            const result = await deliverOnce(sub, bodyJson, "webhook.test" as WebhookEvent, deliveryId)
            await updateDeliveryRecord(workspaceId, result)
        } catch (err) {
            console.error("[webhooks] dispatchTestWebhook error:", err)
        }
    })()
}

/**
 * Public API. Look up enabled subscriptions for the workspace + event,
 * then fire deliveries in parallel. Returns immediately (does not wait
 * for HTTP round-trips).
 *
 * The payload is wrapped in a standard envelope so receivers can
 * dispatch on `event` without inspecting the body shape.
 */
export function dispatchWebhook<T = unknown>(
    workspaceId: string,
    event: WebhookEvent,
    payload: T,
): void {
    // Run async work in the background — do NOT await.
    void (async () => {
        try {
            const subsSnap = await adminDb
                .collection("workspaces")
                .doc(workspaceId)
                .collection("webhooks")
                .where("enabled", "==", true)
                .get()

            if (subsSnap.empty) return

            const subs: WebhookSubscription[] = subsSnap.docs
                .map(d => ({ id: d.id, ...d.data() } as WebhookSubscription))
                .filter(s => Array.isArray(s.events) && s.events.includes(event))

            if (subs.length === 0) return

            const deliveryId = crypto.randomUUID()
            const envelope = {
                id: deliveryId,
                event,
                workspaceId,
                createdAt: new Date().toISOString(),
                data: payload,
            }
            const vestaBody = JSON.stringify(envelope)
            const slackBody = formatSlackPayload(event, payload as Record<string, unknown>)

            const results = await Promise.all(
                subs.map((sub) => {
                    const body = sub.format === "slack" ? slackBody : vestaBody
                    return deliverOnce(sub, body, event, deliveryId)
                }),
            )
            // Fire-and-forget the audit updates too
            await Promise.all(results.map(r => updateDeliveryRecord(workspaceId, r)))
        } catch (err) {
            console.error("[webhooks] dispatchWebhook error:", err)
        }
    })()
}
