"use server"

import { adminDb } from "@/lib/firebase-admin"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import crypto from "crypto"

// ── E-Signature Actions ──

export async function requestSignature(documentId: string, contactId: string) {
    try {
        const session = await auth()
        if (!session?.user) return { success: false, error: "Unauthorized" }

        // Fetch the contact to get email
        const contactDoc = await adminDb.collection("contacts").doc(contactId).get()
        if (!contactDoc.exists) return { success: false, error: "Contact not found" }
        const contact = contactDoc.data()!

        // Fetch the document
        const docRef = adminDb.collection("contacts").doc(contactId).collection("documents").doc(documentId)
        const docSnap = await docRef.get()
        if (!docSnap.exists) return { success: false, error: "Document not found" }
        const document = docSnap.data()!

        // Generate a unique token
        const token = crypto.randomBytes(32).toString("hex")

        // Create the signature request
        const sigRef = await adminDb.collection("signature_requests").add({
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
                contactEmail: data.contactEmail,
                status: data.status,
                requestedAt: data.requestedAt?.toDate ? data.requestedAt.toDate().toISOString() : data.requestedAt,
                signedAt: data.signedAt?.toDate ? data.signedAt.toDate().toISOString() : data.signedAt,
            },
        }
    } catch (error) {
        console.error("Failed to fetch signature request:", error)
        return { success: false, error: "Failed to fetch signature request" }
    }
}

export async function submitSignature(token: string, signatureDataUrl: string) {
    try {
        if (!token || !signatureDataUrl) {
            return { success: false, error: "Missing required fields" }
        }

        // Find the signature request by token
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

        // Update the document status
        if (sigData.contactId && sigData.documentId) {
            await adminDb
                .collection("contacts")
                .doc(sigData.contactId)
                .collection("documents")
                .doc(sigData.documentId)
                .update({
                    status: "SIGNED",
                    signedAt: new Date(),
                    signatureUrl: signatureDataUrl,
                    updatedAt: new Date(),
                })
        }

        // Create a notification for the CRM user who requested the signature
        try {
            await adminDb.collection("notifications").add({
                title: "Document Signed",
                message: `${sigData.contactName || "A contact"} signed "${sigData.documentName || "a document"}"`,
                type: "document_signed",
                linkUrl: `/contacts`,
                read: false,
                createdAt: new Date(),
            })
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
        const snapshot = await adminDb.collection("signature_requests")
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
