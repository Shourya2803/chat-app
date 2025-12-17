# AI-Powered Professional Chat Application

## Quick Start Guide

### 1. Clone and Setup

```bash
git clone <repository-url>
cd Chat-app
```

### 2. Backend Setup

```bash
cd backend
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your credentials
# - Clerk keys from https://clerk.com
# - Gemini API key from https://makersuite.google.com/app/apikey
# - Cloudflare R2 credentials from Cloudflare dashboard
# - Firebase credentials from Firebase console
# - PostgreSQL connection string (Neon recommended)
```

### 3. Frontend Setup

```bash
cd frontend
npm install

# Copy environment file
cp .env.example .env

# Edit .env with Clerk and API URLs
```

### 4. Database Setup

**Option A: Docker (Recommended)**
```bash
# From project root
docker-compose up postgres redis -d
```

**Option B: Local Installation**
- Install PostgreSQL and Redis locally
- Update connection strings in `.env`

### 5. Run the Application

**Development Mode:**

Terminal 1 - Backend:
```bash
cd backend
npm run dev
```

Terminal 2 - Worker:
```bash
cd backend
npm run worker
```

Terminal 3 - Frontend:
```bash
cd frontend
npm run dev
```

**Production Mode (Docker):**
```bash
docker-compose up -d
```

### 6. Access the Application

- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- Health Check: http://localhost:5000/health

## Key Features

✅ Real-time messaging with Socket.IO
✅ AI-powered tone conversion (Professional, Polite, Formal)
✅ Image sharing with Cloudflare R2
✅ Push notifications via FCM
✅ Typing indicators and presence detection
✅ Read receipts and unread counters
✅ Dark/Light mode
✅ Responsive design
✅ Rate limiting and security

## API Keys Required

1. **Clerk** (Authentication)
   - Sign up at https://clerk.com
   - Create application
   - Get publishable and secret keys

2. **Google Gemini** (AI)
   - Get API key from https://makersuite.google.com/app/apikey

3. **Cloudflare R2** (Storage)
   - Create R2 bucket in Cloudflare dashboard
   - Generate API tokens
   - Note bucket name and public URL

4. **Firebase** (Notifications)
   - Create project at https://console.firebase.google.com
   - Enable Cloud Messaging
   - Download service account JSON
   - Extract credentials

5. **Neon PostgreSQL** (Database)
   - Sign up at https://neon.tech
   - Create database
   - Copy connection string

## Troubleshooting

**Connection Issues:**
- Ensure all services are running
- Check environment variables
- Verify network connectivity

**Database Errors:**
- Check DATABASE_URL format
- Ensure PostgreSQL is accessible
- Run migrations automatically on start

**Socket.IO Issues:**
- Verify WS_URL matches backend
- Check CORS settings
- Ensure token is valid

## Development Tips

- Use `npm run dev` for hot reload
- Check logs in terminal or Docker
- Use Redis CLI for debugging: `redis-cli`
- Monitor queue: BullMQ Board (optional)

## Support

For issues, please check:
1. Environment variables are set correctly
2. All services are running
3. API keys are valid
4. Network/firewall settings

Happy coding! 🚀
