import { adminDb } from "@/lib/firebase-admin";
import { randomUUID } from "crypto";
import { createHash } from "crypto";

// ── Types ────────────────────────────────────────────────────────────────────

export interface TrackingRecord {
    id: string;
    emailId: string | null; // Resend email ID
    contactId: string;
    recipientEmail: string;
    subject: string;
    sentAt: Date;
    // Open tracking
    opened: boolean;
    openedAt: Date | null;
    openCount: number;
    // Click tracking
    clickedLinks: { url: string; clickedAt: string; count: number }[];
    totalClicks: number;
    // Link map: trackingId -> original URL
    linkMap: Record<string, string>;
    // Metadata
    userAgent: string | null;
    ipHash: string | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function hashIp(ip: string): string {
    return createHash("sha256").update(ip + (process.env.TRACKING_SALT || "afcrashpad")).digest("hex").slice(0, 16);
}

function getBaseUrl(): string {
    return process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "https://app.afcrashpad.com";
}

// ── Create a tracking record & inject pixel + link wrapping ──────────────────

export async function createTrackedEmail({
    contactId,
    recipientEmail,
    subject,
    html,
}: {
    contactId: string;
    recipientEmail: string;
    subject: string;
    html: string;
}): Promise<{ trackingId: string; trackedHtml: string }> {
    const trackingId = randomUUID();
    const baseUrl = getBaseUrl();

    // Build link map by finding all href links in the HTML
    const linkMap: Record<string, string> = {};
    const trackedHtml = wrapLinksWithTracking(html, trackingId, baseUrl, linkMap);

    // Append tracking pixel
    const pixelUrl = `${baseUrl}/api/track/open/${trackingId}`;
    const pixelImg = `<img src="${pixelUrl}" width="1" height="1" style="display:none;border:0;" alt="" />`;
    const finalHtml = injectPixel(trackedHtml, pixelImg);

    // Store tracking record in Firestore
    await adminDb.collection("email_tracking").doc(trackingId).set({
        contactId,
        recipientEmail,
        subject,
        emailId: null, // Will be updated after Resend returns
        sentAt: new Date(),
        opened: false,
        openedAt: null,
        openCount: 0,
        clickedLinks: [],
        totalClicks: 0,
        linkMap,
        userAgent: null,
        ipHash: null,
    });

    return { trackingId, trackedHtml: finalHtml };
}

/**
 * Update the tracking record with the Resend email ID after sending.
 */
export async function updateTrackingEmailId(trackingId: string, emailId: string) {
    try {
        await adminDb.collection("email_tracking").doc(trackingId).update({ emailId });
    } catch (err) {
        console.error("Failed to update tracking emailId:", err);
    }
}

// ── Record open event ────────────────────────────────────────────────────────

export async function recordOpen(trackingId: string, userAgent: string | null, ip: string | null) {
    try {
        const docRef = adminDb.collection("email_tracking").doc(trackingId);
        const doc = await docRef.get();
        if (!doc.exists) return;

        const data = doc.data()!;
        const updates: Record<string, any> = {
            openCount: (data.openCount || 0) + 1,
        };

        // Only set opened/openedAt on first open
        if (!data.opened) {
            updates.opened = true;
            updates.openedAt = new Date();
        }

        if (userAgent && !data.userAgent) {
            updates.userAgent = userAgent;
        }
        if (ip && !data.ipHash) {
            updates.ipHash = hashIp(ip);
        }

        await docRef.update(updates);
    } catch (err) {
        console.error("Failed to record open:", err);
    }
}

// ── Record click event ───────────────────────────────────────────────────────

export async function recordClick(
    trackingId: string,
    linkId: string,
    userAgent: string | null,
    ip: string | null
): Promise<string | null> {
    try {
        const docRef = adminDb.collection("email_tracking").doc(trackingId);
        const doc = await docRef.get();
        if (!doc.exists) return null;

        const data = doc.data()!;
        const linkMap: Record<string, string> = data.linkMap || {};
        const originalUrl = linkMap[linkId];
        if (!originalUrl) return null;

        // Update click stats
        const clickedLinks: { url: string; clickedAt: string; count: number }[] = data.clickedLinks || [];
        const existing = clickedLinks.find((l) => l.url === originalUrl);
        if (existing) {
            existing.count += 1;
            existing.clickedAt = new Date().toISOString();
        } else {
            clickedLinks.push({
                url: originalUrl,
                clickedAt: new Date().toISOString(),
                count: 1,
            });
        }

        const updates: Record<string, any> = {
            clickedLinks,
            totalClicks: (data.totalClicks || 0) + 1,
        };

        // Also mark as opened if a click happens (user clearly opened the email)
        if (!data.opened) {
            updates.opened = true;
            updates.openedAt = new Date();
            updates.openCount = (data.openCount || 0) + 1;
        }

        if (userAgent && !data.userAgent) {
            updates.userAgent = userAgent;
        }
        if (ip && !data.ipHash) {
            updates.ipHash = hashIp(ip);
        }

        await docRef.update(updates);
        return originalUrl;
    } catch (err) {
        console.error("Failed to record click:", err);
        return null;
    }
}

// ── Fetch tracking data for a contact ────────────────────────────────────────

export async function getTrackingForContact(contactId: string) {
    try {
        const snap = await adminDb
            .collection("email_tracking")
            .where("contactId", "==", contactId)
            .orderBy("sentAt", "desc")
            .limit(50)
            .get();

        return snap.docs.map((doc) => {
            const d = doc.data();
            return {
                id: doc.id,
                emailId: d.emailId,
                contactId: d.contactId,
                recipientEmail: d.recipientEmail,
                subject: d.subject,
                sentAt: d.sentAt?.toDate?.().toISOString() ?? d.sentAt,
                opened: d.opened ?? false,
                openedAt: d.openedAt?.toDate?.().toISOString() ?? d.openedAt ?? null,
                openCount: d.openCount ?? 0,
                clickedLinks: d.clickedLinks ?? [],
                totalClicks: d.totalClicks ?? 0,
            };
        });
    } catch (err) {
        console.error("Failed to get tracking for contact:", err);
        return [];
    }
}

// ── HTML manipulation helpers ────────────────────────────────────────────────

/**
 * Replace href links in HTML with tracked redirect URLs.
 * Skips mailto: and tel: links.
 */
function wrapLinksWithTracking(
    html: string,
    trackingId: string,
    baseUrl: string,
    linkMap: Record<string, string>
): string {
    // Match href="..." in anchor tags
    return html.replace(
        /(<a\s[^>]*href\s*=\s*["'])([^"']+)(["'][^>]*>)/gi,
        (match, prefix, url, suffix) => {
            // Skip non-http links
            if (url.startsWith("mailto:") || url.startsWith("tel:") || url.startsWith("#")) {
                return match;
            }
            // Skip tracking URLs (avoid double-wrapping)
            if (url.includes("/api/track/")) {
                return match;
            }

            const linkId = randomUUID();
            linkMap[linkId] = url;
            const trackedUrl = `${baseUrl}/api/track/click/${trackingId}?l=${linkId}`;
            return `${prefix}${trackedUrl}${suffix}`;
        }
    );
}

/**
 * Inject the tracking pixel before </body> or at the end of HTML.
 */
function injectPixel(html: string, pixelImg: string): string {
    if (html.includes("</body>")) {
        return html.replace("</body>", `${pixelImg}</body>`);
    }
    // No </body> tag — just append
    return html + pixelImg;
}
