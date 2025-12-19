import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
    const envStatus = {
        CLERK_SECRET_KEY: !!process.env.CLERK_SECRET_KEY,
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
        DATABASE_URL: !!process.env.DATABASE_URL,
        FIREBASE_PROJECT_ID: !!process.env.FIREBASE_PROJECT_ID,
        FIREBASE_CLIENT_EMAIL: !!process.env.FIREBASE_CLIENT_EMAIL,
        FIREBASE_PRIVATE_KEY: !!process.env.FIREBASE_PRIVATE_KEY,
        FIREBASE_DATABASE_URL: !!process.env.FIREBASE_DATABASE_URL || !!process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
        GEMINI_API_KEY: !!process.env.GEMINI_API_KEY,
        REDIS_URL: !!process.env.REDIS_URL || !!process.env.KV_URL,
    };

    const diagnostics: any = {
        env: envStatus,
        database: 'Checking...',
        redis: redis ? 'Connected (Client Initialized)' : 'Not Initialized',
        firebaseAdmin: adminDb ? 'Connected (Client Initialized)' : 'Not Initialized',
    };

    try {
        // Attempt a simple query
        await prisma.user.count();
        diagnostics.database = '✅ Connected';
    } catch (dbError: any) {
        diagnostics.database = `❌ Error: ${dbError.message}`;
    }

    return NextResponse.json(diagnostics);
}
