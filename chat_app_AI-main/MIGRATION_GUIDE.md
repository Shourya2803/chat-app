# Migration Guide: From Monolithic to Frontend/Backend Split

This guide explains how to migrate from the old monolithic Next.js + Socket.IO setup to the new separated architecture.

## What Changed?

### Before (Monolithic)
```
chat_app_AI-main/
├── server.ts (Next.js + Socket.IO in one file)
├── src/
│   ├── app/ (Next.js pages)
│   ├── components/
│   ├── lib/
│   │   ├── socket.ts (connected to localhost:3000)
│   │   └── server/ (Prisma, Redis, AI in same repo)
│   └── ...
└── package.json (all dependencies mixed)

❌ Problems:
- Vercel serverless breaks WebSocket
- Can't scale backend independently
- All secrets in one place
- No clean separation of concerns
```

### After (Separated)
```
chat_app_AI-main/
├── frontend/ (Vercel deployment)
│   ├── src/
│   │   ├── app/ (Next.js pages)
│   │   ├── components/
│   │   └── lib/
│   │       └── socket.ts (connects to Render backend)
│   └── package.json (frontend deps only)
│
└── backend/ (Render deployment)
    ├── server.ts (Express + Socket.IO)
    ├── src/
    │   ├── lib/ (Prisma, Redis)
    │   └── services/ (AI service)
    └── package.json (backend deps only)

✅ Benefits:
- WebSocket works on Render
- Independent scaling
- Clear security boundaries
- Better performance
```

---

## Step-by-Step Migration

### 1. Understand the New Structure

**Backend (Render):**
- All database operations (Prisma)
- All Redis operations
- All AI/Gemini calls
- Socket.IO **server**
- Authentication verification
- Business logic

**Frontend (Vercel):**
- React components
- Next.js pages/routing
- Socket.IO **client** only
- No database access
- No secrets

---

### 2. Update Your Code

#### A. Socket.IO Connection

**Old Code (Monolithic):**
```typescript
// src/lib/socket.ts
const WS_URL = 'http://localhost:3000'; // Same server
const socket = io(WS_URL, {
  transports: ['polling', 'websocket'],
});
```

**New Code (Separated):**
```typescript
// frontend/src/lib/socket.ts
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL!; // Backend URL
const socket = io(SOCKET_URL, {
  auth: { token }, // Pass Clerk token
  transports: ['websocket', 'polling'],
  withCredentials: true,
});
```

#### B. Sending Messages

**Old Code:**
```typescript
// Might have called API route that then emits socket event
await fetch('/api/messages', {
  method: 'POST',
  body: JSON.stringify(message),
});
```

**New Code:**
```typescript
// Direct socket emit to backend
socketService.sendMessage({
  conversationId,
  receiverId,
  content,
  applyTone,
  toneType,
});
```

#### C. Server-Side Code

**Old Code:**
```typescript
// pages/api/some-endpoint.ts
import prisma from '@/lib/server/database/prisma';
// ❌ This won't work on Vercel with new structure
```

**New Code:**
```typescript
// backend/server.ts
import { prisma } from './src/lib/prisma';
// ✅ Server code only in backend
```

---

### 3. Environment Variables

#### Old .env (Everything Mixed)
```bash
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
CLERK_SECRET_KEY=sk_...
CLERK_PUBLISHABLE_KEY=pk_...
GEMINI_API_KEY=AIzaSy...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

#### New Frontend .env.local (Public Only)
```bash
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

#### New Backend .env (All Secrets)
```bash
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
CLERK_SECRET_KEY=sk_...
GEMINI_API_KEY=AIzaSy...
FRONTEND_URL=http://localhost:3000
PORT=4000
```

---

### 4. Remove Old Custom Server

If you had a custom Next.js server (like the old `server.ts`), it's been replaced:

**Old server.ts (at root):**
```typescript
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
// This won't work on Vercel serverless
```

**New backend/server.ts:**
```typescript
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
// Pure Node.js server, works on Render
```

**New frontend (no custom server):**
- Just standard Next.js
- Deploys as serverless functions on Vercel

---

### 5. Update Package Scripts

#### Old package.json
```json
{
  "scripts": {
    "dev": "tsx watch server.ts",
    "start": "NODE_ENV=production tsx server.ts"
  }
}
```

#### New Frontend package.json
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  }
}
```

#### New Backend package.json
```json
{
  "scripts": {
    "dev": "tsx watch server.ts",
    "start": "NODE_ENV=production tsx server.ts"
  }
}
```

---

### 6. Update Imports

#### Remove Backend Imports from Frontend

**❌ Don't do this in frontend:**
```typescript
import prisma from '@/lib/server/database/prisma';
import { redis } from '@/lib/server/database/redis';
import { aiService } from '@/lib/server/services/ai.service';
```

**✅ Instead:**
- Use Socket.IO events to trigger backend actions
- Or use HTTP fetch to backend REST endpoints

**Example:**
```typescript
// Instead of calling AI service directly:
// ❌ const result = await aiService.convertTone(text, tone);

