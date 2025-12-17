/**
 * Prisma Client for Backend
 * =========================
 * This module provides the Prisma client instance for database operations.
 * Used only on the backend server (Render).
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prismaClientSingleton = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' 
      ? ['query', 'error', 'warn'] 
      : ['error'],
  });
};

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

export const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaGlobal = prisma;
}

// Handle connection errors
prisma.$connect().catch((error) => {
  logger.error('Prisma connection error:', error);
});

export default prisma;
