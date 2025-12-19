import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs';
import { prisma } from '@/lib/prisma';
import { adminDb } from '@/lib/firebase-admin';
import { aiService } from '@/lib/ai.service';
import { redis } from '@/lib/redis';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
    try {
        // Authenticate with Clerk
        const { userId: clerkId } = auth();

        if (!clerkId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get the user from database
        const user = await prisma.user.findUnique({
            where: { clerkId },
            select: { id: true, username: true, role: true },
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Parse request body
        const body = await req.json();
        const { content, mediaUrl } = body;

        if (!content || !content.trim()) {
            return NextResponse.json({ error: 'Content is required' }, { status: 400 });
        }

        // Apply AI tone conversion (always professional)
        let finalContent = content;
        let originalContent = content;
        const appliedTone = 'professional';

        console.log('🤖 Applying professional tone conversion');

        try {
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Gemini API timeout after 30s')), 30000)
            );

            const result = await Promise.race([
                aiService.convertTone(content, 'professional'),
                timeoutPromise
            ]) as any;

            if (result.success && result.convertedText) {
                finalContent = result.convertedText;
                console.log('✅ Tone conversion successful');
            } else {
                console.warn(`⚠️ Tone conversion failed: ${result.error || 'Empty response'}`);
            }
        } catch (error: any) {
            console.error(`❌ Tone conversion error: ${error.message}`);
        }

        // Save to Prisma database
        const timestamp = Date.now();
        const messageId = `msg_${timestamp}_${user.id.substring(0, 8)}`;

        // Get system user for receiver (global chat)
        const systemUser = await prisma.user.findUnique({
            where: { clerkId: 'system-admin' }
        });
        const receiverId = systemUser?.id || user.id;

        const message = await prisma.message.create({
            data: {
                conversationId: 'global-group',
                senderId: user.id,
                receiverId: receiverId,
                content: finalContent,
                originalContent: originalContent,
                toneApplied: appliedTone,
                mediaUrl: mediaUrl || null,
            },
        });

        // Save to Firebase Realtime Database for instant sync
        // Fail gracefully if Firebase is not configured (don't block the API)
        if (adminDb) {
            try {
                const firebaseMessage = {
                    id: message.id,
                    sender_id: user.id,
                    sender_username: user.username || 'Anonymous',
                    content: finalContent,
                    original_content: originalContent,
                    timestamp: timestamp,
                    is_admin_message: (user as any).role === 'ADMIN',
                    media_url: mediaUrl || null,
                };

                await adminDb.ref(`messages/${timestamp}`).set(firebaseMessage);
                console.log(`✅ Message saved to Firebase: ${message.id}`);
            } catch (fbError) {
                console.error('⚠️ Failed to save to Firebase (message saved to DB only):', fbError);
            }
        } else {
            console.warn('⚠️ Firebase Admin not initialized - skipping real-time sync');
        }

        console.log(`✅ Message saved to Prisma: ${message.id}`);

        // Redis Caching (as requested: keep last 10 messages)
        if (redis) {
            try {
                const cacheKey = 'chat:messages:global-group';

                // Construct message object matching the frontend structure
                const redisMessage = JSON.stringify({
                    id: message.id,
                    conversation_id: message.conversationId,
                    sender_id: message.senderId,
                    sender_username: user.username || 'Anonymous', // Add username for display
                    receiver_id: message.receiverId,
                    content: message.content,
                    original_content: message.originalContent,
                    tone_applied: message.toneApplied,
                    message_type: mediaUrl ? 'image' : 'text',
                    media_url: message.mediaUrl,
                    status: 'sent',
                    is_read: false,
                    created_at: message.createdAt,
                    updated_at: message.updatedAt,
                });

                // Push to head of list
                await redis.lpush(cacheKey, redisMessage);

                // Trim to keep only the newest 10 items (0 to 9)
                await redis.ltrim(cacheKey, 0, 9);
                console.log('✅ Message cached in Redis (Top 10)');
            } catch (redisError) {
                console.error('⚠️ Redis cache error:', redisError);
            }
        }

        return NextResponse.json({
            success: true,
            data: {
                message: {
                    id: message.id,
                    conversation_id: message.conversationId,
                    sender_id: message.senderId,
                    receiver_id: message.receiverId,
                    content: message.content,
                    original_content: message.originalContent,
                    tone_applied: message.toneApplied,
                    message_type: mediaUrl ? 'image' : 'text',
                    media_url: message.mediaUrl,
                    status: 'sent',
                    is_read: false,
                    created_at: message.createdAt,
                    updated_at: message.updatedAt,
                },
            },
        });
    } catch (error: any) {
        console.error('❌ Send message error:', error);
        return NextResponse.json(
            { error: 'Failed to send message', details: error.message },
            { status: 500 }
        );
    }
}
