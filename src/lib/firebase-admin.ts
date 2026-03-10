import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

let _db: FirebaseFirestore.Firestore | null = null;
let _auth: admin.auth.Auth | null = null;
let _messaging: admin.messaging.Messaging | null = null;

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

function getDb() {
    if (!_db) {
        const dbId = process.env.FIREBASE_DATABASE_ID;
        if (!dbId) throw new Error("FIREBASE_DATABASE_ID environment variable is not set");
        _db = getFirestore(ensureApp(), dbId);
    }
    return _db;
}

function getAuth() {
    if (!_auth) _auth = admin.auth(ensureApp());
    return _auth;
}

function getMessaging() {
    if (!_messaging) _messaging = admin.messaging(ensureApp());
    return _messaging;
}

// Lazy proxy — defers initialization until first property access at runtime
export const adminDb = new Proxy({} as FirebaseFirestore.Firestore, {
    get(_, prop) {
        const db = getDb();
        const val = (db as any)[prop];
        return typeof val === 'function' ? val.bind(db) : val;
    },
});

export const adminAuth = new Proxy({} as admin.auth.Auth, {
    get(_, prop) {
        const a = getAuth();
        const val = (a as any)[prop];
        return typeof val === 'function' ? val.bind(a) : val;
    },
});

export const adminMessaging = new Proxy({} as admin.messaging.Messaging, {
    get(_, prop) {
        const m = getMessaging();
        const val = (m as any)[prop];
        return typeof val === 'function' ? val.bind(m) : val;
    },
});

export function getAdminStorageBucket() {
    ensureApp();
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    return getStorage().bucket(bucketName);
}
