import { adminDb, adminMessaging } from "@/lib/firebase-admin";
import { tenantDb } from "@/lib/tenant-db";
import { sendEmail } from "@/lib/email";

/**
 * Sends an email notification to all workspace members who have email notifications
 * enabled for the given notification type.
 */
export async function sendEmailToEligibleUsers(workspaceId: string, notification: {
    title: string;
    message: string;
    type: string;
    linkUrl?: string | null;
}) {
    try {
        // Get workspace member IDs
        const membersSnap = await adminDb
            .collection("workspace_members")
            .where("workspaceId", "==", workspaceId)
            .get();

        if (membersSnap.empty) return;

        // Batch-fetch user docs for all members
        const memberUserIds = membersSnap.docs.map(d => d.data().userId).filter(Boolean);
        if (memberUserIds.length === 0) return;

        const userRefs = memberUserIds.map(uid => adminDb.collection("users").doc(uid));
        const userDocs = await adminDb.getAll(...userRefs);

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

        // Map notification type to preference key
        const typeToKey: Record<string, string> = {
            opportunity: "email_opportunity",
            contact: "email_contact",
            checkin: "email_checkin",
            checkout: "email_checkout",
            task: "email_task",
        };

        const prefKey = typeToKey[notification.type];

        for (const userDoc of userDocs) {
            if (!userDoc.exists) continue;
            const user = userDoc.data()!;
            if (!user.email) continue;

            const prefs = user.notificationPreferences;

            // If user has no preferences set, default to email enabled
            if (prefs) {
                // Master email toggle
                if (prefs.emailEnabled === false) continue;
                // Per-type toggle
                if (prefKey && prefs[prefKey] === false) continue;
            }

            const linkHtml = notification.linkUrl
                ? `<p style="margin-top: 16px;"><a href="${baseUrl}${notification.linkUrl}" style="display: inline-block; padding: 10px 20px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600;">View in CRM</a></p>`
                : "";

            const html = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="padding: 24px; background-color: #0a0a0a; border-radius: 8px;">
                        <h2 style="color: #f5f5f5; margin: 0 0 8px;">${notification.title}</h2>
                        <p style="color: #a3a3a3; margin: 0; font-size: 15px;">${notification.message}</p>
                        ${linkHtml}
                    </div>
                    <p style="color: #737373; font-size: 12px; margin-top: 16px; text-align: center;">
                        Vesta CRM &bull; You can manage email preferences in Settings
                    </p>
                </div>
            `;

            try {
                await sendEmail({
                    to: user.email,
                    subject: `${notification.title} — ${notification.message}`,
                    html,
                });
            } catch (emailErr) {
                console.error(`Failed to send notification email to ${user.email}:`, emailErr);
            }
        }
    } catch (err) {
        console.error("Email dispatch error:", err);
    }
}

/**
 * Sends a push notification to all workspace members who have push enabled
 * for the given notification type and have FCM tokens stored.
 */
export async function sendPushToEligibleUsers(workspaceId: string, notification: {
    title: string;
    message: string;
    type: string;
    linkUrl?: string | null;
}) {
    try {
        // Get workspace member IDs
        const membersSnap = await adminDb
            .collection("workspace_members")
            .where("workspaceId", "==", workspaceId)
            .get();

        if (membersSnap.empty) return;

        // Batch-fetch user docs for all members
        const memberUserIds = membersSnap.docs.map(d => d.data().userId).filter(Boolean);
        if (memberUserIds.length === 0) return;

        const userRefs = memberUserIds.map(uid => adminDb.collection("users").doc(uid));
        const userDocs = await adminDb.getAll(...userRefs);

        const typeToKey: Record<string, string> = {
            opportunity: "push_opportunity",
            contact: "push_contact",
            checkin: "push_checkin",
            checkout: "push_checkout",
            task: "push_task",
        };

        const prefKey = typeToKey[notification.type];

        for (const userDoc of userDocs) {
            if (!userDoc.exists) continue;
            const user = userDoc.data()!;
            const fcmTokens: string[] = user.fcmTokens || [];
            if (fcmTokens.length === 0) continue;

            const prefs = user.notificationPreferences;

            // Push requires explicit opt-in (unlike email which defaults on)
            if (!prefs || prefs.pushEnabled !== true) continue;
            if (prefKey && prefs[prefKey] === false) continue;

            const tokensToRemove: string[] = [];

            for (const token of fcmTokens) {
                try {
                    await adminMessaging.send({
                        token,
                        data: {
                            title: notification.title,
                            body: notification.message,
                            url: notification.linkUrl || "/pipeline",
                        },
                    });
                } catch (err: any) {
                    if (
                        err?.code === "messaging/invalid-registration-token" ||
                        err?.code === "messaging/registration-token-not-registered"
                    ) {
                        tokensToRemove.push(token);
                    } else {
                        console.error(`Push failed for token ${token.slice(0, 10)}...`, err);
                    }
                }
            }

            // Clean up stale tokens
            if (tokensToRemove.length > 0) {
                const validTokens = fcmTokens.filter(t => !tokensToRemove.includes(t));
                await adminDb.collection("users").doc(userDoc.id).update({
                    fcmTokens: validTokens,
                });
            }
        }
    } catch (err) {
        console.error("Push dispatch error:", err);
    }
}
