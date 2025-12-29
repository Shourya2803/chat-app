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
    const usersSnapshot = await db.collection('users').get();

    const users = usersSnapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data()
    }));

    // Sort by username asc
    users.sort((a: any, b: any) => (a.username || '').localeCompare(b.username || ''));

    return NextResponse.json({ success: true, data: users });
  } catch (error: any) {
    console.error('❌ Get users error from Firestore:', error);
    return NextResponse.json({ error: 'Failed to fetch users', details: error.message }, { status: 500 });
  }
}
