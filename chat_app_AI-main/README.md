# AI-Powered Professional Chat Application

A full-stack, production-ready real-time chat application with AI-powered tone conversion, built using modern technologies including Next.js, Node.js, Socket.IO, Redis, PostgreSQL, and the Gemini API.

## 🚀 Features

### Backend Features
- **Authentication & User Management**: Secure authentication via Clerk with JWT tokens
- **Real-Time Messaging**: WebSocket-based chat using Socket.IO with low-latency delivery
- **AI Tone Conversion**: Automatically rewrite messages into professional, polite, or formal tones using Gemini API
- **Message Queue System**: Async message processing with BullMQ for scalability
- **Presence Detection**: Real-time online/offline status tracking via Redis
- **Typing Indicators**: Live typing status updates
- **Media Handling**: Image uploads to Cloudflare R2 (S3-compatible storage)
- **Push Notifications**: FCM integration for offline/backgrounded users
- **Message Status Tracking**: Delivery and read receipts
- **Rate Limiting**: Per-user message rate limiting for abuse prevention

### Frontend Features
- **Modern Chat UI**: WhatsApp-style responsive layout with dark/light mode
- **Real-Time Updates**: Instant message delivery and presence updates
- **AI Controls**: Toggle AI tone enhancer with preview of original vs converted messages
- **Image Sharing**: Upload, preview, and view images inline
- **Smooth Animations**: Framer Motion for delightful user experience
- **Infinite Scroll**: Efficient message history loading with pagination
- **Unread Badges**: Real-time unread message counters

## 🛠 Tech Stack

### Backend
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Real-time**: Socket.IO
- **Database**: PostgreSQL (Neon)
- **Caching/Queues**: Redis + BullMQ
- **AI**: Google Gemini API
- **Storage**: Cloudflare R2 (S3-compatible)
- **Notifications**: Firebase Cloud Messaging
- **Auth**: Clerk

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **State Management**: Zustand
- **Real-time**: Socket.IO Client
- **HTTP Client**: Axios

## 📦 Project Structure

```
Chat-app/
├── backend/
│   ├── src/
│   │   ├── config/          # Environment configuration
│   │   ├── database/        # PostgreSQL and Redis clients
│   │   ├── middleware/      # Auth, rate limiting, error handling
│   │   ├── routes/          # API endpoints
│   │   ├── services/        # Business logic (AI, storage, notifications)
│   │   ├── socket/          # WebSocket handlers
│   │   ├── workers/         # BullMQ job processors
│   │   ├── utils/           # Logger and utilities
│   │   └── server.ts        # Main server file
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── app/             # Next.js app router
│   │   ├── components/      # React components
│   │   ├── lib/             # API and Socket.IO clients
│   │   └── store/           # Zustand state management
│   ├── Dockerfile
│   ├── package.json
│   └── next.config.js
│
└── docker-compose.yml
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL (or use Docker)
- Redis (or use Docker)
- Clerk account
- Gemini API key
- Cloudflare R2 account
- Firebase project (for FCM)

### Environment Setup

#### Backend (.env)
Create `backend/.env` from `.env.example`:

```env
NODE_ENV=development
PORT=5000
CLIENT_URL=http://localhost:3000

# Database (Neon PostgreSQL)
DATABASE_URL=postgresql://user:password@host.neon.tech:5432/chatapp?sslmode=require

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Clerk
CLERK_SECRET_KEY=sk_test_your_clerk_secret_key
CLERK_PUBLISHABLE_KEY=pk_test_your_clerk_publishable_key

# Gemini AI
GEMINI_API_KEY=your_gemini_api_key

# Cloudflare R2
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_BUCKET_NAME=chat-media
R2_PUBLIC_URL=https://your-r2-public-url.com

# Firebase
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----..."
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
```

#### Frontend (.env)
Create `frontend/.env` from `.env.example`:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_WS_URL=http://localhost:5000

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_clerk_publishable_key
CLERK_SECRET_KEY=sk_test_your_clerk_secret_key

NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/chat
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/chat
```

### Installation

#### Option 1: Docker (Recommended)

```bash
# Clone the repository
git clone <repository-url>
cd Chat-app

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

Access the application:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

#### Option 2: Manual Setup

**Backend:**
```bash
cd backend
npm install
npm run dev        # Development
npm run worker     # Start worker in separate terminal
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## 🏗 Architecture Overview

### System Design

