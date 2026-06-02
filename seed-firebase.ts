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

    // 1. Create default pipeline
    console.log("1. Checking for existing pipelines...");
    const pipelines = await db.collection('pipelines').get();

    if (pipelines.empty) {
        console.log("   Creating default Sales Pipeline...");
        const pipelineRef = db.collection('pipelines').doc();
        await pipelineRef.set({
            name: "Sales Pipeline",
            createdAt: new Date(),
            updatedAt: new Date()
        });

        const stages = [
            "New Lead", "Contacted", "Qualified", "Proposal Sent",
            "Negotiation", "Closed Won", "Closed Lost"
        ];

        const batch = db.batch();
        stages.forEach((stageName, index) => {
            const stageRef = pipelineRef.collection('stages').doc();
            batch.set(stageRef, { name: stageName, order: index });
        });

        await batch.commit();
        console.log("   Created pipeline with " + stages.length + " stages.");
    } else {
        console.log("   Pipelines already exist. Skipping.");
    }

    // 2. Create default contact statuses
    console.log("2. Checking for contact statuses...");
    const statusesSnap = await db.collection('contact_statuses').limit(1).get();
    if (statusesSnap.empty) {
        const defaultStatuses = ["Lead", "Prospect", "Active", "Customer", "Inactive"];
        for (let i = 0; i < defaultStatuses.length; i++) {
            await db.collection('contact_statuses').add({
                name: defaultStatuses[i],
                order: i,
                createdAt: new Date(),
                updatedAt: new Date()
            });
        }
        console.log("   Created " + defaultStatuses.length + " default statuses.");
    } else {
        console.log("   Statuses already exist. Skipping.");
    }

    // 3. Create owner user
    const email = process.env.OWNER_EMAIL || "owner@example.com";
    console.log("3. Checking for owner user (" + email + ")...");

    const users = await db.collection('users').where('email', '==', email).get();
    if (users.empty) {
        await db.collection('users').add({
            name: "Owner",
            email: email,
            role: "OWNER",
            createdAt: new Date(),
            updatedAt: new Date()
        });
        console.log("   Created owner user.");
    } else {
        console.log("   Owner user already exists. Skipping.");
    }

    console.log("\nSeeding complete! You can now start the app with: npm run dev");
}

seed().catch(console.error).finally(() => process.exit(0));
