"use server"

import { adminDb } from "@/lib/firebase-admin"
import { auth } from "@/auth"
import { FieldValue } from "firebase-admin/firestore"
import type { HaroSettings, HaroBatch, HaroQuery, HaroMetrics, DEFAULT_HARO_SETTINGS } from "./types"
import { sendEmail } from "@/lib/email"

// ─── Helpers ────────────────────────────────────────────────────────────────

function tsToISO(v: unknown): string | null {
    if (!v) return null
    if (typeof v === "string") return v
    if ((v as any)?.toDate) return (v as any).toDate().toISOString()
    return null
}

async function requireAuth() {
    const session = await auth()
    if (!session?.user) throw new Error("Unauthorized")
    return session
}

/** Parse HARO deadline strings like "Mar 15, 2026 - 6:00 PM ET" into ISO timestamps */
function parseHaroDeadline(deadline: string): string | null {
    if (!deadline) return null
    try {
        // Remove the dash separator and timezone abbreviations
        const cleaned = deadline
            .replace(/\s*-\s*/, " ")
            .replace(/\s+(ET|EST|EDT|CT|CST|CDT|PT|PST|PDT|MT|MST|MDT)\s*$/i, "")
            .trim()
        // Parse as America/New_York to handle EST/EDT automatically
        const localDate = new Date(cleaned)
        if (isNaN(localDate.getTime())) return null
        // Format in Eastern time then convert to UTC properly
        const eastern = new Intl.DateTimeFormat("en-US", {
            timeZone: "America/New_York",
            year: "numeric", month: "2-digit", day: "2-digit",
            hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
        }).formatToParts(localDate)
        const parts: Record<string, string> = {}
        for (const p of eastern) if (p.type !== "literal") parts[p.type] = p.value
        // Build an ISO string that represents this Eastern time, then compute UTC offset
        const etString = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`
        const etAsLocal = new Date(etString)
        const offsetMs = localDate.getTime() - etAsLocal.getTime()
        // The actual UTC time is the parsed date adjusted by the difference
        return new Date(localDate.getTime() - offsetMs).toISOString()
    } catch {
        return null
    }
}

// ─── Settings ───────────────────────────────────────────────────────────────

export async function getHaroSettings(): Promise<HaroSettings | null> {
    await requireAuth()
    const doc = await adminDb.collection("haro_settings").doc("default").get()
    if (!doc.exists) return null
    return doc.data() as HaroSettings
}

export async function saveHaroSettings(settings: HaroSettings) {
    await requireAuth()
    try {
        // Convert to plain object to ensure Firestore compatibility
        const data = JSON.parse(JSON.stringify(settings))
        await adminDb.collection("haro_settings").doc("default").set(data, { merge: true })
        return { success: true }
    } catch (err: any) {
        console.error("Failed to save HARO settings:", err)
        return { success: false, error: err.message || "Failed to save settings" }
    }
}

// ─── Batches ────────────────────────────────────────────────────────────────

export async function getHaroBatches(limit = 20): Promise<HaroBatch[]> {
    await requireAuth()
    const snap = await adminDb
        .collection("haro_batches")
        .orderBy("createdAt", "desc")
        .limit(limit)
        .get()
    return snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        processedAt: tsToISO(doc.data().processedAt) || "",
        createdAt: tsToISO(doc.data().createdAt) || "",
    })) as HaroBatch[]
}

// ─── Queries ────────────────────────────────────────────────────────────────

export async function getHaroQueries(filters?: {
    batchId?: string
    status?: string
    isRelevant?: boolean
    limit?: number
}): Promise<HaroQuery[]> {
    await requireAuth()
    let query: FirebaseFirestore.Query = adminDb.collection("haro_queries")

    if (filters?.batchId) query = query.where("batchId", "==", filters.batchId)
    if (filters?.isRelevant !== undefined) query = query.where("isRelevant", "==", filters.isRelevant)
    if (filters?.status) query = query.where("status", "==", filters.status)

    query = query.orderBy("createdAt", "desc").limit(filters?.limit || 50)

    const snap = await query.get()
    return snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: tsToISO(doc.data().createdAt) || "",
        updatedAt: tsToISO(doc.data().updatedAt) || "",
        sentAt: tsToISO(doc.data().sentAt) || undefined,
    })) as HaroQuery[]
}

export async function updateHaroQuery(
    queryId: string,
    updates: Partial<HaroQuery>
) {
    await requireAuth()
    const { id, ...data } = updates as any
    await adminDb.collection("haro_queries").doc(queryId).update({
        ...data,
        updatedAt: FieldValue.serverTimestamp(),
    })
    return { success: true }
}

export async function sendHaroResponse(queryId: string) {
    await requireAuth()

    const doc = await adminDb.collection("haro_queries").doc(queryId).get()
    if (!doc.exists) return { success: false, error: "Query not found" }

    const query = doc.data() as HaroQuery
    const responseText = query.editedResponse || query.aiResponse
    if (!responseText) return { success: false, error: "No response to send" }
    if (!query.reporterEmail) return { success: false, error: "No reporter email" }

    const settings = await getHaroSettings()

    try {
        const fromEmail = settings?.sendFromEmail || process.env.RESEND_FROM_EMAIL || "noreply@afcrashpad.com"
        await sendEmail({
            to: query.reporterEmail,
            subject: query.responseSubject || `RE: ${query.title}`,
            html: responseText.replace(/\n/g, "<br>"),
        })

        await adminDb.collection("haro_queries").doc(queryId).update({
            status: "sent",
            sentAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        })

        // Update batch sent count
        if (query.batchId) {
            await adminDb.collection("haro_batches").doc(query.batchId).update({
                responsesSent: FieldValue.increment(1),
            })
        }

        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message || "Failed to send" }
    }
}

export async function markPlacement(
    queryId: string,
    placementUrl: string,
    domainAuthority: number
) {
    await requireAuth()
    // Estimate SEO value: DA * $50 as a rough heuristic
    const estimatedValue = domainAuthority * 50
    await adminDb.collection("haro_queries").doc(queryId).update({
        placementConfirmed: true,
        placementUrl,
        placementDomainAuthority: domainAuthority,
        estimatedSeoValue: estimatedValue,
        status: "placed",
        updatedAt: FieldValue.serverTimestamp(),
    })
    return { success: true }
}

function buildResponsePrompt(
    settings: HaroSettings,
    query: { title: string; reporterName: string; mediaOutlet: string; description: string }
): string {
    // Dynamic tone guidance based on slider (0=casual, 100=professional)
    const tone = settings.responseTone
    let toneInstruction: string
    if (tone <= 30) {
        toneInstruction = `- Very casual and conversational. Use contractions freely, first-person stories, and a relaxed voice.
- Think "texting a smart friend" — warm, approachable, zero corporate-speak.
- Short sentences. Personality over polish.`
    } else if (tone <= 70) {
        toneInstruction = `- Professional but warm. Think "friendly expert", not "formal essay" and not "texting a buddy".
- Use contractions naturally (I'm, don't, we've) but don't force slang or overly casual language.
- Sound like a knowledgeable professional writing a quick, genuine email.`
    } else {
        toneInstruction = `- Polished and authoritative. Minimal contractions, confident language.
- Think "expert opinion piece" — credible, precise, well-structured.
- Maintain warmth but lean formal. No slang or overly casual phrasing.`
    }

    // Dynamic length
    let lengthInstruction: string
    if (settings.responseLength === "short") {
        lengthInstruction = "1-2 brief paragraphs, under 100 words. Get straight to the point."
    } else if (settings.responseLength === "long") {
        lengthInstruction = "3-4 detailed paragraphs with examples. Give the reporter plenty to work with."
    } else {
        lengthInstruction = "2-3 short paragraphs for the response body. Reporters are busy."
    }

    // Dynamic writing style
    const styleMap: Record<string, string> = {
        friendly_expert: "Write as a friendly expert — knowledgeable but approachable, sharing insights from real experience.",
        thought_leader: "Write as an authoritative thought leader — confident, forward-thinking, sharing industry perspective.",
        storyteller: "Write as a relatable storyteller — lead with real anecdotes and personal experiences to make your point.",
        data_driven: "Write as a data-driven analyst — support points with specific numbers, metrics, and concrete results.",
    }
    const styleInstruction = styleMap[settings.responseStyle] || styleMap.friendly_expert

    // Optional directives
    const anecdoteInstruction = settings.includeAnecdotes
        ? "- Share a specific example or anecdote from your real experience — this is what makes a response stand out."
        : ""
    const ctaInstruction = settings.includeCallToAction
        ? "- End with a brief note about your availability for follow-up (e.g. 'Happy to hop on a call if you need more detail.')."
        : ""

    return `You are ${settings.name}. Write an email to a journalist. You run ${settings.businessName}, ${settings.businessIntro}. You're also a former Air Force pilot.

TONE — this is critical:
${toneInstruction}
- Avoid stiff AI phrases: "I'd be happy to", "furthermore", "it's worth noting", "in addition", "I believe that".
- ${lengthInstruction}
${anecdoteInstruction}
${ctaInstruction}
- No bullet points or numbered lists. Write in natural paragraphs.
- ${styleInstruction}

The journalist's query:
Title: ${query.title}
Reporter: ${query.reporterName}
Outlet: ${query.mediaOutlet}
Details: ${query.description}

Format your response exactly like this:

Hi ${query.reporterName || "[Reporter Name]"},

[1 sentence intro — who you are and why you're relevant.]

[Your response — ${settings.responseLength === "short" ? "1-2 brief paragraphs" : settings.responseLength === "long" ? "3-4 detailed paragraphs" : "2-3 short paragraphs"}. Be specific, give them something quotable.]

Here's my info if you need it:
${settings.name}, Founder/CEO
${settings.website}
${settings.linkedIn ? settings.linkedIn : ""}
${settings.headshotUrl ? `Headshot: ${settings.headshotUrl}` : ""}

${settings.signoff}`
}

export async function regenerateHaroResponse(queryId: string) {
    await requireAuth()

    const doc = await adminDb.collection("haro_queries").doc(queryId).get()
    if (!doc.exists) return { success: false, error: "Query not found" }

    const query = { id: doc.id, ...doc.data() } as HaroQuery
    const settings = await getHaroSettings()
    if (!settings) return { success: false, error: "HARO settings not configured" }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return { success: false, error: "ANTHROPIC_API_KEY not configured" }

    const Anthropic = (await import("@anthropic-ai/sdk")).default
    const anthropic = new Anthropic({ apiKey })

    const cleanDescription = query.description.replace("[Note: No AI Pitches Considered]", "").trim()

    try {
        const responseMsg = await anthropic.messages.create({
            model: "claude-sonnet-4-20250514",
            max_tokens: 800,
            messages: [{
                role: "user",
                content: buildResponsePrompt(settings, { title: query.title, reporterName: query.reporterName, mediaOutlet: query.mediaOutlet, description: cleanDescription })
            }],
        })

        const aiText = responseMsg.content[0].type === "text" ? responseMsg.content[0].text : ""
        if (!aiText) return { success: false, error: "No response generated" }

        await adminDb.collection("haro_queries").doc(queryId).update({
            aiResponse: aiText,
            editedResponse: "",
            responseSubject: `RE: ${query.title} — ${settings.businessName}`,
            status: "reviewing",
            updatedAt: FieldValue.serverTimestamp(),
        })

        return { success: true, response: aiText }
    } catch (err: any) {
        return { success: false, error: err.message || "Failed to generate response" }
    }
}

// ─── Email Processing Pipeline ──────────────────────────────────────────────

interface ParsedQuery {
    title: string
    description: string
    category: string
    reporterName: string
    reporterEmail: string
    mediaOutlet: string
    mediaUrl: string
    deadline: string
}

function decodeQuotedPrintable(text: string): string {
    // Remove soft line breaks (= at end of line)
    let decoded = text.replace(/=\r?\n/g, "")
    // Decode hex-encoded chars (e.g., =E2=80=94 → UTF-8 bytes)
    decoded = decoded.replace(/=([0-9A-Fa-f]{2})/g, (_, hex) =>
        String.fromCharCode(parseInt(hex, 16))
    )
    // Fix multi-byte UTF-8 sequences that got decoded char-by-char
    try {
        const bytes = new Uint8Array([...decoded].map(c => c.charCodeAt(0)))
        decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes)
    } catch {
        // If decoding fails, return as-is
    }
    return decoded
}

function stripAntiAIMarkers(text: string): string {
    // Remove base64-encoded anti-AI detection strings embedded by HARO
    // These look like random base64 jammed into query text
    return text.replace(/[A-Za-z0-9+/=]{40,}/g, "").replace(/\s{3,}/g, " ").trim()
}

function extractPlainText(emlContent: string): string {
    // Extract the text/plain part from the .eml multipart content
    const plainMarker = "Content-Type: text/plain"
    const plainIdx = emlContent.indexOf(plainMarker)
    if (plainIdx === -1) return emlContent

    // Find the start of actual content (after headers)
    const contentStart = emlContent.indexOf("\n\n", plainIdx)
    if (contentStart === -1) return emlContent

    // Find the boundary end (next part or end)
    const boundaryMatch = emlContent.match(/boundary="([^"]+)"/)
    let contentEnd = emlContent.length
    if (boundaryMatch) {
        const nextBoundary = emlContent.indexOf(`--${boundaryMatch[1]}`, contentStart)
        if (nextBoundary > contentStart) contentEnd = nextBoundary
    }

    return emlContent.substring(contentStart + 2, contentEnd)
}

function parseHaroEmail(emailText: string): ParsedQuery[] {
    // Step 1: Extract plain text from .eml if needed
    let text = emailText
    if (text.includes("Content-Type:") && text.includes("boundary=")) {
        text = extractPlainText(text)
    }

    // Step 2: Decode quoted-printable encoding
    if (text.includes("=\n") || text.includes("=E2") || text.includes("=C2")) {
        text = decodeQuotedPrintable(text)
    }

    // Step 3: Find the detailed query section (after the **** separator)
    const starSep = text.indexOf("****************************")
    const detailedSection = starSep !== -1 ? text.substring(starSep) : text

    // Step 4: Split by the dashed separator between queries
    const blocks = detailedSection.split(/-{20,}/)

    const queries: ParsedQuery[] = []

    for (const block of blocks) {
        // Look for the Summary line: "N) Summary: ..."
        const summaryMatch = block.match(/\d+\)\s*Summary:\s*([\s\S]*?)(?=\n\s*Name:)/i)
        if (!summaryMatch) continue

        const title = summaryMatch[1].replace(/\n/g, " ").trim()

        // Extract fields
        const nameMatch = block.match(/^Name:\s*(.*?)$/im)
        const categoryMatch = block.match(/^Category:\s*(.*?)$/im)
        const emailMatch = block.match(/(reply\+[a-z0-9-]+@helpareporter\.com)/i)
        const outletMatch = block.match(/^Media Outlet:\s*(.*?)$/im)
        const deadlineMatch = block.match(/^Deadline:\s*(.*?)$/im)
        const noAI = /No AI Pitches Considered/i.test(block)

        // Extract query text (everything after "Query:" up to "Back to Top")
        const queryBodyMatch = block.match(/Query:\s*([\s\S]*?)(?=Back to Top|$)/i)
        let queryBody = queryBodyMatch ? queryBodyMatch[1].trim() : ""
        queryBody = stripAntiAIMarkers(queryBody)

        // Extract media URL from outlet line like "Outlet Name (https://url.com)"
        let mediaUrl = ""
        if (outletMatch) {
            const urlInOutlet = outletMatch[1].match(/\((https?:\/\/[^\s)]+)\)/)
            if (urlInOutlet) mediaUrl = urlInOutlet[1]
        }

        // Clean outlet name (remove URL part)
        let outletName = outletMatch ? outletMatch[1].trim() : ""
        outletName = outletName.replace(/\s*\(https?:\/\/[^\s)]+\)\s*/g, "").trim()

        queries.push({
            title,
            description: queryBody + (noAI ? "\n\n[Note: No AI Pitches Considered]" : ""),
            category: categoryMatch ? categoryMatch[1].trim() : "General",
            reporterName: nameMatch ? nameMatch[1].trim() : "",
            reporterEmail: emailMatch ? emailMatch[1] : "",
            mediaOutlet: outletName,
            mediaUrl,
            deadline: deadlineMatch ? deadlineMatch[1].trim() : "",
        })
    }

    // Fallback for non-HARO format emails (generic numbered list)
    if (queries.length === 0) {
        const titlePattern = /(\d+)\)\s+(.*?)(?:\(([^)]+)\))?\s*\n/g
        let match
        while ((match = titlePattern.exec(text)) !== null) {
            const emailAddrMatch = text.substring(match.index).match(/([a-zA-Z0-9._+-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/)
            queries.push({
                title: match[2].trim(),
                description: "",
                category: "General",
                reporterName: "",
                reporterEmail: emailAddrMatch ? emailAddrMatch[1] : "",
                mediaOutlet: match[3]?.trim() || "",
                mediaUrl: "",
                deadline: "",
            })
        }
    }

    return queries
}

export async function processHaroEmail(emailContent: string, emailSubject?: string) {
    await requireAuth()
    return processHaroEmailInternal(emailContent, emailSubject)
}

// ─── Metrics ────────────────────────────────────────────────────────────────

export async function getHaroMetrics(): Promise<HaroMetrics> {
    await requireAuth()

    const [batchesSnap, queriesSnap, placedSnap] = await Promise.all([
        adminDb.collection("haro_batches").get(),
        adminDb.collection("haro_queries").get(),
        adminDb.collection("haro_queries").where("placementConfirmed", "==", true).get(),
    ])

    let totalQueriesReceived = 0
    let totalRelevantMatches = 0
    let totalResponsesSent = 0

    for (const doc of batchesSnap.docs) {
        const d = doc.data()
        totalQueriesReceived += d.totalQueries || 0
        totalRelevantMatches += d.relevantQueries || 0
        totalResponsesSent += d.responsesSent || 0
    }

    let totalBacklinks = 0
    let totalDA = 0
    let totalSeoValue = 0
    for (const doc of placedSnap.docs) {
        const d = doc.data()
        totalBacklinks++
        totalDA += d.placementDomainAuthority || 0
        totalSeoValue += d.estimatedSeoValue || 0
    }

    const avgResponseRate = totalRelevantMatches > 0
        ? Math.round((totalResponsesSent / totalRelevantMatches) * 100)
        : 0
    const avgDA = totalBacklinks > 0 ? Math.round(totalDA / totalBacklinks) : 0

    // Weekly data for chart (last 8 weeks)
    const weeklyData: HaroMetrics["weeklyData"] = []
    const now = new Date()
    for (let w = 7; w >= 0; w--) {
        const weekStart = new Date(now)
        weekStart.setDate(weekStart.getDate() - w * 7)
        const weekEnd = new Date(weekStart)
        weekEnd.setDate(weekEnd.getDate() + 7)

        let queries = 0, relevant = 0, sent = 0, placed = 0
        for (const doc of queriesSnap.docs) {
            const d = doc.data()
            const created = d.createdAt?.toDate?.() || new Date(d.createdAt)
            if (created >= weekStart && created < weekEnd) {
                queries++
                if (d.isRelevant) relevant++
                if (d.status === "sent" || d.status === "placed") sent++
                if (d.placementConfirmed) placed++
            }
        }

        weeklyData.push({
            week: weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            queries,
            relevant,
            sent,
            placed,
        })
    }

    return {
        totalBatches: batchesSnap.size,
        totalQueriesReceived,
        totalRelevantMatches,
        totalResponsesSent,
        totalPlacementsConfirmed: placedSnap.size,
        totalBacklinksEarned: totalBacklinks,
        avgResponseRate,
        avgDomainAuthority: avgDA,
        estimatedTotalSeoValue: totalSeoValue,
        weeklyData,
    }
}

// ─── Delete / Bulk Actions ──────────────────────────────────────────────────

export async function deleteHaroBatch(batchId: string) {
    await requireAuth()
    // Delete all queries in this batch
    const queriesSnap = await adminDb.collection("haro_queries").where("batchId", "==", batchId).get()
    const batch = adminDb.batch()
    queriesSnap.docs.forEach(doc => batch.delete(doc.ref))
    batch.delete(adminDb.collection("haro_batches").doc(batchId))
    await batch.commit()
    return { success: true }
}

export async function bulkUpdateQueryStatus(queryIds: string[], status: HaroQuery["status"]) {
    await requireAuth()
    const batch = adminDb.batch()
    for (const id of queryIds) {
        batch.update(adminDb.collection("haro_queries").doc(id), {
            status,
            updatedAt: FieldValue.serverTimestamp(),
        })
    }
    await batch.commit()
    return { success: true }
}

// ─── Gmail Auto-Fetch ───────────────────────────────────────────────────────

// Step 1: Quick fetch — just get unprocessed HARO emails from Gmail
export async function fetchNewHaroEmails() {
    const { fetchHaroEmails } = await import("@/lib/gmail")

    const lastBatch = await adminDb
        .collection("haro_batches")
        .orderBy("createdAt", "desc")
        .limit(1)
        .get()

    const twoDaysAgo = new Date()
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
    const afterDate = lastBatch.empty
        ? twoDaysAgo.toISOString().split("T")[0]
        : undefined

    const emails = await fetchHaroEmails({ maxResults: 10, afterDate })
    if (emails.length === 0) return { emails: [], message: "No HARO emails found in Gmail" }

    // Filter out already-processed emails
    const emailIds = emails.map(e => e.id).slice(0, 10)
    let processedIds = new Set<string>()
    if (emailIds.length > 0) {
        const processedSnap = await adminDb.collection("haro_batches")
            .where("gmailMessageId", "in", emailIds)
            .get()
        processedIds = new Set(processedSnap.docs.map(d => d.data().gmailMessageId))
    }

    const newEmails = emails.filter(e => !processedIds.has(e.id))
    if (newEmails.length === 0) return { emails: [], message: "All HARO emails already processed" }

    return {
        emails: newEmails.map(e => ({ id: e.id, subject: e.subject, date: e.date })),
        message: `Found ${newEmails.length} new HARO email(s)`,
        _fullEmails: newEmails, // kept server-side for processSingleHaroEmail
    }
}

// Step 2: Process a single email by Gmail ID (called one at a time from UI)
export async function processSingleHaroEmail(gmailMessageId: string) {
    const { fetchHaroEmails } = await import("@/lib/gmail")

    // Fetch this specific email
    const emails = await fetchHaroEmails({ maxResults: 10 })
    const email = emails.find(e => e.id === gmailMessageId)
    if (!email) return { success: false, error: "Email not found in Gmail" }

    return processHaroEmailInternal(email.body, email.subject, gmailMessageId)
}

// Full pipeline for cron (non-interactive, processes all at once)
export async function fetchAndProcessHaroEmails() {
    const { fetchHaroEmails } = await import("@/lib/gmail")

    const lastBatch = await adminDb
        .collection("haro_batches")
        .orderBy("createdAt", "desc")
        .limit(1)
        .get()

    const twoDaysAgo = new Date()
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
    const afterDate = lastBatch.empty
        ? twoDaysAgo.toISOString().split("T")[0]
        : undefined

    const emails = await fetchHaroEmails({ maxResults: 10, afterDate })
    if (emails.length === 0) return { success: true, message: "No new HARO emails found", processed: 0 }

    const emailIds = emails.map(e => e.id).slice(0, 10)
    let processedIds = new Set<string>()
    if (emailIds.length > 0) {
        const processedSnap = await adminDb.collection("haro_batches")
            .where("gmailMessageId", "in", emailIds)
            .get()
        processedIds = new Set(processedSnap.docs.map(d => d.data().gmailMessageId))
    }

    const newEmails = emails.filter(e => !processedIds.has(e.id))
    if (newEmails.length === 0) return { success: true, message: "All HARO emails already processed", processed: 0 }

    const results = []
    for (const email of newEmails) {
        const result = await processHaroEmailInternal(email.body, email.subject, email.id)
        results.push(result)
    }

    return {
        success: true,
        message: `Processed ${results.length} new HARO email(s)`,
        processed: results.length,
        results,
    }
}

// Debug: check what tokens are stored
export async function debugGmailTokens() {
    await requireAuth()
    const tokenDoc = await adminDb.collection("oauth_tokens").doc("gmail").get()
    if (!tokenDoc.exists) return { stored: false }
    const data = tokenDoc.data()!
    return {
        stored: true,
        hasAccessToken: !!data.accessToken,
        accessTokenPrefix: data.accessToken ? data.accessToken.substring(0, 20) + "..." : "none",
        hasRefreshToken: !!data.refreshToken,
        refreshTokenPrefix: data.refreshToken ? data.refreshToken.substring(0, 10) + "..." : "none",
        accessTokenExpires: data.accessTokenExpires,
        expiresDate: data.accessTokenExpires ? new Date(data.accessTokenExpires).toISOString() : "none",
        email: data.email,
    }
}

// Ensures Gmail tokens are in Firestore, then fetches email list (fast)
export async function triggerHaroFetch() {
    const session = await requireAuth()
    try {
        // Ensure Gmail tokens exist in Firestore
        const tokenDoc = await adminDb.collection("oauth_tokens").doc("gmail").get()
        if (!tokenDoc.exists || !tokenDoc.data()?.refreshToken) {
            const s = session as any
            if (s.refreshToken) {
                await adminDb.collection("oauth_tokens").doc("gmail").set({
                    accessToken: s.accessToken || "",
                    refreshToken: s.refreshToken,
                    accessTokenExpires: s.accessTokenExpires || 0,
                    email: session.user?.email || "",
                    updatedAt: new Date().toISOString(),
                }, { merge: true })
            } else {
                return { success: false, emails: [], message: "No Gmail refresh token in session. Please sign out, then sign back in and approve Gmail access." }
            }
        }
        return await fetchNewHaroEmails()
    } catch (err: any) {
        console.error("HARO fetch error:", err)
        return { success: false, emails: [], message: err.message || "Failed to fetch emails" }
    }
}

// Process a single email (called from UI one at a time for progress)
export async function triggerProcessSingleEmail(gmailMessageId: string) {
    await requireAuth()
    try {
        return await processSingleHaroEmail(gmailMessageId)
    } catch (err: any) {
        console.error("HARO process error:", err)
        return { success: false, error: err.message || "Failed to process email" }
    }
}

// Internal processor that stores the Gmail message ID
async function processHaroEmailInternal(emailContent: string, emailSubject?: string, gmailMessageId?: string) {
    const settingsDoc = await adminDb.collection("haro_settings").doc("default").get()
    const settings: HaroSettings = settingsDoc.exists
        ? (settingsDoc.data() as HaroSettings)
        : (await import("./types")).DEFAULT_HARO_SETTINGS

    const batchRef = adminDb.collection("haro_batches").doc()
    const batch: Record<string, any> = {
        processedAt: new Date().toISOString(),
        emailSubject: emailSubject || "HARO Email",
        emailDate: new Date().toISOString(),
        totalQueries: 0,
        relevantQueries: 0,
        responsesGenerated: 0,
        responsesSent: 0,
        status: "processing",
        createdAt: FieldValue.serverTimestamp(),
    }
    if (gmailMessageId) batch.gmailMessageId = gmailMessageId
    await batchRef.set(batch)

    try {
        const parsedQueries = parseHaroEmail(emailContent)

        if (parsedQueries.length === 0) {
            await batchRef.update({
                status: "error",
                errorMessage: "Could not parse any queries from the email.",
            })
            return { success: false, error: "No queries found", batchId: batchRef.id }
        }

        await batchRef.update({ totalQueries: parsedQueries.length })

        const Anthropic = (await import("@anthropic-ai/sdk")).default
        const apiKey = process.env.ANTHROPIC_API_KEY
        if (!apiKey) {
            await batchRef.update({ status: "error", errorMessage: "ANTHROPIC_API_KEY not configured" })
            return { success: false, error: "ANTHROPIC_API_KEY not configured", batchId: batchRef.id }
        }
        const anthropic = new Anthropic({ apiKey })

        const topicsList = settings.expertiseTopics.join(", ")
        const titlesText = parsedQueries.map((q, i) => {
            const cleanDesc = q.description.replace(/\[Note: No AI Pitches Considered\]/g, "").replace(/\n/g, " ").trim()
            return `${i + 1}) Title: ${q.title} (${q.mediaOutlet || "Unknown"})\n   Details: ${cleanDesc.slice(0, 300)}`
        }).join("\n\n")

        const filterResponse = await anthropic.messages.create({
            model: "claude-sonnet-4-20250514",
            max_tokens: 1000,
            messages: [{
                role: "user",
                content: `You are filtering journalist queries for relevance. I am an expert in: ${topicsList}.

My business: ${settings.businessName} — ${settings.businessIntro}.

IMPORTANT: I am NOT a licensed professional (not a CPA, attorney, doctor, therapist, financial advisor, etc.) unless one of my expertise topics explicitly states otherwise. If a query requires specific professional credentials or licenses (e.g. "looking for a CPA", "must be a licensed therapist", "input from an MD", "certified financial planner"), and my expertise does not include that credential, score it 20-40 at most — it is low relevance because I cannot credibly respond.

${settings.relevancyStrictness <= 30
    ? "SCORING GUIDANCE: Be generous. Consider tangential connections and adjacent expertise. Score 60+ if there's any reasonable angle I could speak to."
    : settings.relevancyStrictness >= 71
        ? "SCORING GUIDANCE: Be very strict. Only score above 60 for direct, exact topic matches. Tangential or loosely related connections should score below 40."
        : ""}

Below are queries from reporters. For each query, read both the title AND details to determine relevance to my expertise. Return a JSON object with this exact format:

{"results": [{"index": 1, "relevant": true, "score": 85, "reason": "Brief reason"}, ...]}

Include ALL queries in the results array. Score from 0-100 for relevance.

Queries:
${titlesText}`
            }],
        })

        let relevanceResults: { index: number; relevant: boolean; score: number; reason: string }[] = []
        const filterText = filterResponse.content[0].type === "text" ? filterResponse.content[0].text : ""
        const jsonMatch = filterText.match(/\{[\s\S]*"results"[\s\S]*\}/)
        if (jsonMatch) {
            try {
                relevanceResults = JSON.parse(jsonMatch[0]).results || []
            } catch { }
        }

        let relevantCount = 0
        const savedQueries: (HaroQuery & { _parsed: ParsedQuery })[] = []

        for (let i = 0; i < parsedQueries.length; i++) {
            const pq = parsedQueries[i]
            const relevance = relevanceResults.find(r => r.index === i + 1)
            const isRelevant = relevance?.relevant || false
            if (isRelevant) relevantCount++

            const queryRef = adminDb.collection("haro_queries").doc()
            const queryDoc: Omit<HaroQuery, "id"> = {
                batchId: batchRef.id,
                title: pq.title,
                description: pq.description,
                category: pq.category,
                reporterName: pq.reporterName,
                reporterEmail: pq.reporterEmail,
                mediaOutlet: pq.mediaOutlet,
                mediaUrl: pq.mediaUrl,
                deadline: pq.deadline,
                deadlineParsed: parseHaroDeadline(pq.deadline) || "",
                relevanceScore: relevance?.score || 0,
                isRelevant,
                relevanceReason: relevance?.reason || "",
                aiResponse: "",
                editedResponse: "",
                responseSubject: "",
                status: isRelevant ? "pending" : "declined",
                placementConfirmed: false,
                placementUrl: "",
                placementDomainAuthority: 0,
                estimatedSeoValue: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            }

            await queryRef.set({ ...queryDoc, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() })
            if (isRelevant) savedQueries.push({ ...queryDoc, id: queryRef.id, _parsed: pq })
        }

        await batchRef.update({ relevantQueries: relevantCount })

        let responsesGenerated = 0
        for (const sq of savedQueries) {
            const noAI = sq.description.includes("[Note: No AI Pitches Considered]")
            // Strip the no-AI marker from the description before sending to Claude
            const cleanDescription = sq.description.replace("[Note: No AI Pitches Considered]", "").trim()
            try {
                const responseMsg = await anthropic.messages.create({
                    model: "claude-sonnet-4-20250514",
                    max_tokens: 800,
                    messages: [{
                        role: "user",
                        content: buildResponsePrompt(settings, { title: sq.title, reporterName: sq.reporterName, mediaOutlet: sq.mediaOutlet, description: cleanDescription })
                    }],
                })

                const aiText = responseMsg.content[0].type === "text" ? responseMsg.content[0].text : ""
                if (aiText) {
                    // Force "reviewing" for no-AI flagged queries to prevent accidental auto-send
                    const status = noAI ? "reviewing" : (settings.sendMode === "draft" ? "reviewing" : "approved")
                    await adminDb.collection("haro_queries").doc(sq.id).update({
                        aiResponse: aiText,
                        responseSubject: `RE: ${sq.title} — ${settings.businessName}`,
                        status,
                        updatedAt: FieldValue.serverTimestamp(),
                    })
                    responsesGenerated++

                    // Only auto-send for non-flagged queries
                    if (!noAI) {
                        if (settings.sendMode === "auto" && sq.reporterEmail) {
                            await sendHaroResponse(sq.id)
                        } else if (settings.sendMode === "auto_with_threshold" && sq.relevanceScore >= settings.confidenceThreshold && sq.reporterEmail) {
                            await sendHaroResponse(sq.id)
                        }
                    }
                }
            } catch (err) {
                console.error(`Failed to generate response for query ${sq.id}:`, err)
            }
        }

        await batchRef.update({ responsesGenerated, status: "completed" })
        return { success: true, batchId: batchRef.id, totalQueries: parsedQueries.length, relevantQueries: relevantCount, responsesGenerated }
    } catch (err: any) {
        await batchRef.update({ status: "error", errorMessage: err.message || "Processing failed" })
        return { success: false, error: err.message || "Processing failed", batchId: batchRef.id }
    }
}

// ─── Deadline Expiration & Alerts ────────────────────────────────────────────

/** Check for expiring/expired HARO queries. Called from cron. */
export async function checkHaroDeadlines() {
    const { createNotification } = await import("@/app/notifications/actions")
    const now = new Date()
    const fourHoursFromNow = new Date(now.getTime() + 4 * 60 * 60 * 1000)

    // Get all pending/reviewing queries that have a parsed deadline
    const snap = await adminDb.collection("haro_queries")
        .where("status", "in", ["pending", "reviewing", "approved"])
        .get()

    let expired = 0
    let alerted = 0

    for (const doc of snap.docs) {
        const data = doc.data()
        const deadlineParsed = data.deadlineParsed
        if (!deadlineParsed) continue

        const deadline = new Date(deadlineParsed)

        // Auto-expire past-deadline queries
        if (deadline < now) {
            await doc.ref.update({ status: "expired", updatedAt: FieldValue.serverTimestamp() })
            expired++
            continue
        }

        // Alert for queries expiring within 4 hours (if not already notified)
        if (deadline < fourHoursFromNow && !data.deadlineNotified) {
            await createNotification({
                title: "HARO Query Expiring Soon",
                message: `"${data.title}" expires in ${Math.round((deadline.getTime() - now.getTime()) / (60 * 1000))} minutes`,
                type: "haro_deadline",
                linkUrl: "/marketing",
                dedupeKey: `haro-deadline-${doc.id}`,
            })
            await doc.ref.update({ deadlineNotified: true })
            alerted++
        }
    }

    return { expired, alerted }
}
