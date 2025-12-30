import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
    try {
        const { userId: clerkId } = auth();
        if (!clerkId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { chatId, action } = await req.json(); // action: 'pin' | 'unpin'
        if (!chatId || !['pin', 'unpin'].includes(action)) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const db = await getAdminFirestore();
        const userRef = db.collection('users').doc(clerkId);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const userData = userDoc.data() || {};
        const pinnedChatIds = userData.pinnedChatIds || [];

        if (action === 'pin') {
            if (pinnedChatIds.includes(chatId)) {
                return NextResponse.json({ success: true, message: 'Already pinned' });
            }
            if (pinnedChatIds.length >= 3) {
                return NextResponse.json({ error: 'Limit of 3 pinned chats reached' }, { status: 400 });
            }
            await userRef.update({
                pinnedChatIds: FieldValue.arrayUnion(chatId)
            });
        } else {
            await userRef.update({
                pinnedChatIds: FieldValue.arrayRemove(chatId)
            });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Pinning error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
