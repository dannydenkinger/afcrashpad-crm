import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

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
export const adminDb = getFirestore(admin.app(), dbId);
export const adminAuth = admin.auth();
