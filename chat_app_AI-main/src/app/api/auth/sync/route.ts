import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs';
import { getAdminFirestore } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  console.log('🔄 [SYNC] POST Request received (Migrating to Firestore)');
  try {
    const { userId: clerkId } = auth();
    const user = await currentUser();

    if (!clerkId || !user) {
      console.warn('🔄 [SYNC] Unauthorized: Missing clerkId or user object');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = await getAdminFirestore();
    const userRef = db.collection('users').doc(clerkId);
    const userDoc = await userRef.get();

    const userEmail = user.emailAddresses[0]?.emailAddress || '';
    const username = user.username || `${user.firstName} ${user.lastName}`.trim() || 'Anonymous';
    const avatarUrl = user.imageUrl;

    const userData = {
      clerkId,
      email: userEmail,
      username,
      avatarUrl,
      updatedAt: new Date().toISOString(),
    };

    if (userDoc.exists) {
      console.log('🔄 [SYNC] Updating Firestore user profile...');
      await userRef.update(userData);
    } else {
      console.log('🔄 [SYNC] Creating new user in Firestore...');
      await userRef.set({
        ...userData,
        role: 'USER', // Default role for new users
        createdAt: new Date().toISOString(),
      });
    }

    const finalDoc = await userRef.get();
    console.log('🔄 [SYNC] User sync success');

    return NextResponse.json({ success: true, data: { id: clerkId, ...finalDoc.data() } });
  } catch (error: any) {
    console.error('❌ Sync error:', error);
    return NextResponse.json({
      error: 'Sync failed',
      message: error.message,
    }, { status: 500 });
  }
}

export const GET = POST;
