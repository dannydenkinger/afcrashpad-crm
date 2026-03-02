import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import path from 'path';
import dotenv from 'dotenv';

// Load .env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            }),
        });
    } catch (error: any) {
        console.error('Firebase admin initialization error', error.stack);
    }
}

const dbId = process.env.FIREBASE_DATABASE_ID;
if (!dbId) throw new Error("FIREBASE_DATABASE_ID environment variable is not set");
const db = getFirestore(admin.app(), dbId);

async function seed() {
    console.log("Seeding Firebase database...");

    // Create Metadata document
    console.log("1. Creating bases metadata...");
    await db.collection('metadata').doc('bases').set({
        names: [
            "Luke AFB",
            "Nellis AFB",
            "Randolph AFB",
            "Altus AFB",
            "Columbus AFB",
            "Holloman AFB",
            "Vance AFB",
            "Laughlin AFB"
        ]
    });

    // Check if pipeline exists
    console.log("2. Checking for existing pipelines...");
    const pipelines = await db.collection('pipelines').get();
    
    if (pipelines.empty) {
        console.log("3. Creating default Traveler Placement pipeline...");
        const pipelineRef = db.collection('pipelines').doc();
        await pipelineRef.set({
            name: "Traveler Placement",
            createdAt: new Date(),
            updatedAt: new Date()
        });

        const stages = [
            "New Lead", "Contacted", "Finding Properties", "Selecting Property",
            "Lease Sent", "Lease Signed", "Move-in Scheduled",
            "Current Tenant", "Move-out Scheduled", "Review/Referral", "Closed Won",
            "Closed Lost", "Archive"
        ];

        console.log("4. Creating default stages...");
        const batch = db.batch();
        stages.forEach((stageName, index) => {
            const stageRef = pipelineRef.collection('stages').doc();
            batch.set(stageRef, {
                name: stageName,
                order: index
            });
        });
        
        await batch.commit();
        console.log("Successfully created default pipeline and stages!");
    } else {
        console.log("Pipelines already exist. Skipping creation.");
    }

    // Seed contact statuses if empty
    const statusesSnap = await db.collection('contact_statuses').limit(1).get();
    if (statusesSnap.empty) {
        console.log("5a. Seeding contact statuses...");
        const defaultStatuses = ["Lead", "Forms Pending", "Booked", "Active Stay", "Vendor", "Host", "Currently Staying"];
        for (let i = 0; i < defaultStatuses.length; i++) {
            await db.collection('contact_statuses').add({
                name: defaultStatuses[i],
                order: i,
                createdAt: new Date(),
                updatedAt: new Date()
            });
        }
        console.log("Created default contact statuses!");
    }

    // Seed special accommodations if empty
    const accSnap = await db.collection('special_accommodations').limit(1).get();
    if (accSnap.empty) {
        console.log("5b. Seeding special accommodations...");
        const defaultAcc = ["Traveling with Pet", "Spouse", "Dependents"];
        for (let i = 0; i < defaultAcc.length; i++) {
            await db.collection('special_accommodations').add({
                name: defaultAcc[i],
                order: i,
                createdAt: new Date(),
                updatedAt: new Date()
            });
        }
        console.log("Created default special accommodations!");
    }
    
    // Set up owner user if it doesn't exist
    // You should probably change this to your actual email when running
    const email = process.env.OWNER_EMAIL || "afcrashpad@gmail.com";
    console.log(`5. Checking for owner user (${email})...`);
    
    const users = await db.collection('users').where('email', '==', email).get();
    if (users.empty) {
        console.log("7. Creating owner user...");
        await db.collection('users').add({
            name: "Owner",
            email: email,
            role: "OWNER",
            createdAt: new Date(),
            updatedAt: new Date()
        });
        console.log("Created owner user!");
    } else {
        console.log("Owner user already exists.");
    }

    console.log("Seeding complete!");
}

seed().catch(console.error).finally(() => process.exit(0));
