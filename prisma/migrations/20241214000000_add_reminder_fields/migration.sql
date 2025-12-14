-- AlterTable
ALTER TABLE "events" ADD COLUMN "reminderMinutesBefore" INTEGER;
ALTER TABLE "events" ADD COLUMN "reminderSentAt" TIMESTAMP(3);
