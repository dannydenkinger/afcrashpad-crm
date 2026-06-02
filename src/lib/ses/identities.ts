import {
    CreateEmailIdentityCommand,
    DeleteEmailIdentityCommand,
    GetEmailIdentityCommand,
    VerificationStatus,
} from "@aws-sdk/client-sesv2"
import { adminDb } from "@/lib/firebase-admin"
import { getSesClient } from "@/lib/ses/client"

export type SesIdentityStatus = "PENDING" | "VERIFIED" | "FAILED"

export interface SesIdentityConfig {
    identityType: "DOMAIN" | "EMAIL_ADDRESS"
    identity: string
    status: SesIdentityStatus
    dkimTokens: string[]
    fromAddress: string | null
    fromName: string | null
    createdAt: string
    verifiedAt?: string
    lastCheckedAt: string
}

function settingsDocRef(workspaceId: string) {
    return adminDb.collection("settings").doc(`${workspaceId}_integrations`)
}

function workspaceDocRef(workspaceId: string) {
    return adminDb.collection("workspaces").doc(workspaceId)
}

function isDomain(value: string): boolean {
    return !value.includes("@")
}

function mapVerificationStatus(status?: VerificationStatus | string): SesIdentityStatus {
    if (status === VerificationStatus.SUCCESS || status === "SUCCESS") return "VERIFIED"
    if (status === VerificationStatus.FAILED || status === "FAILED") return "FAILED"
    return "PENDING"
}

export async function getIdentity(workspaceId: string): Promise<SesIdentityConfig | null> {
    if (!workspaceId) throw new Error("workspaceId required")
    const snap = await settingsDocRef(workspaceId).get()
    const ses = snap.exists ? snap.data()?.ses : null
    return ses ? (ses as SesIdentityConfig) : null
}

export async function createIdentity(
    workspaceId: string,
    identity: string,
    opts: { fromAddress?: string; fromName?: string } = {},
): Promise<SesIdentityConfig> {
    if (!workspaceId) throw new Error("workspaceId required")
    if (!identity) throw new Error("identity (domain or email) required")

    const identityType = isDomain(identity) ? "DOMAIN" : "EMAIL_ADDRESS"
    const client = getSesClient()

    const result = await client.send(
        new CreateEmailIdentityCommand({
            EmailIdentity: identity,
        }),
    )

    const dkimTokens = result.DkimAttributes?.Tokens ?? []
    const status = mapVerificationStatus(result.VerifiedForSendingStatus ? "SUCCESS" : undefined)
    const now = new Date().toISOString()

    const config: SesIdentityConfig = {
        identityType,
        identity,
        status,
        dkimTokens,
        fromAddress: opts.fromAddress ?? (identityType === "EMAIL_ADDRESS" ? identity : null),
        fromName: opts.fromName ?? null,
        createdAt: now,
        lastCheckedAt: now,
    }

    await settingsDocRef(workspaceId).set(
        { ses: config, workspaceId, updatedAt: new Date() },
        { merge: true },
    )
    await workspaceDocRef(workspaceId).update({
        ses_identity_status: status,
        updatedAt: new Date(),
    })

    return config
}

export async function refreshStatus(workspaceId: string): Promise<SesIdentityConfig | null> {
    const existing = await getIdentity(workspaceId)
    if (!existing) return null

    const client = getSesClient()
    const result = await client.send(
        new GetEmailIdentityCommand({ EmailIdentity: existing.identity }),
    )

    const dkimStatus = result.DkimAttributes?.Status
    const nextStatus: SesIdentityStatus = result.VerifiedForSendingStatus
        ? "VERIFIED"
        : mapVerificationStatus(dkimStatus)

    const now = new Date().toISOString()
    const updated: SesIdentityConfig = {
        ...existing,
        status: nextStatus,
        dkimTokens: result.DkimAttributes?.Tokens ?? existing.dkimTokens,
        lastCheckedAt: now,
    }
    if (nextStatus === "VERIFIED" && !updated.verifiedAt) {
        updated.verifiedAt = now
    } else if (!updated.verifiedAt) {
        delete updated.verifiedAt
    }

    await settingsDocRef(workspaceId).set(
        { ses: updated, workspaceId, updatedAt: new Date() },
        { merge: true },
    )
    await workspaceDocRef(workspaceId).update({
        ses_identity_status: nextStatus,
        updatedAt: new Date(),
    })

    return updated
}

export async function deleteIdentity(workspaceId: string): Promise<void> {
    const existing = await getIdentity(workspaceId)
    if (!existing) return

    const client = getSesClient()
    try {
        await client.send(new DeleteEmailIdentityCommand({ EmailIdentity: existing.identity }))
    } catch (err) {
        console.error("[SES] Failed to delete identity on AWS side:", err)
    }

    await settingsDocRef(workspaceId).set(
        { ses: null, workspaceId, updatedAt: new Date() },
        { merge: true },
    )
    await workspaceDocRef(workspaceId).update({
        ses_identity_status: "PENDING",
        updatedAt: new Date(),
    })
}

export async function updateFromAddress(
    workspaceId: string,
    fromAddress: string,
    fromName?: string,
): Promise<SesIdentityConfig> {
    const existing = await getIdentity(workspaceId)
    if (!existing) throw new Error("No SES identity configured for workspace")

    const updated: SesIdentityConfig = {
        ...existing,
        fromAddress,
        fromName: fromName ?? existing.fromName,
    }
    await settingsDocRef(workspaceId).set(
        { ses: updated, workspaceId, updatedAt: new Date() },
        { merge: true },
    )
    return updated
}
