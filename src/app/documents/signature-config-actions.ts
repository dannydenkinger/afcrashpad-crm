"use server"

import { tenantDb } from "@/lib/tenant-db"
import { requireAuth } from "@/lib/auth-guard"
import { revalidatePath } from "next/cache"
import { sendEmail } from "@/lib/email"
import crypto from "crypto"
import type { SignatureBlockData } from "./components/SignatureBlock"

// ── Types ──

export interface SignatureConfig {
    id: string
    documentId: string
    contactId: string
    blocks: SignatureBlockData[]
    signers: string[]
    pdfUrl: string
    status: "configuring" | "sent" | "completed"
    createdAt: string
    updatedAt: string
}

// ── Save Signature Config ──

export async function saveSignatureConfig(
    docId: string,
    contactId: string,
    blocks: SignatureBlockData[],
    signers: string[],
    pdfUrl: string
): Promise<{ success: boolean; configId?: string; error?: string }> {
    const session = await requireAuth()
    const workspaceId = session.user.workspaceId
    const db = tenantDb(workspaceId)

    try {
        // Check if a config already exists for this document
        const existing = await db.collection("document_signature_configs")
            .where("documentId", "==", docId)
            .where("contactId", "==", contactId || "")
            .limit(1)
            .get()

        if (!existing.empty) {
            // Update existing config
            const configDoc = existing.docs[0]
            await db.doc("document_signature_configs", configDoc.id).update({
                blocks: blocks.map(b => ({ ...b })),
                signers,
                pdfUrl,
                updatedAt: new Date(),
            })
            return { success: true, configId: configDoc.id }
        }

        // Create new config
        const ref = await db.add("document_signature_configs", {
            documentId: docId,
            contactId: contactId || "",
            blocks: blocks.map(b => ({ ...b })),
            signers,
            pdfUrl,
            status: "configuring",
            createdBy: session.user.email || "",
            createdAt: new Date(),
            updatedAt: new Date(),
        })

        return { success: true, configId: ref.id }
    } catch (error) {
        console.error("Failed to save signature config:", error)
        return { success: false, error: "Failed to save configuration" }
    }
}

// ── Get Signature Config ──

export async function getSignatureConfig(
    docId: string,
    contactId: string
): Promise<{ success: boolean; config?: SignatureConfig; error?: string }> {
    const session = await requireAuth()
    const workspaceId = session.user.workspaceId
    const db = tenantDb(workspaceId)

    try {
        const snapshot = await db.collection("document_signature_configs")
            .where("documentId", "==", docId)
            .where("contactId", "==", contactId || "")
            .limit(1)
            .get()

        if (snapshot.empty) return { success: true } // no config yet

        const doc = snapshot.docs[0]
        const data = doc.data()

        return {
            success: true,
            config: {
                id: doc.id,
                documentId: data.documentId,
                contactId: data.contactId,
                blocks: (data.blocks || []) as SignatureBlockData[],
                signers: (data.signers || []) as string[],
                pdfUrl: data.pdfUrl || "",
                status: data.status || "configuring",
                createdAt: data.createdAt?.toDate?.().toISOString() || "",
                updatedAt: data.updatedAt?.toDate?.().toISOString() || "",
            },
        }
    } catch (error) {
        console.error("Failed to fetch signature config:", error)
        return { success: false, error: "Failed to fetch configuration" }
    }
}

// ── Send Prepared Signatures ──

export async function sendPreparedSignatures(
    configId: string
): Promise<{ success: boolean; sent?: number; error?: string }> {
    const session = await requireAuth()
    const workspaceId = session.user.workspaceId
    const db = tenantDb(workspaceId)

    try {
        const configDoc = await db.doc("document_signature_configs", configId).get()
        if (!configDoc.exists) return { success: false, error: "Configuration not found" }

        const config = configDoc.data()!
        const blocks = (config.blocks || []) as SignatureBlockData[]
        const signers = (config.signers || []) as string[]
        const documentId = config.documentId as string
        const contactId = config.contactId as string
        const pdfUrl = config.pdfUrl as string

        // Fetch the document for its name
        const docRef = contactId
            ? db.subcollection("contacts", contactId, "documents").doc(documentId)
            : db.doc("documents", documentId)
        const docSnap = await docRef.get()
        const docName = docSnap.exists ? (docSnap.data()?.name as string) || "Document" : "Document"

        const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
        const requestIds: string[] = []

        for (const email of signers) {
            const signerBlocks = blocks.filter(b => b.assignedTo === email)
            if (signerBlocks.length === 0) continue

            const token = crypto.randomBytes(32).toString("hex")

            const sigRef = await db.add("signature_requests", {
                documentId,
                contactId: contactId || "",
                standalone: !contactId,
                recipientEmail: email,
                contactEmail: email,
                contactName: email,
                documentName: docName,
                documentUrl: pdfUrl,
                pdfUrl,
                configId,
                signatureBlocks: signerBlocks.map(b => ({ ...b })),
                allBlocks: blocks.map(b => ({ ...b })),
                token,
                status: "pending",
                requestedBy: session.user.email || session.user.name || "Unknown",
                requestedAt: new Date(),
                signedAt: null,
                signatureUrl: null,
            })

            requestIds.push(sigRef.id)

            const signingLink = `${baseUrl}/sign/${token}`
            await sendEmail({
                to: email,
                subject: `Signature Requested: ${docName}`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h2 style="color: #1a1a1a; margin-bottom: 16px;">Document Signature Request</h2>
                        <p style="color: #4a4a4a; font-size: 14px; line-height: 1.6;">
                            ${session.user.name || session.user.email} has requested your signature on <strong>"${docName}"</strong>.
                        </p>
                        <p style="color: #4a4a4a; font-size: 14px; line-height: 1.6;">
                            You have <strong>${signerBlocks.length} signature field${signerBlocks.length !== 1 ? "s" : ""}</strong> to complete.
                        </p>
                        <div style="margin: 24px 0; text-align: center;">
                            <a href="${signingLink}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
                                Review & Sign Document
                            </a>
                        </div>
                        <p style="color: #888; font-size: 12px;">
                            This link is unique to you. Please do not share it.
                        </p>
                    </div>
                `,
            })
        }

        // Update document status
        await docRef.update({
            status: "PENDING",
            signatureRequestIds: requestIds,
            signatureConfigId: configId,
            updatedAt: new Date(),
        })

        // Update config status
        await db.doc("document_signature_configs", configId).update({
            status: "sent",
            updatedAt: new Date(),
        })

        revalidatePath("/documents")
        revalidatePath("/contacts")
        return { success: true, sent: signers.length }
    } catch (error) {
        console.error("Failed to send prepared signatures:", error)
        return { success: false, error: "Failed to send signature requests" }
    }
}

// ── Get Document Details (lightweight) ──

export async function getDocumentForPrepare(
    docId: string,
    contactId: string
): Promise<{ success: boolean; doc?: { name: string; url: string; status: string }; error?: string }> {
    const session = await requireAuth()
    const workspaceId = session.user.workspaceId
    const db = tenantDb(workspaceId)

    try {
        const docRef = contactId
            ? db.subcollection("contacts", contactId, "documents").doc(docId)
            : db.doc("documents", docId)

        const snap = await docRef.get()
        if (!snap.exists) return { success: false, error: "Document not found" }

        const data = snap.data()!
        return {
            success: true,
            doc: {
                name: (data.name as string) || "Untitled",
                url: (data.url as string) || "",
                status: (data.status as string) || "LINK",
            },
        }
    } catch (error) {
        console.error("Failed to fetch document:", error)
        return { success: false, error: "Failed to fetch document" }
    }
}
