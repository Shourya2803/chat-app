import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
    const envStatus = {
        CLERK_SECRET_KEY: !!process.env.CLERK_SECRET_KEY,
        CLERK_PUBLISHABLE_KEY: !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
        DATABASE_URL: !!process.env.DATABASE_URL,
        FIREBASE_PROJECT_ID: !!process.env.FIREBASE_PROJECT_ID,
        FIREBASE_PRIVATE_KEY: !!process.env.FIREBASE_PRIVATE_KEY?.length,
        FIREBASE_DATABASE_URL: !!process.env.FIREBASE_DATABASE_URL || !!process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
        GEMINI_API_KEY: !!process.env.GEMINI_API_KEY,
        REDIS_URL: !!process.env.REDIS_URL || !!process.env.KV_URL,
    };

    const diagnostics: any = {
        status: 'investigating',
        env: envStatus,
        database: 'Checking...',
        redis: redis ? 'Initialized' : 'Not Initialized',
        firebaseAdmin: adminDb ? 'Initialized' : 'Not Initialized',
        timestamp: new Date().toISOString(),
    };

    try {
        // Attempt a simple query
        await prisma.user.count();
        diagnostics.database = '✅ Connected';
        diagnostics.status = 'healthy';
    } catch (dbError: any) {
        diagnostics.status = 'error';
        diagnostics.database = `❌ Error: ${dbError.message}`;
        diagnostics.prismaError = {
            code: dbError.code,
            meta: dbError.meta,
            stack: dbError.stack?.split('\n').slice(0, 3).join('\n'), // First 3 lines
        };
    }

    return NextResponse.json(diagnostics);
}
