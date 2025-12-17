# Chat App - Frontend/Backend Separation

This project has been refactored into a clean frontend/backend architecture suitable for deployment on Vercel (frontend) and Render (backend).

## 📁 Project Structure

```
chat_app_AI-main/
├── frontend/                    # 🎨 VERCEL DEPLOYMENT
│   ├── src/
│   │   ├── app/                # Next.js App Router pages
│   │   │   ├── chat/           # Main chat page
│   │   │   ├── sign-in/        # Clerk sign-in
│   │   │   ├── sign-up/        # Clerk sign-up
│   │   │   └── api/            # REST API routes (NO WebSocket here!)
│   │   ├── components/         # React components
│   │   │   └── chat/
│   │   │       ├── ChatWindow.tsx
│   │   │       ├── MessageList.tsx
│   │   │       ├── MessageInput.tsx
│   │   │       ├── Sidebar.tsx
│   │   │       └── ToneSelector.tsx
│   │   ├── lib/
│   │   │   ├── socket.ts       # ✅ Socket.IO CLIENT (connects to backend)
│   │   │   ├── api.ts          # HTTP client for REST API
│   │   │   └── utils.ts
│   │   ├── store/              # Zustand state management
│   │   └── types/              # TypeScript types
│   ├── package.json            # Frontend dependencies only
│   ├── .env.example            # Public env vars (NEXT_PUBLIC_*)
│   └── DEPLOYMENT.md           # Vercel deployment guide
│
├── backend/                     # 🚀 RENDER DEPLOYMENT
│   ├── src/
│   │   ├── lib/
│   │   │   ├── prisma.ts       # Prisma client
│   │   │   └── redis.ts        # Redis + presence service
│   │   ├── services/
│   │   │   └── ai.service.ts   # Google Gemini integration
│   │   └── utils/
│   │       └── logger.ts       # Logging utility
│   ├── prisma/
│   │   └── schema.prisma       # Database schema
│   ├── server.ts               # ✅ Express + Socket.IO SERVER
│   ├── package.json            # Backend dependencies only
│   ├── .env.example            # Secret env vars (DO NOT expose to frontend!)
│   └── DEPLOYMENT.md           # Render deployment guide
│
└── README.md                    # This file
```

---

## 🎯 Architecture Overview

### Frontend (Vercel)
- **Technology**: Next.js 14 (App Router) + React 18 + TypeScript
- **Auth**: Clerk (hosted authentication)
- **State**: Zustand stores
- **Real-time**: Socket.IO **client** (connects to backend)
- **Deployment**: Vercel serverless/edge
- **No Secrets**: Only public env vars (`NEXT_PUBLIC_*`)

### Backend (Render)
- **Technology**: Node.js + Express + Socket.IO server
- **Database**: PostgreSQL via Prisma ORM
- **Cache**: Redis (for user presence)
- **AI**: Google Gemini (tone conversion)
- **Auth**: Verifies Clerk tokens
- **Deployment**: Render (long-running Node process)
- **Secrets**: Database credentials, API keys, etc.

---

## 🔄 How It Works

### Message Flow

```
1. User types message in frontend (ChatWindow.tsx)
   ↓
2. Frontend sends via Socket.IO client (socket.ts)
   ↓
3. WebSocket connection to backend (wss://backend.onrender.com)
   ↓
4. Backend receives 'send-message' event (server.ts)
   ↓
5. Backend verifies Clerk token
   ↓
6. Backend applies tone if requested (ai.service.ts)
   ↓
7. Backend saves to PostgreSQL (Prisma)
   ↓
8. Backend broadcasts to receiver's room
   ↓
9. Frontend receives 'new-message' event
   ↓
10. React component updates UI
```

### Authentication Flow

```
1. User signs in via Clerk (frontend)
   ↓
2. Clerk issues session token
   ↓
3. Frontend stores token in cookie
   ↓
4. Frontend connects Socket.IO with token:
   io(backendUrl, { auth: { token } })
   ↓
5. Backend middleware verifies token:
   clerkClient.verifyToken(token)
   ↓
6. Backend fetches user from database by clerk_id
   ↓
7. Backend attaches user info to socket:
   socket.data.userId = dbUserId
   ↓
8. User authenticated for all socket events
```

---

## 🚀 Deployment Steps

### 1. Deploy Backend to Render

```bash
cd backend

# Set up environment variables in Render dashboard:
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
CLERK_SECRET_KEY=sk_live_...
GEMINI_API_KEY=AIzaSy...
FRONTEND_URL=https://your-app.vercel.app

# Deploy
git push origin main
```

See [backend/DEPLOYMENT.md](backend/DEPLOYMENT.md) for details.

### 2. Deploy Frontend to Vercel

```bash
cd frontend

# Set up environment variables in Vercel dashboard:
NEXT_PUBLIC_SOCKET_URL=https://your-backend.onrender.com
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...

# Deploy
git push origin main
```

See [frontend/DEPLOYMENT.md](frontend/DEPLOYMENT.md) for details.

---

## 🛠️ Local Development

### Prerequisites
- Node.js 18+ 
- PostgreSQL database
- Redis server (optional)
- Clerk account
- Google Gemini API key

### Setup Backend

```bash
cd backend

# Install dependencies
npm install

# Copy and configure environment
cp .env.example .env
# Edit .env with your credentials

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Start backend server
npm run dev
```

Backend runs on `http://localhost:4000`

### Setup Frontend

```bash
cd frontend

# Install dependencies
npm install

# Copy and configure environment
cp .env.example .env.local
# Edit with:
# NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
# NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...

# Start frontend
npm run dev
```

Frontend runs on `http://localhost:3000`

### Test Connection

