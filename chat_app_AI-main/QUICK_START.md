# 🚀 Quick Start Guide

Get your refactored chat app running in 10 minutes!

## Prerequisites

- Node.js 18+ installed
- PostgreSQL database (local or cloud)
- Redis (optional, for presence features)
- Clerk account (https://clerk.com)
- Google Gemini API key (https://makersuite.google.com)

---

## Local Development Setup

### Step 1: Clone and Install (2 minutes)

```bash
# Navigate to project
cd chat_app_AI-main

# Install backend
cd backend
npm install

# Install frontend
cd ../frontend
npm install
```

---

### Step 2: Set Up Backend (3 minutes)

```bash
cd backend

# Copy environment template
cp .env.example .env

# Edit .env with your credentials
# Required:
# - DATABASE_URL (your PostgreSQL connection string)
# - CLERK_SECRET_KEY (from Clerk dashboard)
# - GEMINI_API_KEY (from Google AI Studio)
# Optional:
# - REDIS_URL (for presence features)

# Example .env:
cat > .env << 'EOF'
NODE_ENV=development
PORT=4000
FRONTEND_URL=http://localhost:3000

DATABASE_URL=postgresql://user:password@localhost:5432/chatdb
REDIS_URL=redis://localhost:6379

CLERK_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxx
CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxxxxxxx

GEMINI_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
EOF

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Start backend server
npm run dev
```

You should see:
```
✅ Database connected successfully
✅ Redis connected successfully (or warning if not configured)
🚀 Backend server running on port 4000
📡 Socket.IO server ready
```

---

### Step 3: Set Up Frontend (2 minutes)

Open a new terminal:

```bash
cd frontend

# Copy environment template
cp .env.example .env.local

# Edit .env.local
cat > .env.local << 'EOF'
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_APP_URL=http://localhost:3000
EOF

# Start frontend
npm run dev
```

You should see:
```
✓ Ready on http://localhost:3000
```

---

### Step 4: Test Connection (3 minutes)

1. Open browser to `http://localhost:3000`

2. Sign in with Clerk

3. Open browser console (F12)

4. Look for:
   ```
   🔌 Connecting to Socket.IO server: http://localhost:4000
   ✅ Socket connected to backend
   ```

5. Send a test message

6. Check backend terminal for:
   ```
   📩 send-message event triggered
   💾 Saving message to database...
   ✅ Message saved: <message-id>
   ```

✅ **Success!** Your chat app is running locally.

---

## Production Deployment

### Option 1: Deploy to Render + Vercel (Recommended)

#### Backend to Render (5 minutes)

1. Push backend to GitHub:
   ```bash
   cd backend
   git init
   git add .
   git commit -m "Backend ready"
   git remote add origin <your-backend-repo>
   git push -u origin main
   ```

2. Go to https://render.com

3. Click **New** → **Web Service**

4. Connect GitHub repo

5. Configure:
   - **Build Command**: `npm install && npx prisma generate`
   - **Start Command**: `npm start`

6. Add environment variables (from backend/.env.example)

7. Deploy!

8. Get your backend URL: `https://your-app.onrender.com`

#### Frontend to Vercel (5 minutes)

1. Push frontend to GitHub:
   ```bash
   cd frontend
   git init
   git add .
   git commit -m "Frontend ready"
   git remote add origin <your-frontend-repo>
   git push -u origin main
   ```

2. Go to https://vercel.com

3. Click **Add New** → **Project**

4. Import GitHub repo

5. Set environment variables:
   ```
   NEXT_PUBLIC_SOCKET_URL=https://your-app.onrender.com
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
   ```

6. Deploy!

7. Update backend CORS:
   - In Render dashboard, set `FRONTEND_URL` to your Vercel URL

✅ **Done!** Your app is live.

---

## Troubleshooting

### "Database connection failed"
```bash
# Check if PostgreSQL is running
psql -U postgres -c "SELECT 1"

# Verify DATABASE_URL format:
# postgresql://username:password@hostname:5432/database
```

### "Socket connection error"
```bash
# Backend not running?
curl http://localhost:4000/health

# Should return: {"status":"ok",...}

# Check NEXT_PUBLIC_SOCKET_URL in frontend
echo $NEXT_PUBLIC_SOCKET_URL
```

### "Authentication error"
```bash
# Verify Clerk keys match
# Backend: CLERK_SECRET_KEY
# Frontend: NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

# Both should be from same Clerk environment (test or production)
```

### "Module not found"
```bash
# Did you install dependencies?
cd backend && npm install
cd ../frontend && npm install

# Did you generate Prisma client?
cd backend && npx prisma generate
```

---

## Next Steps

1. ✅ Read [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) for architecture details
2. ✅ Check [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md) if migrating from old code
3. ✅ See [frontend/EXAMPLE_COMPONENT.tsx](frontend/EXAMPLE_COMPONENT.tsx) for usage examples
4. ✅ Review [backend/DEPLOYMENT.md](backend/DEPLOYMENT.md) for production deployment
5. ✅ Review [frontend/DEPLOYMENT.md](frontend/DEPLOYMENT.md) for Vercel deployment

---

## Development Commands

### Backend
```bash
cd backend

# Development
npm run dev              # Start with hot reload

# Production
npm start                # Start production server

# Database
npx prisma generate      # Generate Prisma client
npx prisma migrate dev   # Run migrations (dev)
npx prisma migrate deploy # Run migrations (prod)
npx prisma studio        # Open database GUI
```

### Frontend
```bash
cd frontend

# Development
npm run dev              # Start Next.js dev server

# Production
npm run build            # Build for production
npm start                # Start production server

# Linting
npm run lint             # Run ESLint
```

---

## Environment Variables Cheat Sheet

### Development

**Backend (.env)**
```bash
NODE_ENV=development
PORT=4000
FRONTEND_URL=http://localhost:3000
DATABASE_URL=postgresql://localhost:5432/chatdb
REDIS_URL=redis://localhost:6379
CLERK_SECRET_KEY=sk_test_...
GEMINI_API_KEY=AIzaSy...
```

**Frontend (.env.local)**
```bash
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Production

**Backend (Render)**
```bash
NODE_ENV=production
PORT=4000
FRONTEND_URL=https://your-app.vercel.app
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
CLERK_SECRET_KEY=sk_live_...
GEMINI_API_KEY=AIzaSy...
```

**Frontend (Vercel)**
```bash
NEXT_PUBLIC_SOCKET_URL=https://your-backend.onrender.com
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

---

## Testing Checklist

- [ ] Backend starts without errors
- [ ] Frontend starts without errors
- [ ] Can access http://localhost:3000
- [ ] Can sign in with Clerk
- [ ] Socket connects (check console)
- [ ] Can send a message
- [ ] Message appears in UI
- [ ] Tone conversion works (if enabled)
- [ ] Real-time delivery works
- [ ] Backend logs show message events

---

## Getting Help

1. Check the troubleshooting section above
2. Review browser console for errors (F12)
3. Check backend logs in terminal
4. Verify all environment variables are set
5. Read the relevant documentation:
   - [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)
   - [backend/DEPLOYMENT.md](backend/DEPLOYMENT.md)
   - [frontend/DEPLOYMENT.md](frontend/DEPLOYMENT.md)

---

**Happy coding! 🎉**

Need more help? Check the [REFACTORING_SUMMARY.md](REFACTORING_SUMMARY.md) for a complete overview.
