import { PrismaClient } from '@prisma/client';

/**
 * Prisma client singleton.
 * Optimized for serverless environments (like Neon + Next.js) 
 * where connections might be dropped or pooled.
 */

declare global {
    var prisma: PrismaClient | undefined;
}

// Log configuration for development
const logOptions: any[] = process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'];

export const prisma =
    globalThis.prisma ||
    new PrismaClient({
        log: logOptions,
        // Add connection retry logic for serverless environments
    });

if (process.env.NODE_ENV !== 'production') {
    globalThis.prisma = prisma;
}

export default prisma;
