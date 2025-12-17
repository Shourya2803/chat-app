# 🚀 Frontend Deployment Guide (Vercel)

This guide explains how to deploy the **frontend** (Next.js + React) to **Vercel**.

## What This Deploys

- **Next.js App**: Static pages + API routes (no WebSocket server)
- **Clerk Auth**: User authentication UI
- **Socket.IO Client**: Connects to backend WebSocket server on Render
- **React Components**: Chat UI, message lists, etc.

## Prerequisites

1. **Vercel Account**: Sign up at https://vercel.com
2. **Backend Deployed**: Backend must be deployed first (see backend/DEPLOYMENT.md)
3. **Backend URL**: Copy your Render backend URL (e.g., `https://your-backend.onrender.com`)
4. **Clerk Account**: Get publishable key from https://dashboard.clerk.com

---

## Step 1: Prepare Frontend Code

### 1.1 Update Socket URL
The frontend connects to your backend via `NEXT_PUBLIC_SOCKET_URL`. This will be set in Vercel environment variables.

### 1.2 Verify No Server Code
Ensure frontend doesn't import any backend-only code:
- ❌ No Prisma imports
- ❌ No Redis imports
- ❌ No Gemini API key usage
- ❌ No server-side Socket.IO
- ✅ Only Socket.IO **client**

---

## Step 2: Push Code to GitHub

```bash
cd frontend
git init
git add .
git commit -m "Initial frontend commit"
git remote add origin <your-github-repo>
git push -u origin main
```

---

## Step 3: Deploy to Vercel

### 3.1 Import Project
1. Go to https://vercel.com/dashboard
2. Click **Add New** → **Project**
3. Import your GitHub repository
4. Configure:
   - **Framework Preset**: Next.js
   - **Root Directory**: `frontend` (if in monorepo) or leave empty
   - **Build Command**: `npm run build` (auto-detected)
   - **Output Directory**: `.next` (auto-detected)
   - **Install Command**: `npm install` (auto-detected)

### 3.2 Don't Deploy Yet!
Click **Expand** on Environment Variables first.

---

## Step 4: Set Environment Variables

Add these environment variables in Vercel:

```bash
# Backend WebSocket URL (FROM RENDER)
NEXT_PUBLIC_SOCKET_URL=https://your-backend-app.onrender.com

# Clerk Public Key (from https://dashboard.clerk.com)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxxxxxxxxxx

# Optional: Clerk Routes
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/chat
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/chat

# Your Vercel App URL (will be auto-assigned)
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

**Important Notes:**
- All variables must start with `NEXT_PUBLIC_` to be accessible in the browser
- Never put secrets here (they're exposed to users)
- NEXT_PUBLIC_SOCKET_URL must point to your Render backend

---

## Step 5: Deploy

Click **Deploy** button.

Vercel will:
1. Install dependencies
2. Build Next.js app
3. Deploy to global CDN
4. Provide you with a URL

---

## Step 6: Update Backend CORS

After deployment, you need to allow your Vercel domain in backend CORS:

### 6.1 Go to Render Dashboard
1. Open your backend web service
2. Go to **Environment** tab

### 6.2 Update FRONTEND_URL
```bash
FRONTEND_URL=https://your-app.vercel.app
```

**For multiple domains** (e.g., preview deployments):
```bash
FRONTEND_URL=https://your-app.vercel.app,https://*.vercel.app
```

### 6.3 Save and Redeploy
Backend will automatically redeploy with new CORS settings.

---

## Step 7: Verify Deployment

### 7.1 Test Sign In
1. Visit `https://your-app.vercel.app`
2. Click **Sign In** or **Sign Up**
3. Complete authentication

### 7.2 Test WebSocket Connection
1. Open browser console (F12)
2. Look for:
   ```
   🔌 Connecting to Socket.IO server: https://your-backend.onrender.com
   ✅ Socket connected to backend
   ```

### 7.3 Test Messaging
1. Send a test message
2. Check if it appears in the chat
3. Try tone conversion feature

---

## Step 8: Set Up Custom Domain (Optional)

### 8.1 In Vercel Dashboard
1. Go to your project
2. Click **Settings** → **Domains**
3. Add your custom domain (e.g., `chat.yourdomain.com`)
4. Follow DNS configuration instructions

