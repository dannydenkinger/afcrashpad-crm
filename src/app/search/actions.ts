"use server"

import { adminDb } from "@/lib/firebase-admin";
import type { SearchResult } from "./types";

export async function globalSearch(q: string): Promise<{
    contacts: SearchResult[];
    opportunities: SearchResult[];
    notes: SearchResult[];
}> {
    try {
        const query = q?.trim().toLowerCase() || "";
        if (query.length < 2) return { contacts: [], opportunities: [], notes: [] };

        const contactsSnap = await adminDb.collection("contacts").get();
        const contacts: SearchResult[] = [];
        const contactIds = new Set<string>();
        const opps: SearchResult[] = [];
        const notes: SearchResult[] = [];

        for (const doc of contactsSnap.docs) {
            const d = doc.data();
            const name = (d.name || "").toLowerCase();
            const email = (d.email || "").toLowerCase();
            const phone = (d.phone || "").replace(/\D/g, "");
            const qNorm = query.replace(/\D/g, "");

            const matches =
                name.includes(query) ||
                email.includes(query) ||
                (qNorm.length >= 3 && phone.includes(qNorm));

            if (matches) {
                contacts.push({
                    id: doc.id,
                    name: d.name || "Unknown",
                    email: d.email || "",
                    type: "contact",
                });
                contactIds.add(doc.id);
            }
        }

        const oppsSnap = await adminDb.collection("opportunities").get();
        const contactsMap: Record<string, string> = {};
        for (const doc of oppsSnap.docs) {
            const d = doc.data();
            let contactName = contactsMap[d.contactId];
            if (!contactName && d.contactId) {
                const cDoc = await adminDb.collection("contacts").doc(d.contactId).get();
                contactName = cDoc.exists ? (cDoc.data()?.name as string) || "Unknown" : "Unknown";
                contactsMap[d.contactId] = contactName;
            }
            const name = (contactName || "").toLowerCase();
            if (name.includes(query)) {
                opps.push({
                    id: doc.id,
                    name: contactName || "Unknown",
                    contactId: d.contactId,
                    contactName,
                    type: "opportunity",
                });
            }
        }

        for (const contactId of Array.from(contactIds)) {
            const notesSnap = await adminDb
                .collection("contacts")
                .doc(contactId)
                .collection("notes")
                .orderBy("createdAt", "desc")
                .limit(5)
                .get();

            const contact = contacts.find((c) => c.id === contactId);
            const contactName = contact && "name" in contact ? contact.name : "Unknown";

            for (const nDoc of notesSnap.docs) {
                const content = (nDoc.data().content || "").toLowerCase();
                if (content.includes(query)) {
                    const full = nDoc.data().content || "";
                    notes.push({
                        id: nDoc.id,
                        content: full.length > 80 ? full.slice(0, 80) + "…" : full,
                        contactId,
                        contactName,
                        type: "note",
                    });
                }
            }
        }

        return {
            contacts: contacts.slice(0, 8),
            opportunities: opps.slice(0, 8),
            notes: notes.slice(0, 5),
        };
    } catch (error) {
        console.error("Search error:", error);
        return { contacts: [], opportunities: [], notes: [] };
    }
}
