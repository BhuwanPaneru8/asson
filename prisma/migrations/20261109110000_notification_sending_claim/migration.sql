-- A claimed notification moves to SENDING so concurrent dispatchers can't send it twice.
ALTER TYPE "NotificationStatus" ADD VALUE 'SENDING' AFTER 'QUEUED';
ALTER TABLE "Notification" ADD COLUMN "claimedAt" TIMESTAMP(3);
