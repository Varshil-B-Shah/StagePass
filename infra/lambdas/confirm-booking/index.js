const AWS = require('aws-sdk')
const dynamo = new AWS.DynamoDB.DocumentClient()
const TABLE = `${process.env.TABLE_PREFIX || 'dev_'}payment_tasks`

exports.handler = async (event) => {
  const { task_token, input } = event
  if (!task_token || !input?.razorpay_order_id) {
    throw new Error('Missing task_token or razorpay_order_id')
  }
  const expires_at = Math.floor(Date.now() / 1000) + 900  // 15 min TTL
  await dynamo.put({
    TableName: TABLE,
    Item: {
      razorpay_order_id: input.razorpay_order_id,
      task_token,
      booking_id: input.booking_id,
      show_id: input.show_id,
      expires_at,
    },
  }).promise()
  console.log('Task token saved for:', input.razorpay_order_id)
  // Step Functions waits here — resumes when webhook calls SendTaskSuccess
}
