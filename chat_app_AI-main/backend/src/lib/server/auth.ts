import { prisma } from '../prisma';

export async function getUserRole(clerkId: string): Promise<'ADMIN' | 'USER'> {
    const user = await (prisma.user as any).findUnique({
        where: { clerkId },
        select: { role: true }
    });
    // Since we use Role enum, it will be 'ADMIN' or 'USER' (uppercase in Prisma)
    // Converting to string for flexibility if needed, but the Enum is better.
    return (user as any)?.role || 'USER';
}
