import AWS from 'aws-sdk'
import { config } from '../config'

let client: AWS.DynamoDB.DocumentClient | null = null

export function getDynamoClient(): AWS.DynamoDB.DocumentClient {
  if (!client) {
    AWS.config.update({
      region: config.aws.region,
      accessKeyId: config.aws.access_key_id,
      secretAccessKey: config.aws.secret_access_key,
    })
    client = new AWS.DynamoDB.DocumentClient()
  }
  return client
}

const TASKS_TABLE = () => `${config.dynamo.table_prefix}payment_tasks`

export interface PaymentTask {
  razorpay_order_id: string
  task_token: string
  booking_id: string
  show_id: string
  expires_at: number
}

export async function savePaymentTask(task: PaymentTask): Promise<void> {
  await getDynamoClient().put({ TableName: TASKS_TABLE(), Item: task }).promise()
}

export async function getPaymentTask(razorpay_order_id: string): Promise<PaymentTask | null> {
  const result = await getDynamoClient().get({
    TableName: TASKS_TABLE(),
    Key: { razorpay_order_id },
  }).promise()
  return (result.Item as PaymentTask) || null
}

export async function deletePaymentTask(razorpay_order_id: string): Promise<void> {
  await getDynamoClient().delete({
    TableName: TASKS_TABLE(),
    Key: { razorpay_order_id },
  }).promise()
}
