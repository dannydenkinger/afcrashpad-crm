"use server"

import { adminDb } from "@/lib/firebase-admin"
import { tenantDb } from "@/lib/tenant-db"
import { requireAuth } from "@/lib/auth-guard"
import { revalidatePath } from "next/cache"
import crypto from "crypto"
import { track } from "@/lib/posthog/server"

// ── E-Signature Actions ──

export async function requestSignature(documentId: string, contactId: string) {
    try {
        const session = await requireAuth()
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)

        // Fetch the contact to get email
        const contactDoc = await db.doc("contacts", contactId).get()
        if (!contactDoc.exists) return { success: false, error: "Contact not found" }
        const contact = contactDoc.data()!

        // Fetch the document
        const docRef = db.subcollection("contacts", contactId, "documents").doc(documentId)
        const docSnap = await docRef.get()
        if (!docSnap.exists) return { success: false, error: "Document not found" }
        const document = docSnap.data()!

        // Generate a unique token
        const token = crypto.randomBytes(32).toString("hex")

        // Create the signature request (workspace-scoped)
        const sigRef = await db.add("signature_requests", {
            documentId,
            contactId,
            contactEmail: contact.email || "",
            contactName: contact.name || "",
            documentName: document.name || "Untitled",
            documentUrl: document.url || "",
            generatedContent: document.generatedContent || "",
            token,
            status: "pending",
            requestedBy: session.user.email || session.user.name || "Unknown",
            requestedAt: new Date(),
            signedAt: null,
            signatureUrl: null,
        })

        // Update the document status to PENDING
        await docRef.update({
            status: "PENDING",
            signatureRequestId: sigRef.id,
            updatedAt: new Date(),
        })

        revalidatePath("/contacts")
        return {
            success: true,
            signingLink: `/sign/${token}`,
            token,
            signatureRequestId: sigRef.id,
        }
    } catch (error) {
        console.error("Failed to create signature request:", error)
        return { success: false, error: "Failed to create signature request" }
    }
}

/**
 * Public-facing — no auth required. Token-based lookup across all workspaces.
 */
export async function getSignatureRequest(token: string) {
    try {
        const snapshot = await adminDb.collection("signature_requests")
            .where("token", "==", token)
            .limit(1)
            .get()

        if (snapshot.empty) return { success: false, error: "Signature request not found" }

        const doc = snapshot.docs[0]
        const data = doc.data()

        return {
            success: true,
            request: {
                id: doc.id,
                documentName: data.documentName,
                documentUrl: data.documentUrl,
                generatedContent: data.generatedContent || "",
                contactName: data.contactName,
                contactEmail: data.contactEmail || data.recipientEmail || "",
                status: data.status,
                requestedAt: data.requestedAt?.toDate ? data.requestedAt.toDate().toISOString() : data.requestedAt,
                signedAt: data.signedAt?.toDate ? data.signedAt.toDate().toISOString() : data.signedAt,
                pdfUrl: data.pdfUrl || "",
                signatureBlocks: data.signatureBlocks || [],
                allBlocks: data.allBlocks || [],
            },
        }
    } catch (error) {
        console.error("Failed to fetch signature request:", error)
        return { success: false, error: "Failed to fetch signature request" }
    }
}

/**
 * Public-facing — no auth required. Token-based submission across all workspaces.
 */
export async function submitSignature(token: string, signatureDataUrl: string) {
    try {
        if (!token || !signatureDataUrl) {
            return { success: false, error: "Missing required fields" }
        }

        // Find the signature request by token (global lookup)
        const snapshot = await adminDb.collection("signature_requests")
            .where("token", "==", token)
            .limit(1)
            .get()

        if (snapshot.empty) return { success: false, error: "Signature request not found" }

        const sigDoc = snapshot.docs[0]
        const sigData = sigDoc.data()

        if (sigData.status === "signed") {
            return { success: false, error: "This document has already been signed" }
        }

        // Update the signature request
        await sigDoc.ref.update({
            status: "signed",
            signedAt: new Date(),
            signatureUrl: signatureDataUrl,
        })

        if (sigData.workspaceId) {
            track({
                workspaceId: sigData.workspaceId,
                event: { name: "document_signed" },
            }).catch(() => {})
        }

        // Check if all signature requests for this document are now signed
        if (sigData.documentId) {
            const allRequestsQuery = sigData.contactId
                ? adminDb.collection("signature_requests")
                    .where("documentId", "==", sigData.documentId)
                    .where("contactId", "==", sigData.contactId)
                : adminDb.collection("signature_requests")
                    .where("documentId", "==", sigData.documentId)
                    .where("standalone", "==", true)

            const allRequests = await allRequestsQuery.get()

            const allSigned = allRequests.docs.every(d => {
                const s = d.data().status
                return s === "signed" || d.id === sigDoc.id
            })

            if (allSigned) {
                // Update either standalone doc or contact-attached doc
                // Use the workspaceId from the signature request data to get the right doc ref
                const docRef = sigData.contactId
                    ? adminDb.collection("contacts").doc(sigData.contactId).collection("documents").doc(sigData.documentId)
                    : adminDb.collection("documents").doc(sigData.documentId)

                await docRef.update({
                    status: "SIGNED",
                    signedAt: new Date(),
                    signatureUrl: signatureDataUrl,
                    updatedAt: new Date(),
                })
            }
        }

        // Create a notification for the CRM user who requested the signature
        try {
            // Use the workspaceId from the signature request to scope the notification
            const workspaceId = sigData.workspaceId
            if (workspaceId) {
                const db = tenantDb(workspaceId)
                await db.add("notifications", {
                    title: "Document Signed",
                    message: `${sigData.contactName || "A contact"} signed "${sigData.documentName || "a document"}"`,
                    type: "document_signed",
                    linkUrl: `/contacts`,
                    read: false,
                    createdAt: new Date(),
                })
            } else {
                await adminDb.collection("notifications").add({
                    title: "Document Signed",
                    message: `${sigData.contactName || "A contact"} signed "${sigData.documentName || "a document"}"`,
                    type: "document_signed",
                    linkUrl: `/contacts`,
                    read: false,
                    createdAt: new Date(),
                })
            }
        } catch {
            // Non-critical: notification creation failure shouldn't block signing
        }

        return { success: true }
    } catch (error) {
        console.error("Failed to submit signature:", error)
        return { success: false, error: "Failed to submit signature" }
    }
}

