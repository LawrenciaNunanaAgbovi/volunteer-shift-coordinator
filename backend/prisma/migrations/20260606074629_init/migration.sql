-- CreateEnum
CREATE TYPE "Role" AS ENUM ('volunteer', 'org_admin');

-- CreateEnum
CREATE TYPE "ShiftStatus" AS ENUM ('draft', 'open', 'closed');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('pending', 'approved', 'denied', 'waitlisted');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "skills" TEXT[],
    "availability_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cause_area" TEXT NOT NULL,
    "description" TEXT,
    "logo_url" TEXT,
    "admin_user_id" TEXT NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shift" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "location" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "status" "ShiftStatus" NOT NULL DEFAULT 'draft',
    "ai_generated" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "shift_id" TEXT NOT NULL,
    "volunteer_id" TEXT NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'pending',
    "waitlist_position" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_admin_user_id_key" ON "Organization"("admin_user_id");

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "Shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_volunteer_id_fkey" FOREIGN KEY ("volunteer_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
