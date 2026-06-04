import { NextResponse } from 'next/server';
import { tenantDb } from '@/lib/tenant-db';
import { sendTrackedEmail } from '@/lib/email';
import { createNotification } from '@/app/notifications/actions';
import { triggerSequence } from '@/lib/email-sequences';
import { determineAssignee } from '@/lib/auto-assign';
import * as z from 'zod';
import { rateLimit, getRateLimitKey } from '@/lib/rate-limit';
import { validateApiKey } from '@/lib/api-auth';
import { calculateOnBaseLodging, lodgingData } from '@/lib/calculators/on-base';

function normalizeDateToYmd(input: unknown): string | null {
    if (!input) return null;
    const s = String(input).trim();
    if (!s) return null;

    // YYYY-MM-DD
    const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) return s;

    // MM/DD/YYYY
    const usMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (usMatch) {
        const mm = String(Number(usMatch[1])).padStart(2, '0');
        const dd = String(Number(usMatch[2])).padStart(2, '0');
        const yyyy = usMatch[3];
        return `${yyyy}-${mm}-${dd}`;
    }

    // Best-effort Date parse
    const d = new Date(s);
    if (isNaN(d.getTime())) return null;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function ymdToIsoNoon(ymd: string): string | null {
    const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    const yyyy = Number(m[1]);
    const mm = Number(m[2]);
    const dd = Number(m[3]);
    const d = new Date(yyyy, mm - 1, dd, 12, 0, 0);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
}

// Normalize an incoming base/location string against the known on-base lodging
// keys (e.g. "Luke AFB" -> "Luke AFB, AZ"). Falls back to the raw value when
// no confident match is found (the value calc returns 0 for unknown bases).
function normalizeBaseName(input: unknown): string | null {
    const raw = String(input ?? '').trim();
    if (!raw) return null;
    const keys = Object.keys(lodgingData);
    const rawLower = raw.toLowerCase();

    const exact = keys.find(k => k.toLowerCase() === rawLower);
    if (exact) return exact;

    // If the form sends "Luke AFB" (no state), try a single unambiguous match.
    const starts = keys.filter(k => k.toLowerCase().startsWith(`${rawLower},`));
    if (starts.length === 1) return starts[0];

    const includes = keys.filter(k => k.toLowerCase().includes(rawLower));
    if (includes.length === 1) return includes[0];

    // Fall back to the raw value (value calc will be 0 if unknown)
    return raw;
}

// Define the expected schema from the webhook
const webhookSchema = z.object({
    name: z.string().optional(),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    email: z.string().email("Valid email is required"),
    phone: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    base: z.string().optional(),
    location: z.string().optional(), // legacy/fallback alias for base
    notes: z.string().optional(),
    value: z.number().optional(),
    special_accommodations: z.union([z.string(), z.array(z.string())]).nullish(),
    reason_for_stay: z.string().optional(),
});

