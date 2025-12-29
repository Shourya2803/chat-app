import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { getAuth } from '@clerk/nextjs/server';

export async function POST(req: NextRequest) {
    try {
        const { userId: clerkId } = await getAuth(req);

        if (!clerkId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { chatId } = await req.json();

        if (!chatId) {
            return NextResponse.json({ error: 'Chat ID is required' }, { status: 400 });
        }

        const db = await getAdminFirestore();
        const chatRef = db.collection('chats').doc(chatId);
        const doc = await chatRef.get();

        if (!doc.exists) {
            return NextResponse.json({ error: 'Group not found' }, { status: 404 });
        }

        const data = doc.data() || {};
        if (data.type !== 'group') {
            return NextResponse.json({ error: 'Cannot join a direct chat' }, { status: 400 });
        }

        const members = data.members || [];
        if (members.includes(clerkId)) {
            return NextResponse.json({
                success: true,
                message: 'Already in group',
                data: { id: chatId, ...data }
            });
        }

        // Add user to members
        const updatedMembers = [...members, clerkId];
        await chatRef.update({
            members: updatedMembers,
            updatedAt: new Date()
        });

        return NextResponse.json({
            success: true,
            data: { id: chatId, ...data, members: updatedMembers },
        });
    } catch (error: any) {
        console.error('Error joining group:', error);
        return NextResponse.json(
            { error: 'Internal Server Error', details: error.message },
            { status: 500 }
        );
    }
}
