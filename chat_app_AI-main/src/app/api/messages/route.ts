import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs';
import { getAdminFirestore } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    console.log('📨 [MESSAGES] GET Request received (Firestore Migration)');
    try {
        const { userId: clerkId } = auth();
        if (!clerkId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const db = await getAdminFirestore();

        // 1. Get User Profile for Role Check
        const userDoc = await db.collection('users').doc(clerkId).get();
        const userData = userDoc.data();
        const isAdmin = userData?.role === 'ADMIN';

        // 2. Get Query Parameters
        const searchParams = req.nextUrl.searchParams;
        const chatId = searchParams.get('chatId') || 'global-group';
        const limit = parseInt(searchParams.get('limit') || '50');

        console.log(`📨 [MESSAGES] Fetching for Chat: ${chatId} (Limit: ${limit})`);

        // 3. Fetch Messages from Firestore Subcollection
        const messagesSnapshot = await db.collection('messages')
            .doc(chatId)
            .collection('messages')
            .orderBy('createdAt', 'desc')
            .limit(limit)
            .get();

        const formattedMessages = messagesSnapshot.docs.map((doc: any) => {
            const m = doc.data();
            const isSender = m.senderId === clerkId;

            // Logic: Admin and Sender see original text. Others see AI secured text.
            const displayContent = (isAdmin || isSender)
                ? (m.originalText || m.aiText || '')
                : (m.aiText || m.originalText || '');

            return {
                id: doc.id,
                conversation_id: chatId,
                sender_id: m.senderId,
                sender_username: m.senderUsername || 'Anonymous',
                content: displayContent,
                original_content: m.originalText,
                ai_text: m.aiText,
                message_type: m.mediaUrl ? 'image' : 'text',
                media_url: m.mediaUrl,
                created_at: m.createdAt,
            };
        });

        return NextResponse.json({
            success: true,
            data: {
                id: chatId,
                messages: formattedMessages.reverse(), // Show oldest at top
            },
        });

    } catch (error: any) {
        console.error('❌ Get messages error from Firestore:', error);
        return NextResponse.json({
            error: 'Failed to fetch messages',
            message: error.message
        }, { status: 500 });
    }
}
