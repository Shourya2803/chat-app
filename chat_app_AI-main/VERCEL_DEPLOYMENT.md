# Vercel Deployment Notes

## ⚠️ WebSocket Limitation

**Vercel does not support persistent WebSocket connections** because it's a serverless platform. The custom `server.ts` with Socket.IO will not work on Vercel.

### Current Issues on Vercel:
- ❌ Real-time messaging (Socket.IO)
- ❌ User presence/online status
- ❌ Typing indicators
- ❌ Live message delivery

### Solutions:

#### Option 1: Deploy on a Platform with WebSocket Support
Deploy your app on platforms that support long-running Node.js processes:
- **Railway** (recommended) - https://railway.app
- **Render** - https://render.com
- **Fly.io** - https://fly.io
- **DigitalOcean App Platform**
- **AWS EC2/ECS**
- **Heroku**

#### Option 2: Use Serverless WebSocket Alternative
Replace Socket.IO with:
- **Pusher** - Managed WebSocket service
- **Ably** - Real-time messaging platform
- **Firebase Realtime Database**
- **Supabase Realtime**

#### Option 3: Polling (Basic Fallback)
Use HTTP polling to check for new messages every few seconds:
- Less efficient than WebSockets
- Higher latency
- Still works for basic chat functionality

### Recommended: Deploy on Railway

1. Create account at https://railway.app
2. Connect your GitHub repository
3. Add environment variables from `.env`
4. Deploy automatically from `main` branch
5. Railway will run your `server.ts` with full WebSocket support

### Environment Variables Needed
Make sure to set all these on your deployment platform:
```
DATABASE_URL=
REDIS_URL=
CLERK_SECRET_KEY=
CLERK_PUBLISHABLE_KEY=
GEMINI_API_KEY=
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
FIREBASE_PROJECT_ID=
FIREBASE_PRIVATE_KEY=
FIREBASE_CLIENT_EMAIL=
NODE_ENV=production
PORT=3000
```
