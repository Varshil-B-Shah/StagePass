export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  get node_env() { return process.env.NODE_ENV || 'development' },

  database_url: process.env.DATABASE_URL || '',

  dynamo: {
    endpoint: process.env.DYNAMODB_ENDPOINT || undefined,
    region: process.env.AWS_REGION || 'ap-south-1',
    access_key_id: process.env.AWS_ACCESS_KEY_ID || 'local',
    secret_access_key: process.env.AWS_SECRET_ACCESS_KEY || 'local',
    table_prefix: process.env.TABLE_PREFIX || 'dev_',
  },

  redis_url: process.env.UPSTASH_REDIS_URL || '',  // env var renamed from REDIS_URL
  redis_key_prefix: process.env.REDIS_KEY_PREFIX || 'dev:',

  internal_api_secret: process.env.INTERNAL_API_SECRET || '',

  get jwt_secret() { return process.env.JWT_SECRET },
  cognito: {
    region: process.env.COGNITO_REGION || 'ap-south-1',
    user_pool_id: process.env.COGNITO_USER_POOL_ID,
    client_id: process.env.COGNITO_CLIENT_ID,
  },

  ws: {
    mode: (process.env.WS_MODE || 'local') as 'local' | 'sns',
    server_url: process.env.WS_SERVER_URL || 'http://localhost:4000',
  },

  log_level: process.env.LOG_LEVEL || 'info',
}

/** Call once at server startup — throws if required vars are missing. */
export function validateConfig(): void {
  const required: Array<keyof typeof config> = ['database_url', 'redis_url']
  for (const key of required) {
    if (!config[key]) throw new Error(`Missing required env var: ${key.toUpperCase()}`)
  }
}
