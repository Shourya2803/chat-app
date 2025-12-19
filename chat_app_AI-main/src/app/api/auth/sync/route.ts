import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = auth();
    const user = await currentUser();

    if (!clerkId || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Upsert the user into our database
    const dbUser = await prisma.user.upsert({
      where: { clerkId },
      update: {
        email: user.emailAddresses[0]?.emailAddress || '',
        username: user.username || `${user.firstName} ${user.lastName}`.trim() || 'Anonymous',
        avatarUrl: user.imageUrl,
      },
      create: {
        clerkId,
        email: user.emailAddresses[0]?.emailAddress || '',
        username: user.username || `${user.firstName} ${user.lastName}`.trim() || 'Anonymous',
        avatarUrl: user.imageUrl,
        role: 'USER',
      },
    });

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
      details: error.stack?.split('\n')[0]
    }, { status: 500 });
  }
}

export const GET = POST; // Allow both for flexibility