1. Open `http://localhost:3000`
2. Sign in with Clerk
3. Open browser console (F12)
4. Look for: `✅ Socket connected to backend`
5. Send a test message

---

## 🔑 Environment Variables

### Frontend (.env.local)
```bash
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Backend (.env)
```bash
NODE_ENV=development
PORT=4000
FRONTEND_URL=http://localhost:3000

DATABASE_URL=postgresql://user:pass@localhost:5432/chatdb
REDIS_URL=redis://localhost:6379

CLERK_SECRET_KEY=sk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...

GEMINI_API_KEY=AIzaSy...
```

---

## 📝 Key Files Explained

### Backend

#### `backend/server.ts`
- Main entry point
- Creates Express HTTP server
- Attaches Socket.IO for WebSocket
- Handles all real-time events
- Auth middleware for Clerk verification

#### `backend/src/lib/prisma.ts`
- Prisma client singleton
- Database connection management
- Used for all DB queries

#### `backend/src/lib/redis.ts`
- Redis client
- Presence service (online/offline status)
- Pub/sub for real-time updates

#### `backend/src/services/ai.service.ts`
- Google Gemini AI integration
- Tone conversion logic
- Error handling for AI failures

### Frontend

#### `frontend/src/lib/socket.ts`
- Socket.IO **client** singleton
- Connects to backend WebSocket
- Sends Clerk token for auth
- Provides methods: `connect()`, `sendMessage()`, `joinConversation()`, etc.

#### `frontend/src/components/chat/ChatWindow.tsx`
- Main chat interface
- Uses `socketService` to send/receive messages
- Listens for `new-message`, `message-sent`, etc.
- Integrates with Zustand store

---

## 🐛 Troubleshooting

### WebSocket Connection Issues

**Symptom**: "Socket connection error" in console

**Check**:
1. Backend is running: `curl https://your-backend.onrender.com/health`
2. `NEXT_PUBLIC_SOCKET_URL` is correct (no trailing slash)
3. Backend CORS allows frontend domain
4. Render service is not sleeping (free tier sleeps after 15 min)

### Authentication Issues

**Symptom**: "Authentication error: Invalid token"

**Check**:
1. Clerk secret key is set in backend
2. Clerk publishable key matches secret key (same environment)
3. Token is being passed: check `socket.handshake.auth.token` in backend logs
4. User exists in database with matching `clerk_id`

### Database Connection Issues

**Symptom**: "Database connection failed"

**Check**:
1. `DATABASE_URL` is correct
2. Database is accessible from Render server
3. Prisma client is generated: `npx prisma generate`
4. Migrations are applied: `npx prisma migrate deploy`

### CORS Errors

**Symptom**: "CORS policy: No 'Access-Control-Allow-Origin'"

**Check**:
1. Backend `FRONTEND_URL` includes your Vercel domain
2. Backend CORS config allows credentials
3. Frontend uses `withCredentials: true` in socket config

---

## 📊 Performance Tips

### Backend
- Use Redis for caching frequently accessed data
- Enable database connection pooling
- Add indexes to frequently queried fields
- Use Prisma's `select` to fetch only needed fields

### Frontend
- Use React.memo for expensive components
- Debounce typing indicators
- Lazy load images
- Use Next.js Image component for optimization

---

## 🔒 Security Considerations

### Backend
- ✅ All secrets in environment variables
- ✅ Clerk token verification on every socket connection
- ✅ User ID from database (not client)
- ✅ CORS restricted to frontend domains
- ✅ Rate limiting (if needed, add express-rate-limit)

### Frontend
- ✅ No secrets in code or env vars
- ✅ Only `NEXT_PUBLIC_*` variables
- ✅ Clerk handles authentication
- ✅ Token stored securely in httpOnly cookies

---

## 🧪 Testing

### Backend
```bash
cd backend
npm test  # Add your test suite
```

### Frontend
```bash
cd frontend
npm test  # Add your test suite
```

### Manual Testing
1. Send message without tone
2. Send message with tone conversion
3. Test real-time delivery
4. Test reconnection after disconnect
5. Test multiple users/conversations
6. Test presence updates

---

## 📚 Documentation

- [Backend Deployment Guide](backend/DEPLOYMENT.md)
- [Frontend Deployment Guide](frontend/DEPLOYMENT.md)
- [Prisma Schema](backend/prisma/schema.prisma)
- [Socket.IO Events](#socket-io-events)

---

## 🔌 Socket.IO Events

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `join-conversation` | `conversationId: string` | Join a conversation room |
| `leave-conversation` | `conversationId: string` | Leave a conversation room |
| `send-message` | `{ conversationId, receiverId, content, applyTone?, toneType?, mediaUrl? }` | Send a chat message |
| `typing` | `{ conversationId, isTyping }` | Send typing indicator |
| `mark-read` | `{ conversationId, messageId }` | Mark message as read |
| `heartbeat` | (none) | Keep presence alive |

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `message-sent` | `Message object` | Confirmation of sent message |
| `new-message` | `Message object` | New message received |
| `message-error` | `{ error: string }` | Message sending failed |
| `user-typing` | `{ userId, conversationId, isTyping }` | Someone is typing |
| `message-read` | `{ conversationId, messageId, readBy }` | Message was read |
| `user-status` | `{ userId, status, lastSeen }` | User online/offline |

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally (both frontend and backend)
5. Submit a pull request

---

## 📄 License

MIT License - See LICENSE file for details

---

## 💬 Support

- **Issues**: GitHub Issues
- **Discussions**: GitHub Discussions
- **Docs**: See deployment guides in each folder

---

**Built with ❤️ using Next.js, Socket.IO, Prisma, and Google Gemini AI**
