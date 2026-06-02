"use server"

import { getAuthSession } from "@/lib/auth-guard"
import { adminDb } from "@/lib/firebase-admin"
import { tenantDb } from "@/lib/tenant-db"
import { google } from "googleapis"
import { cookies } from "next/headers"

// ── Read Setup Status ──

export async function getSetupStatus() {
    const session = await getAuthSession()
    if (!session?.user?.email) throw new Error("Unauthorized")

    const workspaceId = session.user.workspaceId
    const db = tenantDb(workspaceId)

    const doc = await db.settingsDoc('integrations').get()
    const data = doc.exists ? doc.data() : null

    // Check calendar integration for the current user
    const userId = session.user.id
    let calendarConnected = false
    if (userId) {
        const calSnap = await adminDb.collection('calendar_integrations')
            .where('userId', '==', userId)
            .limit(1)
            .get()
        calendarConnected = !calSnap.empty
    }

    return {
        google: {
            connected: !!data?.google?.refreshToken,
            calendarConnected,
            ga4PropertyId: data?.google?.ga4PropertyId || null,
            gscSiteUrl: data?.google?.gscSiteUrl || null,
        },
        resend: { connected: !!data?.resend?.apiKey },
        anthropic: { connected: !!data?.anthropic?.apiKey },
        openai: { connected: !!data?.openai?.apiKey },
        gemini: { connected: !!data?.gemini?.apiKey },
        serper: { connected: !!data?.serper?.apiKey },
        wordpress: { connected: !!data?.wordpress?.url && !!data?.wordpress?.appPassword },
        setupCompleted: !!data?.setupCompleted,
    }
}

// ── Save API Keys ──

export async function saveApiKey(service: string, config: Record<string, string>) {
    const session = await getAuthSession()
    if (!session?.user?.email) throw new Error("Unauthorized")

    const workspaceId = session.user.workspaceId
    const db = tenantDb(workspaceId)

    // Verify user is OWNER or ADMIN
    const role = session.user.role
    if (role !== "OWNER" && role !== "ADMIN") throw new Error("Insufficient permissions")

    const integrationsRef = db.settingsDoc('integrations')
    await integrationsRef.set({
        [service]: config,
        updatedAt: new Date().toISOString(),
        workspaceId,
    }, { merge: true })

    return { success: true }
}

// ── Test Connections ──

export async function testResendConnection(apiKey: string) {
    try {
        const res = await fetch("https://api.resend.com/domains", {
            headers: { Authorization: `Bearer ${apiKey}` },
        })
        if (res.ok) return { success: true, message: "Connected successfully" }
        return { success: false, message: `API returned ${res.status}` }
    } catch (error) {
        return { success: false, message: "Failed to connect" }
    }
}

export async function testAnthropicConnection(apiKey: string) {
    try {
        const res = await fetch("https://api.anthropic.com/v1/models", {
            headers: {
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
            },
        })
        if (res.ok) return { success: true, message: "Connected successfully" }
        return { success: false, message: `API returned ${res.status}` }
    } catch (error) {
        return { success: false, message: "Failed to connect" }
    }
}

export async function testOpenAIConnection(apiKey: string) {
    try {
        const res = await fetch("https://api.openai.com/v1/models", {
            headers: { Authorization: `Bearer ${apiKey}` },
        })
        if (res.ok) return { success: true, message: "Connected successfully" }
        return { success: false, message: `API returned ${res.status}` }
    } catch (error) {
        return { success: false, message: "Failed to connect" }
    }
}

export async function testGeminiConnection(apiKey: string) {
    try {
        // Lightweight model-list call to verify the key.
        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
        )
        if (res.ok) return { success: true, message: "Connected successfully" }
        return { success: false, message: `API returned ${res.status}` }
    } catch (error) {
        return { success: false, message: "Failed to connect" }
    }
}

export async function testSerperConnection(apiKey: string) {
    try {
        const res = await fetch("https://google.serper.dev/search", {
            method: "POST",
            headers: {
                "X-API-KEY": apiKey,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ q: "test", num: 1 }),
        })
        if (res.ok) return { success: true, message: "Connected successfully" }
        return { success: false, message: `API returned ${res.status}` }
    } catch (error) {
        return { success: false, message: "Failed to connect" }
    }
}

