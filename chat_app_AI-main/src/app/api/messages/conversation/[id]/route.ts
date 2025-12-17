import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs';
import prisma from '@/lib/server/database/prisma';
import { MessageQueue } from '@/lib/server/workers/message.queue';

// Initialize message queue
const messageQueue = new MessageQueue();

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Get current user
    const currentUser = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify user is part of this conversation
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: id,
        OR: [
          { user1Id: currentUser.id },
          { user2Id: currentUser.id },
        ],
      },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Get messages with sender info
    const messages = await prisma.message.findMany({
      where: {
        conversationId: id,
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: limit,
      skip: offset,
    });

    // Transform to match expected format
    const formattedMessages = messages.map(msg => ({
      id: msg.id,
      conversation_id: msg.conversationId,
      sender_id: msg.senderId,
      receiver_id: msg.receiverId,
      content: msg.content,
      original_content: msg.originalContent,
      tone_applied: msg.toneApplied,
      message_type: msg.mediaUrl ? 'image' : 'text',
      media_url: msg.mediaUrl,
      read_at: msg.readAt,
      created_at: msg.createdAt,
      sender_name: msg.sender.username || `${msg.sender.firstName} ${msg.sender.lastName}`,
      sender_avatar: msg.sender.avatarUrl,
    }));

    return NextResponse.json({
      data: {
        messages: formattedMessages,
      },
      hasMore: messages.length === limit,
    });
  } catch (error) {
    console.error('Get messages error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { content, imageUrl, receiverId, tone } = body;

    if (!content && !imageUrl) {
      return NextResponse.json(
        { error: 'Content or image is required' },
        { status: 400 }
      );
    }

    // Get current user
    const currentUser = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get receiver
    const receiver = await prisma.user.findUnique({
      where: { id: receiverId },
    });

    if (!receiver) {
      return NextResponse.json({ error: 'Receiver not found' }, { status: 404 });
    }

    // Apply tone if enabled
    let finalContent = content;
    let originalContent = content;
    let appliedTone = null;

    console.log('API Message received:', {
      hasContent: !!content,
      hasTone: !!tone,
      tone: tone,
      contentLength: content?.length
    });

    if (tone && content && content.trim()) {
      console.log('Applying tone conversion via API:', tone);
      try {
        const { aiService } = await import('@/lib/server/services/ai.service');
        const result = await aiService.convertTone(content, tone);
        
        if (result.success && result.convertedText) {
          finalContent = result.convertedText;
          appliedTone = tone;
          console.log('✓ API Tone conversion successful:', {
            original: content,
            converted: finalContent,
            tone
          });
        } else {
          console.error('✗ API Tone conversion failed:', result.error);
        }
      } catch (error) {
        console.error('✗ API Tone conversion error:', error);
      }
    } else {
      console.log('Skipping API tone conversion - conditions not met');
    }

    // Create message
    const message = await prisma.message.create({
      data: {
        conversationId: id,
        senderId: currentUser.id,
        receiverId: receiver.id,
        content: finalContent,
        originalContent: originalContent,
        toneApplied: appliedTone,
        mediaUrl: imageUrl || null,
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Update conversation last message time
    await prisma.conversation.update({
      where: { id: id },
      data: { lastMessageAt: new Date() },
    });

    // Format response
    const formattedMessage = {
      id: message.id,
      conversation_id: message.conversationId,
      sender_id: message.senderId,
      receiver_id: message.receiverId,
      content: message.content,
      original_content: message.originalContent,
      tone_applied: message.toneApplied,
      message_type: message.mediaUrl ? 'image' : 'text',
      media_url: message.mediaUrl,
      read_at: message.readAt,
      created_at: message.createdAt,
      sender_name: message.sender.username || `${message.sender.firstName} ${message.sender.lastName}`,
      sender_avatar: message.sender.avatarUrl,
    };

    return NextResponse.json({
      success: true,
      data: formattedMessage,
    });
  } catch (error) {
    console.error('Send message error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
