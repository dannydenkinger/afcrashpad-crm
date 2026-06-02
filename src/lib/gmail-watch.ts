/**
 * Gmail push notification setup via Google Cloud Pub/Sub.
 *
 * Call setupGmailWatch() after a user signs in with Google to register
 * for real-time email notifications. Watches expire after 7 days and
 * must be renewed via the cron endpoint.
 */

import { getValidGmailToken, upsertGmailIntegration } from "@/lib/gmail-integration"

const GMAIL_PUBSUB_TOPIC = process.env.GMAIL_PUBSUB_TOPIC || ""

/**
 * Register a Gmail push notification watch for a user.
 * Returns the historyId and expiration, which are stored in the integration record.
 */
export async function setupGmailWatch(
    workspaceId: string,
    userId: string
): Promise<{ historyId: string; expiration: number } | null> {
    if (!GMAIL_PUBSUB_TOPIC) {
        console.warn("[GMAIL-WATCH] GMAIL_PUBSUB_TOPIC not configured, skipping watch setup")
        return null
    }

    const accessToken = await getValidGmailToken(workspaceId, userId)

    const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/watch", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            topicName: GMAIL_PUBSUB_TOPIC,
            labelIds: ["INBOX"],
            labelFilterBehavior: "INCLUDE",
        }),
    })

    if (!res.ok) {
        const err = await res.text()
        console.error(`[GMAIL-WATCH] Failed to set up watch: ${res.status} ${err}`)
        return null
    }

    const data = await res.json()
    const historyId = data.historyId
    const expiration = Number(data.expiration)

    // Store watch metadata in the integration record
    await upsertGmailIntegration(workspaceId, userId, {
        historyId,
        watchExpiration: expiration,
    })

    console.log(`[GMAIL-WATCH] Watch set up for user ${userId}, expires ${new Date(expiration).toISOString()}`)

    return { historyId, expiration }
}

/**
 * Stop watching a user's Gmail inbox.
 */
export async function stopGmailWatch(
    workspaceId: string,
    userId: string
): Promise<void> {
    const accessToken = await getValidGmailToken(workspaceId, userId)

    await fetch("https://gmail.googleapis.com/gmail/v1/users/me/stop", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    })

    await upsertGmailIntegration(workspaceId, userId, {
        watchExpiration: 0,
    })
}

/**
 * Fetch message history since a given historyId.
 * Returns new message IDs that were added to the inbox.
 */
export async function getHistoryChanges(
    accessToken: string,
    startHistoryId: string
): Promise<string[]> {
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/history?startHistoryId=${startHistoryId}&historyTypes=messageAdded&labelId=INBOX`

    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!res.ok) {
        // 404 means historyId is too old — need full sync
        if (res.status === 404) {
            console.warn("[GMAIL-WATCH] History ID expired, need full resync")
            return []
        }
        const err = await res.text()
        throw new Error(`Gmail history error: ${res.status} ${err}`)
    }

    const data = await res.json()
    if (!data.history) return []

    const messageIds: string[] = []
    for (const entry of data.history) {
        if (entry.messagesAdded) {
            for (const added of entry.messagesAdded) {
                // Only include messages in INBOX (not sent, drafts, etc.)
                if (added.message?.labelIds?.includes("INBOX")) {
                    messageIds.push(added.message.id)
                }
            }
        }
    }

    // Return the latest historyId for storage
    return messageIds
}

/**
 * Fetch a full Gmail message by ID.
 */
export async function fetchFullMessage(
    accessToken: string,
    messageId: string
): Promise<any> {
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!res.ok) {
        const err = await res.text()
        throw new Error(`Gmail fetch message error: ${res.status} ${err}`)
    }

    return res.json()
}
