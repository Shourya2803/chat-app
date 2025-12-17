# 🚀 Backend Deployment Guide (Render)

This guide explains how to deploy the **backend server** (Node.js + Express + Socket.IO + Prisma) to **Render**.

## What This Server Does

- **WebSocket Server**: Handles real-time chat via Socket.IO
- **Database**: Connects to PostgreSQL via Prisma ORM
- **Redis**: Manages user presence/online status
- **AI Processing**: Uses Google Gemini for message tone conversion
- **Authentication**: Verifies Clerk tokens from frontend

## Prerequisites

1. **Render Account**: Sign up at https://render.com
2. **PostgreSQL Database**: Create a Postgres instance on Render or use external (Neon, Railway, etc.)
3. **Redis Instance**: Create Redis on Render, Upstash, or Railway
4. **Clerk Account**: Get API keys from https://dashboard.clerk.com
5. **Gemini API Key**: Get from https://makersuite.google.com/app/apikey

---

## Step 1: Create PostgreSQL Database

### Option A: Render Postgres
1. Go to Render Dashboard
2. Click **New** → **PostgreSQL**
3. Choose a name (e.g., `chat-app-db`)
4. Select region closest to your users
5. Choose plan (Free tier available)
6. Click **Create Database**
7. Copy the **Internal Database URL** (starts with `postgresql://`)

### Option B: External Database (Neon, Railway, Supabase)
- Use their connection string in step 4

---

## Step 2: Create Redis Instance

### Option A: Render Redis
1. Go to Render Dashboard
2. Click **New** → **Redis**
3. Choose a name (e.g., `chat-app-redis`)
4. Select plan
5. Click **Create Redis**
6. Copy the **Internal Redis URL** (starts with `redis://`)

### Option B: Upstash
1. Go to https://console.upstash.com
2. Create a new Redis database
3. Copy the connection URL

---

## Step 3: Deploy to Render

### 3.1 Push Backend Code to GitHub
```bash
cd backend
git init
git add .
git commit -m "Initial backend commit"
git remote add origin <your-github-repo>
git push -u origin main
```

### 3.2 Create Web Service on Render
1. Go to Render Dashboard
2. Click **New** → **Web Service**
3. Connect your GitHub repository
4. Configure:
   - **Name**: `chat-app-backend` (or any name)
   - **Region**: Same as your database
   - **Branch**: `main`
   - **Root Directory**: `backend` (if in monorepo) or leave empty
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npx prisma generate`
   - **Start Command**: `npm start`
   - **Instance Type**: Select plan (Free/Starter/Professional)

5. Click **Create Web Service**

---

## Step 4: Set Environment Variables

In your Render web service dashboard, go to **Environment** tab and add:

```bash
# Node Environment
NODE_ENV=production
PORT=4000

# Frontend URL (for CORS)
FRONTEND_URL=https://your-app.vercel.app

# Database (from Step 1)
DATABASE_URL=postgresql://user:password@host:5432/database

# Redis (from Step 2)
REDIS_URL=redis://:password@host:6379

# Clerk (from https://dashboard.clerk.com)
CLERK_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxxxxxxx
CLERK_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxxxxxxxxxx

# Google Gemini AI (from https://makersuite.google.com)
GEMINI_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

**Important**: Click **Save Changes** after adding all variables.

---

## Step 5: Run Database Migrations

### Option A: From Render Shell
1. In your web service dashboard, go to **Shell** tab
2. Run:
```bash
npx prisma migrate deploy
```

### Option B: Locally with Production Database
```bash
# Set DATABASE_URL in your local .env
DATABASE_URL=<production-database-url>

# Run migrations
npx prisma migrate deploy
```

---

## Step 6: Verify Deployment

### Check Health Endpoint
```bash
curl https://your-backend-app.onrender.com/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-12-17T...",
  "uptime": 123.45
}
```

### Check Logs
1. Go to Render dashboard
2. Open your web service
3. Click **Logs** tab
4. Look for:
   ```
   ✅ Database connected successfully
   ✅ Redis connected successfully
   🚀 Backend server running on port 4000
   📡 Socket.IO server ready
   ```

---

## Step 7: Get Your Backend URL

Your backend will be available at:
```
https://your-backend-app.onrender.com
```

Copy this URL - you'll need it for frontend deployment!

---

## Common Issues

### Issue: Database Connection Failed
**Solution**: Verify DATABASE_URL is correct and database is running

### Issue: Redis Connection Failed
**Solution**: Check REDIS_URL format. If using Upstash, ensure URL includes credentials

### Issue: Build Failed
**Solution**: Make sure package.json has all dependencies listed

### Issue: WebSocket Not Working
**Solution**: Ensure Render plan supports WebSocket connections (Starter or above)

### Issue: CORS Errors
**Solution**: Update FRONTEND_URL in environment variables to match your Vercel domain

---

## Scaling

### Free Tier Limitations
- Server sleeps after 15 minutes of inactivity
- First request after sleep takes ~30 seconds
- Not suitable for production with real users

### Upgrading
- **Starter Plan ($7/month)**: No sleep, suitable for small apps
- **Professional**: For production apps with high traffic

---

## Monitoring

### View Logs
```bash
# In Render dashboard → Logs tab
# Or use Render CLI:
render logs -s your-service-name
```

### Health Checks
Render automatically monitors `/health` endpoint

---

## Next Steps

1. ✅ Backend deployed to Render
2. 📝 Copy your backend URL: `https://your-backend-app.onrender.com`
3. 🚀 Now deploy frontend to Vercel (see VERCEL_DEPLOYMENT.md)
4. 🔗 Set `NEXT_PUBLIC_SOCKET_URL` in Vercel to your backend URL

---

## Support

- Render Docs: https://render.com/docs
- Prisma Docs: https://www.prisma.io/docs
- Socket.IO Docs: https://socket.io/docs/v4/

---

**🎉 Your backend is now live and ready to handle WebSocket connections!**
