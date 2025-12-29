// Firebase Admin SDK initialization for serverless
const admin = require('firebase-admin');

let adminApp: any;

/**
 * Ensures Firebase Admin is initialized with correct settings.
 */
function initializeAdmin() {
    let projectId = process.env.FIREBASE_PROJECT_ID;

    // Clean potential quotes from Project ID
    if (projectId) projectId = projectId.replace(/^"|"$/g, '');

    // Fallback to public ID IF private ID is missing or is just a placeholder
    const isPlaceholder = (id: string | undefined) => !id || id.includes('your_') || id === 'project-id';

    if (isPlaceholder(projectId)) {
        projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    }

    let clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    if (clientEmail) clientEmail = clientEmail.replace(/^"|"$/g, '');
    // Enhanced Private Key Cleaning
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (privateKey) {
        // 1. Remove outer quotes if present
        privateKey = privateKey.replace(/^"|"$/g, '');

        // 2. FORCE replacement of escaped newlines (handling both \n string literals and actual newlines)
        privateKey = privateKey.replace(/\\n/g, '\n');

        // 3. Ensure it looks like a valid PEM key
        // Sometimes keys are copy-pasted without headers
        if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
            // If headers are missing, try to reconstruct them (rare but possible)
            privateKey = `-----BEGIN PRIVATE KEY-----\n${privateKey}\n-----END PRIVATE KEY-----\n`;
        }
    } else {
        console.error("❌ FATAL: FIREBASE_PRIVATE_KEY is missing from environment variables.");
    }

    // Safety check: Does the email look like it belongs to the project?
    if (clientEmail && projectId && !clientEmail.includes(projectId)) {
        console.warn(`⚠️ CONFIG WARNING: Your FIREBASE_CLIENT_EMAIL (${clientEmail}) does not match your FIREBASE_PROJECT_ID (${projectId}). This often causes "16 UNAUTHENTICATED" errors.`);
    }

    if (!admin.apps.length) {
        if (isPlaceholder(projectId) || !clientEmail || !privateKey) {
            console.warn('⚠️ Firebase Admin: One or more critical variables are missing or placeholders.');
            return null;
        }

        const rtdbUrl = process.env.FIREBASE_DATABASE_URL ||
            process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ||
            `https://${projectId}-default-rtdb.firebaseio.com`;

        console.log('🛡️ Initializing Firebase Admin for Project:', projectId);
        console.log('⚡ RTDB URL:', rtdbUrl);

        try {
            adminApp = admin.initializeApp({
                credential: admin.credential.cert({
                    projectId,
                    clientEmail,
                    privateKey,
                }),
                databaseURL: rtdbUrl,
            });
            return adminApp;
        } catch (error) {
            console.error('❌ Firebase Admin init failed:', error);
            return null;
        }
    }
    return admin.apps[0];
}

/**
 * Returns an initialized Firestore instance with correct settings.
 */
export async function getAdminFirestore() {
    const app = initializeAdmin();
    if (!app) throw new Error('Firebase Admin not initialized - check your environment variables');

    const db = admin.firestore(app);
    try {
        db.settings({ ignoreUndefinedProperties: true });
    } catch (e) {
        // Settings already applied
    }
    return db;
}

/**
 * Returns an initialized Realtime Database instance.
 */
export async function getAdminDb() {
    const app = initializeAdmin();
    if (!app) throw new Error('Firebase Admin not initialized');
    return admin.database(app);
}

// Legacy exports
export const adminFirestore = admin.apps.length ? admin.firestore(admin.apps[0]) : null;
