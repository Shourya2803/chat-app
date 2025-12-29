import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { auth } from '@clerk/nextjs';

export async function POST(request: NextRequest) {
    try {
        const { name } = await request.json();
        const { userId } = auth();

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!name || typeof name !== 'string') {
            return NextResponse.json({ error: 'Group name is required' }, { status: 400 });
        }

        const db = await getAdminFirestore();

        // 1. Check for unique group name
        const existingGroup = await db.collection('chats')
            .where('type', '==', 'group')
            .where('name', '==', name.trim())
            .get();

        if (!existingGroup.empty) {
            return NextResponse.json({ error: 'A group with this name already exists' }, { status: 400 });
        }

        // 2. Fetch all admins from Firestore to include them in the group (Migrated from Prisma)
        const adminsSnapshot = await db.collection('users')
            .where('role', '==', 'ADMIN')
            .get();

        const adminIds = adminsSnapshot.docs.map((doc: any) => doc.data().clerkId);

        // 3. Create group with creator and all admins
        const members = Array.from(new Set([userId, ...adminIds]));

        const chatsRef = db.collection('chats');
        const chatRef = chatsRef.doc();

        const chatDoc = {
            type: 'group',
            name: name.trim(),
            members: members,
            createdBy: userId,
            createdAt: new Date(),
            updatedAt: new Date(),
            lastMessage: '',
            lastMessageAt: new Date(),
        };

        await chatRef.set(chatDoc);

        return NextResponse.json({
            success: true,
            data: { id: chatRef.id, ...chatDoc },
        });
    } catch (error: any) {
        console.error('Group creation error:', error);
        return NextResponse.json({
            error: error.message || 'Failed to create group',
            details: error.details,
            code: error.code
        }, { status: 500 });
    }
}
