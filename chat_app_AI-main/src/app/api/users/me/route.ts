import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs';
import { getAdminFirestore } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { userId: clerkId } = auth();

    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = await getAdminFirestore();
    const userRef = db.collection('users').doc(clerkId);
    let userDoc = await userRef.get();

    if (!userDoc.exists) {
      // Auto-create user in Firestore if not found (matching Clerk)
      const clerkUser = await currentUser();
      if (clerkUser) {
        const userData = {
          clerkId,
          email: clerkUser.emailAddresses[0]?.emailAddress || '',
          username: clerkUser.username || clerkUser.firstName || clerkId,
          avatarUrl: clerkUser.imageUrl,
          role: 'USER',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await userRef.set(userData);
        userDoc = await userRef.get();
      } else {
        return NextResponse.json({ error: 'User not found in Firestore or Clerk' }, { status: 404 });
      }
    }

    return NextResponse.json({
      success: true,
      data: { id: clerkId, ...userDoc.data() },
    });
  } catch (error: any) {
    console.error('Error fetching user profile from Firestore:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
