import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs';
import prisma from '@/lib/server/database/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { userId: otherUserId, otherUserId: altOtherUserId } = body;
    const targetUserId = otherUserId || altOtherUserId;

    if (!targetUserId) {
      return NextResponse.json(
        { error: 'Other user ID is required' },
        { status: 400 }
      );
    }

    // Get current user's database ID
    const currentUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true },
    });

    if (!currentUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get other user's database ID
    const otherUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true },
    });

    if (!otherUser) {
      return NextResponse.json(
        { error: 'Other user not found' },
        { status: 404 }
      );
    }

    // Check if conversation exists
    const existing = await prisma.conversation.findFirst({
      where: {
        OR: [
          { user1Id: currentUser.id, user2Id: otherUser.id },
          { user1Id: otherUser.id, user2Id: currentUser.id },
        ],
      },
    });

    if (existing) {
      return NextResponse.json({ 
        data: { conversationId: existing.id },
        success: true 
      });
    }

    // Create new conversation
    const conversation = await prisma.conversation.create({
      data: {
        user1Id: currentUser.id,
        user2Id: otherUser.id,
      },
    });

    return NextResponse.json({ 
      data: { conversationId: conversation.id },
      success: true 
    }, { status: 201 });
  } catch (error: any) {
    console.error('Create conversation error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: process.env.NODE_ENV === 'development' ? error.message : undefined 
      },
      { status: 500 }
    );
  }
}
