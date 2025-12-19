import { prisma } from './prisma';

export const GLOBAL_CONVERSATION_ID = 'global-group';

export async function getOrCreateGlobalConversation() {
    try {
        let conversation = await prisma.conversation.findUnique({
            where: { id: GLOBAL_CONVERSATION_ID },
        });

        if (!conversation) {
            console.log('🚀 Creating global conversation record...');
            conversation = await prisma.conversation.create({
                data: {
                    id: GLOBAL_CONVERSATION_ID,
                    type: 'GLOBAL',
                    name: 'Corporate General Chat',
                },
            });
            console.log('✅ Global conversation created');
        }

        return conversation;
    } catch (error) {
        console.error('❌ Error in getOrCreateGlobalConversation:', error);
        throw error;
    }
}