```
┌─────────────┐         ┌─────────────┐
│   Next.js   │◄────────┤   Clerk     │
│  Frontend   │         │   Auth      │
└──────┬──────┘         └─────────────┘
       │
       │ HTTP + WebSocket
       │
┌──────▼──────┐
│   Express   │◄────────► Redis (Presence, Queues)
│   Backend   │
└──────┬──────┘
       │
       ├──────────────► PostgreSQL (Messages)
       │
       ├──────────────► BullMQ Workers (AI Processing)
       │                     │
       │                     ▼
       │                Gemini API (Tone Conversion)
       │
       ├──────────────► Cloudflare R2 (Images)
       │
       └──────────────► Firebase (Push Notifications)
```

### Key Components

1. **Real-Time Communication**: Socket.IO handles WebSocket connections for instant messaging
2. **Message Processing**: BullMQ processes messages asynchronously with AI tone conversion
3. **Presence Tracking**: Redis tracks user online/offline status with heartbeat mechanism
4. **Caching Layer**: Redis caches user data and manages distributed state
5. **Media Storage**: Cloudflare R2 stores uploaded images with CDN delivery
6. **Notifications**: FCM sends push notifications to offline users

## 📚 API Endpoints

### Authentication
- `POST /api/auth/sync` - Sync Clerk user with backend
- `GET /api/auth/me` - Get current user profile

### Users
- `GET /api/users/:userId` - Get user by ID
- `GET /api/users?q=search` - Search users
- `PATCH /api/users/profile` - Update profile
- `GET /api/users/conversations/list` - Get user conversations

### Messages
- `GET /api/messages/conversation/:id` - Get conversation messages
- `POST /api/messages/conversation` - Create/get conversation
- `POST /api/messages/conversation/:id/read` - Mark as read
- `DELETE /api/messages/:id` - Delete message
- `GET /api/messages/unread` - Get unread counts

### Upload
- `POST /api/upload/image` - Upload image
- `DELETE /api/upload/image` - Delete image

### Notifications
- `POST /api/notifications/register-token` - Register FCM token
- `POST /api/notifications/remove-token` - Remove FCM token

## 🔌 Socket.IO Events

### Client → Server
- `join-conversation` - Join conversation room
- `leave-conversation` - Leave conversation room
- `send-message` - Send a message
- `typing-start` - Start typing
- `typing-stop` - Stop typing
- `mark-read` - Mark messages as read
- `heartbeat` - Keep connection alive

### Server → Client
- `new-message` - Receive new message
- `message-sent` - Confirmation of sent message
- `message-error` - Error sending message
- `user-status` - User online/offline status
- `user-typing` - Typing indicator
- `messages-read` - Read receipts

## 🎨 UI Theme

The application features a professional blue and white theme:
- **Primary Color**: Blue (#3b82f6)
- **Light Mode**: White backgrounds with blue accents
- **Dark Mode**: Dark gray backgrounds with blue highlights
- **Animations**: Smooth transitions and micro-interactions

## 📝 Resume-Ready Summary

> Built an AI-powered real-time chat application using **Next.js**, **Node.js**, **WebSockets**, **Redis**, **PostgreSQL**, and **Gemini API**. The system automatically rewrites messages into professional tones before sending, supports image sharing via **Cloudflare R2**, and triggers push notifications via **Firebase Cloud Messaging**. Designed for scalability using **Redis queues**, **async workers (BullMQ)**, and **presence tracking**. Implemented features include typing indicators, read receipts, unread counters, and a responsive UI with dark mode support.

## 🔧 Development

### Backend Scripts
```bash
npm run dev      # Development with hot reload
npm run build    # Build TypeScript
npm run start    # Production server
npm run worker   # Start worker process
```

### Frontend Scripts
```bash
npm run dev      # Development server
npm run build    # Production build
npm run start    # Production server
npm run lint     # ESLint
```

## 🚀 Deployment

### Backend Deployment
1. Set up PostgreSQL database (Neon recommended)
2. Set up Redis instance
3. Configure environment variables
4. Deploy to platform (Vercel, Railway, Heroku, etc.)
5. Start worker process separately

### Frontend Deployment
1. Build Next.js application
2. Configure environment variables
3. Deploy to Vercel or similar platform

## 📄 License

MIT

## 🤝 Contributing

Contributions welcome! Please open an issue or submit a pull request.

## 🙏 Acknowledgments

- Next.js for the amazing framework
- Clerk for authentication
- Google Gemini for AI capabilities
- Cloudflare for R2 storage
- Firebase for push notifications
