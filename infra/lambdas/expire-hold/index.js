const AWS = require('aws-sdk')
const dynamo = new AWS.DynamoDB.DocumentClient()
const SEATS_TABLE = `${process.env.TABLE_PREFIX || 'dev_'}seats`

exports.handler = async (event) => {
  // event may be the Step Functions input or a Catch event wrapper
  const booking_id = event.booking_id || event.input?.booking_id
  const show_id = event.show_id || event.input?.show_id

  if (!booking_id || !show_id) {
    console.error('Missing booking_id or show_id:', JSON.stringify(event))
    return
  }

  // Fetch seat_id from booking-service
  const res = await fetch(
    `${process.env.BOOKING_SERVICE_URL}/api/bookings/${booking_id}`,
    { headers: { 'x-internal-secret': process.env.INTERNAL_API_SECRET } }
  )
  if (!res.ok) { console.error('Cannot fetch booking', booking_id); return }
  const booking = await res.json()
  const seat_id = booking.seats?.[0]
  if (!seat_id) return

  // Conditional write: RESERVED → AVAILABLE
  // If condition fails (already BOOKED or AVAILABLE), it's a no-op
  try {
    await dynamo.update({
      TableName: SEATS_TABLE,
      Key: { PK: show_id, SK: seat_id },
      UpdateExpression: 'SET #s = :avail REMOVE held_by, hold_expires_at, hold_expires_at_ttl',
      ConditionExpression: '#s = :reserved',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: { ':avail': 'AVAILABLE', ':reserved': 'RESERVED' },
    }).promise()
  } catch (err) {
    if (err.code === 'ConditionalCheckFailedException') {
      console.log('Seat already released/confirmed — no-op')
      return
    }
    throw err
  }

  // Mark booking FAILED
  await fetch(`${process.env.BOOKING_SERVICE_URL}/api/bookings/expire`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-internal-secret': process.env.INTERNAL_API_SECRET },
    body: JSON.stringify({ booking_id }),
  })
}
