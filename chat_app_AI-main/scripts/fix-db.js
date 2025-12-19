const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('🚀 Starting manual database fix...');

        // 1. Create the enum if it doesn't exist
        console.log('Creating UserRole enum type...');
        try {
            await prisma.$executeRawUnsafe(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserRole') THEN
            CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');
          END IF;
        END$$;
      `);
            console.log('✅ UserRole enum checked/created');
        } catch (e) {
            console.error('⚠️ Could not create enum (it might already exist in a different schema):', e.message);
        }

        // 2. Add the column to the users table
        console.log('Adding role column to users table...');
        try {
            await prisma.$executeRawUnsafe(`
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" "UserRole" DEFAULT 'USER';
      `);
            console.log('✅ Role column checked/added');
        } catch (e) {
            console.error('❌ Could not add role column:', e.message);
        }

        console.log('🎉 Manual fix sequence complete.');
    } catch (error) {
        console.error('❌ Critical failure in fix script:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
