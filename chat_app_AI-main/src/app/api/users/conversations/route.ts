import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs';
import { getAdminFirestore } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { userId: clerkId } = auth();
    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = await getAdminFirestore();

    // 1. Fetch Groups (Visible to all)
    const groupsSnapshot = await db.collection('chats')
      .where('type', '==', 'group')
      .get();

    // 2. Fetch Direct Chats (User must be a member)
    const directSnapshot = await db.collection('chats')
      .where('type', '==', 'direct')
      .where('members', 'array-contains', clerkId)
      .get();

    const conversations = [
      ...groupsSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })),
      ...directSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }))
    ];

    // Sort by lastMessageAt descending
    conversations.sort((a: any, b: any) => {
      const timeA = a.lastMessageAt?.toMillis?.() || new Date(a.lastMessageAt || 0).getTime();
      const timeB = b.lastMessageAt?.toMillis?.() || new Date(b.lastMessageAt || 0).getTime();
      return timeB - timeA;
    });

    return NextResponse.json({ success: true, data: conversations });
  } catch (error: any) {
    console.error('❌ Get conversations error from Firestore:', error);
    return NextResponse.json({ error: 'Failed to fetch conversations', details: error.message }, { status: 500 });
  }
}
