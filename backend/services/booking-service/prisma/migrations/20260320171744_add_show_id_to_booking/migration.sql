/*
  Warnings:

  - Added the required column `show_id` to the `Booking` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "show_id" TEXT NOT NULL;
