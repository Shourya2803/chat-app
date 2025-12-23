# 🤖 AI-Powered Professional Chat Application

[![Next.js](https://img.shields.io/badge/Next.js-14-blue?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?style=flat-square&logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql)](https://www.postgresql.org/)
[![Clerk](https://img.shields.io/badge/Auth-Clerk-6C47FF?style=flat-square&logo=clerk)](https://clerk.com/)

A production-ready, full-stack real-time chat application featuring **AI-powered message tone conversion**. Built with a serverless-first architecture using Next.js 14, this application transforms casual messages into professional communication in real-time.

---

## 🧩 Project Overview
This project solves the challenge of maintaining professional communication in fast-paced corporate environments. By integrating **Google Gemini AI**, the application automatically refines message tone to be professional, polite, and concise, while allowing users to see both original and refined versions based on permissions.

**Primary Goals:**
- 📧 **Professionalism**: Auto-correcting tone for corporate communication.
- ⚡ **Real-time**: Near-instant message delivery and synchronization.
- 📱 **Omnichannel**: Desktop and mobile responsive with push notification support.
- 🔒 **Secure**: Enterprise-grade authentication and data persistence.

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + Framer Motion (Animations)
- **State Management**: Zustand
- **Icons**: Lucide React

### Backend & Infrastructure
- **Server**: Next.js API Routes (Serverless)
- **Database**: PostgreSQL (via Prisma ORM)
- **Real-time Sync**: Firebase Realtime Database
- **Caching**: Redis (ioredis) for high-frequency message access
- **AI Engine**: Google Gemini API (@google/generative-ai)
- **Media Storage**: Cloudinary (Image uploads)
- **Authentication**: Clerk Auth

---

## ⚙️ Workflow Architecture

The application follows a modern serverless event-driven architecture.

```mermaid
flowchart TD
    User([User Client]) -->|1. Submit Message| API[Next.js API Route /send-message]
    API -->|2. Refine Tone| Gemini[Google Gemini AI]
    Gemini -->|3. Return Professional Text| API
    API -->|4. Persist| DB[(PostgreSQL / Prisma)]
    API -->|5. Sync| Firebase[Firebase Realtime DB]
    API -->|6. Cache| Redis[(Redis Caching)]
    Firebase -->|7. Real-time Update| OtherUsers([Connected Clients])
    API -.->|8. Push Notification| FCM[Firebase Cloud Messaging]
```

---

## 🔥 Firebase Integration
Firebase is a critical backbone for the real-time experience:
- **Realtime Database**: Handles instant message synchronization across active clients without maintaining long-lived WebSocket connections manually.
- **Cloud Messaging (FCM)**: Delivers push notifications to offline users.
- **Service Worker**: A custom `firebase-messaging-sw.js` handles background notifications even when the tab is closed.

**Setup Highlights:**
- **VAPID Keys**: Used for browser-to-FCM authentication.
- **Admin SDK**: Securely updates the Realtime Database and triggers notifications from the server-side API.

---

## 🚀 Features
- ✅ **AI Tone Conversion**: Automatically converts messages to a professional tone using Gemini AI.
- ✅ **Real-time Synchronization**: Instant chat updates via Firebase integration.
- ✅ **Media Sharing**: Seamless image uploads powered by Cloudinary.
- ✅ **Optimistic UI**: Messages appear instantly on the sender's side for a zero-latency feel.
- ✅ **Redis Caching**: Top 10 messages from the global chat are cached in Redis for ultra-fast initial loads.
- ✅ **Unread Counters**: Real-time unread message tracking for all conversations.
- ✅ **Push Notifications**: Never miss a message with integrated browser notifications.
- ✅ **Modern UI**: Polished blue/white corporate theme with light/dark mode support.

---

## 🔧 Installation

Follow these steps to set up the project locally:

### 1. Clone the Repository
```bash
git clone https://github.com/Shourya2803/chat-app-ai.git
cd chat-app-ai
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
Create a `.env.local` file in the root directory and add the following:

```env
# Clerk Auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
CLERK_SECRET_KEY=...

# Database
DATABASE_URL=postgresql://user:pass@host:port/dbname

# Redis
REDIS_URL=redis://...

# Gemini AI
GEMINI_API_KEY=...

# Cloudinary
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# Firebase (Client & Admin)
NEXT_PUBLIC_FIREBASE_API_KEY=...
FIREBASE_PROJECT_ID=...
FIREBASE_PRIVATE_KEY="..."
FIREBASE_CLIENT_EMAIL=...
```

### 4. Database Setup
```bash
npx prisma generate
npx prisma db push
```

### 5. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to see the application.

---

## 📚 Folder Structure
```text
src/
 ├── app/                  # Next.js App Router (Pages & API)
 │   ├── api/              # Serverless API endpoints
 │   ├── chat/             # Main Chat Interface
 │   └── layout.tsx        # Root layout with providers
 ├── components/           # Reusable UI Components
 │   ├── chat/             # MessageList, MessageInput, etc.
 │   └── ui/               # Primary UI building blocks
 ├── lib/                  # Service initializations (Prisma, Firebase, AI)
 ├── store/                # Zustand State Management
 ├── types/                # TypeScript interfaces
 └── middleware.ts         # Clerk Auth middleware
prisma/                    # Database schema and migrations
public/                    # Static assets & Service Workers
```

---

## 🧠 Project Approach
This application was built with a **Serverless-First** mindset to minimize infrastructure overhead while maximizing scalability.

1. **Architecture Decision**: Instead of a traditional monolithic Socket.IO server, we utilized **Firebase Realtime Database** for sync. This allows the backend to remain entirely stateless (deployable to Vercel/Next.js) while maintaining real-time features.
2. **AI Integration**: Tone conversion is handled at the API level during the message-send lifecycle. We use **Promise.race** with a timeout to ensure that AI processing doesn't hang the message delivery if the Gemini API is latent.
3. **Caching Strategy**: Redis is used specifically for the "Global Group Chat" to store the most recent conversation segment, reducing database hits during peak activity.

---

## 🌐 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/messages` | Fetch conversation history (Redis + DB) |
| `POST` | `/api/send-message` | Send message with AI tone conversion |
| `POST` | `/api/upload/image` | Upload media to Cloudinary |
| `GET` | `/api/users/me` | Fetch current user profile |
| `GET` | `/api/health` | Service health status check |

**Sample Message Payload:**
```json
{
  "content": "hey can u send me the report asap",
  "mediaUrl": null
}
```
**AI Output:** *"Greetings, could you please forward the report to me at your earliest convenience?"*

---

## 🧩 Workflows (CI/CD)
The project is optimized for **Vercel** deployment:
- **Branching**: `main` for production, `develop` for features.
- **CI**: Automated linting and type-checking on every Push/PR via GitHub Actions.
- **CD**: Auto-deployment to Vercel upon merging to `main`.

---

## 🧪 Testing
- **API Testing**: Validated using Postman and locally written test scripts in `/scripts`.
- **UI Testing**: Manual verification of real-time sync across multiple browser instances.
- **Database**: Prisma Studio used for real-time data inspection.

---

## 🧑‍💻 Contribution Guide
1. **Fork** the repository.
2. **Create a Feature Branch** (`git checkout -b feature/AmazingFeature`).
3. **Commit** your changes with clear messages (`git commit -m 'feat: add amazing feature'`).
4. **Push** to the branch.
5. **Open a Pull Request**.

---

## 🔒 Environment Variables
Please refer to [.env.example](.env.example) for a complete list of required configuration keys. All client-side variables must be prefixed with `NEXT_PUBLIC_`.

---

## 📦 Deployment
The application is designed to be hosted on **Vercel** with a managed **PostgreSQL** (e.g., Neon) and **Redis** (e.g., Upstash).

1. Connect your GitHub repo to Vercel.
2. Add all Environment Variables in the Vercel Dashboard.
3. Deploy!

---

## 📸 Screenshots / Demo
> [!NOTE]
> Add Your App Screenshots Or Demo GIF Here!

---

## 📅 Roadmap
- [ ] Group chat creation UI.
- [ ] Message reactions (backend schema ready).
- [ ] Voice message support.
- [ ] Read receipts visualization across all devices.

---

## 🧾 License
This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.

---
*Built with ❤️ by [Shourya](https://github.com/Shourya2803)*