export async function testWordPressConnection(url: string, username: string, appPassword: string) {
    try {
        const wpUrl = url.replace(/\/$/, '')
        const res = await fetch(`${wpUrl}/wp-json/wp/v2/posts?per_page=1`, {
            headers: {
                Authorization: `Basic ${Buffer.from(`${username}:${appPassword}`).toString('base64')}`,
            },
        })
        if (res.ok) return { success: true, message: "Connected successfully" }
        return { success: false, message: `API returned ${res.status}` }
    } catch (error) {
        return { success: false, message: "Failed to connect" }
    }
}

// ── Google Service Helpers ──

async function getGoogleOAuth2Client() {
    const session = await getAuthSession()
    if (!session?.user?.workspaceId) return null

    const db = tenantDb(session.user.workspaceId)
    const doc = await db.settingsDoc('integrations').get()
    const data = doc.data()
    if (!data?.google?.refreshToken) return null

    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
    )
    oauth2Client.setCredentials({
        refresh_token: data.google.refreshToken,
        access_token: data.google.accessToken,
        expiry_date: data.google.expiresAt ? data.google.expiresAt * 1000 : undefined,
    })
    return oauth2Client
}

export async function listGA4Properties() {
    const session = await getAuthSession()
    if (!session?.user?.email) throw new Error("Unauthorized")

    const oauth2Client = await getGoogleOAuth2Client()
    if (!oauth2Client) return { properties: [], error: "Google not connected" }

    try {
        const analyticsAdmin = google.analyticsadmin({ version: 'v1beta', auth: oauth2Client })
        const res = await analyticsAdmin.properties.list({
            filter: 'parent:accounts/-',
            pageSize: 50,
        })

        const properties = (res.data.properties || []).map(p => ({
            id: p.name?.replace('properties/', '') || '',
            displayName: p.displayName || 'Unnamed Property',
        }))

        return { properties, error: null }
    } catch (error: any) {
        console.error("Error listing GA4 properties:", error.message)
        return { properties: [], error: "Failed to list properties. Ensure the account has GA4 properties." }
    }
}

export async function listGSCSites() {
    const session = await getAuthSession()
    if (!session?.user?.email) throw new Error("Unauthorized")

    const oauth2Client = await getGoogleOAuth2Client()
    if (!oauth2Client) return { sites: [], error: "Google not connected" }

    try {
        const searchconsole = google.searchconsole({ version: 'v1', auth: oauth2Client })
        const res = await searchconsole.sites.list()

        const sites = (res.data.siteEntry || []).map(s => ({
            siteUrl: s.siteUrl || '',
            permissionLevel: s.permissionLevel || '',
        }))

        return { sites, error: null }
    } catch (error: any) {
        console.error("Error listing GSC sites:", error.message)
        return { sites: [], error: "Failed to list sites. Ensure the account has Search Console access." }
    }
}

export async function selectGA4Property(propertyId: string) {
    const session = await getAuthSession()
    if (!session?.user?.email) throw new Error("Unauthorized")

    const workspaceId = session.user.workspaceId
    const db = tenantDb(workspaceId)

    await db.settingsDoc('integrations').set({
        google: { ga4PropertyId: propertyId },
        updatedAt: new Date().toISOString(),
        workspaceId,
    }, { merge: true })

    return { success: true }
}

export async function selectGSCSite(siteUrl: string) {
    const session = await getAuthSession()
    if (!session?.user?.email) throw new Error("Unauthorized")

    const workspaceId = session.user.workspaceId
    const db = tenantDb(workspaceId)

    await db.settingsDoc('integrations').set({
        google: { gscSiteUrl: siteUrl },
        updatedAt: new Date().toISOString(),
        workspaceId,
    }, { merge: true })

    return { success: true }
}

// ── Complete Setup ──

export async function completeSetup() {
    const session = await getAuthSession()
    if (!session?.user?.email) throw new Error("Unauthorized")

    const workspaceId = session.user.workspaceId
    const db = tenantDb(workspaceId)

    await db.settingsDoc('integrations').set({
        setupCompleted: true,
        setupCompletedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        workspaceId,
    }, { merge: true })

    // Set cookie so middleware doesn't redirect on every request
    const cookieStore = await cookies()
    cookieStore.set('setup_completed', 'true', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365, // 1 year
        path: '/',
    })

    return { success: true }
}
