# Chat App Backend

Node.js + Express + Socket.IO + Prisma + Redis backend for the AI-powered chat application.

## Features

- ✅ **WebSocket Server**: Real-time chat via Socket.IO
- ✅ **Authentication**: Clerk token verification
- ✅ **Database**: PostgreSQL via Prisma ORM
- ✅ **Caching**: Redis for user presence
- ✅ **AI Integration**: Google Gemini for tone conversion
- ✅ **Scalable**: Designed for Render deployment

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **WebSocket**: Socket.IO 4.x
- **Database**: PostgreSQL + Prisma ORM
- **Cache**: Redis + ioredis
- **AI**: Google Generative AI (Gemini)
- **Auth**: Clerk SDK

## Installation

```bash
npm install
```

## Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Required environment variables:

```bash
DATABASE_URL=postgresql://user:password@host:5432/database
CLERK_SECRET_KEY=sk_live_xxxxx
GEMINI_API_KEY=AIzaSyxxxxx
FRONTEND_URL=https://your-frontend.vercel.app
```

## Database Setup

```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Or for development
npx prisma migrate dev
```

## Development

```bash
npm run dev
```

Server runs on `http://localhost:4000`

## Production

```bash
npm start
```

## Health Check

```bash
curl http://localhost:4000/health
```

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed Render deployment instructions.

## Project Structure

```
backend/
├── src/
│   ├── lib/
│   │   ├── prisma.ts       # Database client
│   │   └── redis.ts        # Redis + presence
│   ├── services/
│   │   └── ai.service.ts   # Gemini AI
│   └── utils/
│       └── logger.ts       # Logging
├── prisma/
│   └── schema.prisma       # Database schema
├── server.ts               # Main server file
└── package.json
```

## Socket.IO Events

### Client → Server

- `join-conversation` - Join conversation room
- `leave-conversation` - Leave conversation room
- `send-message` - Send chat message
- `typing` - Typing indicator
- `mark-read` - Mark message as read
- `heartbeat` - Presence heartbeat

### Server → Client

- `message-sent` - Message sent confirmation
- `new-message` - New message received
- `message-error` - Error occurred
- `user-typing` - User is typing
- `message-read` - Message read receipt
- `user-status` - User online/offline

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port | No (default: 4000) |
| `NODE_ENV` | Environment | No (default: development) |
| `DATABASE_URL` | PostgreSQL connection | Yes |
| `REDIS_URL` | Redis connection | No (graceful fallback) |
| `CLERK_SECRET_KEY` | Clerk authentication | Yes |
| `GEMINI_API_KEY` | Google Gemini AI | Yes |
| `FRONTEND_URL` | Frontend URL for CORS | Yes |

## Scripts

- `npm run dev` - Development with hot reload
- `npm start` - Production server
- `npx prisma generate` - Generate Prisma client
- `npx prisma migrate deploy` - Run migrations
- `npx prisma studio` - Database GUI

## License

MIT
