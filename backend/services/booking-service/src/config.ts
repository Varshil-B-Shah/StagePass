export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  get node_env() { return process.env.NODE_ENV || 'development' },

  // Read lazily — validated at startup via validateConfig()
  database_url: process.env.DATABASE_URL || '',

  dynamo: {
    endpoint: process.env.DYNAMODB_ENDPOINT || undefined,
    region: process.env.AWS_REGION || 'us-east-1',
    access_key_id: process.env.AWS_ACCESS_KEY_ID || 'local',
    secret_access_key: process.env.AWS_SECRET_ACCESS_KEY || 'local',
  },

  redis_url: process.env.REDIS_URL || '',

  get jwt_secret() { return process.env.JWT_SECRET },   // dev only
  cognito: {
    region: process.env.COGNITO_REGION || 'us-east-1',
    user_pool_id: process.env.COGNITO_USER_POOL_ID,
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
