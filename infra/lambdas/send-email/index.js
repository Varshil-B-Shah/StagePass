const AWS = require('aws-sdk')
const ses = new AWS.SES({ region: process.env.AWS_REGION || 'us-east-1' })

exports.handler = async (event) => {
  const { booking_id, show_id, razorpay_order_id } = event

  const bookingRes = await fetch(
    `${process.env.BOOKING_SERVICE_URL}/api/bookings/${booking_id}`,
    { headers: { 'x-internal-secret': process.env.INTERNAL_API_SECRET } }
  )
  if (!bookingRes.ok) throw new Error(`Cannot fetch booking ${booking_id}`)
  const booking = await bookingRes.json()

  await ses.sendEmail({
    Source: process.env.SES_FROM_EMAIL || 'noreply@stagepass.in',
    Destination: { ToAddresses: [booking.user?.email || booking.email] },
    Message: {
      Subject: { Data: `Booking Confirmed — ${booking_id}` },
      Body: {
        Text: {
          Data: [
            `Your booking is confirmed!`,
            `Booking ID: ${booking_id}`,
            `Show: ${show_id}`,
            `Seats: ${booking.seats?.join(', ')}`,
            `Payment ref: ${razorpay_order_id}`,
          ].join('\n'),
        },
      },
    },
  }).promise()
}