### 8.2 Update Environment Variables
After adding custom domain:
```bash
NEXT_PUBLIC_APP_URL=https://chat.yourdomain.com
```

### 8.3 Update Backend CORS
In Render backend environment:
```bash
FRONTEND_URL=https://chat.yourdomain.com
```

---

## Common Issues

### Issue: Socket Connection Failed
**Symptoms**: Console shows "Socket connection error"

**Solutions**:
1. Verify `NEXT_PUBLIC_SOCKET_URL` is correct
2. Check backend is running (visit backend health endpoint)
3. Verify backend CORS allows your Vercel domain
4. Check backend logs for connection attempts

### Issue: Authentication Not Working
**Symptoms**: Can't sign in, Clerk errors

**Solutions**:
1. Verify `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is correct
2. Check Clerk dashboard for allowed domains
3. Add Vercel domain to Clerk allowed origins

### Issue: Build Failed
**Symptoms**: Vercel build errors

**Solutions**:
1. Check no backend imports in frontend code
2. Ensure all dependencies are in package.json
3. Verify TypeScript types are correct

### Issue: Messages Not Sending
**Symptoms**: Messages don't appear, no errors

**Solutions**:
1. Check browser console for Socket.IO errors
2. Verify Clerk token is being sent
3. Check backend logs for message events
4. Ensure database is accessible

---

## Environment-Specific URLs

### Development
```bash
# Local frontend
http://localhost:3000

# Local backend
http://localhost:4000

# Socket connection
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
```

### Production
```bash
# Vercel frontend
https://your-app.vercel.app

# Render backend
https://your-backend.onrender.com

# Socket connection
NEXT_PUBLIC_SOCKET_URL=https://your-backend.onrender.com
```

---

## Automatic Deployments

### Enable Git Integration
Vercel automatically deploys when you:
1. Push to `main` branch → Production deployment
2. Push to other branches → Preview deployments
3. Open Pull Request → Preview deployment with unique URL

### Preview Deployments
Each PR gets a unique URL like:
```
https://your-app-git-feature-branch.vercel.app
```

To support preview deployments, use wildcard CORS in backend:
```bash
FRONTEND_URL=https://*.vercel.app
```

---

## Monitoring

### View Logs
1. Go to Vercel Dashboard
2. Select your project
3. Click **Deployments**
4. Click a deployment → **Function Logs** (for API routes)

### Analytics
Vercel provides built-in analytics:
- Page views
- Performance metrics
- Error tracking

---

## Performance Optimization

### Edge Functions (Optional)
For even faster API routes:
1. Add to API route:
   ```typescript
   export const config = {
     runtime: 'edge',
   };
   ```

### CDN Caching
Vercel automatically caches:
- Static pages
- Images
- Public assets

---

## Cost

### Hobby Plan (Free)
- Unlimited deployments
- 100GB bandwidth/month
- Suitable for personal projects

### Pro Plan ($20/month)
- Higher limits
- Team collaboration
- Commercial use

---

## Next Steps

1. ✅ Frontend deployed to Vercel
2. ✅ Backend deployed to Render
3. ✅ WebSocket connection working
4. 🎉 Your chat app is live!

### Optional Enhancements
- [ ] Set up custom domain
- [ ] Enable analytics
- [ ] Add error tracking (Sentry)
- [ ] Set up CI/CD tests
- [ ] Add performance monitoring

---

## Troubleshooting Checklist

Before asking for help, verify:

- [ ] Backend is running (check health endpoint)
- [ ] `NEXT_PUBLIC_SOCKET_URL` matches backend URL exactly
- [ ] Backend `FRONTEND_URL` includes your Vercel domain
- [ ] Clerk publishable key is correct
- [ ] Browser console shows no CORS errors
- [ ] Backend logs show connection attempts

---

## Support

- Vercel Docs: https://vercel.com/docs
- Next.js Docs: https://nextjs.org/docs
- Socket.IO Client: https://socket.io/docs/v4/client-api/
- Clerk Docs: https://clerk.com/docs

---

**🎉 Your frontend is now live on Vercel!**

Visit your app: `https://your-app.vercel.app`
