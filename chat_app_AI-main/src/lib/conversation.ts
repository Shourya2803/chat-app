import { getAdminFirestore } from './firebase-admin';

export const GLOBAL_CONVERSATION_ID = 'global-group';

export async function getOrCreateGlobalConversation() {
    try {
        const db = await getAdminFirestore();
        const chatRef = db.collection('chats').doc(GLOBAL_CONVERSATION_ID);
        const chatDoc = await chatRef.get();

        if (!chatDoc.exists) {
            console.log('🚀 Creating global conversation record in Firestore...');
            await chatRef.set({
                type: 'group',
                name: 'Corporate General Chat',
                members: [], // Public groups might have empty members if everyone can see them
                createdAt: new Date(),
                updatedAt: new Date(),
                lastMessageAt: new Date(),
            });
            console.log('✅ Global conversation created in Firestore');
        }

        return { id: GLOBAL_CONVERSATION_ID, ...(chatDoc.exists ? chatDoc.data() : {}) };
    } catch (error) {
        console.error('❌ Error in getOrCreateGlobalConversation:', error);
        throw error;
    }
}
