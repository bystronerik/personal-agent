-- AlterTable
ALTER TABLE "users" ADD COLUMN     "delivery_channel" TEXT NOT NULL DEFAULT 'email',
ADD COLUMN     "email" TEXT,
ADD COLUMN     "email_suspended_at" TIMESTAMP(3),
ADD COLUMN     "email_suspended_reason" TEXT,
ADD COLUMN     "email_verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "telegram_chat_id" TEXT;
