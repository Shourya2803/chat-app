import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { getAuth } from '@clerk/nextjs/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const { userId: clerkId } = await getAuth(req);

        if (!clerkId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const db = await getAdminFirestore();
        const chatsSnapshot = await db.collection('chats')
            .where('members', 'array-contains', clerkId)
            .orderBy('lastMessageAt', 'desc')
            .get();

        const chats = chatsSnapshot.docs.map((doc: any) => ({
            id: doc.id,
            ...doc.data(),
        }));

        return NextResponse.json({
            success: true,
            data: chats,
        });
    } catch (error: any) {
        console.error('Error fetching chats:', error);
        return NextResponse.json(
            { error: 'Internal Server Error', details: error.message },
            { status: 500 }
        );
    }
}
