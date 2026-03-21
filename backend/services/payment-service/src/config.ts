import 'dotenv/config'

export const config = {
  port: parseInt(process.env.PORT || '3002', 10),
  razorpay: {
    key_id: process.env.RAZORPAY_KEY_ID || '',
    key_secret: process.env.RAZORPAY_KEY_SECRET || '',
    webhook_secret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  },
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    access_key_id: process.env.AWS_ACCESS_KEY_ID || '',
    secret_access_key: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
  step_functions: {
    state_machine_arn: process.env.STEP_FUNCTIONS_STATE_MACHINE_ARN || '',
  },
  dynamo: {
    table_prefix: process.env.TABLE_PREFIX || 'dev_',
  },
  booking_service_url: process.env.BOOKING_SERVICE_URL || 'http://localhost:3001',
  internal_api_secret: process.env.INTERNAL_API_SECRET || '',
}

export function validateConfig(): void {
  const missing: string[] = []
  if (!config.razorpay.key_id) missing.push('RAZORPAY_KEY_ID')
  if (!config.razorpay.key_secret) missing.push('RAZORPAY_KEY_SECRET')
  if (!config.razorpay.webhook_secret) missing.push('RAZORPAY_WEBHOOK_SECRET')
  if (!config.step_functions.state_machine_arn) missing.push('STEP_FUNCTIONS_STATE_MACHINE_ARN')
  if (missing.length) throw new Error(`Missing required env vars: ${missing.join(', ')}`)
}
