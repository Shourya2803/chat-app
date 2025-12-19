import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        // Authenticate with Clerk
        const { userId: clerkId } = auth();

        if (!clerkId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get the user from database
        const user = await prisma.user.findUnique({
            where: { clerkId },
            select: { id: true, role: true },
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const isAdmin = (user as any).role === 'ADMIN';
        const currentUserId = user.id;

        // Get query parameters
        const searchParams = req.nextUrl.searchParams;
        const limit = parseInt(searchParams.get('limit') || '100');
        const offset = parseInt(searchParams.get('offset') || '0');

        // Fetch messages from database
        const messages = await prisma.message.findMany({
            where: {
                conversationId: 'global-group',
                isDeleted: false
            },
            orderBy: { createdAt: 'desc' },
            skip: offset,
            take: limit,
            include: {
                sender: {
                    select: { username: true }
                }
            }
        });

        // Format messages with proper content based on role
        const formattedMessages = messages.map(m => {
            // Admin sees original_content only
            // Sender sees their own original_content
            // Others see AI-refined content
            const displayContent = isAdmin || m.senderId === currentUserId
                ? m.originalContent || m.content
                : m.content;

            return {
                id: m.id,
                conversation_id: m.conversationId,
                sender_id: m.senderId,
                sender_username: m.sender.username || 'Anonymous',
                receiver_id: m.receiverId,
                content: displayContent,
                original_content: m.originalContent,
                tone_applied: m.toneApplied,
                message_type: m.mediaUrl ? 'image' : 'text',
                media_url: m.mediaUrl,
                status: m.status,
                is_read: m.isRead,
                read_at: m.readAt,
                created_at: m.createdAt,
                updated_at: m.updatedAt,
            };
        });

        return NextResponse.json({
            success: true,
            data: {
                name: 'Corporate General Chat',
                messages: formattedMessages.reverse(), // Oldest first
            },
        });
    } catch (error: any) {
        console.error('❌ Get messages error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch messages', details: error.message },
            { status: 500 }
        );
    }
}