export async function POST(req: Request) {
    try {
        // Rate limit: 30 webhook submissions per minute per IP
        const { allowed } = rateLimit(getRateLimitKey(req, "webhook"), 30)
        if (!allowed) {
            return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
        }

        // Parse body once upfront (needed for both auth and payload processing)
        const rawBody = await req.json();

        // 1. Authenticate Request
        // Supports: Authorization header, x-api-key header, ?api_key= query param
        // (for Elementor which can't set headers), and _auth body field (for sendBeacon)
        const authHeader = req.headers.get('authorization');
        const expectedApiKey = process.env.WEBHOOK_API_KEY;
        const queryApiKey = new URL(req.url).searchParams.get('api_key');

        let authenticated = false;
        let workspaceId: string | null = null;

        if (expectedApiKey && authHeader === `Bearer ${expectedApiKey}`) {
            authenticated = true;
            workspaceId = process.env.DEFAULT_WORKSPACE_ID || null;
        }

        // Support api_key query param matching the static env key (for Elementor)
        if (!authenticated && expectedApiKey && queryApiKey === expectedApiKey) {
            authenticated = true;
            workspaceId = process.env.DEFAULT_WORKSPACE_ID || null;
        }

        // Fall back to managed API key authentication (header-based)
        if (!authenticated) {
            const apiKeyResult = await validateApiKey(req);
            if (apiKeyResult) {
                authenticated = true;
                workspaceId = apiKeyResult.workspaceId;
            }
        }

        // Support managed API key passed via ?api_key= query param (Elementor can't set headers)
        if (!authenticated && queryApiKey) {
            const fakeReq = new Request(req.url, {
                headers: { "authorization": `Bearer ${queryApiKey}` },
            });
            const apiKeyResult = await validateApiKey(fakeReq);
            if (apiKeyResult) {
                authenticated = true;
                workspaceId = apiKeyResult.workspaceId;
            }
        }

        // Fall back to _auth field in request body (for sendBeacon which can't set headers)
        if (!authenticated && rawBody._auth) {
            const fakeReq = new Request(req.url, {
                headers: { "authorization": `Bearer ${rawBody._auth}` },
            });
            const apiKeyResult = await validateApiKey(fakeReq);
            if (apiKeyResult) {
                authenticated = true;
                workspaceId = apiKeyResult.workspaceId;
            }
        }

        if (!authenticated) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!workspaceId) {
            return NextResponse.json({ error: 'Could not determine workspace' }, { status: 400 });
        }

        const db = tenantDb(workspaceId);

        // 2. Parse and Normalize Payload (support multiple form providers)
        const { _auth, ...raw } = rawBody;

        // Normalize UTM params
        const utmSource = raw.utm_source ?? raw.utmSource ?? raw.UTM_Source ?? null;
        const utmMedium = raw.utm_medium ?? raw.utmMedium ?? raw.UTM_Medium ?? null;
        const utmCampaign = raw.utm_campaign ?? raw.utmCampaign ?? raw.UTM_Campaign ?? null;
        const utmTerm = raw.utm_term ?? raw.utmTerm ?? raw.UTM_Term ?? null;
        const utmContent = raw.utm_content ?? raw.utmContent ?? raw.UTM_Content ?? null;
        const body: any = {
            ...raw,
            first_name: raw.first_name ?? raw.firstName ?? raw.FirstName ?? raw.fname ?? null,
            last_name: raw.last_name ?? raw.lastName ?? raw.LastName ?? raw.lname ?? null,
            email: raw.email ?? raw.Email ?? null,
            phone: raw.phone ?? raw.Phone ?? raw.phone_number ?? raw.phoneNumber ?? null,
            startDate:
                raw.startDate ??
                raw.start_date ??
                raw.estimated_arrival_date ??
                raw.estimatedArrivalDate ??
                raw.arrival_date ??
                raw.arrivalDate ??
                null,
            endDate:
                raw.endDate ??
                raw.end_date ??
                raw.estimated_departure_date ??
                raw.estimatedDepartureDate ??
                raw.departure_date ??
                raw.departureDate ??
                null,
            // AF: prefer base, fall back to location alias
            base: raw.base ?? raw.Base ?? raw.location ?? raw.Location ?? null,
            location: raw.location ?? raw.Location ?? raw.base ?? raw.Base ?? null,
            notes: raw.notes ?? raw.message ?? raw.Message ?? raw.comment ?? raw.Comment ?? null,
            value: raw.value ?? raw.dealValue ?? raw.deal_value ?? null,
            special_accommodations:
                raw.special_accommodations ??
                raw.specialAccommodation ??
                raw.special_accommodation ??
                null,
            reason_for_stay:
                raw.reason_for_stay ??
                raw.reasonForStay ??
                raw.reason ??
                null,
        };

        const parseResult = webhookSchema.safeParse(body);

        if (!parseResult.success) {
            return NextResponse.json({
                error: 'Invalid payload',
                details: parseResult.error.issues
            }, { status: 400 });
        }

        const data = parseResult.data;
        const finalName = data.name || `${data.first_name || ''} ${data.last_name || ''}`.trim() || 'Website Lead';

        // Capture extra/custom fields not in the known set
        const knownKeys = new Set([
            'name', 'first_name', 'last_name', 'email', 'phone', 'notes', 'message', 'comment',
            'firstName', 'lastName', 'FirstName', 'LastName', 'fname', 'lname', 'Email', 'Phone',
            'phone_number', 'phoneNumber', 'startDate', 'start_date', 'arrival_date', 'arrivalDate',
            'estimated_arrival_date', 'estimatedArrivalDate', 'estimated_departure_date', 'estimatedDepartureDate',
            'endDate', 'end_date', 'departure_date', 'departureDate', 'location', 'Location', 'base', 'Base',
            'value', 'dealValue', 'deal_value', 'Message', 'Comment',
            'special_accommodations', 'specialAccommodation', 'special_accommodation',
            'reason_for_stay', 'reasonForStay', 'reason',
            'utm_source', 'utmSource', 'UTM_Source', 'utm_medium', 'utmMedium', 'UTM_Medium',
            'utm_campaign', 'utmCampaign', 'UTM_Campaign', 'utm_term', 'utmTerm', 'UTM_Term',
            'utm_content', 'utmContent', 'UTM_Content',
            '_auth', 'page_url', 'page_title',
        ]);
        const extraFields: Record<string, string> = {};
        for (const [key, val] of Object.entries(raw)) {
            if (!knownKeys.has(key) && val && String(val).trim()) {
                extraFields[key] = String(val).trim();
            }
        }

        // Format dates if provided
        const startYmd = normalizeDateToYmd(data.startDate);
        const endYmd = normalizeDateToYmd(data.endDate);
        const formattedStartDate = startYmd ? ymdToIsoNoon(startYmd) : null;
        const formattedEndDate = endYmd ? ymdToIsoNoon(endYmd) : null;

        // AF: resolve military base. Prefer base, fall back to location alias.
        const rawBase = data.base ?? data.location ?? null;
        const baseName = normalizeBaseName(rawBase);

        // AF: normalize special accommodations into an array of labels, then map
        // the first label to an existing option in the special_accommodations collection.
        const specialAccommodationLabels = (Array.isArray(data.special_accommodations) ? data.special_accommodations : [data.special_accommodations])
            .filter(Boolean)
            .map(v => String(v).trim())
            .filter(v => v && v !== "- None -" && v.toLowerCase() !== "none");

        let specialAccommodationId: string | null = null;
        if (specialAccommodationLabels.length > 0) {
            try {
                const accSnap = await db.collection('special_accommodations')
                    .where('name', '==', specialAccommodationLabels[0])
                    .limit(1)
                    .get();
                if (!accSnap.empty) {
                    specialAccommodationId = accSnap.docs[0].id;
                }
            } catch (accErr) {
                console.error("Special accommodation lookup failed (non-blocking):", accErr);
            }
        }

        // 3. Find or Create Contact
        let contactId: string;

        const existingContacts = await db.collection('contacts')
            .where('email', '==', data.email)
            .limit(1)
            .get();

        if (existingContacts.empty) {
            const contactRef = await db.add('contacts', {
                name: finalName,
                email: data.email,
                phone: data.phone || null,
                status: 'Lead',
                militaryBase: baseName,
                stayStartDate: formattedStartDate,
                stayEndDate: formattedEndDate,
                ...(data.location && { location: data.location }),
                ...(utmSource && { utmSource }),
                ...(utmMedium && { utmMedium }),
                ...(utmCampaign && { utmCampaign }),
                ...(utmTerm && { utmTerm }),
                ...(utmContent && { utmContent }),
                ...(Object.keys(extraFields).length > 0 && { customFormFields: extraFields }),
                createdAt: new Date(),
                updatedAt: new Date()
            });
            contactId = contactRef.id;

            // Trigger new_contact email sequence for new contacts
            triggerSequence(workspaceId, "new_contact", contactId, data.email, finalName, {
                base: baseName || "",
                location: data.location || baseName || "",
                startDate: startYmd || "",
                endDate: endYmd || "",
            }).catch(() => {});
        } else {
            contactId = existingContacts.docs[0].id;
            const contactData = existingContacts.docs[0].data();

            await db.doc('contacts', contactId).update({
                name: finalName || contactData.name,
                phone: data.phone || contactData.phone,
                militaryBase: baseName || contactData.militaryBase,
                stayStartDate: formattedStartDate || contactData.stayStartDate,
                stayEndDate: formattedEndDate || contactData.stayEndDate,
                updatedAt: new Date()
            });
        }

        // 4. Determine default pipeline and stage
        let targetStageId = null;
        const pipelinesSnap = await db.collection('pipelines').get();
        // Sort client-side since Query doesn't support orderBy after where
        const sortedPipelines = pipelinesSnap.docs.sort((a, b) => {
            const aTime = a.data().createdAt?.toDate?.()?.getTime() || 0;
            const bTime = b.data().createdAt?.toDate?.()?.getTime() || 0;
            return aTime - bTime;
        });

        if (sortedPipelines.length > 0) {
            const defaultPipeline = sortedPipelines[0];
            const stagesSnap = await db.subcollection('pipelines', defaultPipeline.id, 'stages').orderBy('order', 'asc').get();

            if (!stagesSnap.empty) {
                const stages = stagesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                const newLeadStage = stages.find((s: any) =>
                    s.name.toLowerCase().includes('new lead') ||
                    s.name.toLowerCase().includes('inquiry')
                ) || stages[0];

                targetStageId = newLeadStage.id;
            }
        }

        if (!targetStageId) {
            return NextResponse.json({ error: 'No pipeline stages found to assign the opportunity.' }, { status: 500 });
        }

        // 5. Set opportunity value.
        // If the payload supplies an explicit value, use it. Otherwise compute the
        // on-base lodging total from the base + stay dates (AF behavior), and set
        // estimatedProfit to 25% of that total.
        let opportunityValue = data.value || 0;
        let estimatedProfit = 0;
        if (data.value != null) {
            estimatedProfit = Math.round(opportunityValue * 0.25);
        } else if (baseName && startYmd && endYmd) {
            const calc = calculateOnBaseLodging(baseName, startYmd, endYmd);
            opportunityValue = calc.totalCost;
            estimatedProfit = Math.round(opportunityValue * 0.25);
        }

        // Build notes — include known notes field plus any extra/custom fields
        const noteParts: string[] = [];
        if (data.notes && data.notes.trim().length > 0) noteParts.push(`Notes: ${data.notes}`);
        if (specialAccommodationLabels.length > 0) noteParts.push(`Special Accommodations: ${specialAccommodationLabels.join(", ")}`);
        if (data.reason_for_stay && data.reason_for_stay.trim()) noteParts.push(`Reason for Stay: ${data.reason_for_stay}`);

        // Add extra fields to notes with readable labels
        for (const [key, val] of Object.entries(extraFields)) {
            const label = key.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            noteParts.push(`${label}: ${val}`);
        }

        // Include page info if present
        if (raw.page_url) noteParts.push(`Page: ${raw.page_url}`);

        const sharedNotes = noteParts.length > 0 ? `Website Inquiry:\n${noteParts.join('\n')}` : null;

        // 6. Create the Opportunity
        const opportunityName = `${finalName} - Inquiry`;
        const oppRef = await db.add('opportunities', {
            contactId: contactId,
            pipelineStageId: targetStageId,
            name: opportunityName,
            priority: "MEDIUM",
            opportunityValue,
            estimatedProfit,
            source: 'webhook',
            startDate: formattedStartDate,
            endDate: formattedEndDate,
            stayStartDate: formattedStartDate,
            stayEndDate: formattedEndDate,
            militaryBase: baseName,
            reasonForStay: data.reason_for_stay?.trim?.() ? data.reason_for_stay.trim() : null,
            specialAccommodationId,
            specialAccommodationLabels: specialAccommodationLabels.length > 0 ? specialAccommodationLabels : [],
            ...(data.location && { location: data.location }),
            notes: sharedNotes,
            ...(utmSource && { utmSource }),
            ...(utmMedium && { utmMedium }),
            ...(utmCampaign && { utmCampaign }),
            ...(utmTerm && { utmTerm }),
            ...(utmContent && { utmContent }),
            unread: true,
            unreadAt: new Date(),
            lastSeenAt: null,
            lastSeenBy: null,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        // 6b. Auto-assign based on configured rules
        let autoAssignedTo: string | null = null;
        try {
            const assignee = await determineAssignee(workspaceId, {
                leadSource: utmSource || 'webhook',
                base: baseName || null,
                source: utmSource || 'webhook',
            });
            if (assignee) {
                await oppRef.update({
                    assignedTo: assignee.userId,
                    assignedToName: assignee.userName,
                });
                autoAssignedTo = assignee.userName;
            }
        } catch (assignErr) {
            console.error("Auto-assignment failed (non-blocking):", assignErr);
        }

        // 7. Create Contact Note
        if (sharedNotes) {
            await db.addToSubcollection('contacts', contactId, 'notes', {
                content: sharedNotes,
                contactId: contactId,
                opportunityId: oppRef.id,
                source: "webhook",
                createdAt: new Date(),
                updatedAt: new Date()
            });
        }

        // 7b. Auto-link referral by email match
        if (data.email) {
            try {
                const refSnap = await db.collection('referrals')
                    .where('referredEmail', '==', data.email)
                    .limit(1)
                    .get();
                if (!refSnap.empty) {
                    const refDoc = refSnap.docs[0];
                    const refData = refDoc.data();
                    if (refData.status === 'pending') {
                        await refDoc.ref.update({
                            referredContactId: contactId,
                            referredOpportunityId: oppRef.id,
                            referredName: finalName,
                            dealValue: opportunityValue,
                            status: 'contacted',
                        });
                    }
                }
            } catch (refErr) {
                console.error("Referral linking failed (non-blocking):", refErr);
            }
        }

        // 8. Create a notification (fire-and-forget, uses requireAuth internally so we skip in webhook context)
        try {
            await db.add('notifications', {
                title: "New Website Inquiry",
                message: `${finalName}${baseName ? ` - ${baseName}` : ""}`,
                type: "opportunity",
                linkUrl: `/pipeline?deal=${oppRef.id}`,
                read: false,
                createdAt: new Date(),
                updatedAt: new Date(),
            });
        } catch (notifErr) {
            console.error("Notification creation failed (non-blocking):", notifErr);
        }

        // 9. Auto-reply email if enabled
        let autoReplySent = false;
        try {
            const settingsDoc = await db.settingsDoc('automations').get();
            const autoSettings = settingsDoc.exists ? settingsDoc.data() : null;

            if (autoSettings?.autoReplyEnabled && autoSettings?.autoReplyTemplateId && data.email) {
                const templateDoc = await db.doc('email_templates', autoSettings.autoReplyTemplateId).get();
                if (templateDoc.exists) {
                    const template = templateDoc.data()!;
                    const replyBody = (template.body || "")
                        .replace(/\{\{name\}\}/g, finalName)
                        .replace(/\{\{base\}\}/g, baseName || "your requested location")
                        .replace(/\{\{location\}\}/g, baseName || data.location || "your requested location");
                    const replySubject = (template.subject || "")
                        .replace(/\{\{name\}\}/g, finalName)
                        .replace(/\{\{base\}\}/g, baseName || "your requested location")
                        .replace(/\{\{location\}\}/g, baseName || data.location || "your requested location");

                    const inquiryParts: string[] = [];
                    if (finalName) inquiryParts.push(`<strong>Name:</strong> ${finalName}`);
                    inquiryParts.push(`<strong>Email:</strong> ${data.email}`);
                    if (data.phone) inquiryParts.push(`<strong>Phone:</strong> ${data.phone}`);
                    if (baseName) inquiryParts.push(`<strong>Base:</strong> ${baseName}`);
                    if (startYmd) inquiryParts.push(`<strong>Arrival:</strong> ${startYmd}`);
                    if (endYmd) inquiryParts.push(`<strong>Departure:</strong> ${endYmd}`);
                    if (data.reason_for_stay) inquiryParts.push(`<strong>Reason for Stay:</strong> ${data.reason_for_stay}`);
                    if (specialAccommodationLabels.length > 0) inquiryParts.push(`<strong>Special Accommodations:</strong> ${specialAccommodationLabels.join(", ")}`);
                    if (data.notes) inquiryParts.push(`<strong>Notes:</strong> ${data.notes}`);

                    const replyBodyHtml = replyBody.replace(/\n/g, "<br>");

                    const emailHtml = `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <div style="padding: 24px;">
                                ${replyBodyHtml}
                            </div>
                            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
                            <div style="padding: 16px 24px; background-color: #f9fafb; border-radius: 8px; margin: 0 24px 24px;">
                                <p style="margin: 0 0 12px; font-weight: 600; color: #374151;">Your Original Inquiry:</p>
                                <div style="font-size: 14px; color: #6b7280; line-height: 1.6;">
                                    ${inquiryParts.join("<br>")}
                                </div>
                            </div>
                        </div>
                    `;

                    await sendTrackedEmail({
                        to: data.email,
                        subject: replySubject,
                        html: emailHtml,
                        contactId,
                        workspaceId,
                    });

                    await db.addToSubcollection('contacts', contactId, 'messages', {
                        type: "email",
                        direction: "OUTBOUND",
                        content: `Subject: ${replySubject}\n\n${replyBody}\n\n--- Original Inquiry ---\n${inquiryParts.map(p => p.replace(/<[^>]*>/g, "")).join("\n")}`,
                        source: "auto-reply",
                        createdAt: new Date(),
                    });

                    autoReplySent = true;
                }
            }
        } catch (autoReplyErr) {
            console.error("Auto-reply failed (non-blocking):", autoReplyErr);
        }

        return NextResponse.json({
            success: true,
            message: 'Lead created successfully',
            contactId: contactId,
            opportunityId: oppRef.id,
            autoReplySent,
            autoAssignedTo,
        }, { status: 200 });

    } catch (error: any) {
        console.error("Webhook Error:", error);
        return NextResponse.json({
            error: 'Internal Server Error',
            message: error.message
        }, { status: 500 });
    }
}
