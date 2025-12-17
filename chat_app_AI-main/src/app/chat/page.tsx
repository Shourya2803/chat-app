import { currentUser } from '@clerk/nextjs';
import { redirect } from 'next/navigation';
import ChatLayout from '@/components/chat/ChatLayout';

export default async function ChatPage() {
  const user = await currentUser();

  if (!user) {
    redirect('/sign-in');
  }

  return <ChatLayout />;
}
