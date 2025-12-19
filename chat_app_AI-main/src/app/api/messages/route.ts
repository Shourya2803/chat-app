import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    console.log('📨 [MESSAGES] GET Request received');
    try {
        // Authenticate with Clerk
        const { userId: clerkId } = auth();
        console.log('📨 [MESSAGES] Clerk ID:', clerkId);

        if (!clerkId) {
            console.warn('📨 [MESSAGES] Unauthorized');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get the user from database
        const user = await prisma.user.findUnique({
            where: { clerkId },
            select: { id: true, role: true },
        });

        // If user not found in DB, they aren't an admin and won't have a DB user ID yet.
        // We don't 404 here anymore to allow initial load while sync happens.
        const isAdmin = user ? (user as any).role === 'ADMIN' : false;
        const currentUserId = user?.id || clerkId; // Fallback to clerkId for identification if not synced

        if (!user) {
            console.log('📨 [MESSAGES] User not in DB yet, treating as guest/non-admin');
        }

        // Get query parameters
        const searchParams = req.nextUrl.searchParams;
        const limit = parseInt(searchParams.get('limit') || '100');
        const offset = parseInt(searchParams.get('offset') || '0');
        console.log(`📨 [MESSAGES] Params - Limit: ${limit}, Offset: ${offset}`);

        // Redis Cache Check (Fast Load)
        // Only checking for initial page (offset 0) to speed up "above the fold" load
        if (redis && offset === 0) {
            try {
                const cacheKey = 'chat:messages:global-group';
                const cachedMessages = await redis.lrange(cacheKey, 0, 9); // Get top 10

                if (cachedMessages.length > 0) {
                    console.log('🚀 Redis Cache HIT: Returning 10 fast messages');
                    const parsedMessages = cachedMessages.map((msgStr) => {
                        const m = JSON.parse(msgStr);
                        // Apply visibility rules even to cached messages (sanity check)
                        // Admin sees original, Sender sees original, others see content
                        // Note: Redis stores pre-formatted structure, but we re-check ownership for safety if needed.
                        // For simplicity and speed, we trust the cached structure but re-verify "displayContent" logic if possible.
                        // Actually, the cache has 'original_content' and 'content'. We need to select right one.
                        const isSender = m.sender_id === currentUserId;
                        const displayContent = isAdmin || isSender ? m.original_content || m.content : m.content;

                        return {
                            ...m,
                            content: displayContent
                        };
                    });

                    // Redis list has Newest at index 0 (LPUSH). We need to reverse to show Oldest -> Newest
                    return NextResponse.json({
                        success: true,
                        data: {
                            name: 'Corporate General Chat',
                            messages: parsedMessages.reverse(),
                        },
                    });
                }
            } catch (redisError) {
                console.error('⚠️ Redis cache read error (falling back to DB):', redisError);
            }
        }

        // Fetch messages from database (Fallback or Load More)
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
            {
                error: 'Failed to fetch messages',
                message: error.message,
                code: error.code,
                details: error.stack?.split('\n')[0]
            },
            { status: 500 }
        );
    }
}
