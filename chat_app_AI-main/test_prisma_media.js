const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
    try {
        console.log('--- Models in Prisma Client ---');
        const models = Object.keys(prisma).filter(k => !k.startsWith('_') && typeof prisma[k] === 'object');
        console.log('Available models:', models);

        if (prisma.media) {
            console.log('✅ prisma.media exists!');
        } else {
            console.log('❌ prisma.media DOES NOT exist!');
        }
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await prisma.$disconnect();
    }
}

test();
