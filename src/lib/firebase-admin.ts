import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

function ensureApp() {
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            }),
            storageBucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        });
    }
    return admin.app();
}

// Lazy getters — only initialize when actually called at runtime, not at build/import time
export const adminDb = new Proxy({} as FirebaseFirestore.Firestore, {
    get(_, prop) {
        const dbId = process.env.FIREBASE_DATABASE_ID;
        if (!dbId) throw new Error("FIREBASE_DATABASE_ID environment variable is not set");
        const db = getFirestore(ensureApp(), dbId);
        return (db as any)[prop];
    },
});

export const adminAuth = new Proxy({} as admin.auth.Auth, {
    get(_, prop) {
        const a = ensureApp();
        return (admin.auth(a) as any)[prop];
    },
});

export const adminMessaging = new Proxy({} as admin.messaging.Messaging, {
    get(_, prop) {
        const a = ensureApp();
        return (admin.messaging(a) as any)[prop];
    },
});

export function getAdminStorageBucket() {
    ensureApp();
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    return getStorage().bucket(bucketName);
}
