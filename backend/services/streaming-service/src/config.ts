export const config = {
  port: parseInt(process.env.PORT || '3003', 10),
  get node_env() { return process.env.NODE_ENV || 'development' },

  dynamo: {
    region: process.env.AWS_REGION || 'us-east-1',
    access_key_id: process.env.AWS_ACCESS_KEY_ID || '',
    secret_access_key: process.env.AWS_SECRET_ACCESS_KEY || '',
    table_prefix: process.env.TABLE_PREFIX || 'dev_',
  },

  database_url: process.env.DATABASE_URL || '',

  cognito: {
    region: process.env.COGNITO_REGION || 'us-east-1',
    user_pool_id: process.env.COGNITO_USER_POOL_ID || '',
  },

  livekit: {
    api_key: process.env.LIVEKIT_API_KEY || '',
    api_secret: process.env.LIVEKIT_API_SECRET || '',
    url: process.env.LIVEKIT_URL || '',
  },
}

export function validateConfig(): void {
  const missing: string[] = []
  if (!config.database_url) missing.push('DATABASE_URL')
  if (!config.dynamo.access_key_id) missing.push('AWS_ACCESS_KEY_ID')
  if (!config.dynamo.secret_access_key) missing.push('AWS_SECRET_ACCESS_KEY')
  if (!config.livekit.api_key) missing.push('LIVEKIT_API_KEY')
  if (!config.livekit.api_secret) missing.push('LIVEKIT_API_SECRET')
  if (!config.livekit.url) missing.push('LIVEKIT_URL')
  if (missing.length > 0) throw new Error(`Missing required env vars: ${missing.join(', ')}`)
}
