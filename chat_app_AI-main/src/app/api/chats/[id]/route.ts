import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs';
import { getAdminFirestore, getAdminDb } from '@/lib/firebase-admin';

export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const { userId: clerkId } = auth();
        const { id: chatId } = params;
        const { name } = await request.json();

        if (!clerkId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!name || typeof name !== 'string') {
            return NextResponse.json({ error: 'Group name is required' }, { status: 400 });
        }

        const db = await getAdminFirestore();

        // Verify Admin Role
        const userDoc = await db.collection('users').doc(clerkId).get();
        if (!userDoc.exists || userDoc.data()?.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        const chatRef = db.collection('chats').doc(chatId);
        const chatDoc = await chatRef.get();

        if (!chatDoc.exists) {
            return NextResponse.json({ error: 'Group not found' }, { status: 404 });
        }

        if (chatDoc.data()?.type !== 'group') {
            return NextResponse.json({ error: 'Only groups can be renamed' }, { status: 400 });
        }

        // Check for unique group name (optional but consistent with creation)
        const existingGroup = await db.collection('chats')
            .where('type', '==', 'group')
            .where('name', '==', name.trim())
            .get();

        if (!existingGroup.empty && existingGroup.docs[0].id !== chatId) {
            return NextResponse.json({ error: 'A group with this name already exists' }, { status: 400 });
        }

        await chatRef.update({
            name: name.trim(),
            updatedAt: new Date(),
        });

        return NextResponse.json({
            success: true,
            data: { id: chatId, name: name.trim() },
        });
    } catch (error: any) {
        console.error('Group rename error:', error);
        return NextResponse.json({
            error: error.message || 'Failed to rename group',
        }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const { userId: clerkId } = auth();
        const { id: chatId } = params;

        if (!clerkId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const db = await getAdminFirestore();

        // Verify Admin Role
        const userDoc = await db.collection('users').doc(clerkId).get();
        if (!userDoc.exists || userDoc.data()?.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        const chatRef = db.collection('chats').doc(chatId);
        const chatDoc = await chatRef.get();

        if (!chatDoc.exists) {
            return NextResponse.json({ error: 'Group not found' }, { status: 404 });
        }

        if (chatDoc.data()?.type !== 'group') {
            return NextResponse.json({ error: 'Only groups can be deleted' }, { status: 400 });
        }

        // 1. Delete from Firestore
        await chatRef.delete();

        // 2. Delete messages from Realtime Database
        const rtdb = await getAdminDb();
        await rtdb.ref(`messages/${chatId}`).remove();

        return NextResponse.json({
            success: true,
            message: 'Group deleted successfully',
        });
    } catch (error: any) {
        console.error('Group deletion error:', error);
        return NextResponse.json({
            error: error.message || 'Failed to delete group',
        }, { status: 500 });
    }
}
