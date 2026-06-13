-- CreateEnum
CREATE TYPE "ShiftCategory" AS ENUM ('food', 'education', 'environment', 'health', 'animals', 'arts', 'community', 'sports', 'other');

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "position_id" TEXT;

-- AlterTable
ALTER TABLE "Shift" ADD COLUMN     "category" "ShiftCategory" NOT NULL DEFAULT 'other',
ADD COLUMN     "contact_email" TEXT,
ADD COLUMN     "contact_name" TEXT,
ADD COLUMN     "duration" INTEGER,
ADD COLUMN     "end_time" TEXT,
ADD COLUMN     "is_recurring" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requirements" TEXT,
ADD COLUMN     "start_time" TEXT,
ADD COLUMN     "what_to_bring" TEXT;

-- CreateTable
CREATE TABLE "ShiftPosition" (
    "id" TEXT NOT NULL,
    "shift_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "capacity" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShiftPosition_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ShiftPosition" ADD CONSTRAINT "ShiftPosition_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "ShiftPosition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
