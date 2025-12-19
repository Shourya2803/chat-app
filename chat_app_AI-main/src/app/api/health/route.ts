import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
    return NextResponse.json({
        status: 'healthy',
        cloudinary: {
            cloudName: process.env.CLOUDINARY_CLOUD_NAME || null,
            apiKey: process.env.CLOUDINARY_API_KEY ? 'set' : 'missing',
            apiSecret: process.env.CLOUDINARY_API_SECRET ? 'set' : 'missing',
        },
        env_diagnostic: {
            clerk: !!process.env.CLERK_SECRET_KEY,
            db: !!process.env.DATABASE_URL,
            firebase: !!process.env.FIREBASE_PROJECT_ID,
        },
        timestamp: new Date().toISOString(),
    });
}
