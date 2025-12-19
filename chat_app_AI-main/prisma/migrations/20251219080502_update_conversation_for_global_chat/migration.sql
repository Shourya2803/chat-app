-- DropIndex
DROP INDEX "conversations_user1_id_user2_id_key";

-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "name" TEXT,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'DIRECT',
ALTER COLUMN "user1_id" DROP NOT NULL,
ALTER COLUMN "user2_id" DROP NOT NULL;
