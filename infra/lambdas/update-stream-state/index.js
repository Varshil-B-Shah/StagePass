const AWS = require('aws-sdk')
const dynamo = new AWS.DynamoDB.DocumentClient()
const TABLE = `${process.env.TABLE_PREFIX || 'dev_'}stream_state`

exports.handler = async (event) => {
  const detailType = event['detail-type']
  const detail = event.detail
  const channelName = detail.channel_name

  console.log('[update-stream-state]', detailType, channelName)

  // Resolve event_id from channel_name via Scan (one channel at Phase 3 scale)
  const scanResult = await dynamo.scan({
    TableName: TABLE,
    FilterExpression: 'channel_name = :name',
    ExpressionAttributeValues: { ':name': channelName },
    ProjectionExpression: 'event_id',
  }).promise()

  if (!scanResult.Items || scanResult.Items.length === 0) {
    console.warn('No stream_state row found for channel_name:', channelName)
    return
  }

  const event_id = scanResult.Items[0].event_id

  if (detailType === 'IVS Stream State Change') {
    if (detail.event_name === 'Stream Start') {
      await dynamo.update({
        TableName: TABLE,
        Key: { event_id },
        UpdateExpression: 'SET #s = :live, went_live_at = :now',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: {
          ':live': 'LIVE',
          ':now': Math.floor(Date.now() / 1000),
        },
      }).promise()
      console.log('Set status=LIVE for', event_id)

    } else if (detail.event_name === 'Stream End') {
      await dynamo.update({
        TableName: TABLE,
        Key: { event_id },
        UpdateExpression: 'SET #s = :ended',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: { ':ended': 'ENDED' },
      }).promise()
      console.log('Set status=ENDED for', event_id)
    }

  } else if (detailType === 'IVS Recording State Change') {
    if (detail.recording_status === 'Recording End') {
      const vodPath = `s3://${detail.recording_s3_bucket_name}/${detail.recording_s3_key_prefix}`
      await dynamo.update({
        TableName: TABLE,
        Key: { event_id },
        UpdateExpression: 'SET #s = :vod, vod_s3_path = :path',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: { ':vod': 'VOD_AVAILABLE', ':path': vodPath },
      }).promise()
      console.log('Set status=VOD_AVAILABLE for', event_id, 'path:', vodPath)
    }
  }
}