// Use socket event:
// ✅ socketService.sendMessage({ content, applyTone: true, toneType });
// Backend handles AI conversion
```

---

### 7. Update Component Usage

#### Old Component (Direct Backend Access)
```typescript
'use client';
import { useState } from 'react';
import prisma from '@/lib/server/database/prisma'; // ❌ Won't work

export default function ChatComponent() {
  const sendMessage = async () => {
    // ❌ Can't call Prisma from client component
    await prisma.message.create({ data: {...} });
  };
}
```

#### New Component (Socket.IO Client)
```typescript
'use client';
import { useState } from 'react';
import socketService from '@/lib/socket'; // ✅ Client only

export default function ChatComponent() {
  const sendMessage = () => {
    // ✅ Emit socket event to backend
    socketService.sendMessage({
      conversationId,
      receiverId,
      content,
    });
  };
}
```

---

### 8. Testing Migration

#### Local Development

**Terminal 1 (Backend):**
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your credentials
npx prisma generate
npm run dev
# Should see: "🚀 Backend server running on port 4000"
```

**Terminal 2 (Frontend):**
```bash
cd frontend
npm install
cp .env.example .env.local
# Edit .env.local with NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
npm run dev
# Should see: "✓ Ready on http://localhost:3000"
```

**Test:**
1. Open http://localhost:3000
2. Sign in with Clerk
3. Open browser console (F12)
4. Look for: `✅ Socket connected to backend`
5. Send a test message
6. Check backend logs for message events

---

### 9. Deploy

#### Deploy Backend First
```bash
cd backend
# Push to GitHub
git remote add origin <backend-repo>
git push

# Deploy on Render
# See backend/DEPLOYMENT.md
```

#### Then Deploy Frontend
```bash
cd frontend
# Push to GitHub
git remote add origin <frontend-repo>
git push

# Deploy on Vercel
# See frontend/DEPLOYMENT.md
```

---

### 10. Post-Migration Checklist

- [ ] Backend deployed and health check returns 200
- [ ] Frontend deployed successfully
- [ ] `NEXT_PUBLIC_SOCKET_URL` points to backend
- [ ] Backend CORS allows frontend domain
- [ ] Database migrations applied
- [ ] Clerk keys configured in both places
- [ ] Socket connection working (check browser console)
- [ ] Messages sending and receiving
- [ ] Tone conversion working
- [ ] User presence updating
- [ ] No errors in either logs

---

## Common Migration Issues

### Issue: "Module not found" in Frontend
**Cause**: Trying to import backend modules

**Fix**: Remove all imports from `src/lib/server/*` in frontend code

---

### Issue: "Socket connection failed"
**Cause**: Wrong backend URL or backend not running

**Fix**: 
1. Check `NEXT_PUBLIC_SOCKET_URL` is correct
2. Verify backend is running: `curl https://backend.onrender.com/health`
3. Check backend logs for connection attempts

---

### Issue: "Authentication error"
**Cause**: Clerk token not being sent or invalid

**Fix**:
1. Ensure token is passed: `socket.io(url, { auth: { token } })`
2. Verify `CLERK_SECRET_KEY` in backend matches frontend's `CLERK_PUBLISHABLE_KEY` environment

---

### Issue: Database connection failed in backend
**Cause**: DATABASE_URL not set or incorrect

**Fix**:
1. Set `DATABASE_URL` in Render environment variables
2. Run `npx prisma migrate deploy` in Render shell

---

### Issue: CORS errors
**Cause**: Backend CORS doesn't allow frontend domain

**Fix**:
Set `FRONTEND_URL` in backend to your Vercel domain

---

## Rollback Plan

If migration fails and you need to rollback:

1. Keep old monolithic code in a branch:
   ```bash
   git checkout -b backup-monolithic
   git push origin backup-monolithic
   ```

2. Can deploy old code temporarily while fixing issues

3. Old code will still work locally, just not on Vercel production

---

## Benefits After Migration

✅ **WebSocket works on Vercel** (via external backend)
✅ **Better security** (secrets only in backend)
✅ **Independent scaling** (scale frontend/backend separately)
✅ **Better performance** (Vercel edge for static, Render for WebSocket)
✅ **Cleaner code** (clear separation of concerns)
✅ **Easier debugging** (separate logs for frontend/backend)

---

## Questions?

- Check [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) for architecture overview
- See [backend/DEPLOYMENT.md](backend/DEPLOYMENT.md) for backend deployment
- See [frontend/DEPLOYMENT.md](frontend/DEPLOYMENT.md) for frontend deployment
- Check [EXAMPLE_COMPONENT.tsx](frontend/EXAMPLE_COMPONENT.tsx) for usage examples

---

**Good luck with your migration! 🚀**