export async function getSignatureStatus(documentId: string, contactId: string) {
    try {
        const session = await requireAuth()
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)

        const snapshot = await db.collection("signature_requests")
            .where("documentId", "==", documentId)
            .where("contactId", "==", contactId)
            .orderBy("requestedAt", "desc")
            .limit(1)
            .get()

        if (snapshot.empty) return { success: true, request: null }

        const doc = snapshot.docs[0]
        const data = doc.data()

        return {
            success: true,
            request: {
                id: doc.id,
                status: data.status,
                token: data.token,
                signedAt: data.signedAt?.toDate ? data.signedAt.toDate().toISOString() : null,
                signatureUrl: data.signatureUrl,
            },
        }
    } catch (error) {
        console.error("Failed to fetch signature status:", error)
        return { success: false, error: "Failed to fetch status" }
    }
}

// ── Block-Based Signature Submission ──

/**
 * Public-facing — no auth required. Token-based submission.
 */
export async function submitBlockSignatures(
    token: string,
    blockSignatures: { blockId: string; signatureDataUrl: string }[]
) {
    try {
        if (!token || !blockSignatures.length) {
            return { success: false, error: "Missing required fields" }
        }

        const snapshot = await adminDb.collection("signature_requests")
            .where("token", "==", token)
            .limit(1)
            .get()

        if (snapshot.empty) return { success: false, error: "Signature request not found" }

        const sigDoc = snapshot.docs[0]
        const sigData = sigDoc.data()

        if (sigData.status === "signed") {
            return { success: false, error: "This document has already been signed" }
        }

        // Update the signature blocks with signed data
        const updatedBlocks = ((sigData.signatureBlocks || []) as { id: string }[]).map(block => {
            const sig = blockSignatures.find(s => s.blockId === block.id)
            if (sig) {
                return { ...block, signed: true, signatureDataUrl: sig.signatureDataUrl }
            }
            return block
        })

        // Use the first signature as the primary signatureUrl for backward compat
        const primarySigUrl = blockSignatures[0]?.signatureDataUrl || null

        await sigDoc.ref.update({
            status: "signed",
            signedAt: new Date(),
            signatureUrl: primarySigUrl,
            signatureBlocks: updatedBlocks,
        })

        if (sigData.workspaceId) {
            track({
                workspaceId: sigData.workspaceId,
                event: { name: "document_signed" },
            }).catch(() => {})
        }

        // Check if all signature requests for this document are now signed
        if (sigData.documentId) {
            const configId = sigData.configId
            let allRequestsQuery

            if (configId) {
                allRequestsQuery = adminDb.collection("signature_requests")
                    .where("configId", "==", configId)
            } else if (sigData.contactId) {
                allRequestsQuery = adminDb.collection("signature_requests")
                    .where("documentId", "==", sigData.documentId)
                    .where("contactId", "==", sigData.contactId)
            } else {
                allRequestsQuery = adminDb.collection("signature_requests")
                    .where("documentId", "==", sigData.documentId)
                    .where("standalone", "==", true)
            }

            const allRequests = await allRequestsQuery.get()
            const allSigned = allRequests.docs.every(d => {
                const s = d.data().status
                return s === "signed" || d.id === sigDoc.id
            })

            if (allSigned) {
                const docRef = sigData.contactId
                    ? adminDb.collection("contacts").doc(sigData.contactId).collection("documents").doc(sigData.documentId)
                    : adminDb.collection("documents").doc(sigData.documentId)

                await docRef.update({
                    status: "SIGNED",
                    signedAt: new Date(),
                    updatedAt: new Date(),
                })

                // Trigger signed PDF generation if there's a configId
                if (configId) {
                    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
                    try {
                        await fetch(`${baseUrl}/api/documents/generate-signed-pdf`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                configId,
                                documentId: sigData.documentId,
                                contactId: sigData.contactId || "",
                            }),
                        })
                    } catch (err) {
                        console.error("Failed to trigger PDF generation:", err)
                    }
                }
            }
        }

        // Create notification
        try {
            const workspaceId = sigData.workspaceId
            if (workspaceId) {
                const db = tenantDb(workspaceId)
                await db.add("notifications", {
                    title: "Document Signed",
                    message: `${sigData.contactName || sigData.recipientEmail || "A signer"} signed "${sigData.documentName || "a document"}"`,
                    type: "document_signed",
                    linkUrl: `/documents`,
                    read: false,
                    createdAt: new Date(),
                })
            } else {
                await adminDb.collection("notifications").add({
                    title: "Document Signed",
                    message: `${sigData.contactName || sigData.recipientEmail || "A signer"} signed "${sigData.documentName || "a document"}"`,
                    type: "document_signed",
                    linkUrl: `/documents`,
                    read: false,
                    createdAt: new Date(),
                })
            }
        } catch {
            // Non-critical
        }

        return { success: true }
    } catch (error) {
        console.error("Failed to submit block signatures:", error)
        return { success: false, error: "Failed to submit signatures" }
    }
}
