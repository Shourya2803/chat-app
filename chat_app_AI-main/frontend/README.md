# Chat App Frontend

Next.js 14 + React 18 + Socket.IO client for the AI-powered chat application.

## Features

- ✅ **Real-time Chat**: Socket.IO client connects to backend
- ✅ **Authentication**: Clerk integration
- ✅ **Modern UI**: Tailwind CSS + Framer Motion
- ✅ **State Management**: Zustand
- ✅ **TypeScript**: Full type safety
- ✅ **Vercel Ready**: Optimized for serverless deployment

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **UI Library**: React 18
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **State**: Zustand
- **Auth**: Clerk
- **WebSocket**: Socket.IO Client
- **HTTP**: Axios

## Installation

```bash
npm install
```

## Configuration

Copy `.env.example` to `.env.local` and configure:

```bash
cp .env.example .env.local
```

Required environment variables:

```bash
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
```

## Development

```bash
npm run dev
```

App runs on `http://localhost:3000`

## Production Build

```bash
npm run build
npm start
```

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed Vercel deployment instructions.

## Project Structure

```
frontend/
├── src/
│   ├── app/                # Next.js pages
│   │   ├── chat/          # Main chat page
│   │   ├── sign-in/       # Authentication
│   │   └── api/           # API routes
│   ├── components/        # React components
│   │   └── chat/
│   ├── lib/
│   │   ├── socket.ts      # Socket.IO client
│   │   ├── api.ts         # HTTP client
│   │   └── utils.ts       # Utilities
│   ├── store/             # Zustand stores
│   └── types/             # TypeScript types
└── package.json
```

## Usage Example

See [EXAMPLE_COMPONENT.tsx](EXAMPLE_COMPONENT.tsx) for a complete example.

Quick example:

```typescript
import socketService from '@/lib/socket';
import { useUser } from '@clerk/nextjs';

export default function ChatComponent() {
  const { user } = useUser();

  useEffect(() => {
    const connect = async () => {
      const token = await user?.getToken();
      if (token) {
        socketService.connect(token);
      }
    };
    connect();
  }, [user]);

  const sendMessage = () => {
    socketService.sendMessage({
      conversationId: 'conv-id',
      receiverId: 'user-id',
      content: 'Hello!',
    });
  };

  return <button onClick={sendMessage}>Send</button>;
}
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_SOCKET_URL` | Backend WebSocket URL | Yes |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk public key | Yes |
| `NEXT_PUBLIC_APP_URL` | App URL | No |

## Scripts

- `npm run dev` - Development server
- `npm run build` - Production build
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## License

MIT
