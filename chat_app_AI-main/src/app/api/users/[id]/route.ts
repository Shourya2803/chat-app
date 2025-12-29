import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs';
import { getAdminFirestore } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId: currentClerkId } = auth();
    if (!currentClerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params; // This is the clerkId
    const db = await getAdminFirestore();
    const userDoc = await db.collection('users').doc(id).get();

    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found in Firestore' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: { id: userDoc.id, ...userDoc.data() }
    });
  } catch (error: any) {
    console.error('❌ Get user by ID error from Firestore:', error);
    return NextResponse.json({ error: 'Failed to fetch user', details: error.message }, { status: 500 });
  }
}
