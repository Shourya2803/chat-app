import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs';
import prisma from '@/lib/server/database/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current user to find their ID
    const currentUser = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (!currentUser) {
      return NextResponse.json({ conversations: [] });
    }

    // Get conversations with Prisma
    const conversations = await prisma.conversation.findMany({
      where: {
        OR: [
          { user1Id: currentUser.id },
          { user2Id: currentUser.id },
        ],
      },
      include: {
        user1: true,
        user2: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { lastMessageAt: 'desc' },
    });

    // Format response
    const formattedConversations = await Promise.all(
      conversations.map(async (conv) => {
        const otherUser = conv.user1Id === currentUser.id ? conv.user2 : conv.user1;
        const unreadCount = await prisma.message.count({
          where: {
            conversationId: conv.id,
            receiverId: currentUser.id,
            isRead: false,
          },
        });

        return {
          conversation_id: conv.id,
          other_user: {
            id: otherUser.id,
            username: otherUser.username,
            first_name: otherUser.firstName,
            last_name: otherUser.lastName,
            email: otherUser.email,
            avatar_url: otherUser.avatarUrl,
            status: otherUser.status,
          },
          last_message: conv.messages[0] ? {
            content: conv.messages[0].content,
            created_at: conv.messages[0].createdAt,
          } : null,
          unread_count: unreadCount,
        };
      })
    );

    return NextResponse.json({ conversations: formattedConversations });
  } catch (error) {
    console.error('Get conversations error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
