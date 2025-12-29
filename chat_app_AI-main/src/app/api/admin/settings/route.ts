import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs';
import { getAdminFirestore } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
    try {
        const { userId: clerkId } = auth();
        if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const db = await getAdminFirestore();
        const userDoc = await db.collection('users').doc(clerkId).get();
        const userData = userDoc.data();

        if (userData?.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        const { systemPrompt } = await req.json();
        if (!systemPrompt) return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });

        await db.collection('admin_settings').doc('ai_rules').set({
            systemPrompt,
            updatedAt: new Date(),
        }, { merge: true });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    try {
        const db = await getAdminFirestore();
        const doc = await db.collection('admin_settings').doc('ai_rules').get();
        return NextResponse.json({ success: true, data: doc.data() });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
