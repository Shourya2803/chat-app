# Architecture Diagram

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER'S BROWSER                          │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │          FRONTEND (Vercel Deployment)                    │  │
│  │                                                          │  │
│  │  ┌────────────┐  ┌─────────────┐  ┌─────────────────┐  │  │
│  │  │  Next.js   │  │   React     │  │   Socket.IO     │  │  │
│  │  │  Pages     │  │ Components  │  │    Client       │  │  │
│  │  └────────────┘  └─────────────┘  └─────────────────┘  │  │
│  │                                                          │  │
│  │  • No backend code                                       │  │
│  │  • No database access                                    │  │
│  │  • Only public env vars (NEXT_PUBLIC_*)                 │  │
│  │  • Connects to external Socket.IO server                │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 │ HTTPS + WebSocket (wss://)
                                 │ Auth: Clerk Token
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND (Render Deployment)                  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   Express Server                          │  │
│  │                                                          │  │
│  │  ┌────────────────┐          ┌───────────────────────┐  │  │
│  │  │   HTTP Server  │          │   Socket.IO Server    │  │  │
│  │  │   (REST API)   │          │   (WebSocket)         │  │  │
│  │  └────────────────┘          └───────────────────────┘  │  │
│  │                                                          │  │
│  │  ┌─────────────────────────────────────────────────┐    │  │
│  │  │            Authentication Middleware            │    │  │
│  │  │       (Verify Clerk Token on Connect)           │    │  │
│  │  └─────────────────────────────────────────────────┘    │  │
│  │                                                          │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐   │  │
│  │  │   Prisma    │  │    Redis    │  │  Gemini AI   │   │  │
│  │  │   Client    │  │   Client    │  │   Service    │   │  │
│  │  └─────────────┘  └─────────────┘  └──────────────┘   │  │
│  │                                                          │  │
│  │  • All secrets (DB, API keys, etc.)                     │  │
│  │  • Business logic                                        │  │
│  │  • Long-running WebSocket process                       │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                    │                          │
                    │                          │
                    ▼                          ▼
         ┌────────────────────┐    ┌─────────────────────┐
         │    PostgreSQL      │    │      Redis          │
         │    (Database)      │    │   (Cache/Presence)  │
         │                    │    │                     │
         │  • Users           │    │  • Online status    │
         │  • Messages        │    │  • Pub/Sub          │
         │  • Conversations   │    │                     │
         └────────────────────┘    └─────────────────────┘
```

---

## Message Flow

```
1. USER TYPES MESSAGE
   ├─ Frontend: React Component
   └─ Input field with optional tone selector

2. FRONTEND SENDS VIA SOCKET.IO
   ├─ socketService.sendMessage({
   │     conversationId,
   │     receiverId,
   │     content,
   │     applyTone: true,
   │     toneType: 'professional'
   │   })
   └─ WebSocket connection to backend

3. BACKEND RECEIVES EVENT
   ├─ server.ts: io.on('send-message', ...)
   └─ Validates authentication

4. BACKEND VERIFIES USER
   ├─ socket.data.userId (from auth middleware)
   └─ Fetch user from database

5. AI TONE CONVERSION (if enabled)
   ├─ aiService.convertTone(content, toneType)
   ├─ Call Google Gemini API
   └─ Get professional version of message

6. SAVE TO DATABASE
   ├─ prisma.message.create({
   │     content: convertedText,
   │     originalContent: originalText,
   │     toneApplied: 'professional',
   │     ...
   │   })
   └─ Update conversation timestamp

7. BROADCAST TO RECEIVER
   ├─ socket.to(`conversation:${conversationId}`)
   │         .emit('new-message', message)
   └─ Real-time delivery via WebSocket

8. FRONTEND RECEIVES EVENT
   ├─ socketService.on('new-message', handleNewMessage)
   └─ Update React state → UI updates automatically

9. UI UPDATES
   ├─ Message appears in chat window
   ├─ Scroll to bottom
   └─ Play notification sound (optional)
```

---

## Authentication Flow

```
1. USER VISITS APP
   └─ https://your-app.vercel.app

2. CLERK AUTHENTICATION
   ├─ User clicks "Sign In"
   ├─ Clerk handles authentication UI
   ├─ User signs in with email/social
   └─ Clerk issues session token

3. FRONTEND GETS TOKEN
   ├─ const token = await user.getToken()
   └─ Token stored in httpOnly cookie

4. SOCKET.IO CONNECTION
   ├─ socketService.connect(token)
   └─ io(backendUrl, { auth: { token } })

5. BACKEND RECEIVES CONNECTION
   ├─ io.use(async (socket, next) => {
   │     const token = socket.handshake.auth.token
   │     ...
   │   })
   └─ Authentication middleware runs

6. VERIFY TOKEN
   ├─ const session = await clerkClient.verifyToken(token)
   └─ Extract Clerk user ID (session.sub)

7. FETCH DATABASE USER
   ├─ const user = await prisma.user.findUnique({
   │     where: { clerkId: session.sub }
   │   })
   └─ Get database user ID

8. ATTACH TO SOCKET
   ├─ socket.data.userId = user.id
   └─ socket.data.clerkId = session.sub

9. CONNECTION ACCEPTED
   ├─ next() → User connected
   └─ socket.join(`user:${userId}`)

10. AUTHENTICATED SESSION
    ├─ All socket events now have access to socket.data.userId
    └─ Backend knows who sent each message
```

---

## Presence System

```
┌─────────────┐
│   REDIS     │  ← Stores online/offline status
└──────┬──────┘
       │
       ├─ Key: presence:user123
       ├─ Value: "online"
       └─ TTL: 300 seconds (5 min)

FLOW:
1. User connects → presenceService.setOnline(userId)
2. Heartbeat every 30s → Refresh TTL
3. User disconnects → presenceService.setOffline(userId)
4. TTL expires → Auto offline (if no heartbeat)
5. Broadcast status → io.emit('user-status', {...})
6. Frontend updates UI → Green/grey indicator
```

---

## Deployment Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    PRODUCTION                            │
└──────────────────────────────────────────────────────────┘

┌─────────────────┐         ┌──────────────────────────┐
│     USER        │ ──────→ │   Vercel CDN (Global)    │
│   Browser       │         │   - Frontend static      │
│                 │         │   - Edge functions       │
└─────────────────┘         │   - Automatic scaling    │
                            └──────────────────────────┘
                                      │
                                      │ WebSocket
                                      ▼
                            ┌──────────────────────────┐
                            │   Render (US/EU)         │
                            │   - Backend server       │
                            │   - Socket.IO server     │
                            │   - Auto deploy on push  │
                            └──────────────────────────┘
                                      │
                      ┌───────────────┴────────────────┐
                      ▼                                ▼
           ┌─────────────────────┐        ┌──────────────────┐
           │   PostgreSQL        │        │     Redis        │
           │   (Render/Neon)     │        │   (Upstash)      │
           │   - User data       │        │   - Presence     │
           │   - Messages        │        │   - Cache        │
           └─────────────────────┘        └──────────────────┘
```

---

## Security Boundaries

```
┌──────────────────────────────────────────────────────────────┐
│                        FRONTEND (Public)                     │
├──────────────────────────────────────────────────────────────┤
│  EXPOSED TO BROWSER:                                         │
│  ✅ NEXT_PUBLIC_SOCKET_URL=https://backend.onrender.com      │
│  ✅ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...            │
│  ✅ NEXT_PUBLIC_APP_URL=https://app.vercel.app               │
│                                                              │
│  ❌ NO secrets                                               │
│  ❌ NO database credentials                                  │
│  ❌ NO API keys                                              │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                      BACKEND (Private)                       │
├──────────────────────────────────────────────────────────────┤
│  SECRETS (Never exposed to browser):                         │
│  🔒 DATABASE_URL=postgresql://...                            │
│  🔒 REDIS_URL=redis://...                                    │
│  🔒 CLERK_SECRET_KEY=sk_live_...                             │
│  🔒 GEMINI_API_KEY=AIzaSy...                                 │
│  🔒 All business logic                                       │
│  🔒 All database operations                                  │
└──────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagram

```
USER INPUT
    ↓
React Component (frontend)
    ↓
socketService.sendMessage()
    ↓
WebSocket (wss://)
    ↓
Backend Socket.IO Server (server.ts)
    ↓
Authentication Check (socket.data.userId)
    ↓
AI Service (optional tone conversion)
    ↓
Prisma → PostgreSQL (save message)
    ↓
Broadcast to conversation room
    ↓
WebSocket (wss://)
    ↓
socketService.on('new-message')
    ↓
React state update
    ↓
UI re-render
    ↓
MESSAGE DISPLAYED
```

---

## Folder Structure Visual

```
📁 chat_app_AI-main/
│
├── 📁 frontend/                   🎨 VERCEL
│   ├── 📁 src/
│   │   ├── 📁 app/               (Next.js App Router)
│   │   │   ├── 📄 page.tsx       (Home page)
│   │   │   ├── 📁 chat/          (Chat page)
│   │   │   ├── 📁 sign-in/       (Auth pages)
│   │   │   └── 📁 api/           (API routes)
│   │   │
│   │   ├── 📁 components/        (React components)
│   │   │   └── 📁 chat/
│   │   │       ├── 📄 ChatWindow.tsx
│   │   │       ├── 📄 MessageList.tsx
│   │   │       └── 📄 MessageInput.tsx
│   │   │
│   │   ├── 📁 lib/
│   │   │   ├── 📄 socket.ts      ⚡ Socket.IO CLIENT
│   │   │   ├── 📄 api.ts         (HTTP client)
│   │   │   └── 📄 utils.ts
│   │   │
│   │   ├── 📁 store/             (Zustand state)
│   │   └── 📁 types/             (TypeScript types)
│   │
│   ├── 📄 package.json           (Frontend deps only)
│   ├── 📄 .env.example           (Public vars only)
│   ├── 📄 next.config.js
│   └── 📄 DEPLOYMENT.md
│
├── 📁 backend/                    🚀 RENDER
│   ├── 📁 src/
│   │   ├── 📁 lib/
│   │   │   ├── 📄 prisma.ts      (Database client)
│   │   │   └── 📄 redis.ts       (Cache + presence)
│   │   │
│   │   ├── 📁 services/
│   │   │   └── 📄 ai.service.ts  (Gemini AI)
│   │   │
│   │   └── 📁 utils/
│   │       └── 📄 logger.ts      (Logging)
│   │
│   ├── 📁 prisma/
│   │   └── 📄 schema.prisma      (Database schema)
│   │
│   ├── 📄 server.ts              ⚡ Express + Socket.IO SERVER
│   ├── 📄 package.json           (Backend deps only)
│   ├── 📄 .env.example           (All secrets)
│   ├── 📄 tsconfig.json
│   └── 📄 DEPLOYMENT.md
│
└── 📚 Documentation/
    ├── 📄 START_HERE.md          ⭐ Start here!
    ├── 📄 QUICK_START.md
    ├── 📄 PROJECT_STRUCTURE.md
    ├── 📄 MIGRATION_GUIDE.md
    ├── 📄 REFACTORING_SUMMARY.md
    └── 📄 ARCHITECTURE.md        (This file)
```

---

This architecture ensures:
- ✅ Frontend works on Vercel serverless
- ✅ WebSocket works on Render
- ✅ Clear security boundaries
- ✅ Independent scaling
- ✅ Clean code separation
