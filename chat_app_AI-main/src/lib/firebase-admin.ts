// Firebase Admin SDK initialization for serverless
// Using require syntax for better compatibility with the package structure
const admin = require('firebase-admin');

let adminApp: any;
let adminDb: any;

try {
    // Check if Firebase Admin is already initialized
    if (!admin.apps.length) {
        const serviceAccount = {
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        };

        // Warn if keys are missing
        if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
            console.warn('⚠️ Missing Firebase Admin keys:', {
                pid: !!serviceAccount.projectId,
                email: !!serviceAccount.clientEmail,
                key: !!serviceAccount.privateKey
            });
        }

        adminApp = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: process.env.FIREBASE_DATABASE_URL,
        });
    } else {
        // If already initialized, use the existing app
        adminApp = admin.apps[0];
    }

    // Initialize Database
    if (adminApp && process.env.FIREBASE_DATABASE_URL) {
        adminDb = admin.database(adminApp);
    } else if (adminApp) {
        console.warn('⚠️ FIREBASE_DATABASE_URL is missing. Real-time DB operations will fail.');
    }

} catch (error) {
    console.error('❌ Firebase Admin initialization error:', error);
    // Don't throw in serverless - let routes handle missing Firebase gracefully
}

// Explicit named exports
export { adminApp, adminDb };

// Default export for flexibility
export default adminDb;
