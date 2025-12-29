import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs';
import { getAdminFirestore, getAdminDb } from '@/lib/firebase-admin';
import { aiService } from '@/lib/ai.service';
import { DocumentData } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const { userId: clerkId } = auth();
        const user = await currentUser();

        if (!clerkId || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { chatId, content, mediaUrl, tone = 'professional' } = await req.json();

        if (!chatId || (!content && !mediaUrl)) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // 1. Get Sender Info from Firestore (Migrated from Prisma)
        const db = await getAdminFirestore();
        const userRef = db.collection('users').doc(clerkId);
        const userDoc = await userRef.get();
        const userData = userDoc.data() as DocumentData | undefined; // Cast to DocumentData

        if (!userData) {
            return NextResponse.json({ error: 'User profile not found in Firestore' }, { status: 404 });
        }

        const rtdb = await getAdminDb();

        // 1. Validate Chat Membership
        const chatDoc = await db.collection('chats').doc(chatId).get();
        if (!chatDoc.exists) return NextResponse.json({ error: 'Chat not found' }, { status: 404 });

        const chatData = chatDoc.data() || {};
        // 1. Validate Chat Membership (Bypass for Admins)
        const isMember = chatData.members?.includes(clerkId);
        const isAdmin = userData?.role === 'ADMIN';

        if (!isMember && !isAdmin) {
            return NextResponse.json({ error: 'Not a member of this chat' }, { status: 403 });
        }

        // 2. Load Admin Settings for AI
        const adminSettingsDoc = await db.collection('admin_settings').doc('ai_rules').get();
        const systemPrompt = adminSettingsDoc.exists ? adminSettingsDoc.data()?.systemPrompt : undefined;

        const keyExists = !!(process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY);
        console.log(`🤖 AI: Secure Tone Conversion started... [Key: ${keyExists ? 'Active' : 'Missing'}] [Prompt: ${systemPrompt ? 'Custom' : 'Default'}]`);

        // 3. Process with AI (Enforce Professional as Default)
        let finalContent = content || '';
        if (content && content.trim()) {
            console.log(`🤖 AI: Converting "${content.slice(0, 30)}..."`);
            const result = await aiService.convertTone(content, 'professional', systemPrompt);
            if (result.success && result.convertedText) {
                finalContent = result.convertedText;
                console.log(`✅ AI: Transcription Complete: "${finalContent}"`);
            } else {
                console.warn(`⚠️ AI: Conversion failed or blocked. Using original as fallback. Error: ${result.error}`);
            }
        }

        // 4. Save Message to Firestore (Permanent Archive)
        const messageRef = db.collection('messages').doc(chatId).collection('messages').doc();
        const messageData = {
            id: messageRef.id,
            senderId: clerkId,
            senderUsername: user.username || 'Anonymous',
            originalText: content || '',
            aiText: finalContent,
            mediaUrl: mediaUrl || null,
            createdAt: new Date().toISOString(), // Use ISO string for consistency
        };
        await messageRef.set(messageData);

        // 5. Dual-Write to Realtime Database (Sub-second Sync)
        try {
            await rtdb.ref(`messages/${chatId}/${messageRef.id}`).set(messageData);
            console.log(`⚡ RTDB: Message synced successfully to /messages/${chatId}`);
        } catch (rtdbErr) {
            console.error('❌ RTDB write failed:', rtdbErr);
            // Don't fail the whole request if only RTDB fails, but we should know.
        }

        // 6. Update Chat Last Message
        await db.collection('chats').doc(chatId).update({
            lastMessage: finalContent || (mediaUrl ? 'Sent an image' : ''),
            lastOriginalMessage: content || finalContent || (mediaUrl ? 'Sent an image' : ''),
            lastMessageAt: new Date(),
        });

        return NextResponse.json({ success: true, data: { message: messageData } });
    } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorStack = error instanceof Error ? error.stack : undefined;
        console.error('❌ CRITICAL: Send message error:', errorMessage, errorStack);

        return NextResponse.json({
            error: errorMessage,
            details: errorStack, // Helpful for debugging
            code: 'INTERNAL_SERVER_ERROR'
        }, { status: 500 });
    }
}
