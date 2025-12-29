import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
    let firestoreStatus = 'unknown';
    try {
        const db = await getAdminFirestore();
        await db.collection('health').doc('status').set({
            lastChecked: new Date().toISOString()
        }, { merge: true });
        firestoreStatus = 'connected';
    } catch (e) {
        firestoreStatus = 'error';
    }

    return NextResponse.json({
        status: firestoreStatus === 'connected' ? 'healthy' : 'degraded',
        firestore: firestoreStatus,
        cloudinary: {
            cloudName: process.env.CLOUDINARY_CLOUD_NAME || null,
            apiKey: process.env.CLOUDINARY_API_KEY ? 'set' : 'missing',
        },
        env_diagnostic: {
            clerk: !!process.env.CLERK_SECRET_KEY,
            firebase: !!process.env.FIREBASE_PROJECT_ID,
        },
        timestamp: new Date().toISOString(),
    });
}
