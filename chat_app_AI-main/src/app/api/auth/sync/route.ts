import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  console.log('🔄 [SYNC] POST Request received');
  try {
    const { userId: clerkId } = auth();
    const user = await currentUser();

    console.log('🔄 [SYNC] Clerk ID:', clerkId);
    console.log('🔄 [SYNC] User object found:', !!user);

    if (!clerkId || !user) {
      console.warn('🔄 [SYNC] Unauthorized: Missing clerkId or user object');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Try to find user by clerkId
    let dbUser = await prisma.user.findUnique({
      where: { clerkId },
    });

    const userEmail = user.emailAddresses[0]?.emailAddress || '';
    const username = user.username || `${user.firstName} ${user.lastName}`.trim() || 'Anonymous';
    const avatarUrl = user.imageUrl;

    if (dbUser) {
      console.log('🔄 [SYNC] Found by Clerk ID, updating...');
      dbUser = await prisma.user.update({
        where: { clerkId },
        data: { email: userEmail, username, avatarUrl },
      });
    } else {
      // 2. Try to find by email if clerkId didn't match (prevents P2002)
      console.log('🔄 [SYNC] Not found by Clerk ID, checking email:', userEmail);
      const userByEmail = await prisma.user.findUnique({
        where: { email: userEmail },
      });

      if (userByEmail) {
        console.log('🔄 [SYNC] Found by email, updating Clerk ID...');
        dbUser = await prisma.user.update({
          where: { email: userEmail },
          data: { clerkId, username, avatarUrl },
        });
      } else {
        // 3. Create new user
        console.log('🔄 [SYNC] Creating new user...');
        dbUser = await prisma.user.create({
          data: {
            clerkId,
            email: userEmail,
            username,
            avatarUrl,
            role: 'USER',
          },
        });
      }
    }
    console.log('🔄 [SYNC] User sync success');

    // Ensure system user exists
    await prisma.user.upsert({
      where: { clerkId: 'system-admin' },
      update: {},
      create: {
        clerkId: 'system-admin',
        email: 'system@internal.chat',
        username: 'System',
        role: 'ADMIN',
      },
    });

    return NextResponse.json({ success: true, data: dbUser });
  } catch (error: any) {
    console.error('❌ Sync error:', error);
    return NextResponse.json({
      error: 'Sync failed',
      message: error.message,
      code: error.code,
      details: error.stack?.split('\n')?.[0], // First line of stack
      fullError: process.env.NODE_ENV === 'development' ? error : undefined
    }, { status: 500 });
  }
}

export const GET = POST; // Allow both for flexibility
