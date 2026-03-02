import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import * as z from 'zod';

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
    special_accommodations: z.string().optional(),
    reason_for_stay: z.string().optional(),
});

export async function POST(req: Request) {
    try {
        // 1. Authenticate Request
        const authHeader = req.headers.get('authorization');
        const expectedApiKey = process.env.WEBHOOK_API_KEY;

        if (!expectedApiKey || authHeader !== `Bearer ${expectedApiKey}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Parse and Validate Payload
        const body = await req.json();
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
        let formattedStartDate = null;
        let formattedEndDate = null;
        if (data.startDate) {
            const d = new Date(data.startDate);
            if (!isNaN(d.getTime())) formattedStartDate = d.toISOString();
        }
        if (data.endDate) {
            const d = new Date(data.endDate);
            if (!isNaN(d.getTime())) formattedEndDate = d.toISOString();
        }

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
                createdAt: new Date(),
                updatedAt: new Date()
            });
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

        // 5. Create the Opportunity
        const opportunityName = `${finalName} - Inquiry`;
        const oppRef = adminDb.collection('opportunities').doc();
        
        await oppRef.set({
            contactId: contactId,
            pipelineStageId: targetStageId,
            name: opportunityName,
            priority: "MEDIUM",
            opportunityValue: 0,
            estimatedProfit: 0,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        // 6. Create Note if notes or extra fields exist
        const noteParts: string[] = [];
        if (data.notes && data.notes.trim().length > 0) noteParts.push(`Notes: ${data.notes}`);
        if (data.special_accommodations && data.special_accommodations.trim()) noteParts.push(`Special Accommodations: ${data.special_accommodations}`);
        if (data.reason_for_stay && data.reason_for_stay.trim()) noteParts.push(`Reason for Stay: ${data.reason_for_stay}`);
        if (noteParts.length > 0) {
            await adminDb.collection('contacts').doc(contactId).collection('notes').add({
                content: `Website Inquiry:\n${noteParts.join('\n')}`,
                contactId: contactId,
                createdAt: new Date(),
                updatedAt: new Date()
            });
        }

        return NextResponse.json({ 
            success: true, 
            message: 'Lead created successfully',
            contactId: contactId,
            opportunityId: oppRef.id
        }, { status: 200 });

    } catch (error: any) {
        console.error("Webhook Error:", error);
        return NextResponse.json({ 
            error: 'Internal Server Error',
            message: error.message 
        }, { status: 500 });
    }
}
