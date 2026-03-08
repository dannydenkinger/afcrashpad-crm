import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { sendTrackedEmail } from '@/lib/email';
import { createNotification } from '@/app/notifications/actions';
import { triggerSequence } from '@/lib/email-sequences';
import { determineAssignee } from '@/lib/auto-assign';
import * as z from 'zod';
import { calculateOnBaseLodging, lodgingData } from '@/lib/calculators/on-base';
import { rateLimit, getRateLimitKey } from '@/lib/rate-limit';
import { validateApiKey } from '@/lib/api-auth';

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

// Define the expected schema from the WordPress webhook
const webhookSchema = z.object({
    name: z.string().optional(),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    email: z.string().email("Valid email is required"),
    phone: z.string().optional(),
    startDate: z.string().optional(), // Expected format: YYYY-MM-DD
    endDate: z.string().optional(),   // Expected format: YYYY-MM-DD
    base: z.string().optional(),
    notes: z.string().optional(),
    special_accommodations: z.union([z.string(), z.array(z.string())]).optional(),
    reason_for_stay: z.string().optional(),
});

export async function POST(req: Request) {
    try {
        // Rate limit: 30 webhook submissions per minute per IP
        const { allowed } = rateLimit(getRateLimitKey(req, "webhook"), 30)
        if (!allowed) {
            return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
        }

        // 1. Authenticate Request (support both env-based key and managed API keys)
        const authHeader = req.headers.get('authorization');
        const expectedApiKey = process.env.WEBHOOK_API_KEY;

        let authenticated = false;
        if (expectedApiKey && authHeader === `Bearer ${expectedApiKey}`) {
            authenticated = true;
        }

        // Fall back to managed API key authentication
        if (!authenticated) {
            const apiKeyResult = await validateApiKey(req);
            if (apiKeyResult) {
                authenticated = true;
            }
        }

        if (!authenticated) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Parse and Normalize Payload (support both Elementor + Fluent Forms-style keys)
        const raw = await req.json();

        // Normalize UTM params (support both utm_source and utmSource styles)
        const utmSource = raw.utm_source ?? raw.utmSource ?? raw.UTM_Source ?? null;
        const utmMedium = raw.utm_medium ?? raw.utmMedium ?? raw.UTM_Medium ?? null;
        const utmCampaign = raw.utm_campaign ?? raw.utmCampaign ?? raw.UTM_Campaign ?? null;
        const utmTerm = raw.utm_term ?? raw.utmTerm ?? raw.UTM_Term ?? null;
        const utmContent = raw.utm_content ?? raw.utmContent ?? raw.UTM_Content ?? null;
        const body: any = {
            ...raw,
            // Names
            first_name: raw.first_name ?? raw.firstName ?? raw.FirstName ?? raw.fname ?? null,
            last_name: raw.last_name ?? raw.lastName ?? raw.LastName ?? raw.lname ?? null,
            // Core contact fields
            email: raw.email ?? raw.Email ?? null,
            phone: raw.phone ?? raw.Phone ?? raw.phone_number ?? raw.phoneNumber ?? null,
            // Dates – support multiple possible field IDs
            startDate:
                raw.startDate ??
                raw.estimated_arrival_date ??
                raw.estimatedArrivalDate ??
                raw.arrival_date ??
                raw.arrivalDate ??
                null,
            endDate:
                raw.endDate ??
                raw.estimated_departure_date ??
                raw.estimatedDepartureDate ??
                raw.departure_date ??
                raw.departureDate ??
                null,
            // Base / location
            base: raw.base ?? raw.Base ?? raw.location ?? raw.Location ?? null,
            // Notes/message
            notes: raw.notes ?? raw.message ?? raw.Message ?? raw.comment ?? raw.Comment ?? null,
            // Special accommodations + reason
            special_accommodations:
                raw.special_accommodations ??
                raw.specialAccommodation ??
                raw.special_accommodation ??
                null,
            reason_for_stay:
                raw.reason_for_stay ??
                raw.reasonForStay ??
                raw.reason_for_stay ?? // duplicate key safe
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

        // Format dates if provided
        const startYmd = normalizeDateToYmd(data.startDate);
        const endYmd = normalizeDateToYmd(data.endDate);
        const formattedStartDate = startYmd ? ymdToIsoNoon(startYmd) : null;
        const formattedEndDate = endYmd ? ymdToIsoNoon(endYmd) : null;

        // 3. Find or Create Contact
        let contactId: string;
        
        const existingContacts = await adminDb.collection('contacts')
            .where('email', '==', data.email)
            .limit(1)
            .get();

        if (existingContacts.empty) {
            const contactRef = adminDb.collection('contacts').doc();
            contactId = contactRef.id;

            await contactRef.set({
                name: finalName,
                email: data.email,
                phone: data.phone || null,
                militaryBase: data.base || null,
                stayStartDate: formattedStartDate,
                stayEndDate: formattedEndDate,
                status: 'Lead',
                ...(utmSource && { utmSource }),
                ...(utmMedium && { utmMedium }),
                ...(utmCampaign && { utmCampaign }),
                ...(utmTerm && { utmTerm }),
                ...(utmContent && { utmContent }),
                createdAt: new Date(),
                updatedAt: new Date()
            });

            // Trigger new_contact email sequence for new contacts
            triggerSequence("new_contact", contactId, data.email, finalName, {
                base: data.base || "",
                startDate: startYmd || "",
                endDate: endYmd || "",
            }).catch(() => {});
        } else {
            contactId = existingContacts.docs[0].id;
            const contactData = existingContacts.docs[0].data();
            
            await adminDb.collection('contacts').doc(contactId).update({
                name: finalName || contactData.name,
                phone: data.phone || contactData.phone,
                militaryBase: data.base || contactData.militaryBase,
                stayStartDate: formattedStartDate || contactData.stayStartDate,
                stayEndDate: formattedEndDate || contactData.stayEndDate,
                updatedAt: new Date()
            });
        }

        // 4. Determine default pipeline and stage
        let targetStageId = null;
        const pipelinesSnap = await adminDb.collection('pipelines').orderBy('createdAt', 'asc').limit(1).get();

        if (!pipelinesSnap.empty) {
            const defaultPipeline = pipelinesSnap.docs[0];
            const stagesSnap = await defaultPipeline.ref.collection('stages').orderBy('order', 'asc').get();
            
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

        // 5. Auto-calculate opportunity value from stay dates + base (on-base lodging rates)
        let opportunityValue = 0;
        const stayStartDateIso = formattedStartDate;
        const stayEndDateIso = formattedEndDate;
        const baseName = normalizeBaseName(data.base);

        if (baseName && startYmd && endYmd) {
            const calc = calculateOnBaseLodging(baseName, startYmd, endYmd);
            opportunityValue = calc.totalCost;
        }

        // Normalize special accommodations to array of labels
        const specialAccommodationLabels = (Array.isArray(data.special_accommodations) ? data.special_accommodations : [data.special_accommodations])
            .filter(Boolean)
            .map(v => String(v).trim())
            .filter(v => v && v !== "- None -" && v.toLowerCase() !== "none");

        // Try to map the first special accommodation label to an existing option in Settings
        let specialAccommodationId: string | null = null;
        if (specialAccommodationLabels.length > 0) {
            const accSnap = await adminDb
                .collection('special_accommodations')
                .where('name', '==', specialAccommodationLabels[0])
                .limit(1)
                .get();
            if (!accSnap.empty) {
                specialAccommodationId = accSnap.docs[0].id;
            }
        }

        // Build a single notes blob that both Contact + Opportunity can share
        const noteParts: string[] = [];
        if (data.notes && data.notes.trim().length > 0) noteParts.push(`Notes: ${data.notes}`);
        if (specialAccommodationLabels.length > 0) noteParts.push(`Special Accommodations: ${specialAccommodationLabels.join(", ")}`);
        if (data.reason_for_stay && data.reason_for_stay.trim()) noteParts.push(`Reason for Stay: ${data.reason_for_stay}`);
        const sharedNotes = noteParts.length > 0 ? `Website Inquiry:\n${noteParts.join('\n')}` : null;

        // 6. Create the Opportunity (New Deal from website inquiry)
        const opportunityName = `${finalName} - Inquiry`;
        const oppRef = adminDb.collection('opportunities').doc();

        await oppRef.set({
            contactId: contactId,
            pipelineStageId: targetStageId,
            name: opportunityName,
            priority: "MEDIUM",
            opportunityValue,
            estimatedProfit: Math.round(opportunityValue * 0.25),
            source: 'webhook',
            stayStartDate: stayStartDateIso,
            stayEndDate: stayEndDateIso,
            militaryBase: baseName,
            notes: sharedNotes,
            reasonForStay: data.reason_for_stay?.trim?.() ? data.reason_for_stay.trim() : null,
            specialAccommodationId,
            specialAccommodationLabels: specialAccommodationLabels.length > 0 ? specialAccommodationLabels : [],
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
            const assignee = await determineAssignee({
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

        // 7. Create Contact Note (so it also shows on the Contact)
        if (sharedNotes) {
            await adminDb.collection('contacts').doc(contactId).collection('notes').add({
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
                const refSnap = await adminDb.collection('referrals')
                    .where('referredEmail', '==', data.email)
                    .limit(1)
                    .get();
                if (!refSnap.empty) {
                    const refDoc = refSnap.docs[0];
                    const refData = refDoc.data();
                    // Only advance if not already past contacted
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

        // 8. Create a notification (in-app + email dispatch)
        await createNotification({
            title: "New Website Inquiry",
            message: `${finalName}${baseName ? ` • ${baseName}` : ""}`,
            type: "opportunity",
            linkUrl: `/pipeline?deal=${oppRef.id}`,
        });

        // 9. Auto-reply email if enabled
        let autoReplySent = false;
        try {
            const settingsDoc = await adminDb.collection('settings').doc('automations').get();
            const autoSettings = settingsDoc.exists ? settingsDoc.data() : null;

            if (autoSettings?.autoReplyEnabled && autoSettings?.autoReplyTemplateId && data.email) {
                const templateDoc = await adminDb.collection('email_templates').doc(autoSettings.autoReplyTemplateId).get();
                if (templateDoc.exists) {
                    const template = templateDoc.data()!;
                    // Replace template variables
                    const replyBody = (template.body || "")
                        .replace(/\{\{name\}\}/g, finalName)
                        .replace(/\{\{base\}\}/g, baseName || "your requested location");
                    const replySubject = (template.subject || "")
                        .replace(/\{\{name\}\}/g, finalName)
                        .replace(/\{\{base\}\}/g, baseName || "your requested location");

                    // Build original inquiry summary for the email
                    const inquiryParts: string[] = [];
                    if (finalName) inquiryParts.push(`<strong>Name:</strong> ${finalName}`);
                    inquiryParts.push(`<strong>Email:</strong> ${data.email}`);
                    if (data.phone) inquiryParts.push(`<strong>Phone:</strong> ${data.phone}`);
                    if (baseName) inquiryParts.push(`<strong>Base:</strong> ${baseName}`);
                    if (startYmd) inquiryParts.push(`<strong>Arrival:</strong> ${startYmd}`);
                    if (endYmd) inquiryParts.push(`<strong>Departure:</strong> ${endYmd}`);
                    if (data.reason_for_stay) inquiryParts.push(`<strong>Reason for Stay:</strong> ${data.reason_for_stay}`);
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

                    // Send the actual email via Resend (with tracking)
                    await sendTrackedEmail({
                        to: data.email,
                        subject: replySubject,
                        html: emailHtml,
                        contactId,
                    });

                    // Log the auto-reply as an outbound message in the contact's communications
                    await adminDb.collection('contacts').doc(contactId).collection('messages').add({
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
