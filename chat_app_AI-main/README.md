# AI Chat App - Serverless

A modern, serverless chat application built with Next.js, Firebase Realtime Database, and Google Gemini AI.

## Features

- 🔒 **Secure Authentication** - Powered by Clerk
- 🤖 **AI-Powered Messaging** - Professional tone conversion with Google Gemini
- ⚡ **Real-time Sync** - Instant message updates via Firebase Realtime Database
- 🎭 **Role-Based Content** - Different message views for admins, senders, and receivers
- 📱 **Push Notifications** - Firebase Cloud Messaging (FCM) support
- 🚀 **Fully Serverless** - Deploy to Vercel with zero configuration

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Authentication**: Clerk
- **Database**: PostgreSQL (via Prisma)
- **Real-time**: Firebase Realtime Database
- **AI**: Google Gemini
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Deployment**: Vercel

## Project Structure

```
.
├── src/
│   ├── app/                    # Next.js app router pages
│   │   ├── api/                # API routes (serverless functions)
│   │   │   ├── send-message/   # Send message with AI processing
│   │   │   ├── messages/       # Get message history
│   │   │   └── ...
│   │   ├── chat/               # Chat page
│   │   └── ...
│   ├── components/             # React components
│   │   └── chat/               # Chat-specific components
│   ├── lib/                    # Utility libraries
│   │   ├── firebase-admin.ts   # Firebase Admin SDK
│   │   ├── firebaseClient.ts   # Firebase Client SDK
│   │   ├── ai.service.ts       # Gemini AI service
│   │   └── prisma.ts           # Prisma client
│   └── store/                  # Zustand state management
├── prisma/                     # Database schema
├── public/                     # Static assets
└── ...
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL database
- Firebase project with Realtime Database enabled
- Clerk account
- Google Gemini API key

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd chat_app_AI-main
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Copy `.env.example` to `.env.local` and fill in your credentials:
   ```bash
   cp .env.example .env.local
   ```
   
   See `vercel-environment-variables.md` for the complete list of required variables.

4. **Set up the database**
   ```bash
   npx prisma generate
   npx prisma migrate deploy
   ```

5. **Configure Firebase**
   - Create a Firebase project at https://console.firebase.google.com
   - Enable Realtime Database
   - Download service account key (Settings → Service accounts)
   - Apply security rules from `firebase-database-rules.json`

6. **Run the development server**
   ```bash
   npm run dev
   ```
   
   Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deployment

### Deploy to Vercel

1. **Push your code to GitHub**

2. **Import to Vercel**
   - Go to https://vercel.com
   - Import your GitHub repository
   - Vercel will auto-detect Next.js

3. **Add environment variables**
   - In your Vercel project, go to Settings → Environment Variables
   - Add all variables from `.env.local`
   - See `vercel-environment-variables.md` for the complete list

4. **Deploy**
   - Vercel will automatically deploy on push to main
   - Your app will be live at `your-project.vercel.app`

## How It Works

### Message Flow

1. **User sends a message** → API route `/api/send-message`
2. **Authenticate** with Clerk
3. **AI processing** with Google Gemini (professional tone conversion)
4. **Save to database** (Prisma/PostgreSQL for persistence)
5. **Publish to Firebase** (Realtime Database for instant sync)
6. **Real-time listeners** update all clients instantly

### Role-Based Content

- **Sender**: Sees their original message
- **Receiver**: Sees AI-refined professional version
- **Admin**: Sees ONLY original content for all messages

### Real-time Sync

Firebase Realtime Database handles WebSocket connections:
```typescript
messages/
  -{timestamp}/
    id: string
    sender_id: string
    sender_username: string
    content: string          // AI-refined
    original_content: string // Original
    timestamp: number
```

## Documentation

- **[Walkthrough](docs/walkthrough.md)** - Implementation details
- **[Environment Variables](docs/vercel-environment-variables.md)** - Configuration guide
- **[Firebase Rules](docs/firebase-database-rules.json)** - Database security

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## License

MIT

## Support

For issues and questions, please open an issue on GitHub.
