-- AlterTable
-- Refunds are raised against the Razorpay payment, not the order, so the payment
-- id is stored as soon as capture is confirmed. refund_id doubles as the
-- idempotency guard: a booking that already has one is never refunded again.
ALTER TABLE "Booking" ADD COLUMN     "razorpay_payment_id" TEXT,
                      ADD COLUMN     "refund_id" TEXT,
                      ADD COLUMN     "refund_status" TEXT;

-- Compensation looks a booking up by refund id when the settlement webhook lands.
CREATE UNIQUE INDEX "Booking_refund_id_key" ON "Booking"("refund_id");
