import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs';
import prisma from '@/lib/server/database/prisma';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const { userId } = auth();
    const user = await currentUser();

    if (!userId || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user exists first
    const existingUser = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (existingUser) {
      // Update existing user
      await prisma.user.update({
        where: { clerkId: userId },
        data: {
          username: user.username || null,
          firstName: user.firstName || null,
          lastName: user.lastName || null,
          avatarUrl: user.imageUrl || null,
          // Don't update email to avoid constraint conflicts
        },
      });
    } else {
      // Create new user only if doesn't exist
      try {
        await prisma.user.create({
          data: {
            clerkId: userId,
            email: user.emailAddresses[0]?.emailAddress || '',
            username: user.username || null,
            firstName: user.firstName || null,
            lastName: user.lastName || null,
            avatarUrl: user.imageUrl || null,
          },
        });
      } catch (createError: any) {
        // If user was just created by another request (race condition), update instead
        if (createError.code === 'P2002') {
          await prisma.user.update({
            where: { clerkId: userId },
            data: {
              username: user.username || null,
              firstName: user.firstName || null,
              lastName: user.lastName || null,
              avatarUrl: user.imageUrl || null,
            },
          });
        } else {
          throw createError;
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'User synced successfully',
    });
  } catch (error: any) {
    console.error('Auth sync error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta,
      stack: error.stack
    });
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        code: process.env.NODE_ENV === 'development' ? error.code : undefined
      },
      { status: 500 }
    );
  }
}
